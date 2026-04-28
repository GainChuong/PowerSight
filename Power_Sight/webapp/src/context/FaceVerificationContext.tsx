'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useTracking } from './TrackingContext';
import { useAuth } from './AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type VerificationPhase = 'idle' | 'notifying' | 'scanning' | 'success' | 'fail';

interface FaceVerificationContextType {
  phase: VerificationPhase;
  isPausedForVerification: boolean;
  lastResult: { match: boolean; distance: number } | null;
  modelsReady: boolean;
  triggerVerification: () => void;
  confirmVerification: () => void;
}

// ─── Timing Config ────────────────────────────────────────────────────────────
const FIRST_CHECK_MS  = 5 * 1000;           // 5 giây sau khi đăng nhập (dùng để test)
const RANDOM_MIN_MS   = 3 * 60 * 1000;      // Tối thiểu 3 phút
const RANDOM_MAX_MS   = 8 * 60 * 1000;      // Tối đa 8 phút
const RETRY_MS        = 60 * 1000;          // Thử lại sau 1 phút nếu thất bại

function randomInterval(): number {
  return Math.floor(Math.random() * (RANDOM_MAX_MS - RANDOM_MIN_MS + 1)) + RANDOM_MIN_MS;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const FaceVerificationContext = createContext<FaceVerificationContextType | undefined>(undefined);

export function FaceVerificationProvider({ children }: { children: ReactNode }) {
  const { isRunning, pauseForVerification, resumeAfterVerification } = useTracking();
  const { isAuthenticated, employeeId } = useAuth();

  const [phase, setPhase] = useState<VerificationPhase>('idle');
  const [isPausedForVerification, setIsPausedForVerification] = useState(false);
  const [lastResult, setLastResult] = useState<{ match: boolean; distance: number } | null>(null);
  const [modelsReady, setModelsReady] = useState(false);

  // Refs to avoid stale closures
  const schedulerRef         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef             = useRef<VerificationPhase>('idle');
  const isRunningRef         = useRef(false);
  const isAuthRef            = useRef(false);
  const wasTimerRunningRef   = useRef(false);
  const isFirstCheckRef      = useRef(true);

  useEffect(() => { phaseRef.current = phase; },          [phase]);
  useEffect(() => { isRunningRef.current = isRunning; },  [isRunning]);
  useEffect(() => { isAuthRef.current = isAuthenticated; }, [isAuthenticated]);

  // ── Load face-api models ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { loadFaceApi } = await import('@/lib/tracking/faceUtils');
        await loadFaceApi();
        if (!cancelled) setModelsReady(true);
      } catch (err) {
        console.error('[FaceVerification] Failed to load models:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Clear scheduler ───────────────────────────────────────────────────────
  const clearScheduler = useCallback(() => {
    if (schedulerRef.current) {
      clearTimeout(schedulerRef.current);
      schedulerRef.current = null;
    }
  }, []);

  // ── Show notification to user ─────────────────────────────────────────────
  const triggerNotification = useCallback(() => {
    if (phaseRef.current !== 'idle') return;
    wasTimerRunningRef.current = isRunningRef.current;
    if (isRunningRef.current) {
      pauseForVerification();
      setIsPausedForVerification(true);
    }
    setPhase('notifying');
  }, [pauseForVerification]);

  // ── Schedule next check ───────────────────────────────────────────────────
  const scheduleNext = useCallback((delayMs?: number) => {
    clearScheduler();
    const isFirst = isFirstCheckRef.current;
    const delay = delayMs ?? (isFirst ? FIRST_CHECK_MS : randomInterval());
    if (isFirst) isFirstCheckRef.current = false;

    console.log(`[FaceVerification] Next check in ${Math.round(delay / 1000)}s`);

    schedulerRef.current = setTimeout(async () => {
      if (!isAuthRef.current) return;
      try {
        const { isFaceRegistered } = await import('@/lib/tracking/faceUtils');
        if (!isFaceRegistered()) return;
        triggerNotification();
      } catch { /* ignore */ }
    }, delay);
  }, [clearScheduler, triggerNotification]);

  // ── Start/stop scheduling based on auth state ─────────────────────────────
  useEffect(() => {
    if (isAuthenticated && modelsReady) {
      isFirstCheckRef.current = true;
      scheduleNext(FIRST_CHECK_MS);
    } else if (!isAuthenticated) {
      clearScheduler();
      if (phaseRef.current !== 'idle') {
        setPhase('idle');
        setIsPausedForVerification(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, modelsReady]);

  // ── User clicks "Cho phép" → start scanning ───────────────────────────────
  const confirmVerification = useCallback(() => {
    setPhase('scanning');
  }, []);

  // ── Handle scan result ────────────────────────────────────────────────────
  const handleVerificationComplete = useCallback((result: { match: boolean; distance: number }) => {
    console.log('[FaceVerification] Result:', result);
    setLastResult(result);

    if (result.match) {
      console.log('[FaceVerification] ✅ MATCH - no violation logged');
      setPhase('success');
      setTimeout(() => {
        setPhase('idle');
        setIsPausedForVerification(false);
        if (wasTimerRunningRef.current) resumeAfterVerification();
        scheduleNext();
      }, 2000);
    } else {
      console.log('[FaceVerification] ❌ MISMATCH - logging violation...');
      setPhase('fail');

      // Ghi vi phạm vào file Excel
      const similarity = result.distance < 999 ? Math.max(0, 1 - result.distance) : 0;
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm   = (now.getMonth() + 1).toString().padStart(2, '0');
      const dd   = now.getDate().toString().padStart(2, '0');
      const violationPayload = {
        employeeId: employeeId || 'EM001',
        sessionId: `SESS_LIVE_${yyyy}${mm}${dd}`,
        details: `Face verification failed - Similarity: ${similarity.toFixed(3)}`,
        similarity,
      };
      console.log('[FaceVerification] Posting violation:', violationPayload);
      fetch('/api/tracker/violation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(violationPayload),
      }).then(async res => {
        const body = await res.json();
        console.log('[FaceVerification] Violation API response:', res.status, body);
      }).catch(err => console.warn('[FaceVerification] Error logging violation:', err));

      // Sau 3 giây xóa UI fail, giữ timer đã dừng, thử lại sau 1 phút
      setTimeout(() => {
        if (phaseRef.current === 'fail') {
          setPhase('idle');
          scheduleNext(RETRY_MS);
        }
      }, 3000);
    }
  }, [resumeAfterVerification, scheduleNext, employeeId]);

  // ── Manual trigger (testing) ──────────────────────────────────────────────

  const triggerVerification = useCallback(() => {
    if (!modelsReady || !isAuthRef.current) return;
    clearScheduler();
    triggerNotification();
  }, [modelsReady, clearScheduler, triggerNotification]);

  useEffect(() => () => clearScheduler(), [clearScheduler]);

  return (
    <FaceVerificationContext.Provider
      value={{ phase, isPausedForVerification, lastResult, modelsReady, triggerVerification, confirmVerification }}
    >
      {children}
      {phase !== 'idle' && (
        <FaceVerificationModal
          phase={phase}
          lastResult={lastResult}
          onConfirm={confirmVerification}
          onVerificationComplete={handleVerificationComplete}
        />
      )}
    </FaceVerificationContext.Provider>
  );
}

export function useFaceVerification() {
  const ctx = useContext(FaceVerificationContext);
  if (!ctx) throw new Error('useFaceVerification must be used within FaceVerificationProvider');
  return ctx;
}

// ─── Modal Component ──────────────────────────────────────────────────────────
interface ModalProps {
  phase: VerificationPhase;
  lastResult: { match: boolean; distance: number } | null;
  onConfirm: () => void;
  onVerificationComplete: (result: { match: boolean; distance: number }) => void;
}

function FaceVerificationModal({ phase, lastResult, onConfirm, onVerificationComplete }: ModalProps) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const scannedRef    = useRef(false);

  // Khi chuyển sang scanning → mở camera và quét
  useEffect(() => {
    if (phase !== 'scanning' || scannedRef.current) return;
    scannedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const { startWebcam, detectFaceDescriptor, getStoredFace, compareFaces, stopWebcam } =
          await import('@/lib/tracking/faceUtils');

        if (!videoRef.current || cancelled) return;
        const stream = await startWebcam(videoRef.current);
        streamRef.current = stream;

        await new Promise(r => setTimeout(r, 1500)); // để camera ổn định
        if (cancelled) { stopWebcam(stream); return; }

        let bestResult: { match: boolean; distance: number } | null = null;
        for (let i = 0; i < 3; i++) {
          if (cancelled) break;
          const descriptor = await detectFaceDescriptor(videoRef.current!);
          const stored     = getStoredFace();
          if (descriptor && stored) {
            const r = compareFaces(stored, descriptor);
            if (!bestResult || r.distance < bestResult.distance) bestResult = r;
            if (r.match) break;
          }
          await new Promise(r => setTimeout(r, 500));
        }

        stopWebcam(stream);
        streamRef.current = null;
        if (!cancelled) onVerificationComplete(bestResult ?? { match: false, distance: 999 });
      } catch (err) {
        console.error('[FaceVerification] Scan error:', err);
        if (!cancelled) onVerificationComplete({ match: false, distance: 999 });
      }
    })();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [phase, onVerificationComplete]);

  useEffect(() => {
    if (phase !== 'scanning') scannedRef.current = false;
  }, [phase]);

  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fvFadeIn 0.3s ease-out',
    }}>
      <div style={{
        background: 'rgba(15, 23, 42, 0.98)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '24px', padding: '40px',
        maxWidth: '480px', width: '90%',
        textAlign: 'center',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
      }}>

        {/* ── Thông báo – chờ người dùng xác nhận ── */}
        {phase === 'notifying' && (
          <>
            <div style={{
              width: '80px', height: '80px', margin: '0 auto 20px',
              borderRadius: '50%',
              background: 'rgba(245,158,11,0.12)',
              border: '2px solid rgba(245,158,11,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'fvPulse 1.5s infinite',
            }}>
              <span style={{ fontSize: '2.2rem' }}>🔐</span>
            </div>
            <h2 style={{ color: '#f59e0b', margin: '0 0 12px', fontSize: '1.4rem' }}>
              Xác minh danh tính
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', margin: '0 0 8px', lineHeight: 1.7, fontSize: '0.95rem' }}>
              Hệ thống yêu cầu xác minh khuôn mặt định kỳ để đảm bảo an toàn.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.45)', margin: '0 0 28px', fontSize: '0.85rem' }}>
              ⏸ Thời gian làm việc đang tạm dừng
            </p>
            <button
              onClick={onConfirm}
              style={{
                width: '100%', padding: '14px 24px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none', borderRadius: '12px',
                color: 'white', fontWeight: 700, fontSize: '1rem',
                cursor: 'pointer', letterSpacing: '0.02em',
                boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              📷 Cho phép quét khuôn mặt
            </button>
          </>
        )}

        {/* ── Đang quét ── */}
        {phase === 'scanning' && (
          <>
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <video
                ref={videoRef}
                autoPlay muted playsInline
                style={{
                  width: '100%', maxWidth: '320px',
                  borderRadius: '16px',
                  border: '2px solid var(--accent-primary, #3b82f6)',
                  boxShadow: '0 0 30px rgba(59,130,246,0.3)',
                  display: 'block', margin: '0 auto',
                }}
              />
              {/* Scan line animation */}
              <div style={{
                position: 'absolute', left: '10%', right: '10%', height: '2px',
                background: 'var(--accent-primary, #3b82f6)',
                boxShadow: '0 0 10px var(--accent-primary, #3b82f6)',
                animation: 'fvScanLine 2s ease-in-out infinite',
                top: '20%',
              }} />
            </div>
            <h2 style={{ color: 'var(--accent-primary, #3b82f6)', margin: '0 0 8px', fontSize: '1.3rem' }}>
              Đang quét khuôn mặt...
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: '0.9rem' }}>
              Vui lòng nhìn thẳng vào camera
            </p>
          </>
        )}

        {/* ── Thành công ── */}
        {phase === 'success' && (
          <>
            <div style={{
              width: '80px', height: '80px', margin: '0 auto 20px',
              borderRadius: '50%',
              background: 'rgba(16,185,129,0.12)',
              border: '2px solid #10b981',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '2.2rem' }}>✅</span>
            </div>
            <h2 style={{ color: '#10b981', margin: '0 0 12px', fontSize: '1.4rem' }}>
              Xác minh thành công!
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.6 }}>
              Danh tính đã được xác nhận. Tiếp tục làm việc...
            </p>
            {lastResult && (
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', marginTop: '10px' }}>
                Độ tương đồng: {Math.max(0, Math.round((1 - lastResult.distance) * 100))}%
              </p>
            )}
          </>
        )}

        {/* ── Thất bại ── */}
        {phase === 'fail' && (
          <>
            <div style={{
              width: '80px', height: '80px', margin: '0 auto 20px',
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.12)',
              border: '2px solid #ef4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '2.2rem' }}>❌</span>
            </div>
            <h2 style={{ color: '#ef4444', margin: '0 0 12px', fontSize: '1.4rem' }}>
              Xác minh thất bại!
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', margin: '0 0 12px', lineHeight: 1.6 }}>
              Không thể xác nhận danh tính. Vi phạm đã được ghi nhận.
            </p>
            <p style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: 600 }}>
              ⏸ Thời gian làm việc tạm dừng — hệ thống sẽ thử lại sau 1 phút
            </p>
            {lastResult && lastResult.distance < 999 && (
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', marginTop: '10px' }}>
                Độ tương đồng: {Math.max(0, Math.round((1 - lastResult.distance) * 100))}%
              </p>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes fvFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes fvPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.06); opacity: 0.75; }
        }
        @keyframes fvScanLine {
          0%   { top: 10%; }
          50%  { top: 80%; }
          100% { top: 10%; }
        }
      `}</style>
    </div>
  );
}

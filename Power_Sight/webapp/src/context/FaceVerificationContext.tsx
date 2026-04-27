'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useTracking } from './TrackingContext';

type VerificationPhase = 'idle' | 'warning' | 'scanning' | 'success' | 'fail';

interface FaceVerificationContextType {
  phase: VerificationPhase;
  isPausedForVerification: boolean;
  warningCountdown: number;
  lastResult: { match: boolean; distance: number } | null;
  modelsReady: boolean;
  triggerVerification: () => void;
}

const FaceVerificationContext = createContext<FaceVerificationContextType | undefined>(undefined);

const RANDOM_MIN_MS = 1000;  // 1 second
const RANDOM_MAX_MS = 3000; // 3 seconds
const RETRY_MS = 1000;       // 1 second on failure
const WARNING_SECONDS = 5;     // 5-second countdown before scanning

function randomInterval(): number {
  return Math.floor(Math.random() * (RANDOM_MAX_MS - RANDOM_MIN_MS + 1)) + RANDOM_MIN_MS;
}

export function FaceVerificationProvider({ children }: { children: ReactNode }) {
  const { isRunning, pauseForVerification, resumeAfterVerification } = useTracking();

  const [phase, setPhase] = useState<VerificationPhase>('idle');
  const [isPausedForVerification, setIsPausedForVerification] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(WARNING_SECONDS);
  const [lastResult, setLastResult] = useState<{ match: boolean; distance: number } | null>(null);
  const [modelsReady, setModelsReady] = useState(false);

  const schedulerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);
  const phaseRef = useRef<VerificationPhase>('idle');

  // Keep refs in sync
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Load face-api models once on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { loadFaceApi, isFaceRegistered } = await import('@/lib/tracking/faceUtils');
        await loadFaceApi();
        if (!cancelled) setModelsReady(true);
      } catch (err) {
        console.error('[FaceVerification] Failed to load models:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Clear all timers helper
  const clearAllTimers = useCallback(() => {
    if (schedulerRef.current) {
      clearTimeout(schedulerRef.current);
      schedulerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Schedule next verification
  const scheduleNext = useCallback((delayMs?: number) => {
    clearAllTimers();
    const delay = delayMs ?? randomInterval();

    schedulerRef.current = setTimeout(() => {
      if (!isRunningRef.current) return;
      // Start warning phase
      setPhase('warning');
      setIsPausedForVerification(true);
      setWarningCountdown(WARNING_SECONDS);
      pauseForVerification();

      let countdown = WARNING_SECONDS;
      countdownRef.current = setInterval(() => {
        countdown -= 1;
        setWarningCountdown(countdown);
        if (countdown <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          setPhase('scanning');
        }
      }, 1000);
    }, delay);
  }, [clearAllTimers, pauseForVerification]);

  // When tracking starts/stops, manage scheduling
  useEffect(() => {
    if (isRunning && modelsReady && phase === 'idle') {
      // Check if face is registered before scheduling
      (async () => {
        const { isFaceRegistered } = await import('@/lib/tracking/faceUtils');
        if (isFaceRegistered()) {
          scheduleNext();
        }
      })();
    } else if (!isRunning) {
      clearAllTimers();
      if (phase !== 'idle') {
        setPhase('idle');
        setIsPausedForVerification(false);
      }
    }
  }, [isRunning, modelsReady]);

  // Handle verification result
  const handleVerificationComplete = useCallback((result: { match: boolean; distance: number }) => {
    setLastResult(result);

    if (result.match) {
      setPhase('success');
      // Auto-dismiss after 2 seconds and resume
      setTimeout(() => {
        setPhase('idle');
        setIsPausedForVerification(false);
        resumeAfterVerification();
        scheduleNext(); // random 1-3 min
      }, 2000);
    } else {
      setPhase('fail');
      // Keep paused. Schedule retry in 1 min
      setTimeout(() => {
        if (phaseRef.current === 'fail') {
          scheduleNext(RETRY_MS);
        }
      }, 3000); // Show fail message for 3s, then go idle, then retry in 1 min
      setTimeout(() => {
        if (phaseRef.current === 'fail') {
          setPhase('idle');
        }
      }, 3000);
    }
  }, [resumeAfterVerification, scheduleNext]);

  // Manual trigger for testing
  const triggerVerification = useCallback(() => {
    if (!isRunningRef.current || !modelsReady) return;
    clearAllTimers();
    setPhase('warning');
    setIsPausedForVerification(true);
    setWarningCountdown(WARNING_SECONDS);
    pauseForVerification();

    let countdown = WARNING_SECONDS;
    countdownRef.current = setInterval(() => {
      countdown -= 1;
      setWarningCountdown(countdown);
      if (countdown <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;
        setPhase('scanning');
      }
    }, 1000);
  }, [clearAllTimers, modelsReady, pauseForVerification]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  return (
    <FaceVerificationContext.Provider
      value={{
        phase,
        isPausedForVerification,
        warningCountdown,
        lastResult,
        modelsReady,
        triggerVerification,
      }}
    >
      {children}
      {/* The modal reads context internally */}
      {phase !== 'idle' && (
        <FaceVerificationModalInner
          phase={phase}
          warningCountdown={warningCountdown}
          lastResult={lastResult}
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

// ─── Internal Modal Component ────────────────────────────────────────────────

interface ModalProps {
  phase: VerificationPhase;
  warningCountdown: number;
  lastResult: { match: boolean; distance: number } | null;
  onVerificationComplete: (result: { match: boolean; distance: number }) => void;
}

function FaceVerificationModalInner({ phase, warningCountdown, lastResult, onVerificationComplete }: ModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanAttemptedRef = useRef(false);

  // Start webcam when scanning begins
  useEffect(() => {
    if (phase === 'scanning' && !scanAttemptedRef.current) {
      scanAttemptedRef.current = true;
      let cancelled = false;

      (async () => {
        try {
          const { startWebcam, detectFaceDescriptor, getStoredFace, compareFaces, stopWebcam } =
            await import('@/lib/tracking/faceUtils');

          if (!videoRef.current || cancelled) return;

          const stream = await startWebcam(videoRef.current);
          streamRef.current = stream;

          // Wait a moment for the camera to stabilize
          await new Promise(r => setTimeout(r, 1500));
          if (cancelled) { stopWebcam(stream); return; }

          // Try up to 3 detections
          let bestResult: { match: boolean; distance: number } | null = null;

          for (let attempt = 0; attempt < 3; attempt++) {
            if (cancelled) break;
            const descriptor = await detectFaceDescriptor(videoRef.current!);
            const stored = getStoredFace();

            if (descriptor && stored) {
              const result = compareFaces(stored, descriptor);
              if (!bestResult || result.distance < bestResult.distance) {
                bestResult = result;
              }
              if (result.match) break;
            }
            // Wait 500ms between attempts
            await new Promise(r => setTimeout(r, 500));
          }

          stopWebcam(stream);
          streamRef.current = null;

          if (!cancelled) {
            onVerificationComplete(bestResult || { match: false, distance: 999 });
          }
        } catch (err) {
          console.error('[FaceVerification] Scan error:', err);
          if (!cancelled) {
            onVerificationComplete({ match: false, distance: 999 });
          }
        }
      })();

      return () => {
        cancelled = true;
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
      };
    }

    if (phase !== 'scanning') {
      scanAttemptedRef.current = false;
    }
  }, [phase, onVerificationComplete]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.3s ease-out',
    }}>
      <div style={{
        background: 'rgba(30, 41, 59, 0.95)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '24px',
        padding: '40px',
        maxWidth: '480px',
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
      }}>
        {phase === 'warning' && (
          <>
            <div style={{
              width: '80px', height: '80px', margin: '0 auto 20px',
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '2px solid rgba(245, 158, 11, 0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pulse 1.5s infinite',
            }}>
              <span style={{ fontSize: '2.5rem' }}>⚠️</span>
            </div>
            <h2 style={{ color: '#f59e0b', margin: '0 0 12px', fontSize: '1.5rem' }}>
              Xác minh khuôn mặt
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 24px', lineHeight: 1.6 }}>
              Hệ thống sẽ quét khuôn mặt của bạn để xác minh danh tính.
              <br />Vui lòng nhìn thẳng vào camera.
            </p>
            <div style={{
              fontSize: '3.5rem', fontWeight: 'bold', fontFamily: 'monospace',
              color: '#f59e0b',
              textShadow: '0 0 20px rgba(245, 158, 11, 0.4)',
            }}>
              {warningCountdown}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '12px' }}>
              ⏸ Timer đã tạm dừng
            </p>
          </>
        )}

        {phase === 'scanning' && (
          <>
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: '100%', maxWidth: '320px',
                  borderRadius: '16px',
                  border: '2px solid var(--accent-primary)',
                  boxShadow: '0 0 30px rgba(59, 130, 246, 0.3)',
                }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                borderRadius: '16px',
                background: 'linear-gradient(transparent 40%, rgba(59, 130, 246, 0.1))',
                pointerEvents: 'none',
              }} />
              {/* Scanning animation line */}
              <div style={{
                position: 'absolute', left: '10%', right: '10%',
                height: '2px', background: 'var(--accent-primary)',
                boxShadow: '0 0 10px var(--accent-primary)',
                animation: 'scanLine 2s ease-in-out infinite',
                top: '20%',
              }} />
            </div>
            <h2 style={{ color: 'var(--accent-primary)', margin: '0 0 8px', fontSize: '1.3rem' }}>
              Đang quét khuôn mặt...
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
              Vui lòng giữ khuôn mặt ở giữa khung hình
            </p>
          </>
        )}

        {phase === 'success' && (
          <>
            <div style={{
              width: '80px', height: '80px', margin: '0 auto 20px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '2px solid var(--success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '2.5rem' }}>✅</span>
            </div>
            <h2 style={{ color: 'var(--success)', margin: '0 0 12px', fontSize: '1.5rem' }}>
              Xác minh thành công!
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
              Danh tính đã được xác nhận. Timer sẽ tiếp tục...
            </p>
            {lastResult && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
                Độ tương đồng: {Math.max(0, Math.round((1 - lastResult.distance) * 100))}%
              </p>
            )}
          </>
        )}

        {phase === 'fail' && (
          <>
            <div style={{
              width: '80px', height: '80px', margin: '0 auto 20px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '2px solid var(--danger)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '2.5rem' }}>❌</span>
            </div>
            <h2 style={{ color: 'var(--danger)', margin: '0 0 12px', fontSize: '1.5rem' }}>
              Xác minh thất bại!
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.6 }}>
              Không thể xác nhận danh tính. Timer vẫn tạm dừng.
              <br />Hệ thống sẽ quét lại sau <strong style={{ color: 'var(--danger)' }}>1 phút</strong>.
            </p>
            {lastResult && lastResult.distance < 999 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Độ tương đồng: {Math.max(0, Math.round((1 - lastResult.distance) * 100))}%
              </p>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        @keyframes scanLine {
          0% { top: 10%; }
          50% { top: 80%; }
          100% { top: 10%; }
        }
      `}</style>
    </div>
  );
}

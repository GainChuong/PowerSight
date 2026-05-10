'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { handleTrackerPause, handleTrackerResume, logViolation } from '@/lib/tracking/violationEngine';
import { useAuth } from '@/context/AuthContext';

interface Session {
  start: string;
  end: string;
  duration: string;
  tasks: number;
}

interface TrackerStats {
  completedTasks: number;
  targetTasks: number;
  violationsCount: number;
  kpiPerformance: number;
  aiFeedback: string;
}

import { Clock } from 'lucide-react';

interface TrackingContextType {
  isRunning: boolean;
  seconds: number;
  isViolation: boolean;
  isFullscreenViolation: boolean;
  isFaceVerifying: boolean;
  hasConsented: boolean;
  showConsentModal: boolean;
  pastSessions: Session[];
  trackerStats: TrackerStats;
  startTracking: () => void;
  pauseTracking: () => void;
  stopTracking: () => void;
  confirmTrackingConsent: () => void;
  pauseForVerification: () => void;
  resumeAfterVerification: () => void;
}

const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

export function TrackingProvider({ children }: { children: ReactNode }) {
  const { employeeId } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isViolation, setIsViolation] = useState(false);
  const [isFullscreenViolation, setIsFullscreenViolation] = useState(false);
  const wasRunningBeforeViolation = useRef(false);
  const [isFaceVerifying, setIsFaceVerifying] = useState(false);
  const [pastSessions, setPastSessions] = useState<Session[]>([]);
  const [trackerStats, setTrackerStats] = useState<TrackerStats>({
    completedTasks: 0,
    targetTasks: 20,
    violationsCount: 0,
    kpiPerformance: 0,
    aiFeedback: "Đang tải dữ liệu hiệu suất..."
  });

  // Reset tracking state on app initialization (first mount)
  useEffect(() => {
    // Send STOP command to extension to reset its internal timer to 0
    window.postMessage({ type: 'POWERSIGHT_COMMAND', command: 'STOP' }, '*');
    // Ensure local states are zeroed out
    setSeconds(0);
    setIsRunning(false);
    console.log('[Tracking] Timer and state reset on initialization');
  }, []);

  const fetchTrackerData = useCallback(async () => {
    if (!employeeId) return;
    try {
      // Use timestamp as cache buster to ensure we get fresh data after reset
      const res = await fetch(`/api/tracker?employeeId=${employeeId}&_t=${Date.now()}`);
      const data = await res.json();
      if (data.sessions) {
        setPastSessions(data.sessions);
      }
      if (data.targetTasks !== undefined) {
        setTrackerStats({
          completedTasks: data.completedTasks,
          targetTasks: data.targetTasks,
          violationsCount: data.violationsCount || 0,
          kpiPerformance: data.kpiPerformance,
          aiFeedback: data.aiFeedback || "AI chưa có nhận xét nào."
        });
      }
    } catch (err) {
      console.error('Error fetching tracker data:', err);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchTrackerData();
  }, [fetchTrackerData]);

  const wasRunningRef = useRef(false);
  const extensionDetectedRef = useRef(false);
  const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);

  // Keep isRunningRef in sync
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // Fallback timer: ticks every second when running and no extension is detected
  useEffect(() => {
    if (isRunning && !extensionDetectedRef.current) {
      fallbackIntervalRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    }
    return () => {
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };
  }, [isRunning]);



  // Sync state from Chrome Extension Content Script
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'POWERSIGHT_STATE_UPDATE') {
        extensionDetectedRef.current = true;
        const currentlyRunning = event.data.state.isRunning;
        setIsRunning(currentlyRunning);
        setSeconds(event.data.state.seconds);
        setIsViolation(event.data.state.isPausedByViolation || event.data.state.isUrlAllowed === false);
        setIsFaceVerifying(!!(event.data.state.faceVerify && event.data.state.faceVerify.isPausedForFace));
        
        // Sync violations count from extension state
        if (event.data.state.violationsCount !== undefined) {
          setTrackerStats(prev => ({
            ...prev,
            violationsCount: event.data.state.violationsCount
          }));
        }

        // Track violations based on state transitions
        if (currentlyRunning && !wasRunningRef.current) {
          handleTrackerResume(employeeId);
        } else if (!currentlyRunning && wasRunningRef.current) {
          handleTrackerPause(employeeId);
        }
        wasRunningRef.current = currentlyRunning;
      } else if (event.data && event.data.type === 'POWERSIGHT_VIOLATION_LOGGED') {
        console.log('[Tracking] Violation logged message received, refreshing data...');
        fetchTrackerData();
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Request initial state if extension is ready
    window.postMessage({ type: 'POWERSIGHT_COMMAND', command: 'GET_STATE' }, '*');
    
    return () => window.removeEventListener('message', handleMessage);
  }, [employeeId]);

  // Real-time Violation Listener
  useEffect(() => {
    const handleViolationLogged = () => {
      console.log('[Tracking] Violation detected, refreshing data...');
      fetchTrackerData();
    };

    window.addEventListener('POWERSIGHT_VIOLATION_LOGGED' as any, handleViolationLogged);
    return () => window.removeEventListener('POWERSIGHT_VIOLATION_LOGGED' as any, handleViolationLogged);
  }, [fetchTrackerData]);

  // Sync employeeId to extension
  useEffect(() => {
    if (employeeId) {
      window.postMessage({ 
        type: 'POWERSIGHT_COMMAND', 
        command: 'SET_CONFIG', 
        config: { employeeId } 
      }, '*');
    }
  }, [employeeId]);

  const [startTime, setStartTime] = useState<string | null>(null);
  const [hasConsented, setHasConsented] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const startTracking = useCallback(() => {
    if (isRunningRef.current) return;

    if (!hasConsented) {
      setShowConsentModal(true);
      return;
    }

    // Force to fullscreen for Focus Mode
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    // Send command to extension if present
    window.postMessage({ type: 'POWERSIGHT_COMMAND', command: 'START' }, '*');
    // Also update local state immediately (fallback or instant UI feedback)
    setIsRunning(true);
    setStartTime(new Date().toISOString());
    if (!wasRunningRef.current) {
      handleTrackerResume(employeeId);
    }
    wasRunningRef.current = true;
  }, [employeeId, hasConsented]);

  const confirmTrackingConsent = useCallback(() => {
    setHasConsented(true);
    setShowConsentModal(false);
    
    // Actually start tracking now
    // Force to fullscreen for Focus Mode
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    window.postMessage({ type: 'POWERSIGHT_COMMAND', command: 'START' }, '*');
    setIsRunning(true);
    setStartTime(new Date().toISOString());
    if (!wasRunningRef.current) {
      handleTrackerResume(employeeId);
    }
    wasRunningRef.current = true;
  }, [employeeId]);

  const pauseTracking = useCallback(() => {
    if (!isRunningRef.current) return;

    window.postMessage({ type: 'POWERSIGHT_COMMAND', command: 'PAUSE' }, '*');
    setIsRunning(false);
    if (wasRunningRef.current) {
      handleTrackerPause(employeeId);
    }
    wasRunningRef.current = false;
  }, [employeeId]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const stopTracking = useCallback(async () => {
    window.postMessage({ type: 'POWERSIGHT_COMMAND', command: 'STOP' }, '*');
    
    const currentSeconds = seconds;
    const currentStartTime = startTime;
    const now = new Date();
    
    // Call API to save session
    if (employeeId && currentStartTime) {
      try {
        const res = await fetch('/api/tracker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId,
            seconds: currentSeconds,
            startTime: currentStartTime,
            endTime: now.toISOString()
          })
        });
        const result = await res.json();
        
        if (result.saved) {
          // Re-fetch to get updated stats and sessions from Supabase
          await fetchTrackerData();
        }
      } catch (err) {
        console.error('Error saving session:', err);
      }
    }

    setIsRunning(false);
    setSeconds(0);
    setStartTime(null);
    wasRunningRef.current = false;
  }, [seconds, startTime, employeeId, fetchTrackerData]);

  // Pause/resume specifically for face verification (no violation logging)
  const pauseForVerification = useCallback(() => {
    window.postMessage({ type: 'POWERSIGHT_COMMAND', command: 'PAUSE' }, '*');
    setIsRunning(false);
    // Don't call handleTrackerPause — this is not a user-initiated pause
    wasRunningRef.current = false;
  }, []);

  const resumeAfterVerification = useCallback(() => {
    window.postMessage({ type: 'POWERSIGHT_COMMAND', command: 'START' }, '*');
    setIsRunning(true);
    wasRunningRef.current = true;
  }, []);


  // Global violation listeners (Browser behavior)
  useEffect(() => {
    // We need to keep listeners even if paused to detect return to fullscreen
    const handleVisibilityChange = () => {
      // Visibility violation is now handled by the extension with a 2s grace period.
      // Web client no longer logs this to prevent false positives when switching to allowed apps.
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Fullscreen violation detection
    const handleFullscreenChange = () => {
      // Fullscreen is now handled by the extension. 
      // We just ensure the violation state is always cleared.
      setIsFullscreenViolation(false);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    const handleResetLocal = () => {
      console.log('[Tracking] 🔄 Force resetting local state due to login...');
      setSeconds(0);
      setTrackerStats({
        completedTasks: 0,
        targetTasks: 20,
        violationsCount: 0,
        kpiPerformance: 0,
        aiFeedback: "Đang tải dữ liệu hiệu suất..."
      });
      setPastSessions([]);
      setIsRunning(false);
    };

    window.addEventListener('POWERSIGHT_RESET_LOCAL_STATE', handleResetLocal);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('POWERSIGHT_RESET_LOCAL_STATE', handleResetLocal);
    };
  }, [isRunning, employeeId, pauseTracking, startTracking, isFaceVerifying]);

  return (
    <TrackingContext.Provider value={{ 
      isRunning, 
      seconds, 
      isViolation, 
      isFullscreenViolation, 
      isFaceVerifying,
      hasConsented,
      showConsentModal,
      pastSessions, 
      trackerStats, 
      startTracking, 
      pauseTracking, 
      stopTracking,
      confirmTrackingConsent,
      pauseForVerification, 
      resumeAfterVerification 
    }}>
      {children}
      
      {showConsentModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100000, animation: 'fadeInTracking 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{
              width: '100%', maxWidth: '460px', 
              background: 'linear-gradient(165deg, #1e293b 0%, #0f172a 100%)',
              borderRadius: '28px', border: '1px solid rgba(59, 130, 246, 0.3)',
              padding: '40px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(59, 130, 246, 0.1)',
              display: 'flex', flexDirection: 'column', gap: '24px',
              position: 'relative', overflow: 'hidden'
            }}>
              {/* Subtle background glow */}
              <div style={{
                position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px',
                background: 'rgba(59, 130, 246, 0.15)', filter: 'blur(40px)', borderRadius: '50%'
              }} />

              <div style={{ textAlign: 'center' }}>
                <div style={{
                  display: 'inline-flex', padding: '16px', borderRadius: '20px',
                  background: 'rgba(59, 130, 246, 0.1)', marginBottom: '20px',
                  border: '1px solid rgba(59, 130, 246, 0.2)'
                }}>
                  <Clock size={40} color="#60a5fa" />
                </div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', fontWeight: '800', color: 'white', letterSpacing: '-0.025em' }}>
                  Xác nhận Quyền Giám sát
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6', maxWidth: '340px', margin: '0 auto' }}>
                  Để đảm bảo tính minh bạch, vui lòng xác nhận các nội dung sẽ được ghi nhận trong phiên làm việc này.
                </p>
              </div>

              <div style={{ 
                display: 'flex', flexDirection: 'column', gap: '10px', 
                background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <ConsentItem icon="🖱️" text="Ghi nhận hành vi Chuột & Bàn phím" />
                <ConsentItem icon="📸" text="Nhận diện khuôn mặt định kỳ (Camera)" />
                <ConsentItem icon="🌐" text="Ghi nhận Lịch sử Trình duyệt (Logs)" />
                <ConsentItem icon="📋" text="Số liệu xử lý báo cáo thực tế" />
              </div>

              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  onClick={confirmTrackingConsent}
                  style={{
                    width: '100%', padding: '16px', 
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    border: 'none', borderRadius: '14px', color: 'white', 
                    fontWeight: '700', fontSize: '1rem',
                    cursor: 'pointer', transition: 'all 0.3s ease',
                    boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.5)'
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 15px 25px -5px rgba(59, 130, 246, 0.6)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(59, 130, 246, 0.5)';
                  }}
                >
                  Chấp nhận & Bắt đầu
                </button>
                <button
                  onClick={() => setShowConsentModal(false)}
                  style={{
                    width: '100%', padding: '12px', background: 'transparent',
                    border: '1px solid #334155', borderRadius: '14px', color: '#64748b',
                    cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.borderColor = '#475569';
                    e.currentTarget.style.color = '#94a3b8';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.borderColor = '#334155';
                    e.currentTarget.style.color = '#64748b';
                  }}
                >
                  Hủy bỏ
                </button>
              </div>
            </div>
            <style>{`
              @keyframes fadeInTracking { 
                from { opacity: 0; transform: translateY(20px); } 
                to { opacity: 1; transform: translateY(0); } 
              }
            `}</style>
          </div>
        )}
    </TrackingContext.Provider>
  );
}

function ConsentItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.05)'
    }}>
      <span style={{ fontSize: '1.2rem' }}>{icon}</span>
      <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{text}</span>
    </div>
  );
}

export function useTracking() {
  const context = useContext(TrackingContext);
  if (context === undefined) {
    throw new Error('useTracking must be used within a TrackingProvider');
  }
  return context;
}

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

interface TrackingContextType {
  isRunning: boolean;
  seconds: number;
  isViolation: boolean;
  isFullscreenViolation: boolean;
  isFaceVerifying: boolean;
  pastSessions: Session[];
  trackerStats: TrackerStats;
  startTracking: () => void;
  pauseTracking: () => void;
  stopTracking: () => void;
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
    aiFeedback: "Đang phân tích dữ liệu hiệu suất..."
  });

  const fetchTrackerData = useCallback(async () => {
    if (!employeeId) return;
    try {
      const res = await fetch(`/api/tracker?employeeId=${employeeId}`);
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
        
        // Track violations based on state transitions
        if (currentlyRunning && !wasRunningRef.current) {
          handleTrackerResume(employeeId);
        } else if (!currentlyRunning && wasRunningRef.current) {
          handleTrackerPause(employeeId);
        }
        wasRunningRef.current = currentlyRunning;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Request initial state if extension is ready
    window.postMessage({ type: 'POWERSIGHT_COMMAND', command: 'GET_STATE' }, '*');
    
    return () => window.removeEventListener('message', handleMessage);
  }, [employeeId]);

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

  const startTracking = useCallback(() => {
    if (isRunningRef.current) return;

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
      if (document.hidden && isRunningRef.current) {
        logViolation('browser_tab_exit', 'critical', { reason: 'User left the webapp tab' }, employeeId, 'Web Client');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Fullscreen violation detection
    const handleFullscreenChange = () => {
      // Fullscreen is now handled by the extension. 
      // We just ensure the violation state is always cleared.
      setIsFullscreenViolation(false);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isRunning, employeeId, pauseTracking, startTracking, isFaceVerifying]);

  return (
    <TrackingContext.Provider value={{ 
      isRunning, 
      seconds, 
      isViolation,
      isFullscreenViolation,
      isFaceVerifying,
      pastSessions, 
      trackerStats, 
      startTracking, 
      pauseTracking, 
      stopTracking, 
      pauseForVerification, 
      resumeAfterVerification 
    }}>
      {children}
    </TrackingContext.Provider>
  );
}

export function useTracking() {
  const context = useContext(TrackingContext);
  if (context === undefined) {
    throw new Error('useTracking must be used within a TrackingProvider');
  }
  return context;
}

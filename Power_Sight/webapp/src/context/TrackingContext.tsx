'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { handleTrackerPause, handleTrackerResume } from '@/lib/tracking/violationEngine';
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
  kpiPerformance: number;
}

interface TrackingContextType {
  isRunning: boolean;
  seconds: number;
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
  const [pastSessions, setPastSessions] = useState<Session[]>([]);
  const [trackerStats, setTrackerStats] = useState<TrackerStats>({
    completedTasks: 0,
    targetTasks: 20,
    kpiPerformance: 0
  });

  useEffect(() => {
    if (employeeId) {
      fetch(`/api/tracker?employeeId=${employeeId}`)
        .then(res => res.json())
        .then(data => {
          if (data.sessions) {
            setPastSessions(data.sessions);
          }
          if (data.targetTasks !== undefined) {
            setTrackerStats({
              completedTasks: data.completedTasks,
              targetTasks: data.targetTasks,
              kpiPerformance: data.kpiPerformance
            });
          }
        })
        .catch(err => console.error('Error fetching tracker data:', err));
    }
  }, [employeeId]);

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
        
        // Track violations based on state transitions
        if (currentlyRunning && !wasRunningRef.current) {
          handleTrackerResume();
        } else if (!currentlyRunning && wasRunningRef.current) {
          handleTrackerPause();
        }
        wasRunningRef.current = currentlyRunning;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Request initial state if extension is ready
    window.postMessage({ type: 'POWERSIGHT_COMMAND', command: 'GET_STATE' }, '*');
    
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const startTracking = useCallback(() => {
    // Send command to extension if present
    window.postMessage({ type: 'POWERSIGHT_COMMAND', command: 'START' }, '*');
    // Also update local state immediately (fallback or instant UI feedback)
    setIsRunning(true);
    if (!wasRunningRef.current) {
      handleTrackerResume();
    }
    wasRunningRef.current = true;
  }, []);

  const pauseTracking = useCallback(() => {
    window.postMessage({ type: 'POWERSIGHT_COMMAND', command: 'PAUSE' }, '*');
    setIsRunning(false);
    if (wasRunningRef.current) {
      handleTrackerPause();
    }
    wasRunningRef.current = false;
  }, []);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const stopTracking = useCallback(() => {
    window.postMessage({ type: 'POWERSIGHT_COMMAND', command: 'STOP' }, '*');
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setPastSessions(prev => [
      ...prev,
      { 
        start: timeStr, end: timeStr, 
        duration: formatTime(seconds), tasks: 0 
      }
    ]);
    setIsRunning(false);
    setSeconds(0);
    wasRunningRef.current = false;
  }, [seconds]);

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

  return (
    <TrackingContext.Provider value={{ isRunning, seconds, pastSessions, trackerStats, startTracking, pauseTracking, stopTracking, pauseForVerification, resumeAfterVerification }}>
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

'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { TOUR_STEPS } from '@/constants/tourSteps';

interface TourContextType {
  isActive: boolean;
  isMinimized: boolean;
  currentStep: number;
  timeLeft: number;
  startTour: () => void;
  nextStep: (step?: number) => void;
  endTour: () => void;
  toggleMinimized: (minimized?: boolean) => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [timeLeft, setTimeLeft] = useState(0);

  // Timer logic - runs in context to persist across navigations
  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => (prev <= 0 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, currentStep]);

  // Handle timer reset on step change
  useEffect(() => {
    if (!isActive) return;
    
    const stepInfo = TOUR_STEPS.find(s => s.id === currentStep);
    if (stepInfo) {
      setTimeLeft(stepInfo.timeSeconds);
    }
  }, [currentStep, isActive]);

  useEffect(() => {
    if (isAuthenticated) {
      setIsActive(true);
      setIsMinimized(false);
      setCurrentStep(1);
    } else {
      setIsActive(false);
      setIsMinimized(false);
      setCurrentStep(1);
    }
  }, [isAuthenticated]);

  const startTour = () => {
    setCurrentStep(1);
    setIsActive(true);
    setIsMinimized(false);
  };
  
  const nextStep = (step?: number) => {
    if (step) {
      setCurrentStep(step);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };
  
  const endTour = () => {
    setIsActive(false);
    setIsMinimized(false);
  };

  const toggleMinimized = (minimized?: boolean) => {
    setIsMinimized(prev => minimized ?? !prev);
  };

  return (
    <TourContext.Provider value={{ 
      isActive, 
      isMinimized, 
      currentStep, 
      timeLeft,
      startTour, 
      nextStep, 
      endTour, 
      toggleMinimized 
    }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}

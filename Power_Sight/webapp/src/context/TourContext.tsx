'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface TourContextType {
  isActive: boolean;
  currentStep: number;
  startTour: () => void;
  nextStep: (step?: number) => void;
  endTour: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (isAuthenticated) {
      setIsActive(true);
      setCurrentStep(1);
    } else {
      setIsActive(false);
      setCurrentStep(1);
    }
  }, [isAuthenticated]);

  const startTour = () => setIsActive(true);
  
  const nextStep = (step?: number) => {
    if (step) {
      setCurrentStep(step);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };
  
  const endTour = () => setIsActive(false);

  return (
    <TourContext.Provider value={{ isActive, currentStep, startTour, nextStep, endTour }}>
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

'use client';

import { TrackingProvider } from '@/context/TrackingContext';
import { AuthProvider } from '@/context/AuthContext';
import { FaceVerificationProvider } from '@/context/FaceVerificationContext';
import { TourProvider } from '@/context/TourContext';
import FullscreenEnforcer from '@/components/FullscreenEnforcer';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TrackingProvider>
        <TourProvider>
          <FaceVerificationProvider>
            <FullscreenEnforcer />
            {children}
          </FaceVerificationProvider>
        </TourProvider>
      </TrackingProvider>
    </AuthProvider>
  );
}

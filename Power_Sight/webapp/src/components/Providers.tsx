'use client';

import { TrackingProvider } from '@/context/TrackingContext';
import { AuthProvider } from '@/context/AuthContext';
import { FaceVerificationProvider } from '@/context/FaceVerificationContext';
import FullscreenEnforcer from '@/components/FullscreenEnforcer';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TrackingProvider>
        <FaceVerificationProvider>
          <FullscreenEnforcer />
          {children}
        </FaceVerificationProvider>
      </TrackingProvider>
    </AuthProvider>
  );
}

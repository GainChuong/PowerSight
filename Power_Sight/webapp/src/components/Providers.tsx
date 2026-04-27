'use client';

import { TrackingProvider } from '@/context/TrackingContext';
import { AuthProvider } from '@/context/AuthContext';
import { FaceVerificationProvider } from '@/context/FaceVerificationContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TrackingProvider>
        <FaceVerificationProvider>
          {children}
        </FaceVerificationProvider>
      </TrackingProvider>
    </AuthProvider>
  );
}

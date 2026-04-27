'use client';

import { useEffect, useRef } from 'react';
import { checkMousePolicy } from '@/lib/tracking/violationEngine';
import { useTracking } from '@/context/TrackingContext';

export default function SafeWorkspace({ children }: { children: React.ReactNode }) {
  const { isRunning } = useTracking();
  const lastEventTimeRef = useRef(0);

  useEffect(() => {
    let lastX = 0;
    let lastY = 0;
    let linearCount = 0;
    let lastTime = Date.now();

    const handleMouseMove = (e: MouseEvent) => {
      if (!isRunning) return;

      const now = Date.now();
      // Throttle to max 20 fps (50ms) to improve stability and performance
      if (now - lastEventTimeRef.current < 50) return;
      lastEventTimeRef.current = now;

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const time = now - lastTime;
      
      if (Math.abs(dx) > 0 && Math.abs(dy) === 0) {
          linearCount++;
      } else {
          linearCount = 0;
      }

      if (linearCount > 20) {
         checkMousePolicy(distance, time, true);
         linearCount = 0;
      }

      lastX = e.clientX;
      lastY = e.clientY;
      lastTime = now;
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isRunning]);

  return <>{children}</>;
}

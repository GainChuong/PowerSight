'use client';

import { useTracking } from '@/context/TrackingContext';
import { Play, Pause, Square, Clock, ScanFace } from 'lucide-react';
import { checkFacePolicy } from '@/lib/tracking/violationEngine';
import { usePathname } from 'next/navigation';

export default function FloatingTrackerBar() {
  const { 
    isRunning, 
    seconds, 
    isViolation, 
    isFullscreenViolation,
    isFaceVerifying, 
    startTracking, 
    pauseTracking, 
    stopTracking 
  } = useTracking();
  const pathname = usePathname();
  
  const isBlocked = isViolation || isFaceVerifying || isFullscreenViolation;

  // Hide on tracker page since it has its own controls
  if (pathname === '/tracker') {
    return null;
  }

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: '280px', // Offset by sidebar width
      right: 0,
      height: '60px',
      background: 'rgba(15, 23, 42, 0.95)',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      backdropFilter: 'blur(10px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '30px',
      boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)'
    }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '1.2rem', fontFamily: 'monospace' }}>
        <Clock size={20} />
        {formatTime(seconds)}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        {!isRunning ? (
          <button 
            onClick={startTracking} 
            className="btn-primary" 
            disabled={isBlocked}
            style={{ 
              padding: '6px 16px', 
              background: isBlocked ? '#475569' : 'linear-gradient(135deg, var(--success), #059669)',
              opacity: isBlocked ? 0.6 : 1,
              cursor: isBlocked ? 'not-allowed' : 'pointer'
            }}
          >
            <Play size={16} /> Bắt đầu
          </button>
        ) : (
          <button 
            onClick={pauseTracking} 
            disabled={isBlocked}
            style={{ 
              padding: '6px 16px', 
              background: isBlocked ? '#475569' : 'linear-gradient(135deg, var(--warning), #d97706)', 
              border: 'none', 
              color: 'white', 
              borderRadius: '8px', 
              cursor: isBlocked ? 'not-allowed' : 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              opacity: isBlocked ? 0.6 : 1
            }}
          >
            <Pause size={16} /> Tạm dừng
          </button>
        )}
        <button onClick={stopTracking} className="btn-danger" style={{ padding: '6px 16px' }}>
          <Square size={16} /> Kết thúc
        </button>
      </div>
      

    </div>
  );
}

'use client';

import { useTracking } from '@/context/TrackingContext';
import { Play, Pause, Square, Clock, ScanFace } from 'lucide-react';
import { checkFacePolicy } from '@/lib/tracking/violationEngine';
import { usePathname } from 'next/navigation';

export default function FloatingTrackerBar() {
  const { isRunning, seconds, startTracking, pauseTracking, stopTracking } = useTracking();
  const pathname = usePathname();

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
          <button onClick={startTracking} className="btn-primary" style={{ padding: '6px 16px', background: 'linear-gradient(135deg, var(--success), #059669)' }}>
            <Play size={16} /> Bắt đầu
          </button>
        ) : (
          <button onClick={pauseTracking} style={{ padding: '6px 16px', background: 'linear-gradient(135deg, var(--warning), #d97706)', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Pause size={16} /> Tạm dừng
          </button>
        )}
        <button onClick={stopTracking} className="btn-danger" style={{ padding: '6px 16px' }}>
          <Square size={16} /> Kết thúc
        </button>
      </div>
      
      {/* Simulation Buttons - Visible only when running for testing purposes */}
      {isRunning && (
        <div style={{ position: 'absolute', right: '20px', display: 'flex', gap: '10px' }}>
          <button onClick={() => checkFacePolicy([], false)} style={{ fontSize: '0.8rem', padding: '4px 8px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
             Simulate No Face
          </button>
          <button onClick={() => checkFacePolicy([{id: 1}], false)} style={{ fontSize: '0.8rem', padding: '4px 8px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
             Simulate Wrong Face
          </button>
        </div>
      )}
    </div>
  );
}

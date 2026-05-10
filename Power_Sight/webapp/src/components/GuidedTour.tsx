'use client';

import React, { useEffect, useState } from 'react';
import { useTour } from '@/context/TourContext';
import { usePathname } from 'next/navigation';
import { useTracking } from '@/context/TrackingContext';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle2, ChevronRight, X, Clock, RotateCcw } from 'lucide-react';

import { TOUR_STEPS } from '@/constants/tourSteps';

export default function GuidedTour() {
  const { isActive, isMinimized, currentStep, timeLeft, nextStep, endTour, toggleMinimized } = useTour();
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const { isRunning } = useTracking();

  useEffect(() => {
    if (!isActive) return;

    // Auto advance logic based on user actions for step 2
    if (currentStep === 2 && isRunning) {
      setTimeout(() => nextStep(3), 1500);
    }
  }, [currentStep, isRunning, isActive, nextStep]);

  if (!isAuthenticated || !isActive) return null;

  // ── Render Bubble Mode ───────────────────────────────────────────────────
  if (isMinimized) {
    return (
      <button
        onClick={() => toggleMinimized(false)}
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
          border: 'none',
          boxShadow: '0 8px 25px rgba(59, 130, 246, 0.5)',
          cursor: 'pointer',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fvPulseTour 2s infinite',
          color: 'white',
        }}
      >
        <Clock size={28} />
        <div style={{
          position: 'absolute',
          top: '-5px',
          right: '-5px',
          width: '24px',
          height: '24px',
          background: '#ef4444',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          border: '2px solid rgba(15, 23, 42, 1)',
        }}>
          {currentStep}
        </div>
        <style>{`
          @keyframes fvPulseTour {
            0%, 100% { transform: scale(1); box-shadow: 0 8px 25px rgba(59, 130, 246, 0.5); }
            50%       { transform: scale(1.05); box-shadow: 0 12px 35px rgba(59, 130, 246, 0.7); }
          }
        `}</style>
      </button>
    );
  }

  const stepInfo = TOUR_STEPS.find(s => s.id === currentStep);
  if (!stepInfo) return null;

  // ── Render Expanded Mode ──────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed',
      bottom: '30px',
      right: '30px',
      width: '380px',
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(10px)',
      border: '1px solid #3b82f6',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
      zIndex: 99999,
      color: 'white',
      animation: 'slideUp 0.3s ease-out'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Trải nghiệm tính năng
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
           <button 
             onClick={() => toggleMinimized(true)} 
             style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
             title="Thu nhỏ"
           >
             <X size={18} />
           </button>
        </div>
      </div>

      <h4 style={{ margin: '0 0 10px 0', fontSize: '1.1rem' }}>{stepInfo.title}</h4>
      <p style={{ margin: '0 0 15px 0', fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
        {stepInfo.description}
      </p>

      {/* ETA and Timer display */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(59, 130, 246, 0.1)', padding: '10px 12px', borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.2)', marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#93c5fd', fontSize: '0.85rem' }}>
          <Clock size={16} />
          <span>ETA: {stepInfo.eta}</span>
        </div>
        <div style={{ 
          fontSize: '1.1rem', fontWeight: 'bold', 
          color: timeLeft <= 5 && timeLeft > 0 ? '#ef4444' : '#10b981',
          fontFamily: 'monospace'
        }}>
          {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {TOUR_STEPS.map(s => (
            <div key={s.id} style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: s.id === currentStep ? '#3b82f6' : (s.id < currentStep ? '#10b981' : '#334155')
            }} />
          ))}
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {currentStep > 1 && (
            <button 
              onClick={() => nextStep(currentStep - 1)}
              style={{
                background: 'transparent', color: '#94a3b8', border: '1px solid #334155', padding: '6px 14px',
                borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold'
              }}
            >
              Lùi lại
            </button>
          )}
          {currentStep < 5 ? (
            <button 
              onClick={() => nextStep()}
              style={{
                background: '#3b82f6', color: 'white', border: 'none', padding: '6px 14px',
                borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '0.85rem', fontWeight: 'bold'
              }}
            >
              Tiếp tục <ChevronRight size={14} />
            </button>
          ) : (
            <button 
              onClick={() => nextStep(1)}
              style={{
                background: '#3b82f6', color: 'white', border: 'none', padding: '6px 14px',
                borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '0.85rem', fontWeight: 'bold'
              }}
            >
              Bắt đầu lại <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function ConsentItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.05)'
    }}>
      <span style={{ fontSize: '1.2rem' }}>{icon}</span>
      <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{text}</span>
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { useTour } from '@/context/TourContext';
import { usePathname } from 'next/navigation';
import { useTracking } from '@/context/TrackingContext';
import { CheckCircle2, ChevronRight, X, Clock } from 'lucide-react';

const TOUR_STEPS = [
  {
    id: 1,
    title: 'Bước 1: Kiểm tra Lịch trình',
    description: 'Truy cập tab Lịch làm việc (Calendar). Hãy tìm nhiệm vụ "Xử lý sheet báo cáo kết quả hoạt động kinh doanh từ phòng Tài chính" của ngày hôm nay.',
    eta: '30s',
    timeSeconds: 30
  },
  {
    id: 2,
    title: 'Bước 2: Bắt đầu làm việc',
    description: 'Quay lại tab Time Tracker. Nhấn nút Bắt đầu để hệ thống bật Tracking và chuyển sang màn hình Fullscreen.',
    eta: '10s',
    timeSeconds: 10
  },
  {
    id: 3,
    title: 'Bước 3: Xử lý Báo cáo',
    description: 'Mở ứng dụng Gmail. Một email chứa bản sao Google Sheet Raw đã được tự động gửi tới email của bạn. Mở file, xem gợi ý từ Chatbot (copy/paste từ tab ngoài sẽ bị ghi nhận vi phạm), và gửi mail lại sau khi hoàn thành.',
    eta: '6 phút 50s',
    timeSeconds: 410
  },
  {
    id: 4,
    title: 'Bước 4: Xem Dashboard',
    description: 'Chuyển về Dashboard KPI. Hãy filter thời gian từ Tháng 1 đến Tháng hiện tại và quan sát biểu đồ.',
    eta: '1 phút',
    timeSeconds: 60
  },
  {
    id: 5,
    title: 'Bước 5: Chatbot AI',
    description: 'Chuyển sang tab Chatbot và hỏi 3 câu:\n1. Đánh giá hiệu suất từ đầu năm?\n2. Vi phạm ngày hôm nay?\n3. Cách tối ưu xử lý báo cáo?',
    eta: '1 phút',
    timeSeconds: 60
  }
];

export default function GuidedTour() {
  const { isActive, currentStep, nextStep, endTour } = useTour();
  const pathname = usePathname();
  const { isRunning } = useTracking();
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!isActive) return;

    // Reset timer when step changes
    const stepInfo = TOUR_STEPS.find(s => s.id === currentStep);
    if (stepInfo) {
      setTimeLeft(stepInfo.timeSeconds);
    }

    // Auto advance logic based on user actions for step 2
    if (currentStep === 2 && isRunning) {
      setTimeout(() => nextStep(3), 1500);
    }
  }, [currentStep, pathname, isRunning, isActive, nextStep]);

  // Countdown timer logic
  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Optional: Auto-advance when time is up, but we will just let it stay at 0
          // nextStep(); 
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, timeLeft, currentStep]);

  if (!isActive) return null;

  const stepInfo = TOUR_STEPS.find(s => s.id === currentStep);
  if (!stepInfo) return null;

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
        <button onClick={endTour} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
          <X size={18} />
        </button>
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
              onClick={endTour}
              style={{
                background: '#10b981', color: 'white', border: 'none', padding: '6px 14px',
                borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '0.85rem', fontWeight: 'bold'
              }}
            >
              Hoàn thành <CheckCircle2 size={14} />
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

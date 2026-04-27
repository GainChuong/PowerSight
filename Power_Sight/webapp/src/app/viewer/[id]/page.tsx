"use client";

import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Globe, Shield, Clock, Play, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useTracking } from '@/context/TrackingContext';
import { useState, useEffect, useRef } from 'react';

export const ALLOWED_APPS: Record<string, { name: string; url: string; icon: string; description: string; embeddable: boolean }> = {
  gmail: {
    name: 'Gmail',
    url: 'https://mail.google.com',
    icon: '📧',
    description: 'Hệ thống email doanh nghiệp',
    embeddable: false,
  },
  gdrive: {
    name: 'Google Drive',
    url: 'https://drive.google.com',
    icon: '📁',
    description: 'Lưu trữ và chia sẻ tài liệu',
    embeddable: false,
  },
  sap: {
    name: 'SAP',
    url: 'https://s36.gb.ucc.cit.tum.de/sap/bc/ui2/flp?sap-client=312&sap-language=EN#Shell-home',
    icon: '🏢',
    description: 'Hệ thống quản lý đơn hàng SAP',
    embeddable: false,
  },
  sheets: {
    name: 'Google Sheets',
    url: 'https://docs.google.com/spreadsheets',
    icon: '📊',
    description: 'Bảng tính Google Sheets',
    embeddable: false,
  },
  docs: {
    name: 'Google Docs',
    url: 'https://docs.google.com/document',
    icon: '📝',
    description: 'Tài liệu Google Docs',
    embeddable: false,
  }
};

export default function ViewerPage() {
  const params = useParams();
  const appId = params.id as string;
  const app = ALLOWED_APPS[appId];
  const { isRunning, seconds, startTracking } = useTracking();
  const [opened, setOpened] = useState(false);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const openedRef = useRef(false);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleOpenApp = () => {
    if (!isRunning) {
      startTracking();
    }
    setSessionStart(new Date());
    setOpened(true);
    openedRef.current = true;
    window.open(app.url, '_blank', 'noopener');
  };

  // Listen for when user comes back to this tab
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && openedRef.current) {
        // User returned from the external app tab
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  if (!app) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: '20px' }}>
        <Globe size={64} color="var(--text-muted)" />
        <h2 style={{ color: 'var(--text-main)', fontSize: '1.8rem' }}>Ứng dụng không được phép</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '500px', textAlign: 'center', lineHeight: '1.6' }}>
          Ứng dụng &quot;{appId}&quot; không nằm trong danh sách các web được doanh nghiệp cho phép sử dụng trong giờ làm việc.
        </p>
        <Link href="/" className="btn-primary" style={{ padding: '12px 24px', textDecoration: 'none' }}>
          <ArrowLeft size={18} /> Quay lại Dashboard
        </Link>
      </div>
    );
  }

  // For embeddable sites, use iframe
  if (app.embeddable) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 92px)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', background: 'rgba(30, 41, 59, 0.7)',
          borderRadius: '12px 12px 0 0', borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/" style={{ color: 'var(--text-muted)', display: 'flex' }}><ArrowLeft size={20} /></Link>
            <span style={{ fontSize: '1.4rem' }}>{app.icon}</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>{app.name}</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{app.description}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <StatusBadge isRunning={isRunning} />
            {!isRunning && (
              <button onClick={startTracking} className="btn-primary" style={{ padding: '6px 16px', fontSize: '0.85rem', background: 'linear-gradient(135deg, var(--success), #059669)' }}>
                Bắt đầu làm việc
              </button>
            )}
          </div>
        </div>
        <div style={{ flex: 1, borderRadius: '0 0 12px 12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', borderTop: 'none' }}>
          <iframe src={app.url} title={app.name} style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" />
        </div>
      </div>
    );
  }

  // For non-embeddable sites (Gmail, Drive, etc.), show launch pad
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)', gap: '30px' }}>
      {/* Large App Icon */}
      <div style={{
        fontSize: '5rem', width: '140px', height: '140px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(59, 130, 246, 0.1)', borderRadius: '30px',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        boxShadow: '0 0 60px rgba(59, 130, 246, 0.1)',
      }}>
        {app.icon}
      </div>

      <div style={{ textAlign: 'center', maxWidth: '500px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-main)', margin: '0 0 10px 0' }}>
          {app.name}
        </h1>
        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
          {app.description}. Ứng dụng sẽ mở trong tab mới. Thời gian làm việc của bạn sẽ được theo dõi tự động tại thanh phía trên.
        </p>
      </div>

      {/* Status Card */}
      <div className="glass-card" style={{ padding: '24px', width: '100%', maxWidth: '440px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <StatusBadge isRunning={isRunning} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontFamily: 'monospace', fontWeight: 'bold' }}>
            <Clock size={16} />
            {formatTime(seconds)}
          </div>
        </div>

        {opened && sessionStart && (
          <div style={{
            padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px',
            border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '16px',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <CheckCircle size={18} color="var(--success)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>
              Đã mở {app.name} lúc {sessionStart.toLocaleTimeString('vi-VN')}. Đang theo dõi...
            </span>
          </div>
        )}

        <button onClick={handleOpenApp} className="btn-primary" style={{
          width: '100%', padding: '14px', fontSize: '1.05rem',
          background: 'linear-gradient(135deg, var(--accent-primary), #2563eb)',
          boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)',
        }}>
          <ExternalLink size={20} />
          {opened ? `Mở lại ${app.name}` : `Mở ${app.name} & Bắt đầu làm việc`}
        </button>
      </div>

      <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <ArrowLeft size={14} /> Quay lại Dashboard
      </Link>
    </div>
  );
}

function StatusBadge({ isRunning }: { isRunning: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '6px 14px', borderRadius: '20px',
      background: isRunning ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
      border: `1px solid ${isRunning ? 'var(--success)' : 'var(--danger)'}`,
      fontSize: '0.8rem', fontWeight: 'bold',
      color: isRunning ? 'var(--success)' : 'var(--danger)',
    }}>
      <Shield size={14} />
      {isRunning ? 'Đang hoạt động' : 'Chưa bắt đầu'}
    </div>
  );
}

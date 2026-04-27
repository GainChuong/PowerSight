'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ScanFace, KeyRound, UserCircle, LogIn, ShieldCheck, Camera, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [employeeId, setEmployeeId] = useState('EMP-2026');
  const [password, setPassword] = useState('');
  
  // Face registration state
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [registrationPhase, setRegistrationPhase] = useState<'checking' | 'register' | 'capturing' | 'processing' | 'done'>('checking');
  const [registrationError, setRegistrationError] = useState('');
  const [modelsLoading, setModelsLoading] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check if face is already registered on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { isFaceRegistered, loadFaceApi } = await import('@/lib/tracking/faceUtils');
        
        if (isFaceRegistered()) {
          if (!cancelled) {
            setFaceRegistered(true);
            setRegistrationPhase('done');
          }
        } else {
          if (!cancelled) setRegistrationPhase('register');
        }

        // Pre-load models
        await loadFaceApi();
        if (!cancelled) setModelsLoading(false);
      } catch (err) {
        console.error('Failed to load face utils:', err);
        if (!cancelled) {
          setModelsLoading(false);
          setRegistrationPhase('register');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Start webcam for registration
  const startCamera = useCallback(async () => {
    setRegistrationPhase('capturing');
    setRegistrationError('');
    try {
      const { startWebcam } = await import('@/lib/tracking/faceUtils');
      if (videoRef.current) {
        const stream = await startWebcam(videoRef.current);
        streamRef.current = stream;
      }
    } catch (err) {
      setRegistrationError('Không thể truy cập camera. Vui lòng cấp quyền camera.');
      setRegistrationPhase('register');
    }
  }, []);

  // Capture face for registration
  const captureFace = useCallback(async () => {
    if (!videoRef.current) return;
    setRegistrationPhase('processing');
    setRegistrationError('');

    try {
      const { detectFaceDescriptor, storeRegisteredFace, stopWebcam } = await import('@/lib/tracking/faceUtils');
      
      // Try up to 3 times to get a good face descriptor
      let descriptor: Float32Array | null = null;
      for (let i = 0; i < 3; i++) {
        descriptor = await detectFaceDescriptor(videoRef.current);
        if (descriptor) break;
        await new Promise(r => setTimeout(r, 500));
      }

      if (descriptor) {
        storeRegisteredFace(descriptor);
        stopWebcam(streamRef.current);
        streamRef.current = null;
        setFaceRegistered(true);
        setRegistrationPhase('done');
      } else {
        setRegistrationError('Không phát hiện khuôn mặt. Vui lòng đảm bảo khuôn mặt rõ ràng và thử lại.');
        setRegistrationPhase('capturing');
      }
    } catch (err) {
      setRegistrationError('Lỗi khi xử lý khuôn mặt. Vui lòng thử lại.');
      setRegistrationPhase('capturing');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleReRegister = async () => {
    try {
      const { clearRegisteredFace } = await import('@/lib/tracking/faceUtils');
      clearRegisteredFace();
      setFaceRegistered(false);
      setRegistrationPhase('register');
    } catch (err) {
      console.error('Failed to clear registered face:', err);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.warn("Could not enter fullscreen automatically.");
    }
    
    login();
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background decorations */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40vw', height: '40vw', background: 'var(--accent-glow)', filter: 'blur(100px)', borderRadius: '50%', opacity: 0.3 }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40vw', height: '40vw', background: 'rgba(16, 185, 129, 0.2)', filter: 'blur(100px)', borderRadius: '50%', opacity: 0.3 }} />

      <div className="glass-card animate-fade-in" style={{ 
        width: '100%', 
        maxWidth: '480px', 
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 10,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '16px', background: 'rgba(59, 130, 246, 0.1)', marginBottom: '16px' }}>
             <ShieldCheck size={40} color="var(--accent-primary)" />
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0 0 8px 0', color: 'var(--text-main)' }}>PowerSight</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Hệ thống giám sát năng lực điện tử</p>
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', width: '100%', justifyContent: 'center' }}>
          <StepDot active={!faceRegistered} completed={faceRegistered} label="1. Đăng ký mặt" />
          <div style={{ width: '40px', height: '2px', background: faceRegistered ? 'var(--success)' : 'rgba(255,255,255,0.15)' }} />
          <StepDot active={faceRegistered} completed={false} label="2. Đăng nhập" />
        </div>

        {/* ── STEP 1: Face Registration ── */}
        {!faceRegistered && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            
            {registrationPhase === 'checking' && (
              <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <Loader size={32} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Đang tải mô hình nhận diện...</p>
              </div>
            )}

            {registrationPhase === 'register' && (
              <>
                <div style={{
                  width: '120px', height: '120px', borderRadius: '50%',
                  border: '2px dashed var(--accent-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(59, 130, 246, 0.05)',
                }}>
                  <ScanFace size={48} color="var(--accent-primary)" />
                </div>
                <h3 style={{ color: 'var(--text-main)', margin: 0, fontSize: '1.1rem' }}>Đăng ký khuôn mặt</h3>
                <p style={{ color: 'var(--text-muted)', margin: 0, textAlign: 'center', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  Hệ thống cần ghi nhận khuôn mặt của bạn để xác minh danh tính trong khi làm việc.
                </p>
                <button
                  onClick={startCamera}
                  className="btn-primary"
                  disabled={modelsLoading}
                  style={{
                    width: '100%', padding: '14px', marginTop: '8px',
                    opacity: modelsLoading ? 0.5 : 1,
                    background: 'linear-gradient(135deg, var(--accent-primary), #2563eb)',
                  }}
                >
                  <Camera size={18} />
                  {modelsLoading ? 'Đang tải mô hình AI...' : 'Mở Camera để đăng ký'}
                </button>
              </>
            )}

            {(registrationPhase === 'capturing' || registrationPhase === 'processing') && (
              <>
                <div style={{ position: 'relative', width: '100%' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      width: '100%',
                      borderRadius: '16px',
                      border: '2px solid var(--accent-primary)',
                      boxShadow: '0 0 30px rgba(59, 130, 246, 0.2)',
                      transform: 'scaleX(-1)',
                    }}
                  />
                  {/* Face outline guide */}
                  <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '180px', height: '220px',
                    border: '2px dashed rgba(59, 130, 246, 0.6)',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                  }} />
                </div>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem', textAlign: 'center' }}>
                  Đặt khuôn mặt vào khung tròn. Đảm bảo ánh sáng đầy đủ.
                </p>
                <button
                  onClick={captureFace}
                  className="btn-primary"
                  disabled={registrationPhase === 'processing'}
                  style={{
                    width: '100%', padding: '14px',
                    background: registrationPhase === 'processing' 
                      ? 'rgba(59, 130, 246, 0.3)' 
                      : 'linear-gradient(135deg, var(--success), #059669)',
                    opacity: registrationPhase === 'processing' ? 0.7 : 1,
                  }}
                >
                  {registrationPhase === 'processing' ? (
                    <><Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Đang xử lý...</>
                  ) : (
                    <><Camera size={18} /> Chụp ảnh đăng ký</>
                  )}
                </button>
              </>
            )}

            {registrationError && (
              <div style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex', alignItems: 'center', gap: '8px',
                color: '#fca5a5', fontSize: '0.85rem',
              }}>
                <AlertCircle size={16} />
                {registrationError}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Login (after face registered) ── */}
        {faceRegistered && (
          <>
            <div style={{
              width: '100%', padding: '12px', borderRadius: '10px', marginBottom: '20px',
              background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: 'var(--success)', fontSize: '0.85rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle size={18} />
                Khuôn mặt đã được đăng ký
              </div>
              <button 
                type="button"
                onClick={handleReRegister}
                style={{ 
                  background: 'none', border: 'none', color: 'var(--accent-primary)', 
                  fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' 
                }}
              >
                Đăng ký lại
              </button>
            </div>

            <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Mã nhân viên</label>
                <div style={{ position: 'relative' }}>
                  <UserCircle size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    style={{ width: '100%', padding: '12px 12px 12px 40px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', boxSizing: 'border-box' }}
                    required
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Mật khẩu</label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ width: '100%', padding: '12px 12px 12px 40px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', boxSizing: 'border-box' }}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px', marginTop: '8px', display: 'flex', justifyContent: 'center' }}>
                <LogIn size={18} /> Đăng nhập
              </button>
            </form>
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function StepDot({ active, completed, label }: { active: boolean; completed: boolean; label: string }) {
  const bg = completed ? 'var(--success)' : active ? 'var(--accent-primary)' : 'rgba(255,255,255,0.15)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: '10px', height: '10px', borderRadius: '50%', background: bg,
        boxShadow: active ? `0 0 10px ${bg}` : 'none',
        transition: 'all 0.3s',
      }} />
      <span style={{ fontSize: '0.7rem', color: active || completed ? 'var(--text-main)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ScanFace, UserCircle, LogIn, ShieldCheck, Camera, CheckCircle, AlertCircle, Loader, KeyRound, Mail } from 'lucide-react';
import { useFaceVerification } from '@/context/FaceVerificationContext';

export default function Login() {
  const { login } = useAuth();
  const { setFaceDescriptor } = useFaceVerification();
  const [empId, setEmpId] = useState('');
  const [password, setPassword] = useState('password123'); // Default for demo
  const [email, setEmail] = useState('');

  // Face registration state
  const [faceRegistered, setFaceRegistered]     = useState(false);
  const [phase, setPhase]                        = useState<'enter_id' | 'checking' | 'register' | 'capturing' | 'processing' | 'done'>('enter_id');
  const [error, setError]                        = useState('');
  const [modelsLoading, setModelsLoading]        = useState(true);
  const [loginLoading, setLoginLoading]          = useState(false);

  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Khởi tạo mô hình AI ──────────────────────────────────────────────────
  useEffect(() => {
    // Delay loading to allow the UI to paint first
    const timer = setTimeout(async () => {
      try {
        const { loadFaceApi } = await import('@/lib/tracking/faceUtils');
        await loadFaceApi();
        setModelsLoading(false);
      } catch (err) {
        console.error('[Login] Model load error:', err);
        setError('Không thể tải mô hình nhận diện khuôn mặt.');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // ── Kiểm tra ID nhân viên ──────────────────────────────────────────────
  const handleCheckId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId.trim() || !email.trim()) {
      setError('Vui lòng nhập mã nhân viên và email');
      return;
    }
    setError('');
    setPhase('checking');

    try {
      // Try to enter fullscreen on first interaction
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      
      // 1. Kiểm tra trên server (Supabase)
      const res = await fetch(`/api/face?employeeId=${empId}`);
      const data = await res.json();

      if (data.faceDescriptor) {
        // Chuyển đổi từ mảng số về Float32Array
        const descriptor = new Float32Array(data.faceDescriptor);
        setFaceDescriptor(descriptor);
        setFaceRegistered(true);
        setPhase('done');
      } else {
        setFaceRegistered(false);
        setPhase('register');
      }
    } catch (err) {
      console.error('[Login] Check ID error:', err);
      setPhase('register'); // Fallback to register if check fails
    }
  };

  // ── Mở camera ───────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setPhase('capturing');
    setError('');
    try {
      const { startWebcam } = await import('@/lib/tracking/faceUtils');
      if (videoRef.current) {
        const stream = await startWebcam(videoRef.current);
        streamRef.current = stream;
      }
    } catch {
      setError('Không thể truy cập camera. Vui lòng cấp quyền camera.');
      setPhase('register');
    }
  }, []);

  // ── Chụp ảnh đăng ký ────────────────────────────────────────────────────
  const captureFace = useCallback(async () => {
    if (!videoRef.current) return;
    setPhase('processing');
    setError('');

    try {
      const { detectFaceDescriptor, storeRegisteredFace, stopWebcam } = await import('@/lib/tracking/faceUtils');

      let descriptor: Float32Array | null = null;
      for (let i = 0; i < 3; i++) {
        descriptor = await detectFaceDescriptor(videoRef.current);
        if (descriptor) break;
        await new Promise(r => setTimeout(r, 500));
      }

      if (!descriptor) {
        setError('Không phát hiện khuôn mặt. Vui lòng đảm bảo ánh sáng tốt và thử lại.');
        setPhase('capturing');
        return;
      }

      // Lưu vào context (memory)
      setFaceDescriptor(descriptor);

      // Lưu lên Supabase
      const saveRes = await fetch('/api/face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: empId, descriptor: Array.from(descriptor) }),
      });
      if (!saveRes.ok) {
        console.warn('[Login] Face saved locally but not to DB:', await saveRes.text());
      } else {
        console.log('[Login] Face saved to Supabase successfully.');
      }

      stopWebcam(streamRef.current);
      streamRef.current = null;
      setFaceRegistered(true);
      setPhase('done');
    } catch (err) {
      console.error('[Login] Capture error:', err);
      setError('Lỗi khi xử lý khuôn mặt. Vui lòng thử lại.');
      setPhase('capturing');
    }
  }, [empId]);

  // ── Dọn dẹp camera khi unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };
  }, []);

  // ── Đăng ký lại khuôn mặt ───────────────────────────────────────────────
  const handleReRegister = async () => {
    try {
      setFaceDescriptor(null);
      // Xóa trong DB
      await fetch('/api/face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: empId, descriptor: null }),
      }).catch(() => {});
      setFaceRegistered(false);
      setPhase('register');
      setError('');
    } catch (err) {
      console.error('[Login] Re-register error:', err);
    }
  };

  // ── Đăng nhập ───────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoginLoading(true);
    try {
      const res  = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          employeeId: empId,
          password: password 
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Mã nhân viên hoặc mật khẩu không đúng');
        return;
      }
      try { await document.documentElement.requestFullscreen(); } catch { /* optional */ }
      login(empId, email);
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại sau.');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', width: '100vw',
      background: 'radial-gradient(ellipse at 30% 40%, #1e3a5f 0%, #0f172a 60%, #0a0f1e 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background blobs */}
      <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: '45vw', height: '45vw', background: 'rgba(59,130,246,0.18)', filter: 'blur(120px)', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: '45vw', height: '45vw', background: 'rgba(16,185,129,0.12)', filter: 'blur(120px)', borderRadius: '50%' }} />

      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', maxWidth: '460px',
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px', padding: '44px 40px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
        animation: 'lgFadeIn 0.4s ease-out',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '14px', borderRadius: '18px', background: 'rgba(59,130,246,0.12)', marginBottom: '16px', border: '1px solid rgba(59,130,246,0.2)' }}>
            <ShieldCheck size={40} color="#3b82f6" />
          </div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 6px', color: '#fff', letterSpacing: '-0.02em' }}>PowerSight</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem' }}>Hệ thống giám sát năng lực điện tử</p>
        </div>

        {/* Bước chỉ báo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
          <StepDot active={phase === 'enter_id'} completed={phase !== 'enter_id'} label="1. Mã NV" />
          <div style={{ width: '30px', height: '2px', background: phase !== 'enter_id' ? '#10b981' : 'rgba(255,255,255,0.1)', borderRadius: '1px' }} />
          <StepDot active={!faceRegistered && phase !== 'enter_id'} completed={faceRegistered} label="2. Khuôn mặt" />
          <div style={{ width: '30px', height: '2px', background: faceRegistered ? '#10b981' : 'rgba(255,255,255,0.1)', borderRadius: '1px' }} />
          <StepDot active={faceRegistered} completed={false} label="3. Đăng nhập" />
        </div>

        {/* ── BƯỚC 0: Nhập mã nhân viên ── */}
        {phase === 'enter_id' && (
          <form onSubmit={handleCheckId} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <h3 style={{ color: '#fff', margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 700 }}>Chào mừng trở lại</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: '0.9rem' }}>Vui lòng nhập mã nhân viên để bắt đầu</p>
            </div>
            
            <div style={{ position: 'relative' }}>
              <UserCircle size={18} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Ví dụ: EM001"
                value={empId}
                onChange={e => setEmpId(e.target.value.toUpperCase())}
                required
                autoFocus
                style={{
                  width: '100%', padding: '14px 14px 14px 44px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px', color: '#fff', fontSize: '1rem', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ position: 'relative' }}>
              <Mail size={18} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                placeholder="Email để nhận báo cáo (VD: name@gmail.com)"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  width: '100%', padding: '14px 14px 14px 44px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px', color: '#fff', fontSize: '1rem', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%', padding: '14px',
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                border: 'none', borderRadius: '12px',
                color: 'white', fontWeight: 700, fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
              }}
            >
              Tiếp tục
            </button>
          </form>
        )}

        {/* ── BƯỚC 1: Đăng ký khuôn mặt ── */}
        {!faceRegistered && phase !== 'enter_id' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>

            {phase === 'checking' && (
              <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                <Loader size={32} color="#3b82f6" style={{ animation: 'lgSpin 1s linear infinite' }} />
                <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: '0.9rem' }}>Đang kiểm tra dữ liệu khuôn mặt...</p>
              </div>
            )}

            {phase === 'register' && (
              <>
                <div style={{
                  width: '110px', height: '110px', borderRadius: '50%',
                  border: '2px dashed rgba(59,130,246,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(59,130,246,0.05)',
                }}>
                  <ScanFace size={46} color="#3b82f6" />
                </div>
                <h3 style={{ color: '#fff', margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Đăng ký khuôn mặt</h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, textAlign: 'center', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  Hệ thống cần ghi nhận khuôn mặt để xác minh danh tính định kỳ trong khi làm việc.
                </p>
                <button
                  onClick={startCamera}
                  disabled={modelsLoading}
                  style={{
                    width: '100%', padding: '14px', marginTop: '8px',
                    background: modelsLoading ? 'rgba(59,130,246,0.3)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    border: 'none', borderRadius: '12px',
                    color: 'white', fontWeight: 700, fontSize: '0.95rem',
                    cursor: modelsLoading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    boxShadow: modelsLoading ? 'none' : '0 4px 20px rgba(59,130,246,0.35)',
                  }}
                >
                  <Camera size={18} />
                  {modelsLoading ? 'Đang tải mô hình AI...' : 'Mở Camera để đăng ký'}
                </button>
              </>
            )}

            {(phase === 'capturing' || phase === 'processing') && (
              <>
                <div style={{ position: 'relative', width: '100%' }}>
                  <video
                    ref={videoRef} autoPlay muted playsInline
                    style={{
                      width: '100%', borderRadius: '16px',
                      border: '2px solid #3b82f6',
                      boxShadow: '0 0 30px rgba(59,130,246,0.25)',
                      transform: 'scaleX(-1)',
                    }}
                  />
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '170px', height: '210px',
                    border: '2px dashed rgba(59,130,246,0.6)',
                    borderRadius: '50%', pointerEvents: 'none',
                  }} />
                </div>
                <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: '0.85rem', textAlign: 'center' }}>
                  Đặt khuôn mặt vào khung tròn. Đảm bảo ánh sáng đầy đủ.
                </p>
                <button
                  onClick={captureFace}
                  disabled={phase === 'processing'}
                  style={{
                    width: '100%', padding: '14px',
                    background: phase === 'processing' ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none', borderRadius: '12px',
                    color: 'white', fontWeight: 700, fontSize: '0.95rem',
                    cursor: phase === 'processing' ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    boxShadow: '0 4px 20px rgba(16,185,129,0.3)',
                  }}
                >
                  {phase === 'processing'
                    ? <><Loader size={18} style={{ animation: 'lgSpin 1s linear infinite' }} /> Đang xử lý...</>
                    : <><Camera size={18} /> Chụp ảnh đăng ký</>
                  }
                </button>
              </>
            )}

            {error && (
              <div style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                display: 'flex', alignItems: 'center', gap: '8px',
                color: '#fca5a5', fontSize: '0.85rem',
              }}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── BƯỚC 2: Đăng nhập ── */}
        {faceRegistered && (
          <>
            <div style={{
              width: '100%', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px',
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: '#10b981', fontSize: '0.85rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle size={18} />
                Mã NV: {empId}
              </div>
              <button
                onClick={handleReRegister}
                style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Đăng ký lại mặt
              </button>
            </div>

            <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                  Mã nhân viên
                </label>
                <div style={{ position: 'relative' }}>
                  <UserCircle size={18} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={empId}
                    readOnly
                    style={{
                      width: '100%', padding: '12px 12px 12px 40px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px', color: 'rgba(255,255,255,0.8)', outline: 'none',
                      boxSizing: 'border-box', cursor: 'default',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                  Email
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="email"
                    value={email}
                    readOnly
                    style={{
                      width: '100%', padding: '12px 12px 12px 40px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px', color: 'rgba(255,255,255,0.8)', outline: 'none',
                      boxSizing: 'border-box', cursor: 'default',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                  Mật khẩu
                </label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={18} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{
                      width: '100%', padding: '12px 12px 12px 40px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px', color: '#fff', outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: '10px',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  color: '#fca5a5', fontSize: '0.85rem',
                }}>
                  <AlertCircle size={16} />{error}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                style={{
                  width: '100%', padding: '14px', marginTop: '4px',
                  background: loginLoading ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  border: 'none', borderRadius: '12px',
                  color: 'white', fontWeight: 700, fontSize: '1rem',
                  cursor: loginLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: loginLoading ? 'none' : '0 4px 20px rgba(59,130,246,0.4)',
                }}
              >
                {loginLoading
                  ? <><Loader size={18} style={{ animation: 'lgSpin 1s linear infinite' }} /> Đang xác thực...</>
                  : <><LogIn size={18} /> Đăng nhập</>
                }
              </button>
            </form>
          </>
        )}
      </div>

      <style>{`
        @keyframes lgFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lgSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function StepDot({ active, completed, label }: { active: boolean; completed: boolean; label: string }) {
  const color = completed ? '#10b981' : active ? '#3b82f6' : 'rgba(255,255,255,0.15)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: '10px', height: '10px', borderRadius: '50%', background: color,
        boxShadow: (active || completed) ? `0 0 10px ${color}` : 'none',
        transition: 'all 0.4s',
      }} />
      <span style={{ fontSize: '0.7rem', color: (active || completed) ? '#fff' : 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  );
}

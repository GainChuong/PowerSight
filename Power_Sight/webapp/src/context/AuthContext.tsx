'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

const AUTH_VERSION = '4'; // Tăng số này để xóa session cũ và force re-login

interface AuthContextType {
  isAuthenticated: boolean;
  employeeId: string | null;
  userEmail: string | null;
  login: (employeeId: string, email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // RESET LOGIC: Nếu đây là một session mới (mở tab mới/refresh browser), 
    // chúng ta xóa localStorage để ép user phải login lại từ đầu.
    // Nhưng sau khi login, họ có thể thoải mái chuyển tab/page trong cùng session.
    if (typeof window !== 'undefined' && !sessionStorage.getItem('ps_session_active')) {
      localStorage.removeItem('power_sight_auth');
      localStorage.removeItem('tracking_start_time');
      localStorage.removeItem('tracking_is_running');
      sessionStorage.setItem('ps_session_active', 'true');
    }

    // Tự động khôi phục session nếu có trong localStorage
    const savedAuth = localStorage.getItem('power_sight_auth');
    if (savedAuth) {
      try {
        const { id, email, version } = JSON.parse(savedAuth);
        // Kiểm tra version để tránh lỗi cấu trúc data cũ
        if (version === AUTH_VERSION) {
          setEmployeeId(id);
          setUserEmail(email);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('power_sight_auth');
        }
      } catch (e) {
        console.error('Error parsing saved auth:', e);
        localStorage.removeItem('power_sight_auth');
      }
    }
  }, []);

  const login = async (id: string, email: string) => {
    console.log(`[Auth] Logging in user ${id}, triggering data reset for today...`);
    
    // 1. Reset database for today
    try {
      const resetRes = await fetch(`/api/tracker?employeeId=${id}`, { method: 'DELETE' });
      if (!resetRes.ok) {
        const errorData = await resetRes.json();
        console.error('[Auth] Database reset failed:', errorData.error);
      } else {
        console.log('[Auth] Database today-data reset successfully.');
      }
    } catch (err) {
      console.error('[Auth] Network error during reset:', err);
    }

    // 2. Reset extension and local counters
    if (typeof window !== 'undefined') {
      window.postMessage({ 
        source: 'powersight-webapp', 
        type: 'POWERSIGHT_COMMAND', 
        command: 'RESET' 
      }, '*');
      
      // Also dispatch a custom event for TrackingContext to immediately clear its local state
      window.dispatchEvent(new CustomEvent('POWERSIGHT_RESET_LOCAL_STATE'));
    }

    setIsAuthenticated(true);
    setEmployeeId(id);
    setUserEmail(email);
    localStorage.setItem('power_sight_auth', JSON.stringify({ id, email, version: AUTH_VERSION }));
  };

  const logout = () => {
    setIsAuthenticated(false);
    setEmployeeId(null);
    setUserEmail(null);
    localStorage.removeItem('power_sight_auth');
    if (typeof window !== 'undefined') {
      Object.keys(sessionStorage)
        .filter(k => k.startsWith('viewer_'))
        .forEach(k => sessionStorage.removeItem(k));
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, employeeId, userEmail, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

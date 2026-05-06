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
    try {
      const savedAuth = localStorage.getItem('power_sight_auth');
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        // Kiểm tra version - nếu khác version hiện tại thì xóa session cũ
        if (parsed.version !== AUTH_VERSION) {
          localStorage.removeItem('power_sight_auth');
          return;
        }
        const { id, email } = parsed;
        if (id && typeof id === 'string' && id.trim().length > 0) {
          setIsAuthenticated(true);
          setEmployeeId(id);
          if (email) setUserEmail(email);
        } else {
          localStorage.removeItem('power_sight_auth');
        }
      }
    } catch {
      localStorage.removeItem('power_sight_auth');
    }
  }, []);

  const login = (id: string, email: string) => {
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

'use client';

import { useAuth } from '@/context/AuthContext';
import Login from './Login';
import { useEffect, useState } from 'react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Prevents hydration mismatch on initial render
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <>{children}</>;
}

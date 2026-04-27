import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

// Mock Tracking Context
vi.mock('@/context/TrackingContext', () => ({
  useTracking: () => ({
    isRunning: false,
    seconds: 0,
    startTracking: vi.fn(),
  }),
}));

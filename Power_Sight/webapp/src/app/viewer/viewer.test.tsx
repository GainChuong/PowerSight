import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ViewerPage, { ALLOWED_APPS } from './[id]/page';
import { useParams } from 'next/navigation';

describe('Viewer Configuration', () => {
  it('should have SAP configured with the correct TUM URL', () => {
    expect(ALLOWED_APPS.sap.url).toBe('https://s36.gb.ucc.cit.tum.de/sap/bc/ui2/flp?sap-client=312&sap-language=EN#Shell-home');
  });

  it('should have SAP set to non-embeddable (Launch Pad UI)', () => {
    expect(ALLOWED_APPS.sap.embeddable).toBe(false);
  });

  it('should have Gmail set to non-embeddable', () => {
    expect(ALLOWED_APPS.gmail.embeddable).toBe(false);
  });
});

describe('ViewerPage Rendering', () => {
  it('should show unauthorized message for unknown apps', () => {
    vi.mocked(useParams).mockReturnValue({ id: 'unknown' });
    render(<ViewerPage />);
    expect(screen.getByText(/Ứng dụng không được phép/i)).toBeInTheDocument();
  });

  it('should render launch pad for SAP', () => {
    vi.mocked(useParams).mockReturnValue({ id: 'sap' });
    render(<ViewerPage />);
    expect(screen.getByText('SAP')).toBeInTheDocument();
    expect(screen.getByText(/Mở SAP & Bắt đầu làm việc/i)).toBeInTheDocument();
  });
});

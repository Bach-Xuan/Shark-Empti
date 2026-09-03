import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Toaster } from '@/components/ui/toaster';
import { showErrorToast } from '@/lib/error-toast';
import { cleanup } from '@testing-library/react';
import React from 'react';

afterEach(cleanup);

describe('error toast', () => {
  it('renders the code and safe diagnostic values', async () => {
    render(<Toaster />);
    showErrorToast({ code: 'AI-UPSTREAM-502', message: 'Request unavailable.', values: { provider: 'Nvidia', providerCode: '502' } });
    expect(await screen.findByText('Error code: AI-UPSTREAM-502')).toBeTruthy();
    expect(screen.getByText(/providerCode: 502/)).toBeTruthy();
    expect(screen.queryByText(/Request unavailable/)).toBeNull();
  });
});

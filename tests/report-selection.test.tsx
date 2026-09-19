import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ReportSelectionRow } from '@/components/report-selection-row';

afterEach(cleanup);
it('toggles exactly once from the checkbox, row label, and keyboard with an accessible name', async () => {
  const changed = vi.fn();
  function Harness() {
    const [checked, setChecked] = useState(false);
    return <ReportSelectionRow checked={checked} onToggle={() => { changed(); setChecked(value => !value); }} label="Phép cộng — 19/09/2026"><span>Session details</span></ReportSelectionRow>;
  }
  render(<Harness />);
  const user = userEvent.setup();
  const control = screen.getByRole('checkbox', { name: 'Phép cộng — 19/09/2026' });
  await user.click(control);
  expect(control.getAttribute('aria-checked')).toBe('true');
  expect(changed).toHaveBeenCalledTimes(1);
  await user.click(screen.getByText('Session details'));
  expect(control.getAttribute('aria-checked')).toBe('false');
  expect(changed).toHaveBeenCalledTimes(2);
  control.focus();
  await user.keyboard('[Space]');
  expect(control.getAttribute('aria-checked')).toBe('true');
  expect(changed).toHaveBeenCalledTimes(3);
  await user.click(control.closest('label')!);
  expect(control.getAttribute('aria-checked')).toBe('false');
  expect(changed).toHaveBeenCalledTimes(4);
});

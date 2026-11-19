'use client';
import type { ReactNode } from 'react';

export function ReportSelectionRow({ checked, onToggle, label, className, children }: {
  checked: boolean; onToggle: () => void; label: string; className?: string; children: ReactNode;
}) {
  return <label className={className}>
    <input type="checkbox" checked={checked} onChange={onToggle} aria-label={label}
      className="h-6 w-6 shrink-0 cursor-pointer accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
    {children}
  </label>;
}

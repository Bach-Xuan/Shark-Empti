'use client';
import type { ReactNode } from 'react';
import { Checkbox } from './ui/checkbox';

export function ReportSelectionRow({ checked, onToggle, label, className, children }: {
  checked: boolean; onToggle: () => void; label: string; className?: string; children: ReactNode;
}) {
  return <label className={className}>
    <span className="shrink-0"><Checkbox checked={checked} onCheckedChange={onToggle}
      aria-label={label} className="w-6 h-6 border-2" /></span>
    {children}
  </label>;
}

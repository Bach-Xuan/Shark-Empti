'use client';
import dynamic from 'next/dynamic';
import { memo, Suspense } from 'react';

// Plain discussion/chat does not need the KaTeX parser or its stylesheet.
const MathText = dynamic(() => import('./math-text').then(module => module.MathText));

export const LatexText = memo(function LatexText({ text }: { text: string }) {
  if (!text || !/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/.test(text)) return <span className="leading-relaxed">{text}</span>;
  return <Suspense fallback={<span>{text}</span>}><MathText text={text} /></Suspense>;
});

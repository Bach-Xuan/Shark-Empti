
'use client';

import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexTextProps {
  text: string;
}

/**
 * A component that parses text and renders LaTeX expressions using KaTeX.
 * Supports inline ($...$) and block ($$...$$) math.
 */
export function LatexText({ text }: LatexTextProps) {
  const parts = useMemo(() => {
    if (!text) return [];
    // Split by $$...$$ (block) or $...$ (inline)
    return text.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+?\$)/g);
  }, [text]);

  return (
    <span className="leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const content = part.slice(2, -2);
          try {
            return (
              <span
                key={index}
                className="block my-4 overflow-x-auto text-center"
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(content, {
                    displayMode: true,
                    throwOnError: false,
                  }),
                }}
              />
            );
          } catch (e) {
            return <span key={index}>{part}</span>;
          }
        } else if (part.startsWith('$') && part.endsWith('$')) {
          const content = part.slice(1, -1);
          try {
            return (
              <span
                key={index}
                className="inline-block px-1"
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(content, {
                    displayMode: false,
                    throwOnError: false,
                  }),
                }}
              />
            );
          } catch (e) {
            return <span key={index}>{part}</span>;
          }
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

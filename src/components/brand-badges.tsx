'use client';

import { UiText } from "@/components/ui-text";

/**
 * @fileOverview Huy hiệu thương hiệu cố định ở góc dưới bên trái màn hình.
 */
export default function BrandBadges() {
  return (
    <div className="fixed bottom-6 left-6 z-[9999] flex flex-col gap-2 pointer-events-none select-none animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="bg-card/90 backdrop-blur-md px-4 md:px-6 py-2 md:py-2.5 rounded-full border-2 border-border shadow-duo">
        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">
          <UiText id="credits" />
        </span>
      </div>
      <div className="bg-card/90 backdrop-blur-md px-4 md:px-6 py-2 md:py-2.5 rounded-full border-2 border-border shadow-duo w-fit">
        <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.15em] text-primary">
          SHARK EMPTI v1.15.1
        </span>
      </div>
    </div>
  );
}

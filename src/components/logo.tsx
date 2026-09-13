import { Sparkles } from 'lucide-react';

export const Logo = ({ className = "w-10 h-10" }: { className?: string }) => {
  return (
    <div className={`${className} flex items-center justify-center text-primary`}>
      <Sparkles className="w-full h-full fill-current" />
    </div>
  );
};
'use client';
import { Binary, Type, FlaskConical } from 'lucide-react';
import { useAppPreferences } from './app-preferences';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
const LATEX_SNIPPETS = [
  {
    id: 'math',
    label: { vi: 'Toán học', en: 'Mathematics' },
    icon: Binary,
    items: [
      { code: '\\frac{a}{b}', label: { vi: 'Phân số', en: 'Fraction' } },
      { code: '\\sqrt{x}', label: { vi: 'Căn bậc 2', en: 'Square root' } },
      { code: '\\sqrt[n]{x}', label: { vi: 'Căn n', en: 'Nth root' } },
      { code: 'x^{2}', label: { vi: 'Mũ 2', en: 'Square' } },
      { code: 'x^{n}', label: { vi: 'Mũ n', en: 'Power' } },
      { code: 'x_{n}', label: { vi: 'Chỉ số', en: 'Subscript' } },
      { code: '\\sum_{i=1}^{n}', label: { vi: 'Tổng', en: 'Sum' } },
      { code: '\\int_{a}^{b}', label: { vi: 'Tích phân', en: 'Integral' } },
      { code: '\\lim_{x \\to \\infty}', label: { vi: 'Giới hạn', en: 'Limit' } },
      { code: '\\log_{a}x', label: { vi: 'Log a', en: 'Log base a' } },
      { code: '\\ln x', label: { vi: 'Log nepe', en: 'Natural log' } },
      { code: '\\sin x', label: { vi: 'Sin', en: 'Sin' } },
      { code: '\\cos x', label: { vi: 'Cos', en: 'Cos' } },
      { code: '\\tan x', label: { vi: 'Tan', en: 'Tan' } },
    ]
  },
  {
    id: 'symbols',
    label: { vi: 'Ký hiệu', en: 'Symbols' },
    icon: Type,
    items: [
      { code: '\\pi', label: { vi: 'Pi', en: 'Pi' } },
      { code: '\\alpha', label: { vi: 'Alpha', en: 'Alpha' } },
      { code: '\\beta', label: { vi: 'Beta', en: 'Beta' } },
      { code: '\\gamma', label: { vi: 'Gamma', en: 'Gamma' } },
      { code: '\\Delta', label: { vi: 'Delta', en: 'Delta' } },
      { code: '\\theta', label: { vi: 'Theta', en: 'Theta' } },
      { code: '\\lambda', label: { vi: 'Lambda', en: 'Lambda' } },
      { code: '\\omega', label: { vi: 'Omega', en: 'Omega' } },
      { code: '\\infty', label: { vi: 'Vô cực', en: 'Infinity' } },
      { code: '\\neq', label: { vi: 'Khác', en: 'Not equal' } },
      { code: '\\approx', label: { vi: 'Xấp xỉ', en: 'Approximately' } },
      { code: '\\leq', label: { vi: 'Nhỏ/bằng', en: 'Less or equal' } },
      { code: '\\geq', label: { vi: 'Lớn/bằng', en: 'Greater or equal' } },
      { code: '\\rightarrow', label: { vi: 'Suy ra', en: 'Implies' } },
      { code: '\\forall', label: { vi: 'Với mọi', en: 'For all' } },
      { code: '\\exists', label: { vi: 'Tồn tại', en: 'Exists' } },
    ]
  },
  {
    id: 'chem',
    label: { vi: 'Hóa học', en: 'Chemistry' },
    icon: FlaskConical,
    items: [
      { code: 'H_{2}O', label: { vi: 'Nước', en: 'Water' } },
      { code: 'CO_{2}', label: { vi: 'CO2', en: 'CO2' } },
      { code: 'O_{2}', label: { vi: 'Oxy', en: 'Oxygen' } },
      { code: 'H_{2}SO_{4}', label: { vi: 'H2SO4', en: 'H2SO4' } },
      { code: 'C_{6}H_{12}O_{6}', label: { vi: 'Glucose', en: 'Glucose' } },
      { code: '\\rightarrow', label: { vi: 'Mũi tên', en: 'Arrow' } },
      { code: '\\rightleftharpoons', label: { vi: 'Thuận nghịch', en: 'Equilibrium' } },
      { code: '\\uparrow', label: { vi: 'Bay hơi', en: 'Gas' } },
      { code: '\\downarrow', label: { vi: 'Kết tủa', en: 'Precipitate' } },
      { code: 'SO_{4}^{2-}', label: { vi: 'Sunfat', en: 'Sulfate' } },
      { code: 'OH^{-}', label: { vi: 'Hydroxit', en: 'Hydroxide' } },
      { code: 'H^{+}', label: { vi: 'Proton', en: 'Proton' } },
    ]
  }
];
export function LatexQuickToolbar({ onSelect }: { onSelect: (s: string) => void }) {
  const { lang } = useAppPreferences();
  return (
    <Card className="border-[3px] rounded-2xl md:rounded-[2rem] p-3 md:p-5 bg-muted/5 shadow-inner">
      <Tabs defaultValue="math" className="w-full">
        <TabsList className="bg-transparent h-auto p-0 flex flex-wrap gap-2 mb-4 justify-start">
          {LATEX_SNIPPETS.map(group => (
            <TabsTrigger 
              key={group.id} 
              value={group.id} 
              className="rounded-xl px-3 md:px-6 py-2 md:py-3 border-2 border-border data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:border-primary/20 text-[8px] md:text-xs font-black uppercase tracking-widest transition-all"
            >
              <group.icon className="w-3.5 h-3.5 md:w-5 md:h-5 mr-1.5 md:mr-2" />
              {group.label[lang]}
            </TabsTrigger>
          ))}
        </TabsList>
        {LATEX_SNIPPETS.map(group => (
          <TabsContent key={group.id} value={group.id} className="mt-0 outline-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {group.items.map((item, idx) => (
                <Button 
                  key={idx} 
                  variant="outline" 
                  size="sm" 
                  className="h-10 md:h-12 justify-start px-2 md:px-3 rounded-xl md:rounded-2xl border-2 hover:border-primary hover:bg-primary/5 bg-card transition-all btn-duo shadow-none"
                  onClick={() => onSelect(item.code)}
                >
                  <span className="font-code text-[8px] md:text-sm text-primary truncate flex-1">{item.code}</span>
                  <span className="text-[6px] md:text-[8px] font-black uppercase opacity-40 truncate ml-1 shrink-0">{item.label[lang]}</span>
                </Button>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}

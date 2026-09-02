
/**
 * @fileOverview Utilities for processing activity data.
 */

export function getDaysInMonth(year: number, month: number): Date[] {
  const date = new Date(year, month, 1);
  const days: Date[] = [];
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

export function groupActivityByMonth(data: Record<string, boolean>) {
  const months: Record<string, { year: number; month: number; activeDays: string[] }> = {};
  
  Object.keys(data).forEach(dateStr => {
    const parts = dateStr.split('-').map(Number);
    if (parts.length < 2) return;
    const [y, m] = parts;
    const key = `${y}-${m}`;
    if (!months[key]) {
      months[key] = { year: y, month: m - 1, activeDays: [] };
    }
    months[key].activeDays.push(dateStr);
  });

  return Object.values(months).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

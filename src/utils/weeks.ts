export interface WeekInfo {
  label: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

/**
 * Generates Friday-to-Thursday weeks for the year 2026.
 * Week-1 starts on Jan 2, 2026 (Friday) and ends on Jan 9, 2026 (Friday) [Special Friday-to-Friday].
 * Week-2 starts on Jan 9, 2026 (Friday) and ends on Jan 15, 2026 (Thursday) [Standard].
 * Week-21 starts on May 22, 2026 (Friday) and ends on May 29, 2026 (Friday) [Special Friday-to-Friday].
 * Week-22 starts on May 29, 2026 (Friday) and ends on Jun 04, 2026 (Thursday) [Standard].
 */
export function generateWeeksFor2026(): Record<string, WeekInfo> {
  const weeksRecord: Record<string, WeekInfo> = {};
  const startDate = new Date(2026, 0, 2); // January 2, 2026 (Friday) -> Start of Week-1
  
  for (let i = 1; i <= 52; i++) {
    const wStart = new Date(startDate.getTime());
    wStart.setDate(startDate.getDate() + (i - 1) * 7);
    
    const wEnd = new Date(wStart.getTime());
    // Special Friday-to-Friday weeks: Week-1 and Week-21 end on the subsequent Friday (+7 days)
    if (i === 1 || i === 21) {
      wEnd.setDate(wStart.getDate() + 7);
    } else {
      wEnd.setDate(wStart.getDate() + 6);
    }
    
    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    
    const label = `Week-${i}`;
    weeksRecord[label] = {
      label,
      start: formatDate(wStart),
      end: formatDate(wEnd)
    };
  }
  return weeksRecord;
}

export const weeks = generateWeeksFor2026();

/**
 * Calculates correct Week string matching the generated weeks.
 * From a given YYYY-MM-DD start date.
 */
export function getWeekFromStartDate(dateStr: string): string {
  if (!dateStr) return '';
  
  let formattedDate = dateStr.trim();
  
  // Normalize formatted date to YYYY-MM-DD if in visual/slashed format
  if (formattedDate.includes('/') || (formattedDate.includes('-') && formattedDate.split('-')[0].length !== 4)) {
    const parsed = new Date(formattedDate);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      formattedDate = `${y}-${m}-${d}`;
    }
  }
  
  // 1. Check for exact start match first to prioritize starting boundaries
  for (const wkKey of Object.keys(weeks)) {
    if (weeks[wkKey].start === formattedDate) {
      return wkKey;
    }
  }
  
  // 2. Check for range matches
  for (const wkKey of Object.keys(weeks)) {
    if (formattedDate >= weeks[wkKey].start && formattedDate <= weeks[wkKey].end) {
      return wkKey;
    }
  }
  
  // 3. Fallback: Mathematical division if date falls outside or on a gap
  const parsed = new Date(formattedDate);
  if (isNaN(parsed.getTime())) return '';
  const firstFriday = new Date(2026, 0, 2);
  const diffTime = parsed.getTime() - firstFriday.getTime();
  const diffDays = Math.floor(diffTime / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return 'Week-1';
  const weekNo = Math.min(52, Math.max(1, Math.floor(diffDays / 7) + 1));
  return `Week-${weekNo}`;
}

export default weeks;

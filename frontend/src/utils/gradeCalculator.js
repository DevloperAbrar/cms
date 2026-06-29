/**
 * Client-side grade helpers (display only — authoritative calc is server-side).
 */
export const getGradeLetter = (percentage) => {
    if (percentage >= 90) return 'O';
    if (percentage >= 80) return 'A+';
    if (percentage >= 70) return 'A';
    if (percentage >= 60) return 'B+';
    if (percentage >= 50) return 'B';
    if (percentage >= 40) return 'C';
    return 'F';
  };
  
  export const getAttendanceColor = (pct) => {
    if (pct >= 75) return 'text-green-600';
    if (pct >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  export const formatMarks = (obtained, max) => {
    if (max === 0) return '—';
    return `${obtained}/${max} (${((obtained / max) * 100).toFixed(1)}%)`;
  };
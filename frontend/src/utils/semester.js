// Single source of truth for the Year → Semester mapping used across the app.
// Every academic year has exactly 2 semesters (matches backend/services/grade.service.js
// calculateCGPA default: semestersPerYear = 2).
//   Year 1 -> Sem 1, 2
//   Year 2 -> Sem 3, 4
//   Year 3 -> Sem 5, 6
//   Year 4 -> Sem 7, 8
//   Year 5 -> Sem 9, 10
//   Year 6 -> Sem 11, 12
export const SEMESTERS_PER_YEAR = 2;

// Highest "Year" offered anywhere in the dropdowns (covers 6-year programs).
export const MAX_YEAR = 6;

/**
 * Returns the semester numbers that belong to a given year.
 * getSemestersForYear(3) -> [5, 6]
 * getSemestersForYear('') -> []
 */
export const getSemestersForYear = (year) => {
  const y = Number(year);
  if (!y || y < 1) return [];
  const first = (y - 1) * SEMESTERS_PER_YEAR + 1;
  return Array.from({ length: SEMESTERS_PER_YEAR }, (_, i) => first + i);
};

/**
 * Returns every semester number from 1 up to (and including) the given year's
 * last semester — used where a student should browse all semesters they've
 * been enrolled in so far, not just the current year's two.
 * getSemestersUpToYear(3) -> [1, 2, 3, 4, 5, 6]
 */
export const getSemestersUpToYear = (year) => {
  const y = Number(year);
  if (!y || y < 1) return [];
  return Array.from({ length: y * SEMESTERS_PER_YEAR }, (_, i) => i + 1);
};
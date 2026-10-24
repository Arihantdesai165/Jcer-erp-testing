/**
 * Academic Year Normalization & Comparison Utility (Frontend)
 *
 * Handles diverse academic year formats:
 * - "2026-2027", "2026–2027", "2026/2027", "2026 - 2027", "2026–27", "2026-27"
 * - Normalizes to canonical "YYYY-YY" format (e.g. "2026-27")
 */

/**
 * Normalizes any academic-year string into the canonical "YYYY-YY" format (e.g. "2026-27").
 *
 * @param value Raw academic year input string
 * @returns Canonical academic year string (e.g. "2026-27") or empty string if invalid/empty
 */
export function normalizeAcademicYear(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value).trim();
  if (!str) {
    return '';
  }

  // Matches 4-digit start year, separator (dash, en-dash, em-dash, slash, backslash), and 2-4 digit end year
  // Unicode dash ranges: \u002D (hyphen), \u2010-\u2015 (hyphens/dashes), \u2212 (minus)
  const rangeMatch = str.match(/^(\d{4})\s*[\-\u2010-\u2015\u2212\/\\]\s*(\d{2,4})$/);
  if (rangeMatch) {
    const startYear = rangeMatch[1];
    let endYear = rangeMatch[2];
    if (endYear.length === 4) {
      endYear = endYear.slice(-2);
    } else if (endYear.length === 1) {
      endYear = endYear.padStart(2, '0');
    }
    return `${startYear}-${endYear}`;
  }

  // Matches single 4-digit year like "2026" -> converts to "2026-27"
  const singleMatch = str.match(/^(\d{4})$/);
  if (singleMatch) {
    const startYear = parseInt(singleMatch[1], 10);
    const endYear = ((startYear + 1) % 100).toString().padStart(2, '0');
    return `${startYear}-${endYear}`;
  }

  // Fallback: replace Unicode dashes with standard hyphen and collapse multiple spaces
  return str
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether two academic year representations refer to the same academic year.
 *
 * @param year1 First academic year string
 * @param year2 Second academic year string
 * @returns True if both represent the same academic year
 */
export function areAcademicYearsEqual(
  year1?: string | null,
  year2?: string | null
): boolean {
  if (!year1 || !year2) {
    return false;
  }

  const norm1 = normalizeAcademicYear(year1);
  const norm2 = normalizeAcademicYear(year2);

  if (norm1 && norm2) {
    return norm1 === norm2;
  }

  return String(year1).trim().toLowerCase() === String(year2).trim().toLowerCase();
}

export default {
  normalizeAcademicYear,
  areAcademicYearsEqual,
};

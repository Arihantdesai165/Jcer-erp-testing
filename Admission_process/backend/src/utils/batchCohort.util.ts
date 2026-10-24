/**
 * Utility for calculating and formatting student Engineering Cohort / Batch.
 *
 * An Engineering degree has a fixed 4-year cohort span (StartYear–EndYear).
 *
 * Rules:
 * - Regular students starting Engineering in year Y (Semester 1) belong to cohort Y–(Y+4).
 *   Example: Started in 2026 -> Batch = "2026–2030"
 * - In subsequent years (e.g., Semester 3 in 2027-28), their Batch remains fixed as "2026–2030".
 * - Lateral-entry students who join directly into Semester 3 in year Y (e.g. 2027)
 *   belong to the cohort that started in (Y - 1).
 *   Example: Joining in 2027 into Semester 3 -> Batch = "2026–2030".
 */

export interface CohortCalculationParams {
  batchYear?: number | null;
  admissionBatch?: string | null;
  admissionType?: string | null;
  initialSemester?: number | null;
  entrySemester?: number | null;
  currentAcademicYear?: string | null;
  academicYear?: string | null;
  semester?: number | null;
  usn?: string | null;
}

export interface CohortCalculationResult {
  cohortStartYear: number;
  cohortEndYear: number;
  batchDisplay: string; // e.g. "2026–2030"
}

/**
 * Extracts 4-digit start year from an academic year string like "2026-2027", "2026-27", or "2026".
 */
export function extractAcademicStartYear(academicYear?: string | null): number | null {
  if (!academicYear) return null;
  const match = String(academicYear).match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Calculates the complete 4-year cohort start year, end year, and formatted batch string.
 */
export function calculateStudentCohort(params: CohortCalculationParams): CohortCalculationResult {
  const {
    batchYear,
    admissionBatch,
    admissionType,
    initialSemester,
    entrySemester,
    currentAcademicYear,
    academicYear,
    semester,
    usn,
  } = params;

  // 1. If admissionBatch is already a valid 4-year range (e.g. "2026–2030" or "2026-2030")
  if (admissionBatch) {
    const rangeMatch = String(admissionBatch).match(/^(\d{4})[-–](\d{4})$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (end - start === 4) {
        return {
          cohortStartYear: start,
          cohortEndYear: end,
          batchDisplay: `${start}–${end}`,
        };
      }
    }
  }

  // 2. Determine if student is a Lateral Entry student
  const effectiveEntrySem = entrySemester || initialSemester || 1;
  const isLateral =
    String(admissionType).toUpperCase() === 'LATERAL' ||
    String(admissionType).toUpperCase() === 'DCET' ||
    effectiveEntrySem >= 3;

  // 3. If explicit batchYear is stored and matches a plausible 4-digit year
  if (batchYear && Number.isInteger(batchYear) && batchYear >= 2000 && batchYear <= 2100) {
    return {
      cohortStartYear: batchYear,
      cohortEndYear: batchYear + 4,
      batchDisplay: `${batchYear}–${batchYear + 4}`,
    };
  }

  // 4. Derive from entry year or academic year
  const ayStartYear =
    extractAcademicStartYear(academicYear) ||
    extractAcademicStartYear(currentAcademicYear);

  if (ayStartYear) {
    // If student entered in this academic year
    let cohortStartYear = ayStartYear;
    if (isLateral) {
      // Lateral-entry student joining Sem 3 in year Y joined the cohort that began in (Y - 1)
      cohortStartYear = ayStartYear - 1;
    } else if (semester && semester > 2) {
      // If student is currently in semester S, offset = floor((S - 1) / 2)
      const collegeYearOffset = Math.floor((semester - 1) / 2);
      cohortStartYear = ayStartYear - collegeYearOffset;
    }

    const cohortEndYear = cohortStartYear + 4;
    return {
      cohortStartYear,
      cohortEndYear,
      batchDisplay: `${cohortStartYear}–${cohortEndYear}`,
    };
  }

  // 5. Derive from USN if formatted as 2JR{YY}...
  if (usn) {
    const match = usn.match(/^2JR(\d{2})/i);
    if (match) {
      const usnYear = parseInt('20' + match[1], 10);
      const cohortStartYear = isLateral ? usnYear - 1 : usnYear;
      return {
        cohortStartYear,
        cohortEndYear: cohortStartYear + 4,
        batchDisplay: `${cohortStartYear}–${cohortStartYear + 4}`,
      };
    }
  }

  // 6. Default fallback to standard current cohort (e.g. 2026–2030)
  const defaultStart = 2026;
  return {
    cohortStartYear: defaultStart,
    cohortEndYear: defaultStart + 4,
    batchDisplay: `${defaultStart}–${defaultStart + 4}`,
  };
}

/**
 * Format a batch cohort string from a start year or existing value.
 * Guaranteed to never return a single year like "2026".
 */
export function formatBatchCohort(batch?: string | number | null): string {
  if (!batch) return '2026–2030';
  const str = String(batch).trim();
  // If already "YYYY–YYYY" or "YYYY-YYYY"
  const rangeMatch = str.match(/^(\d{4})[-–](\d{4})$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (end - start === 4) {
      return `${start}–${end}`;
    }
    if (end - start === 1) {
      return `${start}–${start + 4}`;
    }
  }
  // If single 4-digit year like "2026" or string containing 4-digit year
  const match = str.match(/(\d{4})/);
  if (match) {
    const start = parseInt(match[1], 10);
    return `${start}–${start + 4}`;
  }
  return str;
}

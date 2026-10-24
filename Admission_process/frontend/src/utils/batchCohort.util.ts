/**
 * Frontend utility for formatting and calculating 4-year Engineering Cohorts / Batches.
 *
 * An Engineering degree has a fixed 4-year cohort span (StartYear–EndYear).
 *
 * Examples:
 * - Regular student entering 2026 -> Batch = "2026–2030"
 * - Later in Semester 3 (2027-28) -> Batch remains "2026–2030"
 * - Lateral student entering Semester 3 in 2027-28 -> Batch = "2026–2030"
 */

/**
 * Normalizes any batch representation to the complete 4-year cohort string (e.g. "2026–2030").
 * Will NEVER output a single year like "2026".
 */
export function formatBatchCohort(batch?: string | number | null, fallbackStartYear: number = 2026): string {
  if (!batch) {
    return `${fallbackStartYear}–${fallbackStartYear + 4}`;
  }

  const str = String(batch).trim();

  // If already "YYYY–YYYY" or "YYYY-YYYY"
  const rangeMatch = str.match(/^(\d{4})[-–](\d{4})$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (end - start === 4) {
      return `${start}–${end}`;
    }
    // If it was academic year range like 2026-2027
    if (end - start === 1) {
      return `${start}–${start + 4}`;
    }
  }

  // If single 4-digit year like "2026"
  const singleMatch = str.match(/^(\d{4})$/);
  if (singleMatch) {
    const start = parseInt(singleMatch[1], 10);
    return `${start}–${start + 4}`;
  }

  // Academic year string like "2026-27"
  const ayMatch = str.match(/^(\d{4})[-–]\d{2}$/);
  if (ayMatch) {
    const start = parseInt(ayMatch[1], 10);
    return `${start}–${start + 4}`;
  }

  return str;
}

/**
 * Resolves the student's complete 4-year engineering cohort string from any student object.
 */
export function getStudentCohort(student: {
  batch?: string | null;
  batchCohort?: string | null;
  admissionBatch?: string | null;
  batchYear?: number | string | null;
  admissionType?: string | null;
  initialSemester?: number | null;
  semester?: number | null;
  currentAcademicYear?: string | null;
  academicYear?: string | null;
}): string {
  if (student.batch) {
    return formatBatchCohort(student.batch);
  }
  if (student.batchCohort) {
    return formatBatchCohort(student.batchCohort);
  }
  if (student.admissionBatch) {
    return formatBatchCohort(student.admissionBatch);
  }
  if (student.batchYear) {
    return formatBatchCohort(student.batchYear);
  }

  const isLateral =
    String(student.admissionType).toUpperCase() === 'LATERAL' ||
    student.initialSemester === 3;

  const rawAy = student.currentAcademicYear || student.academicYear;
  if (rawAy) {
    const match = String(rawAy).match(/(\d{4})/);
    if (match) {
      const ayYear = parseInt(match[1], 10);
      let cohortStart = ayYear;
      if (isLateral) {
        cohortStart = ayYear - 1;
      } else if (student.semester && student.semester > 2) {
        cohortStart = ayYear - Math.floor((student.semester - 1) / 2);
      }
      return `${cohortStart}–${cohortStart + 4}`;
    }
  }

  return '2026–2030';
}

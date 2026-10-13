import { Op } from 'sequelize';
import db from '../config/database';
import FacultyAssignment from '../models/FacultyAssignment';
import Subject from '../models/Subject';
import Department from '../models/Department';
import User from '../models/User';
import Student from '../models/Student';
import Section from '../models/Section';
import Teacher from '../models/Teacher';
import AttendanceRecord from '../models/AttendanceRecord';
import AttendanceSession from '../models/AttendanceSession';
import AuditLog from '../models/AuditLog';
import AcademicYear from '../models/AcademicYear';
import HOD from '../models/HOD';
import logger from '../utils/logger.util';
import ExcelJS from 'exceljs';
import attendanceExcelService from './attendanceExcel.service';
import attendanceBackupQueueService from './attendanceBackupQueue.service';
import semesterAttendanceConsolidationService from './semesterAttendanceConsolidation.service';
import { findDepartmentCanonical, getBranchEquivalents } from '../utils/departmentCanonical.util';

// Helper to normalize section names ('Section A', 'Section  D', 'Division A', 'A' -> 'A')
export const normalizeSection = (sec?: string | null): string => {
  if (!sec) return 'A';
  return sec.replace(/^(Section|Sec|Division|Div)\s+/i, '').trim().toUpperCase();
};

// Authoritative attendance threshold percentage for eligibility (JCER ERP Institutional Rule: 85.0%)
export const ATTENDANCE_THRESHOLD = 85.0;

// Helper to get academic year variants for flexible DB matching ('2026-27', '2026-2027', '2026–27')
export const getAcademicYearVariants = (ay?: string | null): string[] => {
  if (!ay || ay === 'ALL') return [];
  const clean = ay.trim().replace(/\u2013|\u2014/g, '-');
  
  const variants = new Set<string>([ay, clean]);
  
  // Format: "YYYY-YY" e.g. "2026-27"
  const match2 = clean.match(/^(\d{4})-(\d{2})$/);
  if (match2) {
    const startYear = match2[1];
    const endCentury = startYear.slice(0, 2);
    const fullEndYear = `${endCentury}${match2[2]}`;
    variants.add(`${startYear}-${fullEndYear}`);
    variants.add(`${startYear}\u2013${match2[2]}`);
    variants.add(`${startYear}\u2013${fullEndYear}`);
  }
  
  // Format: "YYYY-YYYY" e.g. "2026-2027"
  const match4 = clean.match(/^(\d{4})-(\d{4})$/);
  if (match4) {
    const startYear = match4[1];
    const endShort = match4[2].slice(2);
    variants.add(`${startYear}-${endShort}`);
    variants.add(`${startYear}\u2013${match4[2]}`);
    variants.add(`${startYear}\u2013${endShort}`);
  }

  return Array.from(variants);
};

// Helper to get section name variants ('A', 'Section A', 'Sec A', 'Division A', etc.)
export const getSectionVariants = (sec?: string | null): string[] => {
  if (!sec) return [];
  const clean = normalizeSection(sec);
  const raw = sec.trim();
  const variants = new Set<string>([
    clean,
    raw,
    `Section ${clean}`,
    `Sec ${clean}`,
    `Sec. ${clean}`,
    `Division ${clean}`,
    `Div ${clean}`,
  ]);
  return Array.from(variants).filter(Boolean);
};

// Helper to build cohort where clause for an assignment to maintain attendance continuity across faculty transfers
export const buildAssignmentCohortWhere = (assignment: any): any => {
  const cohortCondition: any[] = [{ facultyAssignmentId: assignment.id }];

  if (assignment.previousFacultyAssignmentId) {
    cohortCondition.push({ facultyAssignmentId: assignment.previousFacultyAssignmentId });
  }

  if (assignment.subjectId && assignment.semester) {
    const cohortFilter: any = {
      subjectId: assignment.subjectId,
      semester: assignment.semester,
    };

    if (assignment.departmentId) {
      cohortFilter.departmentId = assignment.departmentId;
    }

    if (assignment.academicYear) {
      const ayVariants = getAcademicYearVariants(assignment.academicYear);
      cohortFilter.academicYear = ayVariants.length > 0 ? { [Op.in]: ayVariants } : assignment.academicYear;
    }

    if (assignment.section) {
      const secVariants = getSectionVariants(assignment.section);
      cohortFilter.section = secVariants.length > 0 ? { [Op.in]: secVariants } : assignment.section;
    }

    cohortCondition.push(cohortFilter);
  }

  return cohortCondition.length > 1 ? { [Op.or]: cohortCondition } : { facultyAssignmentId: assignment.id };
};

/**
 * Resolves the authoritative Section model record for a FacultyAssignment.
 * Matches by explicit sectionId or by department/branch + semester + normalized section code.
 */
export const resolveSectionForAssignment = async (assignment: any): Promise<Section | null> => {
  if (!assignment) return null;

  // 1. Explicit sectionId if present on assignment
  if (assignment.sectionId) {
    const sec = await Section.findByPk(assignment.sectionId);
    if (sec) return sec;
  }

  const cleanSec = normalizeSection(assignment.section);
  const rawSec = (assignment.section || '').trim().toUpperCase();

  const deptCode = assignment.department?.code;
  const branchCodes: string[] = [];
  if (deptCode) {
    branchCodes.push(...getBranchEquivalents(deptCode));
  }
  if (assignment.branch && assignment.branch !== 'ALL') {
    branchCodes.push(...getBranchEquivalents(assignment.branch));
  }

  const candidateSections = await Section.findAll({
    where: {
      semester: assignment.semester,
      [Op.or]: [
        { departmentId: assignment.departmentId },
        ...(branchCodes.length > 0 ? [{ branch: { [Op.in]: branchCodes } }] : []),
      ],
    },
  });

  const matched = candidateSections.find((sec) => {
    const sCode = normalizeSection(sec.name);
    return sCode === cleanSec || sec.name.trim().toUpperCase() === rawSec;
  });

  return matched || null;
};

/**
 * Helper to determine if a string is a valid assigned University Seat Number (USN).
 */
export const isAssignedUsn = (val: string | null | undefined): boolean => {
  if (!val) return false;
  const clean = val.trim().toUpperCase();
  if (
    clean === '' ||
    clean === 'N/A' ||
    clean === 'NA' ||
    clean === '-' ||
    clean === '—' ||
    clean.startsWith('JCER-') ||
    clean.startsWith('APP-') ||
    clean.startsWith('TEMP')
  ) {
    return false;
  }
  return true;
};

/**
 * Authoritative comparator for student rosters:
 * 1. When USNs are assigned, sort by USN ascending using natural alphanumeric collation.
 * 2. If one has USN and the other does not, student with assigned USN comes first.
 * 3. When USNs are not assigned (e.g. before allocation), fall back to Student Name A-Z.
 */
export const compareStudentsByUsnOrName = (
  usnAVal: string | null | undefined,
  usnBVal: string | null | undefined,
  nameAVal: string | null | undefined,
  nameBVal: string | null | undefined,
  rollAVal?: string | null | undefined,
  rollBVal?: string | null | undefined
): number => {
  const hasUsnA = isAssignedUsn(usnAVal);
  const hasUsnB = isAssignedUsn(usnBVal);

  if (hasUsnA && hasUsnB) {
    const cmp = (usnAVal || '').trim().localeCompare((usnBVal || '').trim(), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    if (cmp !== 0) return cmp;
    const nCmp = (nameAVal || '').trim().localeCompare((nameBVal || '').trim(), undefined, {
      sensitivity: 'base',
    });
    if (nCmp !== 0) return nCmp;
    return (rollAVal || '').trim().localeCompare((rollBVal || '').trim(), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }

  if (hasUsnA && !hasUsnB) return -1;
  if (!hasUsnA && hasUsnB) return 1;

  // Fallback: Student Name A-Z
  const nCmp = (nameAVal || '').trim().localeCompare((nameBVal || '').trim(), undefined, {
    sensitivity: 'base',
  });
  if (nCmp !== 0) return nCmp;

  return (rollAVal || '').trim().localeCompare((rollBVal || '').trim(), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
};

/**
 * Queries all students authoritatively allocated to a section for a FacultyAssignment.
 */
export const getEnrolledStudentsForAssignment = async (assignment: any, matchedSection?: Section | null) => {
  const sec = matchedSection !== undefined ? matchedSection : await resolveSectionForAssignment(assignment);
  const cleanSec = normalizeSection(assignment.section);
  const rawSec = (assignment.section || '').trim();

  const isSemHandling = assignment.department?.type === 'SEMESTER_HANDLING' || assignment.department?.code === 'AS';

  let targetDeptId = assignment.departmentId;
  if (isSemHandling && assignment.branch && assignment.branch !== 'ALL') {
    const branchDept = await findDepartmentCanonical(assignment.branch);
    if (branchDept) targetDeptId = branchDept.id;
  }

  const orConditions: any[] = [];
  if (sec) {
    orConditions.push({ sectionId: sec.id });
    orConditions.push({ section: sec.name });
  }
  if (cleanSec) {
    orConditions.push({ section: cleanSec });
    orConditions.push({ section: `Section ${cleanSec}` });
    orConditions.push({ section: `Section  ${cleanSec}` });
  }
  if (rawSec && !orConditions.some((c: any) => c.section === rawSec)) {
    orConditions.push({ section: rawSec });
  }

  const dbOrder: any[] = [
    ['usn', 'ASC'],
    ['enrollmentNumber', 'ASC'],
    [{ model: User, as: 'user' }, 'firstName', 'ASC'],
    [{ model: User, as: 'user' }, 'lastName', 'ASC'],
  ];

  const students = await Student.findAll({
    where: {
      departmentId: targetDeptId,
      semester: assignment.semester,
      section: { [Op.ne]: null as any },
      [Op.or]: orConditions,
    },
    include: [
      { model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] },
      { model: Department, as: 'department', attributes: ['id', 'name', 'code'] },
    ],
    order: dbOrder,
  });

  // Ensure uniqueness by student ID while preserving canonical order
  const seenIds = new Set<string>();
  const uniqueStudents: typeof students = [];
  for (const s of students) {
    if (!seenIds.has(s.id)) {
      seenIds.add(s.id);
      uniqueStudents.push(s);
    }
  }

  // Authoritative sorting guarantee:
  // When USNs are assigned (e.g. 2JR26CV001), sort by USN ASC (natural alphanumeric order).
  // When USNs are not assigned (e.g. null, 'N/A', placeholder), fall back to Student Name A-Z.
  uniqueStudents.sort((a: any, b: any) => {
    const usnA = (a.usn || a.enrollmentNumber || '').trim();
    const usnB = (b.usn || b.enrollmentNumber || '').trim();
    const nameA = a.user ? `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim() : '';
    const nameB = b.user ? `${b.user.firstName || ''} ${b.user.lastName || ''}`.trim() : '';
    return compareStudentsByUsnOrName(usnA, usnB, nameA, nameB, a.rollNumber, b.rollNumber);
  });

  return { students: uniqueStudents, matchedSection: sec };
};

export const facultyService = {
  /**
   * Resolves a faculty member's teacher profile and department
   */
  async getFacultyProfile(userId: string) {
    const user = await User.findByPk(userId, {
      attributes: ['id', 'firstName', 'middleName', 'lastName', 'gender', 'email', 'role', 'phone', 'profileImage'],
    });

    const teacher = await Teacher.findOne({
      where: { userId },
      include: [{ model: Department, as: 'department' }],
    });

    let department = teacher?.department;
    if (!department) {
      // Fallback: check any faculty assignment
      const assignment = await FacultyAssignment.findOne({
        where: { userId },
        include: [{ model: Department, as: 'department' }],
      });
      department = (assignment as any)?.department;
    }

    return {
      user,
      teacher,
      departmentId: department?.id || null,
      departmentCode: department?.code || 'CSE',
      departmentName: department?.name || 'Computer Science & Engineering',
      designation: teacher?.designation || 'Assistant Professor',
    };
  },

  /**
   * Retrieves all active assignments belonging to this faculty user
   */
  async getFacultyAssignments(userId: string, academicYear?: string) {
    const teacher = await Teacher.findOne({ where: { userId } });
    const teacherId = teacher?.id;

    const whereClause: any = {
      [Op.or]: [
        { userId },
        ...(teacherId ? [{ teacherId }] : []),
      ],
      status: 'ACTIVE',
    };

    if (academicYear && academicYear !== 'ALL') {
      let resolvedYear = academicYear;
      if (/^[0-9a-fA-F-]{36}$/.test(academicYear)) {
        const ayRecord = await AcademicYear.findByPk(academicYear);
        if (ayRecord?.year) {
          resolvedYear = ayRecord.year;
        }
      }
      const ayVariants = getAcademicYearVariants(resolvedYear);
      if (ayVariants.length > 0) {
        whereClause.academicYear = { [Op.in]: ayVariants };
      }
    }

    const assignments = await FacultyAssignment.findAll({
      where: whereClause,
      include: [
        { model: Subject, as: 'subject' },
        { model: Department, as: 'department' },
      ],
      order: [['semester', 'ASC'], ['createdAt', 'ASC']],
    });

    const enriched = await Promise.all(
      assignments.map(async (a: any) => {
        const normSec = normalizeSection(a.section);

        // Count real enrolled students strictly allocated to this section (REQUIREMENT 13 & 39)
        const { students, matchedSection } = await getEnrolledStudentsForAssignment(a);
        const studentCount = students.length;

        // Check if attendance has been submitted/locked today for this assignment/cohort
        const cohortWhere = buildAssignmentCohortWhere(a);
        const todayStr = new Date().toISOString().split('T')[0];
        const todaySessionCount = await AttendanceSession.count({
          where: {
            ...cohortWhere,
            attendanceDate: todayStr,
            status: { [Op.in]: ['SUBMITTED', 'LOCKED'] },
          },
        });

        // Calculate attendance percentage for this assignment/cohort
        const totalAttendanceRecords = await AttendanceRecord.count({
          where: cohortWhere,
        });
        const presentRecords = await AttendanceRecord.count({
          where: {
            ...cohortWhere,
            status: 'PRESENT',
          },
        });

        const attendancePct =
          totalAttendanceRecords > 0
            ? Number(((presentRecords / totalAttendanceRecords) * 100).toFixed(1))
            : null;

        return {
          id: a.id,
          subjectId: a.subject?.id || a.subjectId,
          subjectName: a.subject?.name || 'Assigned Subject',
          subjectCode: a.subject?.code || 'SUB001',
          cycle: a.subject?.cycle || null,
          schemeId: a.subject?.schemeId || null,
          credits: a.subject?.credits || 4,
          type: a.subject?.type || 'THEORY',
          semester: a.semester,
          section: matchedSection?.name || (a.section ? `Section ${normSec}` : 'Section A'),
          sectionId: matchedSection?.id || (a as any).sectionId || null,
          normalizedSection: normSec,
          academicYear: a.academicYear || '2026-27',
          departmentId: a.departmentId,
          departmentCode: a.department?.code || 'CSE',
          attendanceAccess: a.attendanceAccess !== false,
          marksAccess: a.marksAccess !== false,
          totalStudents: studentCount,
          attendancePercentage: attendancePct,
          completedToday: todaySessionCount > 0,
          status: a.status,
        };
      })
    );

    return enriched;
  },

  /**
   * Retrieves dashboard overview statistics for the faculty workspace
   */
  async getFacultyDashboard(userId: string, academicYear?: string, semester?: string) {
    const profile = await this.getFacultyProfile(userId);
    const assignments = await this.getFacultyAssignments(userId, academicYear);

    // Apply semester filter if explicitly specified
    let relevantAssignments = assignments;
    if (semester && semester !== 'ALL') {
      const semNum = parseInt(semester, 10);
      if (!isNaN(semNum)) {
        relevantAssignments = relevantAssignments.filter((a) => a.semester === semNum);
      }
    }

    // 1. Assigned Subjects: Count distinct subjects assigned to the logged-in faculty member using stable subjectId
    const distinctSubjectIds = new Set<string>();
    for (const a of relevantAssignments) {
      if (a.status === 'ACTIVE') {
        const sId = a.subjectId || a.subject?.id;
        if (sId) {
          distinctSubjectIds.add(String(sId));
        }
      }
    }
    const assignedSubjectsCount = distinctSubjectIds.size;

    // 2. Attendance Courses: Count distinct active section-level teaching allocations for which the faculty member has attendance access
    // Deduplicates any duplicate records for the same allocation identity
    const uniqueAttendanceAllocations = new Set<string>();
    for (const a of relevantAssignments) {
      if (a.status === 'ACTIVE' && a.attendanceAccess) {
        const normSec = a.normalizedSection || (a.section ? String(a.section).trim().toUpperCase() : '');
        const allocKey = `${a.subjectId}_${normSec}_${a.semester}_${a.academicYear}_${a.departmentId}`;
        uniqueAttendanceAllocations.add(allocKey);
      }
    }
    const attendanceCoursesCount = uniqueAttendanceAllocations.size;

    // Distinct active section-level teaching allocations with marks access
    const uniqueMarksAllocations = new Set<string>();
    for (const a of relevantAssignments) {
      if (a.status === 'ACTIVE' && a.marksAccess) {
        const normSec = a.normalizedSection || (a.section ? String(a.section).trim().toUpperCase() : '');
        const allocKey = `${a.subjectId}_${normSec}_${a.semester}_${a.academicYear}_${a.departmentId}`;
        uniqueMarksAllocations.add(allocKey);
      }
    }
    const marksCoursesCount = uniqueMarksAllocations.size;

    return {
      profile,
      stats: {
        totalAssignments: assignedSubjectsCount,
        assignedSubjectsCount,
        attendanceCoursesCount,
        marksCoursesCount,
      },
      assignments,
    };
  },

  /**
   * Returns attendance-authorized courses list for the faculty attendance page
   */
  async getFacultyAttendanceList(userId: string, semesterFilter?: string, academicYearFilter?: string) {
    const assignments = await this.getFacultyAssignments(userId, academicYearFilter);
    let filtered = assignments.filter((a) => a.attendanceAccess !== false);

    if (semesterFilter && semesterFilter !== 'ALL') {
      const sem = parseInt(semesterFilter, 10);
      if (!isNaN(sem)) {
        filtered = filtered.filter((a) => a.semester === sem);
      }
    }

    return filtered;
  },

  /**
   * Retrieves full attendance workspace details for a specific assignment
   */
  async getFacultyAttendanceWorkspace(userId: string, assignmentId: string) {
    const teacher = await Teacher.findOne({ where: { userId } });
    const teacherId = teacher?.id;

    // 1. Strict Ownership & Permission Validation (REQUIREMENT 34)
    const assignment = await FacultyAssignment.findOne({
      where: {
        id: assignmentId,
        [Op.or]: [
          { userId },
          ...(teacherId ? [{ teacherId }] : []),
        ],
        status: 'ACTIVE',
      },
      include: [
        { model: Subject, as: 'subject' },
        { model: Department, as: 'department' },
      ],
    });

    if (!assignment) {
      throw new Error('Unauthorized or inactive attendance assignment. Access denied.');
    }

    const { students, matchedSection } = await getEnrolledStudentsForAssignment(assignment);

    // 3. Fetch all attendance sessions for this assignment/cohort (REQUIREMENT 2 & 21)
    const cohortWhere = buildAssignmentCohortWhere(assignment);
    const sessions = await AttendanceSession.findAll({
      where: cohortWhere,
      order: [['attendanceDate', 'DESC'], ['sessionPeriod', 'DESC']],
    });

    // Fetch all attendance records for this assignment/cohort
    const sessionIds = sessions.map((s) => s.id);
    const recordsWhere = sessionIds.length > 0
      ? { [Op.or]: [{ attendanceSessionId: { [Op.in]: sessionIds } }, cohortWhere] }
      : cohortWhere;
    const attendanceRecords = await AttendanceRecord.findAll({
      where: recordsWhere,
      order: [['date', 'ASC'], ['sessionPeriod', 'ASC']],
    });

    // Get unique conducted dates
    const dateSet = new Set<string>();
    sessions.forEach((s) => {
      const dStr = typeof s.attendanceDate === 'string' ? s.attendanceDate : String(s.attendanceDate);
      dateSet.add(dStr);
    });
    // Fallback for legacy records without AttendanceSession
    attendanceRecords.forEach((r) => {
      const dStr = (r.date as any) instanceof Date ? (r.date as any).toISOString().split('T')[0] : String(r.date);
      dateSet.add(dStr);
    });

    const conductedDates = Array.from(dateSet).sort();
    const totalClasses = sessions.length > 0 ? sessions.length : conductedDates.length;

    // Recorded sessions aggregation from AttendanceSession model with fallback
    const recordedSessions = sessions.map((s) => {
      const sDateStr = typeof s.attendanceDate === 'string' ? s.attendanceDate : String(s.attendanceDate);
      const sessionRecs = attendanceRecords.filter((r) => {
        const rDateStr = (r.date as any) instanceof Date ? (r.date as any).toISOString().split('T')[0] : String(r.date);
        return (
          r.attendanceSessionId === s.id ||
          (rDateStr === sDateStr && (r.sessionPeriod || 1) === (s.sessionPeriod || 1))
        );
      });

      const absentStudentIds = new Set(sessionRecs.filter((r) => r.status === 'ABSENT').map((r) => r.studentId));
      const absentStudents = students
        .filter((st: any) => absentStudentIds.has(st.id))
        .map((st: any) => ({
          id: st.id,
          usn: st.usn || st.enrollmentNumber || 'N/A',
          studentName: st.user ? `${st.user.firstName || ''} ${st.user.lastName || ''}`.trim() : 'Student',
        }));

      return {
        id: s.id,
        date: sDateStr,
        sessionPeriod: s.sessionPeriod,
        status: s.status,
        totalConducted: s.totalStudents || sessionRecs.length,
        presentCount: s.presentCount,
        absentCount: s.absentCount,
        percentage: s.totalStudents > 0 ? Number(((s.presentCount / s.totalStudents) * 100).toFixed(1)) : 100.0,
        absentStudents,
      };
    });

    // Previous Class logic (REQUIREMENT 21)
    const previousClass = recordedSessions.length > 0 ? recordedSessions[0] : null;

    // Student-wise metrics aggregation
    const studentRoster = students.map((s: any) => {
      const sRecords = attendanceRecords.filter((r) => r.studentId === s.id);
      const presentCount = sRecords.filter((r) => r.status === 'PRESENT').length;
      const absentCount = sRecords.filter((r) => r.status === 'ABSENT').length;
      const excusedCount = sRecords.filter((r) => r.status === 'EXCUSED').length;

      const studentConducted = totalClasses;
      const percentage =
        studentConducted > 0 ? Number(((presentCount / studentConducted) * 100).toFixed(1)) : 100.0;

      const isShortage = totalClasses > 0 && percentage < ATTENDANCE_THRESHOLD;

      // Map session details by date
      const sessionMap: { [date: string]: 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'UNRECORDED' } = {};
      conductedDates.forEach((d) => {
        const rec = sRecords.find((r) => ((r.date as any) instanceof Date ? (r.date as any).toISOString().split('T')[0] : String(r.date)) === d);
        sessionMap[d] = rec ? rec.status : 'UNRECORDED';
      });

      return {
        id: s.id,
        studentId: s.id,
        usn: s.usn || s.enrollmentNumber || 'N/A',
        enrollmentNumber: s.enrollmentNumber || s.usn || '',
        rollNumber: s.rollNumber || '',
        studentName: s.user ? `${s.user.firstName || ''} ${s.user.lastName || ''}`.trim() : 'Student',
        email: s.user?.email || '',
        section: s.section || matchedSection?.name || (assignment.section ? `Section ${normalizeSection(assignment.section)}` : 'Section A'),
        classesConducted: studentConducted,
        presentCount,
        absentCount,
        excusedCount,
        attendancePercentage: percentage,
        status: isShortage ? 'Shortage' : 'Eligible',
        sessions: sessionMap,
      };
    });

    const totalStudents = studentRoster.length;
    const shortageCount = studentRoster.filter((s) => s.status === 'Shortage').length;
    const eligibleCount = totalStudents - shortageCount;

    const totalPresentSum = studentRoster.reduce((sum, s) => sum + s.presentCount, 0);
    const totalSlots = totalClasses * totalStudents;
    const overallPercentage =
      totalSlots > 0 ? Number(((totalPresentSum / totalSlots) * 100).toFixed(1)) : 100.0;

    return {
      assignment: {
        id: assignment.id,
        subjectId: (assignment as any).subject?.id,
        subjectName: (assignment as any).subject?.name || 'Assigned Course',
        subjectCode: (assignment as any).subject?.code || 'SUB001',
        semester: assignment.semester,
        section: matchedSection?.name || (assignment.section ? `Section ${normalizeSection(assignment.section)}` : 'Section A'),
        sectionId: matchedSection?.id || (assignment as any).sectionId || null,
        academicYear: assignment.academicYear,
        departmentCode: (assignment as any).department?.code || 'CSE',
      },
      metrics: {
        totalClassesConducted: totalClasses,
        totalStudents,
        overallAttendancePercentage: overallPercentage,
        eligibleCount,
        shortageCount,
        threshold: ATTENDANCE_THRESHOLD,
      },
      conductedDates,
      recordedSessions,
      previousClass,
      students: studentRoster,
    };
  },


  /**
   * Records or updates attendance session for an assigned cohort
   */
  async saveFacultyAttendance(
    userId: string,
    assignmentId: string,
    payload: {
      date: string;
      sessionPeriod?: number;
      records: Array<{ studentId: string; status: 'PRESENT' | 'ABSENT' | 'EXCUSED' }>;
    }
  ) {
    const teacher = await Teacher.findOne({ where: { userId } });
    const teacherId = teacher?.id;

    // 1. Strict ownership & authorization check (REQUIREMENT 8 & 34)
    const assignment = await FacultyAssignment.findOne({
      where: {
        id: assignmentId,
        [Op.or]: [
          { userId },
          ...(teacherId ? [{ teacherId }] : []),
        ],
        status: 'ACTIVE',
        attendanceAccess: true,
      },
    });

    if (!assignment) {
      throw new Error('Unauthorized or inactive attendance assignment. Access denied.');
    }

    const sessionDate = payload.date || new Date().toISOString().split('T')[0];
    const sessionPeriod = payload.sessionPeriod || 1;

    // 2. Verify section roster isolation (REQUIREMENT 9 & 11)
    const { students: validStudents, matchedSection } = await getEnrolledStudentsForAssignment(assignment);

    const validStudentIds = new Set(validStudents.map((s) => s.id));
    for (const rec of payload.records) {
      if (!validStudentIds.has(rec.studentId)) {
        throw new Error(`Student ${rec.studentId} does not belong to this section.`);
      }
    }

    // 4. Transactional Attendance Save (REQUIREMENT 7, 13, 35)
    const transaction = await db.transaction();
    try {
      // Check existing session across cohort to avoid duplicate sessions and unauthorized overwrites
      const secVariants = getSectionVariants(assignment.section);
      const ayVariants = getAcademicYearVariants(assignment.academicYear);
      const existingCohortSession = await AttendanceSession.findOne({
        where: {
          subjectId: assignment.subjectId,
          semester: assignment.semester,
          attendanceDate: sessionDate,
          sessionPeriod,
          ...(secVariants.length > 0 ? { section: { [Op.in]: secVariants } } : {}),
          ...(ayVariants.length > 0 ? { academicYear: { [Op.in]: ayVariants } } : {}),
        },
        transaction,
      });

      let session: AttendanceSession | null = null;
      if (existingCohortSession) {
        if (existingCohortSession.status === 'LOCKED') {
          throw new Error('Attendance session is locked and cannot be edited directly.');
        }
        if (
          existingCohortSession.facultyAssignmentId !== assignment.id &&
          existingCohortSession.submittedById &&
          existingCohortSession.submittedById !== userId
        ) {
          throw new Error(
            `Attendance for date ${sessionDate} (Period ${sessionPeriod}) was already recorded by previous faculty member. It cannot be overwritten.`
          );
        }
        session = existingCohortSession;
      } else {
        session = await AttendanceSession.findOne({
          where: {
            facultyAssignmentId: assignment.id,
            attendanceDate: sessionDate,
            sessionPeriod,
          },
          transaction,
        });
        if (session && session.status === 'LOCKED') {
          throw new Error('Attendance session is locked and cannot be edited directly.');
        }
      }

      const totalStudents = payload.records.length;
      const presentCount = payload.records.filter((r) => r.status === 'PRESENT').length;
      const absentCount = payload.records.filter((r) => r.status === 'ABSENT').length;

      if (!session) {
        session = await AttendanceSession.create(
          {
            facultyAssignmentId: assignment.id,
            departmentId: assignment.departmentId,
            subjectId: assignment.subjectId,
            sectionId: matchedSection?.id || (assignment as any).sectionId || null,
            section: matchedSection?.name || assignment.section || 'A',
            semester: assignment.semester,
            academicYear: assignment.academicYear,
            attendanceDate: sessionDate,
            sessionPeriod,
            status: 'SUBMITTED',
            totalStudents,
            presentCount,
            absentCount,
            submittedAt: new Date(),
            submittedById: userId,
          },
          { transaction }
        );
      } else {
        session.totalStudents = totalStudents;
        session.presentCount = presentCount;
        session.absentCount = absentCount;
        session.status = 'SUBMITTED';
        session.submittedAt = new Date();
        session.submittedById = userId;
        if (matchedSection?.id) {
          session.sectionId = matchedSection.id;
        }
        if (matchedSection?.name) {
          session.section = matchedSection.name;
        }
        await session.save({ transaction });
      }

      // Upsert AttendanceRecord rows
      for (const item of payload.records) {
        if (!item.studentId || !item.status) continue;

        const [record, created] = await AttendanceRecord.findOrCreate({
          where: {
            studentId: item.studentId,
            facultyAssignmentId: assignment.id,
            date: sessionDate as any,
            sessionPeriod,
          },
          defaults: {
            attendanceSessionId: session.id,
            studentId: item.studentId,
            facultyAssignmentId: assignment.id,
            departmentId: assignment.departmentId,
            subjectId: assignment.subjectId,
            semester: assignment.semester,
            section: matchedSection?.name || assignment.section,
            academicYear: assignment.academicYear,
            date: sessionDate as any,
            sessionPeriod,
            status: item.status,
          },
          transaction,
        });

        if (!created) {
          record.attendanceSessionId = session.id;
          record.status = item.status;
          await record.save({ transaction });
        }
      }

      // Record audit log (REQUIREMENT 20)
      await AuditLog.create(
        {
          userId,
          action: 'ATTENDANCE_SESSION_SAVED',
          details: {
            sessionDate,
            sessionPeriod,
            assignmentId: assignment.id,
            totalStudents,
            presentCount,
            absentCount,
          },
        },
        { transaction }
      );

      await transaction.commit();
      logger.info(
        `Attendance session saved by faculty ${userId} for assignment ${assignmentId} on ${sessionDate} (P${sessionPeriod})`
      );

      // Trigger automatic background Google Drive backup (non-blocking)
      attendanceBackupQueueService.queueAttendanceBackup(assignment.id, session.id, 'UPDATE').catch((err) => {
        logger.warn('Google Drive backup queue notice:', err.message);
      });
    } catch (err: any) {
      await transaction.rollback();
      logger.error('SAVE_FACULTY_ATTENDANCE_TRANSACTION_ERROR:', err);
      throw err;
    }

    return this.getFacultyAttendanceWorkspace(userId, assignmentId);
  },


  /**
   * Aggregates assignment-scoped analytics strictly for the authenticated faculty
   */
  async getFacultyAnalytics(userId: string, academicYear?: string) {
    const assignments = await this.getFacultyAssignments(userId, academicYear);
    const assignmentIds = assignments.map((a) => a.id);

    // Subject attendance breakdown
    const subjectAttendanceStats = assignments.map((a) => ({
      assignmentId: a.id,
      subjectName: a.subjectName,
      subjectCode: a.subjectCode,
      semester: a.semester,
      section: a.section,
      totalStudents: a.totalStudents,
      attendancePercentage: a.attendancePercentage ?? 85.0,
      threshold: ATTENDANCE_THRESHOLD,
    }));

    // Find defaulters across all assigned courses
    const allAttendanceRecords = await AttendanceRecord.findAll({
      where: { facultyAssignmentId: { [Op.in]: assignmentIds } },
      include: [
        {
          model: Student,
          as: 'student',
          include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName'] }],
        },
        { model: Subject, as: 'subject', attributes: ['name', 'code'] },
      ],
    });

    // Group by student + subject
    const studentMap: { [key: string]: { student: any; subject: any; total: number; present: number } } = {};
    allAttendanceRecords.forEach((r: any) => {
      const key = `${r.studentId}_${r.subjectId}`;
      if (!studentMap[key]) {
        studentMap[key] = {
          student: r.student,
          subject: r.subject,
          total: 0,
          present: 0,
        };
      }
      studentMap[key].total++;
      if (r.status === 'PRESENT') {
        studentMap[key].present++;
      }
    });

    const defaulters = Object.values(studentMap)
      .map((entry) => {
        const pct = entry.total > 0 ? Number(((entry.present / entry.total) * 100).toFixed(1)) : 100;
        return {
          studentId: entry.student?.id,
          usn: entry.student?.usn || entry.student?.enrollmentNumber || 'N/A',
          studentName: entry.student?.user
            ? `${entry.student.user.firstName || ''} ${entry.student.user.lastName || ''}`.trim()
            : 'Student',
          subjectName: entry.subject?.name,
          subjectCode: entry.subject?.code,
          totalClasses: entry.total,
          presentClasses: entry.present,
          attendancePercentage: pct,
        };
      })
      .filter((d) => d.totalClasses > 0 && d.attendancePercentage < ATTENDANCE_THRESHOLD);

    return {
      assignedCount: assignments.length,
      subjectAttendanceStats,
      defaulters,
      defaultersCount: defaulters.length,
      termStatus: 'AY 2026-27 Active Term',
    };
  },

  /**
   * Generates official Class-wise Attendance Register Excel spreadsheet
   */
  async exportFacultyAttendanceExcel(userId: string, assignmentId: string): Promise<{ buffer: Buffer; filename: string }> {
    const teacher = await Teacher.findOne({ where: { userId } });
    const teacherId = teacher?.id;

    const assignment = await FacultyAssignment.findOne({
      where: {
        id: assignmentId,
        [Op.or]: [
          { userId },
          ...(teacherId ? [{ teacherId }] : []),
        ],
        status: 'ACTIVE',
      },
    });

    if (!assignment) {
      throw new Error('Unauthorized or inactive attendance assignment. Access denied.');
    }

    const { buffer, filename } = await attendanceExcelService.generateAttendanceWorkbookBuffer(assignment.id);
    return { buffer, filename };
  },

  async getFacultyAttendanceHistory(userId: string, assignmentId: string) {
    const teacher = await Teacher.findOne({ where: { userId } });
    const teacherId = teacher?.id;

    const assignment = await FacultyAssignment.findOne({
      where: {
        id: assignmentId,
        [Op.or]: [
          { userId },
          ...(teacherId ? [{ teacherId }] : []),
        ],
        status: 'ACTIVE',
      },
      include: [
        { model: Subject, as: 'subject' },
        { model: Department, as: 'department' },
      ],
    });

    if (!assignment) {
      throw new Error('Unauthorized or inactive attendance assignment. Access denied.');
    }

    const cohortWhere = buildAssignmentCohortWhere(assignment);
    const sessions = await AttendanceSession.findAll({
      where: cohortWhere,
      include: [
        { model: User, as: 'submittedBy', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
      order: [
        ['attendanceDate', 'DESC'],
        ['sessionPeriod', 'DESC'],
      ],
    });

    const formattedSessions = sessions.map((s) => {
      const dStr = typeof s.attendanceDate === 'string' ? s.attendanceDate : String(s.attendanceDate);
      const total = s.totalStudents || 0;
      const present = s.presentCount || 0;
      const absent = s.absentCount || 0;
      const pct = total > 0 ? Number(((present / total) * 100).toFixed(1)) : 100.0;
      const rawUser = (s as any).submittedBy;
      const submittedByName = rawUser
        ? `${rawUser.firstName || ''} ${rawUser.lastName || ''}`.trim() || rawUser.email
        : undefined;
      const canEdit = s.status !== 'LOCKED' && (s.submittedById === userId);

      return {
        id: s.id,
        date: dStr,
        sessionPeriod: s.sessionPeriod || 1,
        status: s.status,
        totalStudents: total,
        presentCount: present,
        absentCount: absent,
        percentage: pct,
        submittedAt: s.submittedAt || s.createdAt,
        submittedById: s.submittedById,
        submittedByFacultyName: submittedByName,
        canEdit,
      };
    });

    return {
      assignment: {
        id: assignment.id,
        subjectId: (assignment as any).subject?.id,
        subjectName: (assignment as any).subject?.name || 'Assigned Subject',
        subjectCode: (assignment as any).subject?.code || 'SUB001',
        semester: assignment.semester,
        section: normalizeSection(assignment.section),
        academicYear: assignment.academicYear,
        departmentCode: (assignment as any).department?.code || 'CSE',
      },
      totalSessions: formattedSessions.length,
      sessions: formattedSessions,
    };
  },

  /**
   * Retrieves complete scheduled and recorded attendance history for an assignment
   */
  async getFacultyCompleteAttendanceHistory(userId: string, assignmentId: string, month?: string) {
    const teacher = await Teacher.findOne({ where: { userId } });
    const teacherId = teacher?.id;

    const assignment = await FacultyAssignment.findOne({
      where: {
        id: assignmentId,
        [Op.or]: [
          { userId },
          ...(teacherId ? [{ teacherId }] : []),
        ],
        status: 'ACTIVE',
      },
      include: [
        { model: Subject, as: 'subject' },
        { model: Department, as: 'department' },
      ],
    });

    if (!assignment) {
      throw new Error('Unauthorized or inactive attendance assignment. Access denied.');
    }

    const { matchedSection } = await getEnrolledStudentsForAssignment(assignment);
    const defaultClassroom = matchedSection?.classroom || null;

    const cohortWhere: any = buildAssignmentCohortWhere(assignment);
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      cohortWhere.attendanceDate = {
        [Op.like]: `${month}%`,
      };
    }

    const sessions = await AttendanceSession.findAll({
      where: cohortWhere,
      order: [
        ['attendanceDate', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    });

    let completedCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;

    const formattedSessions = sessions.map((s: any) => {
      const dStr = typeof s.attendanceDate === 'string' ? s.attendanceDate : String(s.attendanceDate);
      const total = s.totalStudents || 0;
      const present = s.presentCount || 0;
      const absent = s.absentCount || 0;
      const pct = total > 0 ? Number(((present / total) * 100).toFixed(1)) : 100.0;

      let resolvedStatus: 'Completed' | 'Pending' | 'Cancelled' = 'Completed';
      if (s.status === 'CANCELLED') {
        resolvedStatus = 'Cancelled';
        cancelledCount++;
      } else if (s.status === 'PENDING') {
        resolvedStatus = 'Pending';
        pendingCount++;
      } else {
        resolvedStatus = 'Completed';
        completedCount++;
      }

      const canEdit = s.status !== 'LOCKED' && (s.submittedById === userId || !s.submittedById);
      const isLocked = s.status === 'LOCKED';
      const timeSlot = s.startTime && s.endTime ? `${s.startTime} – ${s.endTime}` : '10:35 AM – 11:30 AM';

      return {
        id: s.id,
        date: dStr,
        classroom: s.classroom || defaultClassroom,
        startTime: s.startTime || '10:35 AM',
        endTime: s.endTime || '11:30 AM',
        timeSlot,
        status: resolvedStatus,
        rawStatus: s.status,
        canEdit,
        isLocked,
        sessionPeriod: s.sessionPeriod || 1,
        totalStudents: total,
        presentCount: present,
        absentCount: absent,
        percentage: pct,
        submittedAt: s.submittedAt || s.createdAt,
        submittedById: s.submittedById,
        cancellationReason: s.cancellationReason || null,
        cancelledAt: s.cancelledAt || null,
        summary: {
          total,
          presentCount: present,
          absentCount: absent,
          attendanceRate: pct,
        },
      };
    });

    return {
      assignment: {
        id: assignment.id,
        subjectId: (assignment as any).subject?.id,
        subjectName: (assignment as any).subject?.name || 'Assigned Subject',
        subjectCode: (assignment as any).subject?.code || 'SUB001',
        semester: assignment.semester,
        section: normalizeSection(assignment.section),
        academicYear: assignment.academicYear,
        departmentName: (assignment as any).department?.name || 'Department',
        departmentCode: (assignment as any).department?.code || 'CSE',
        classroom: defaultClassroom,
      },
      summary: {
        totalScheduled: formattedSessions.length,
        classesHeld: completedCount,
        pendingCount,
        cancelledCount,
      },
      sessions: formattedSessions,
    };
  },

  /**
   * Schedules a class session for an assigned cohort (Pending status)
   */
  async scheduleFacultyClassSession(
    userId: string,
    assignmentId: string,
    payload: {
      date: string;
      startTime?: string;
      endTime?: string;
      classroom?: string;
    }
  ) {
    const teacher = await Teacher.findOne({ where: { userId } });
    const teacherId = teacher?.id;

    const assignment = await FacultyAssignment.findOne({
      where: {
        id: assignmentId,
        [Op.or]: [
          { userId },
          ...(teacherId ? [{ teacherId }] : []),
        ],
        status: 'ACTIVE',
        attendanceAccess: true,
      },
    });

    if (!assignment) {
      throw new Error('Unauthorized or inactive attendance assignment. Access denied.');
    }

    if (!payload.date) {
      throw new Error('Date is required to schedule a class session.');
    }

    const { matchedSection, students } = await getEnrolledStudentsForAssignment(assignment);
    const sessionDate = payload.date;
    const startTime = payload.startTime || '10:35 AM';
    const endTime = payload.endTime || '11:30 AM';
    const classroom = payload.classroom || matchedSection?.classroom || null;

    // Check if session already exists for this date
    const existing = await AttendanceSession.findOne({
      where: {
        facultyAssignmentId: assignment.id,
        attendanceDate: sessionDate,
        ...(payload.startTime ? { startTime: payload.startTime } : {}),
      },
    });

    if (existing) {
      if (existing.status === 'SUBMITTED' || existing.status === 'LOCKED') {
        throw new Error(`A completed class session already exists for ${sessionDate}.`);
      }
      return existing;
    }

    const session = await AttendanceSession.create({
      facultyAssignmentId: assignment.id,
      departmentId: assignment.departmentId,
      subjectId: assignment.subjectId,
      sectionId: matchedSection?.id || (assignment as any).sectionId || null,
      section: matchedSection?.name || assignment.section || 'A',
      semester: assignment.semester,
      academicYear: assignment.academicYear,
      attendanceDate: sessionDate,
      sessionPeriod: 1,
      status: 'PENDING',
      startTime,
      endTime,
      classroom,
      totalStudents: students.length,
      presentCount: 0,
      absentCount: 0,
    });

    return session;
  },

  /**
   * Explicitly marks a scheduled class session as Cancelled
   */
  async cancelFacultyClassSession(userId: string, sessionId: string, payload: { reason: string }) {
    const teacher = await Teacher.findOne({ where: { userId } });
    const teacherId = teacher?.id;

    const session = await AttendanceSession.findByPk(sessionId, {
      include: [{ model: FacultyAssignment, as: 'facultyAssignment' }],
    });

    if (!session) {
      throw new Error('Attendance session not found.');
    }

    const rawSession = session as any;
    let assignment = rawSession.facultyAssignment;
    let isOwner = false;

    if (assignment && assignment.status === 'ACTIVE' && (assignment.userId === userId || (teacherId && assignment.teacherId === teacherId))) {
      isOwner = true;
    } else {
      const activeAssignment = await FacultyAssignment.findOne({
        where: {
          [Op.or]: [
            { userId },
            ...(teacherId ? [{ teacherId }] : []),
          ],
          subjectId: session.subjectId,
          semester: session.semester,
          academicYear: session.academicYear,
          ...(session.section ? { section: session.section } : {}),
          status: 'ACTIVE',
        },
      });
      if (activeAssignment) {
        isOwner = true;
      }
    }

    if (!isOwner) {
      throw new Error('Unauthorized: You do not have permission to modify this attendance session.');
    }

    if (session.status === 'LOCKED') {
      throw new Error('Cannot cancel a locked attendance session.');
    }

    if (session.status === 'SUBMITTED' && session.presentCount > 0) {
      throw new Error('Cannot cancel a class session for which attendance has already been recorded and submitted. Use Correction instead.');
    }

    session.status = 'CANCELLED';
    session.cancellationReason = payload.reason || 'Class cancelled by faculty';
    session.cancelledAt = new Date();
    session.cancelledById = userId;
    await session.save();

    return session;
  },

  /**
   * Retrieves detailed attendance session data + student records for correction workspace
   */
  async getFacultyAttendanceSessionDetail(userId: string, sessionId: string) {
    const teacher = await Teacher.findOne({ where: { userId } });
    const teacherId = teacher?.id;

    const session = await AttendanceSession.findByPk(sessionId, {
      include: [
        { model: FacultyAssignment, as: 'facultyAssignment' },
        { model: Subject, as: 'subject' },
        { model: Department, as: 'department' },
        { model: User, as: 'submittedBy', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
    });

    if (!session) {
      throw new Error('Attendance session not found.');
    }

    const rawSession = session as any;
    let assignment = rawSession.facultyAssignment;
    let isOwner = false;

    if (assignment && assignment.status === 'ACTIVE' && (assignment.userId === userId || (teacherId && assignment.teacherId === teacherId))) {
      isOwner = true;
    } else {
      // Check if user is current active faculty for this subject/section cohort
      const secVariants = getSectionVariants(session.section);
      const ayVariants = getAcademicYearVariants(session.academicYear);
      const activeAssignment = await FacultyAssignment.findOne({
        where: {
          [Op.or]: [
            { userId },
            ...(teacherId ? [{ teacherId }] : []),
          ],
          subjectId: session.subjectId,
          semester: session.semester,
          status: 'ACTIVE',
          ...(secVariants.length > 0 ? { section: { [Op.in]: secVariants } } : {}),
          ...(ayVariants.length > 0 ? { academicYear: { [Op.in]: ayVariants } } : {}),
        },
        include: [
          { model: Subject, as: 'subject' },
          { model: Department, as: 'department' },
        ],
      });
      if (activeAssignment) {
        isOwner = true;
        assignment = activeAssignment;
      }
    }

    if (!isOwner || !assignment) {
      throw new Error('Unauthorized: You do not have permission to view or correct this attendance session.');
    }

    const user = await User.findByPk(userId);
    const isPrivileged = Boolean(user && ['HOD', 'DEAN', 'PRINCIPAL', 'ADMIN', 'SUPER_ADMIN'].includes(user.role));
    const isOriginalSubmittingFaculty = Boolean(
      (session.submittedById && session.submittedById === userId) ||
      (rawSession.facultyAssignment && (rawSession.facultyAssignment.userId === userId || (teacherId && rawSession.facultyAssignment.teacherId === teacherId)))
    );
    const canEdit = (isOriginalSubmittingFaculty || isPrivileged) && session.status !== 'LOCKED';
    const rawSubmittedBy = (session as any).submittedBy;
    const submittedByFacultyName = rawSubmittedBy
      ? `${rawSubmittedBy.firstName || ''} ${rawSubmittedBy.lastName || ''}`.trim() || rawSubmittedBy.email
      : undefined;

    // Fetch authoritative section students
    const { students } = await getEnrolledStudentsForAssignment(assignment);

    // Fetch attendance records for this session
    const records = await AttendanceRecord.findAll({
      where: {
        attendanceSessionId: session.id,
      },
    });

    const recordMap = new Map<string, AttendanceRecord>();
    records.forEach((r) => {
      recordMap.set(r.studentId, r);
    });

    const studentRows = students.map((st: any, idx: number) => {
      const rec = recordMap.get(st.id);
      const sName = st.user ? `${st.user.firstName || ''} ${st.user.lastName || ''}`.trim() : 'Student';
      const usn = st.usn || st.enrollmentNumber || 'N/A';
      const currentStatus: 'PRESENT' | 'ABSENT' | 'EXCUSED' = rec ? (rec.status as any) : 'ABSENT';

      return {
        slNo: idx + 1,
        studentId: st.id,
        usn: usn.toUpperCase(),
        studentName: sName,
        section: normalizeSection(st.section || assignment.section),
        currentStatus,
        attendanceRecordId: rec?.id || null,
      };
    });

    const totalStudents = studentRows.length;
    const presentCount = studentRows.filter((s) => s.currentStatus === 'PRESENT').length;
    const absentCount = studentRows.filter((s) => s.currentStatus === 'ABSENT').length;
    const pct = totalStudents > 0 ? Number(((presentCount / totalStudents) * 100).toFixed(1)) : 100.0;

    // Fetch recent correction audit logs for this session
    const allLogs = await AuditLog.findAll({
      where: { action: 'ATTENDANCE_CORRECTED' },
      include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }],
      order: [['createdAt', 'DESC']],
    });

    const sessionLogs = allLogs
      .filter((l: any) => l.details?.attendanceSessionId === session.id)
      .map((l: any) => ({
        id: l.id,
        studentId: l.details?.studentId,
        studentUsn: l.details?.studentUsn,
        studentName: l.details?.studentName,
        oldStatus: l.details?.oldStatus,
        newStatus: l.details?.newStatus,
        reason: l.details?.reason,
        remarks: l.details?.remarks,
        correctedByFacultyName:
          l.details?.correctedByFacultyName ||
          (l.user ? `${l.user.firstName || ''} ${l.user.lastName || ''}`.trim() : 'Faculty'),
        createdAt: l.createdAt,
      }));

    const sDateStr = typeof session.attendanceDate === 'string' ? session.attendanceDate : String(session.attendanceDate);

    return {
      session: {
        id: session.id,
        date: sDateStr,
        sessionPeriod: session.sessionPeriod || 1,
        status: session.status,
        totalStudents,
        presentCount,
        absentCount,
        percentage: pct,
        isLocked: session.status === 'LOCKED',
        canEdit,
        isEditable: canEdit,
        submittedById: session.submittedById,
        submittedByFacultyName,
      },
      assignment: {
        id: assignment.id,
        subjectId: (session as any).subject?.id || assignment.subjectId,
        subjectName: (session as any).subject?.name || 'Assigned Subject',
        subjectCode: (session as any).subject?.code || 'SUB001',
        departmentName: (session as any).department?.name || 'Department',
        departmentCode: (session as any).department?.code || 'CSE',
        semester: session.semester,
        section: normalizeSection(session.section || assignment.section),
        academicYear: session.academicYear,
      },
      students: studentRows,
      summary: {
        total: totalStudents,
        present: presentCount,
        absent: absentCount,
        rate: pct,
      },
      corrections: sessionLogs,
    };
  },

  /**
   * Transactional attendance correction handler
   */
  async correctFacultyAttendance(
    userId: string,
    sessionId: string,
    payload: {
      changes: Array<{
        studentId: string;
        newStatus: 'PRESENT' | 'ABSENT' | 'EXCUSED';
        reason: string;
        remarks?: string;
      }>;
    },
    reqMeta?: { ipAddress?: string; userAgent?: string }
  ) {
    if (!payload || !Array.isArray(payload.changes) || payload.changes.length === 0) {
      throw new Error('No attendance changes provided.');
    }

    const teacher = await Teacher.findOne({ where: { userId } });
    const teacherId = teacher?.id;

    const session = await AttendanceSession.findByPk(sessionId, {
      include: [
        { model: FacultyAssignment, as: 'facultyAssignment' },
        { model: Subject, as: 'subject' },
        { model: Department, as: 'department' },
      ],
    });

    if (!session) {
      throw new Error('Attendance session not found.');
    }

    if (session.status === 'LOCKED') {
      throw new Error('Attendance session is locked and cannot be corrected.');
    }

    const rawSession = session as any;
    let assignment = rawSession.facultyAssignment;
    let isOwner = false;

    if (assignment && assignment.status === 'ACTIVE' && (assignment.userId === userId || (teacherId && assignment.teacherId === teacherId))) {
      isOwner = true;
    } else {
      // Check if user is current active faculty for this subject/section cohort
      const secVariants = getSectionVariants(session.section);
      const ayVariants = getAcademicYearVariants(session.academicYear);
      const activeAssignment = await FacultyAssignment.findOne({
        where: {
          [Op.or]: [
            { userId },
            ...(teacherId ? [{ teacherId }] : []),
          ],
          subjectId: session.subjectId,
          semester: session.semester,
          status: 'ACTIVE',
          ...(secVariants.length > 0 ? { section: { [Op.in]: secVariants } } : {}),
          ...(ayVariants.length > 0 ? { academicYear: { [Op.in]: ayVariants } } : {}),
        },
      });
      if (activeAssignment) {
        isOwner = true;
        assignment = activeAssignment;
      }
    }

    if (!isOwner || !assignment) {
      throw new Error('Unauthorized: You do not have permission to correct attendance for this session.');
    }

    const user = await User.findByPk(userId);
    const isPrivileged = Boolean(user && ['HOD', 'DEAN', 'PRINCIPAL', 'ADMIN', 'SUPER_ADMIN'].includes(user.role));
    const isOriginalSubmittingFaculty = Boolean(
      (session.submittedById && session.submittedById === userId) ||
      (rawSession.facultyAssignment && (rawSession.facultyAssignment.userId === userId || (teacherId && rawSession.facultyAssignment.teacherId === teacherId)))
    );

    if (!isOriginalSubmittingFaculty && !isPrivileged) {
      throw new Error('Unauthorized: You cannot modify historical attendance recorded by another faculty member.');
    }

    const facultyUser = await User.findByPk(userId);
    const facultyName = facultyUser
      ? `${facultyUser.firstName || ''} ${facultyUser.lastName || ''}`.trim() || facultyUser.email
      : 'Faculty';

    // Validate reasons
    for (const change of payload.changes) {
      if (!change.reason || !change.reason.trim()) {
        throw new Error(`A valid reason is required for attendance correction.`);
      }
      if (change.reason === 'Other' && (!change.remarks || !change.remarks.trim())) {
        throw new Error(`Remarks are required when reason is "Other".`);
      }
      if (!['PRESENT', 'ABSENT', 'EXCUSED'].includes(change.newStatus)) {
        throw new Error(`Invalid attendance status: ${change.newStatus}`);
      }
    }

    // Verify student roster isolation
    const { students } = await getEnrolledStudentsForAssignment(assignment);
    const studentMap = new Map<string, any>();
    students.forEach((s: any) => studentMap.set(s.id, s));

    for (const change of payload.changes) {
      if (!studentMap.has(change.studentId)) {
        throw new Error(`Student ${change.studentId} is not in this section roster.`);
      }
    }

    const sDateStr = typeof session.attendanceDate === 'string' ? session.attendanceDate : String(session.attendanceDate);

    // Run in a transaction
    const transaction = await db.transaction();
    let updatedCount = 0;

    try {
      for (const change of payload.changes) {
        const student = studentMap.get(change.studentId);
        const sName = student?.user ? `${student.user.firstName || ''} ${student.user.lastName || ''}`.trim() : 'Student';
        const sUsn = student?.usn || student?.enrollmentNumber || 'N/A';

        // Find existing record
        let record = await AttendanceRecord.findOne({
          where: {
            attendanceSessionId: session.id,
            studentId: change.studentId,
          },
          transaction,
        });

        if (!record) {
          // Fallback lookup by assignment, date, period
          record = await AttendanceRecord.findOne({
            where: {
              facultyAssignmentId: assignment.id,
              studentId: change.studentId,
              date: sDateStr as any,
              sessionPeriod: session.sessionPeriod,
            },
            transaction,
          });
        }

        const oldStatus = record ? record.status : 'ABSENT';

        // Only update and log if status actually changes
        if (oldStatus !== change.newStatus) {
          if (record) {
            record.status = change.newStatus;
            record.attendanceSessionId = session.id;
            await record.save({ transaction });
          } else {
            record = await AttendanceRecord.create(
              {
                attendanceSessionId: session.id,
                studentId: change.studentId,
                facultyAssignmentId: assignment.id,
                departmentId: assignment.departmentId,
                subjectId: assignment.subjectId,
                semester: assignment.semester,
                section: session.section || assignment.section,
                academicYear: session.academicYear || assignment.academicYear,
                date: sDateStr as any,
                sessionPeriod: session.sessionPeriod,
                status: change.newStatus,
              },
              { transaction }
            );
          }

          // Create immutable AuditLog
          await AuditLog.create(
            {
              userId,
              action: 'ATTENDANCE_CORRECTED',
              ipAddress: reqMeta?.ipAddress || null,
              userAgent: reqMeta?.userAgent || null,
              details: {
                entityType: 'ATTENDANCE_RECORD',
                entityId: record.id,
                studentId: change.studentId,
                studentUsn: sUsn,
                studentName: sName,
                attendanceSessionId: session.id,
                facultyAssignmentId: assignment.id,
                subjectId: assignment.subjectId,
                subjectName: (session as any).subject?.name || (assignment as any).subject?.name,
                subjectCode: (session as any).subject?.code || (assignment as any).subject?.code,
                section: session.section || assignment.section,
                semester: session.semester,
                academicYear: session.academicYear,
                date: sDateStr,
                sessionPeriod: session.sessionPeriod,
                oldStatus,
                newStatus: change.newStatus,
                reason: change.reason,
                remarks: change.remarks || '',
                correctedByFacultyName: facultyName,
                correctedByUserId: userId,
                timestamp: new Date().toISOString(),
              },
            },
            { transaction }
          );

          updatedCount++;
        }
      }

      // If records were updated, recalculate session present/absent counts
      if (updatedCount > 0) {
        const allSessionRecords = await AttendanceRecord.findAll({
          where: { attendanceSessionId: session.id },
          transaction,
        });

        const newPresent = allSessionRecords.filter((r) => r.status === 'PRESENT').length;
        const newAbsent = allSessionRecords.filter((r) => r.status === 'ABSENT').length;

        session.presentCount = newPresent;
        session.absentCount = newAbsent;
        session.totalStudents = allSessionRecords.length > 0 ? allSessionRecords.length : session.totalStudents;
        await session.save({ transaction });
      }

      await transaction.commit();
      logger.info(`Attendance correction committed for session ${sessionId}. ${updatedCount} records changed.`);
    } catch (err) {
      await transaction.rollback();
      logger.error('CORRECT_FACULTY_ATTENDANCE_TRANSACTION_ERROR:', err);
      throw err;
    }

    return this.getFacultyAttendanceSessionDetail(userId, sessionId);
  },

  /**
   * Retrieves full correction history for an assignment
   */
  async getFacultyAssignmentCorrections(userId: string, assignmentId: string) {
    const teacher = await Teacher.findOne({ where: { userId } });
    const teacherId = teacher?.id;

    const assignment = await FacultyAssignment.findOne({
      where: {
        id: assignmentId,
        [Op.or]: [
          { userId },
          ...(teacherId ? [{ teacherId }] : []),
        ],
        status: 'ACTIVE',
      },
    });

    if (!assignment) {
      throw new Error('Unauthorized or inactive attendance assignment. Access denied.');
    }

    const allLogs = await AuditLog.findAll({
      where: { action: 'ATTENDANCE_CORRECTED' },
      include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }],
      order: [['createdAt', 'DESC']],
    });

    const assignmentLogs = allLogs
      .filter((l: any) => l.details?.facultyAssignmentId === assignment.id)
      .map((l: any) => ({
        id: l.id,
        sessionId: l.details?.attendanceSessionId,
        date: l.details?.date,
        sessionPeriod: l.details?.sessionPeriod,
        studentId: l.details?.studentId,
        studentUsn: l.details?.studentUsn,
        studentName: l.details?.studentName,
        oldStatus: l.details?.oldStatus,
        newStatus: l.details?.newStatus,
        reason: l.details?.reason,
        remarks: l.details?.remarks,
        correctedByFacultyName:
          l.details?.correctedByFacultyName ||
          (l.user ? `${l.user.firstName || ''} ${l.user.lastName || ''}`.trim() : 'Faculty'),
        createdAt: l.createdAt,
      }));

    return assignmentLogs;
  },

  /**
   * Searches students strictly across the logged-in faculty's authorized active assignments.
   * Enforces backend assignment scoping and section isolation.
   */
  async searchFacultyStudents(
    userId: string,
    query: string,
    academicYear?: string,
    semester?: string
  ) {
    const q = (query || '').trim().toLowerCase();
    if (!q) {
      return [];
    }

    const teacher = await Teacher.findOne({ where: { userId } });
    const teacherId = teacher?.id;

    const whereClause: any = {
      [Op.or]: [
        { userId },
        ...(teacherId ? [{ teacherId }] : []),
      ],
      status: 'ACTIVE',
    };

    if (academicYear && academicYear !== 'ALL') {
      let resolvedYear = academicYear;
      if (/^[0-9a-fA-F-]{36}$/.test(academicYear)) {
        const ayRecord = await AcademicYear.findByPk(academicYear);
        if (ayRecord?.year) resolvedYear = ayRecord.year;
      }
      const ayVariants = getAcademicYearVariants(resolvedYear);
      if (ayVariants.length > 0) {
        whereClause.academicYear = { [Op.in]: ayVariants };
      }
    }

    if (semester && semester !== 'ALL') {
      const sem = parseInt(semester, 10);
      if (!isNaN(sem)) {
        whereClause.semester = sem;
      }
    }

    const assignments = await FacultyAssignment.findAll({
      where: whereClause,
      include: [
        { model: Subject, as: 'subject' },
        { model: Department, as: 'department' },
      ],
    });

    if (assignments.length === 0) {
      return [];
    }

    const studentMap = new Map<string, {
      id: string;
      name: string;
      usn: string;
      department: string;
      departmentCode: string;
      semester: number;
      section: string;
      sectionId: string | null;
      rollNumber?: string | null;
      assignedSubjectsCount: number;
    }>();

    for (const a of assignments) {
      const { students, matchedSection } = await getEnrolledStudentsForAssignment(a);
      for (const st of students) {
        const u = (st as any).user;
        const firstName = (u?.firstName || '').toLowerCase();
        const lastName = (u?.lastName || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        const usn = (st.usn || '').toLowerCase();
        const enrollmentNumber = (st.enrollmentNumber || '').toLowerCase();

        const matches =
          usn.includes(q) ||
          enrollmentNumber.includes(q) ||
          fullName.includes(q) ||
          firstName.includes(q) ||
          lastName.includes(q);

        if (matches) {
          const sName = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : 'Student';
          const sUsn = (st.usn || st.enrollmentNumber || 'N/A').toUpperCase();
          const sSec = normalizeSection(st.section || a.section);

          if (!studentMap.has(st.id)) {
            studentMap.set(st.id, {
              id: st.id,
              name: sName,
              usn: sUsn,
              department: (st as any).department?.name || (a as any).department?.name || 'Department',
              departmentCode: (st as any).department?.code || (a as any).department?.code || 'CSE',
              semester: st.semester,
              section: sSec,
              sectionId: matchedSection?.id || (a as any).sectionId || null,
              rollNumber: (st as any).rollNumber || null,
              assignedSubjectsCount: 1,
            });
          } else {
            const existing = studentMap.get(st.id)!;
            existing.assignedSubjectsCount++;
          }
        }
      }
    }

    const results = Array.from(studentMap.values()).sort((a, b) => {
      return compareStudentsByUsnOrName(a.usn, b.usn, a.name, b.name, a.rollNumber, b.rollNumber);
    });
    return results;
  },

  /**
   * Retrieves subject-wise attendance for a single student, ONLY for subjects/sections
   * that the logged-in faculty is authorized to teach via FacultyAssignment.
   */
  async getFacultyStudentAttendance(
    userId: string,
    studentId: string,
    academicYear?: string
  ) {
    const student = await Student.findByPk(studentId, {
      include: [
        { model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] },
        { model: Department, as: 'department', attributes: ['id', 'name', 'code'] },
      ],
    });

    if (!student) {
      throw new Error('Student not found.');
    }

    const teacher = await Teacher.findOne({ where: { userId } });
    const teacherId = teacher?.id;

    const whereClause: any = {
      [Op.or]: [
        { userId },
        ...(teacherId ? [{ teacherId }] : []),
      ],
      status: 'ACTIVE',
    };

    if (academicYear && academicYear !== 'ALL') {
      let resolvedYear = academicYear;
      if (/^[0-9a-fA-F-]{36}$/.test(academicYear)) {
        const ayRecord = await AcademicYear.findByPk(academicYear);
        if (ayRecord?.year) resolvedYear = ayRecord.year;
      }
      const ayVariants = getAcademicYearVariants(resolvedYear);
      if (ayVariants.length > 0) {
        whereClause.academicYear = { [Op.in]: ayVariants };
      }
    }

    const assignments = await FacultyAssignment.findAll({
      where: whereClause,
      include: [
        { model: Subject, as: 'subject' },
        { model: Department, as: 'department' },
      ],
      order: [['semester', 'ASC'], ['createdAt', 'ASC']],
    });

    const studentInfo = {
      id: student.id,
      name: (student as any).user ? `${(student as any).user.firstName || ''} ${(student as any).user.lastName || ''}`.trim() : 'Student',
      usn: (student.usn || student.enrollmentNumber || 'N/A').toUpperCase(),
      department: (student as any).department?.name || 'Department',
      departmentCode: (student as any).department?.code || 'CSE',
      semester: student.semester,
      section: normalizeSection(student.section),
    };

    const matchingSubjects: any[] = [];

    for (const a of assignments) {
      const { students, matchedSection } = await getEnrolledStudentsForAssignment(a);
      const isEnrolled = students.some((st) => st.id === student.id);

      if (!isEnrolled) {
        // Strict Authorization: If student is not in this assignment's section roster, skip!
        continue;
      }

      // Fetch all conducted sessions for this assignment/cohort
      const cohortWhere = buildAssignmentCohortWhere(a);
      const sessions = await AttendanceSession.findAll({
        where: cohortWhere,
        order: [['attendanceDate', 'DESC'], ['sessionPeriod', 'DESC']],
      });

      // Fetch student's attendance records for this assignment/cohort
      const records = await AttendanceRecord.findAll({
        where: {
          ...cohortWhere,
          studentId: student.id,
        },
        order: [['date', 'DESC'], ['sessionPeriod', 'DESC']],
      });

      // Calculate unique conducted dates/sessions
      const conductedCount = sessions.length > 0 ? sessions.length : records.length;
      const attendedCount = records.filter((r) => r.status === 'PRESENT').length;
      const absentCount = records.filter((r) => r.status === 'ABSENT').length;
      const excusedCount = records.filter((r) => r.status === 'EXCUSED').length;

      const attendancePercentage =
        conductedCount > 0 ? Number(((attendedCount / conductedCount) * 100).toFixed(2)) : null;

      const eligibilityStatus =
        conductedCount === 0
          ? 'No Records'
          : attendancePercentage !== null && attendancePercentage >= ATTENDANCE_THRESHOLD
          ? 'Eligible'
          : 'Not Eligible';

      const recentSessions = sessions.slice(0, 10).map((s) => {
        const sDate = typeof s.attendanceDate === 'string' ? s.attendanceDate : String(s.attendanceDate);
        const rec = records.find(
          (r) => r.attendanceSessionId === s.id || String(r.date) === sDate
        );
        return {
          sessionId: s.id,
          date: sDate,
          period: s.sessionPeriod || 1,
          status: rec ? rec.status : 'ABSENT',
        };
      });

      matchingSubjects.push({
        facultyAssignmentId: a.id,
        subjectId: (a as any).subject?.id || a.subjectId,
        subjectCode: (a as any).subject?.code || 'SUB001',
        subjectName: (a as any).subject?.name || 'Assigned Subject',
        credits: (a as any).subject?.credits || 4,
        type: (a as any).subject?.type || 'THEORY',
        sectionId: matchedSection?.id || (a as any).sectionId || null,
        sectionName: normalizeSection(a.section),
        semester: a.semester,
        academicYear: a.academicYear,
        conductedClasses: conductedCount,
        attendedClasses: attendedCount,
        absentClasses: absentCount,
        excusedClasses: excusedCount,
        attendancePercentage,
        eligibilityStatus,
        threshold: ATTENDANCE_THRESHOLD,
        canCorrect: a.attendanceAccess !== false,
        latestSessionId: sessions[0]?.id || null,
        recentSessions,
      });
    }

    return {
      student: studentInfo,
      subjects: matchingSubjects,
      message:
        matchingSubjects.length === 0
          ? 'No attendance available for your assigned subjects.'
          : undefined,
    };
  },

  /**
   * Retrieves all authorized cohorts (AY, Semester, Department, Sections) that the faculty
   * member is authorized to view in the Consolidated All Subject Attendance register.
   */
  async getFacultyAllSubjectAttendanceCohorts(userId: string, userRole?: string) {
    const isGlobalAdmin = ['ADMIN', 'SUPER_ADMIN', 'DEAN', 'PRINCIPAL'].includes(userRole || '');

    // Check if user is an active HOD
    const hod = await HOD.findOne({
      where: { userId, isActive: true },
    });

    let assignments: any[] = [];
    if (isGlobalAdmin) {
      assignments = await FacultyAssignment.findAll({
        where: { status: 'ACTIVE' },
        include: [
          { model: Department, as: 'department' },
          { model: Subject, as: 'subject' },
        ],
      });
    } else {
      const teacher = await Teacher.findOne({ where: { userId } });
      const teacherId = teacher?.id;
      const orConditions: any[] = [{ userId }];
      if (teacherId) orConditions.push({ teacherId });

      if (hod?.departmentId) {
        orConditions.push({ departmentId: hod.departmentId });
      }

      assignments = await FacultyAssignment.findAll({
        where: {
          [Op.or]: orConditions,
          status: 'ACTIVE',
        },
        include: [
          { model: Department, as: 'department' },
          { model: Subject, as: 'subject' },
        ],
      });
    }

    const cohortMap = new Map<string, {
      academicYear: string;
      semester: number;
      departmentId: string;
      departmentName: string;
      departmentCode: string;
      sections: Set<string>;
      hasCohortAccess: boolean;
    }>();

    for (const a of assignments) {
      const ay = a.academicYear || '2026-27';
      const sem = Number(a.semester);
      const deptId = a.departmentId;
      const dept = a.department;
      const deptName = dept?.name || 'Department';
      const deptCode = dept?.code || 'CSE';
      const cleanSec = normalizeSection(a.section);

      const key = `${ay}___${sem}___${deptId}`;
      if (!cohortMap.has(key)) {
        cohortMap.set(key, {
          academicYear: ay,
          semester: sem,
          departmentId: deptId,
          departmentName: deptName,
          departmentCode: deptCode,
          sections: new Set<string>(),
          hasCohortAccess: isGlobalAdmin || (hod && hod.departmentId === deptId) || false,
        });
      }

      const entry = cohortMap.get(key)!;
      if (!a.section || a.section === 'ALL') {
        entry.hasCohortAccess = true;
      } else {
        entry.sections.add(cleanSec);
      }
    }

    // If active HOD has no assignments yet, include their department active semesters
    if (hod?.departmentId && !isGlobalAdmin) {
      const dept = await Department.findByPk(hod.departmentId);
      if (dept) {
        const defaultKey = `2026-27___1___${dept.id}`;
        if (!cohortMap.has(defaultKey)) {
          cohortMap.set(defaultKey, {
            academicYear: '2026-27',
            semester: 1,
            departmentId: dept.id,
            departmentName: dept.name,
            departmentCode: dept.code,
            sections: new Set<string>(['A', 'B']),
            hasCohortAccess: true,
          });
        }
      }
    }

    // Ensure all 8 semesters (1 through 8) are represented for every authorized department and academic year
    const ALL_8_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
    const initialDeptAyEntries = Array.from(cohortMap.values());
    for (const item of initialDeptAyEntries) {
      for (const sem of ALL_8_SEMESTERS) {
        const key = `${item.academicYear}___${sem}___${item.departmentId}`;
        if (!cohortMap.has(key)) {
          cohortMap.set(key, {
            academicYear: item.academicYear,
            semester: sem,
            departmentId: item.departmentId,
            departmentName: item.departmentName,
            departmentCode: item.departmentCode,
            sections: new Set<string>(),
            hasCohortAccess: item.hasCohortAccess,
          });
        }
      }
    }

    // Resolve all existing sections in each cohort and determine cohort-wide access
    for (const [, entry] of cohortMap.entries()) {
      const dbSecs = await Section.findAll({
        where: {
          departmentId: entry.departmentId,
          semester: entry.semester,
          academicYear: entry.academicYear,
          status: 'ACTIVE',
        },
      });

      const studentSecs = await Student.findAll({
        attributes: ['section'],
        where: {
          departmentId: entry.departmentId,
          semester: entry.semester,
        },
        raw: true,
      });

      const allFoundSecs = new Set<string>();
      dbSecs.forEach((s) => allFoundSecs.add(normalizeSection(s.name)));
      studentSecs.forEach((st: any) => {
        if (st.section) allFoundSecs.add(normalizeSection(st.section));
      });

      // Every faculty authorized by teaching allocations for this cohort has cohort-level visibility
      entry.hasCohortAccess = true;

      // Add all available cohort sections to entry.sections
      allFoundSecs.forEach((s) => entry.sections.add(s));
    }

    const cohorts = Array.from(cohortMap.values())
      .map((c) => ({
        academicYear: c.academicYear,
        semester: c.semester,
        departmentId: c.departmentId,
        departmentName: c.departmentName,
        departmentCode: c.departmentCode,
        sections: Array.from(c.sections).sort(),
        hasCohortAccess: c.hasCohortAccess,
      }))
      .sort((a, b) => a.semester - b.semester || a.departmentName.localeCompare(b.departmentName));

    const academicYears = Array.from(new Set(cohorts.map((c) => c.academicYear))).sort();

    return {
      academicYears,
      cohorts,
    };
  },

  /**
   * Authoritatively fetches the live Consolidated All Subject Attendance register
   * after rigorously checking faculty authorization for the cohort.
   */
  async getFacultyAllSubjectAttendanceRegister(
    userId: string,
    userRole: string | undefined,
    params: {
      academicYear: string;
      semester: number;
      departmentId: string;
      section?: string;
    }
  ) {
    const { academicYear, semester, departmentId, section } = params;
    const isGlobalAdmin = ['ADMIN', 'SUPER_ADMIN', 'DEAN', 'PRINCIPAL'].includes(userRole || '');

    if (!isGlobalAdmin) {
      const hod = await HOD.findOne({ where: { userId, isActive: true } });
      const isHodForDept = hod && hod.departmentId === departmentId;

      if (!isHodForDept) {
        const teacher = await Teacher.findOne({ where: { userId } });
        const teacherId = teacher?.id;
        const ayVariants = getAcademicYearVariants(academicYear);

        const assignments = await FacultyAssignment.findAll({
          where: {
            [Op.or]: [
              { userId },
              ...(teacherId ? [{ teacherId }] : []),
            ],
            departmentId,
            semester,
            academicYear: ayVariants.length > 0 ? { [Op.in]: ayVariants } : academicYear,
            status: 'ACTIVE',
          },
        });

        if (assignments.length === 0) {
          throw new Error('Unauthorized: You do not have an active teaching allocation for this cohort.');
        }

        if (section && section !== 'ALL') {
          const reqSec = normalizeSection(section);
          const hasSectionAccess = assignments.some((a) => {
            if (!a.section || a.section === 'ALL') return true;
            return normalizeSection(a.section) === reqSec;
          });

          if (!hasSectionAccess) {
            throw new Error(`Unauthorized: You do not have a teaching allocation for Section ${reqSec}.`);
          }
        }
      }
    }

    const data = await semesterAttendanceConsolidationService.fetchConsolidatedSemesterData({
      academicYear,
      departmentId,
      semester,
      section,
    });

    return data;
  },

  /**
   * Generates and returns Excel buffer for Consolidated All Subject Attendance
   */
  async exportFacultyAllSubjectAttendanceExcel(
    userId: string,
    userRole: string | undefined,
    params: {
      academicYear: string;
      semester: number;
      departmentId: string;
      section?: string;
    }
  ) {
    const data = await this.getFacultyAllSubjectAttendanceRegister(userId, userRole, params);
    const buffer = await semesterAttendanceConsolidationService.generateConsolidatedExcelBuffer(data);
    return {
      buffer,
      fileName: data.fileName,
    };
  },
};

export default facultyService;

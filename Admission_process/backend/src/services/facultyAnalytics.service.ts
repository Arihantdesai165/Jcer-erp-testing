import { Op } from 'sequelize';
import FacultyAssignment from '../models/FacultyAssignment';
import Subject from '../models/Subject';
import Department from '../models/Department';
import DepartmentSetting from '../models/DepartmentSetting';
import Teacher from '../models/Teacher';
import Student from '../models/Student';
import User from '../models/User';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';
import AssessmentConfiguration from '../models/AssessmentConfiguration';
import StudentAssessmentSummary from '../models/StudentAssessmentSummary';
import FinalInternalMarks from '../models/FinalInternalMarks';
import ExternalExaminationMarks from '../models/ExternalExaminationMarks';
import AcademicYear from '../models/AcademicYear';
import { calculateVtuPassingStatus } from '../utils/bitwiseCalculation.util';
import {
  getEnrolledStudentsForAssignment,
  getAcademicYearVariants,
  normalizeSection,
  ATTENDANCE_THRESHOLD,
  compareStudentsByUsnOrName,
} from './faculty.service';

export interface AnalyticsSemesterItem {
  semester: number;
  semesterName: string;
  academicYear: string;
  assignedSubjectsCount: number;
  assignedSectionsCount: number;
  assignedSections: string[];
  totalStudentsCovered: number;
  attendanceSummary: {
    sessionsConducted: number;
    averageAttendance: number;
    defaultersCount: number;
    threshold: number;
  };
  marksSummary: {
    configuredAssessments: number;
    publishedAssessments: number;
    statusText: string;
    hasMarksData: boolean;
  };
}

export interface AnalyticsSubjectItem {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  semester: number;
  sections: string[];
  assignmentIds: string[];
  totalStudents: number;
  conductedSessions: number;
  averageAttendance: number;
  attendanceStatus: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' | 'NO_DATA';
  marksStatus: string;
  marksAvailability: 'AVAILABLE' | 'PARTIAL' | 'NOT_CONFIGURED';
}

export interface AttendanceAnalyticsResult {
  subject: {
    id: string;
    name: string;
    code: string;
    semester: number;
    selectedSection: string;
    availableSections: string[];
    academicYear: string;
  };
  kpis: {
    enrolledStudents: number;
    conductedSessions: number;
    totalAttendanceRecords: number;
    averageAttendance: number;
    meetingThresholdCount: number;
    belowThresholdCount: number;
    unrecordedSessionsCount: number | null;
    unrecordedSessionsNote: string;
    latestRecordedDate: string | null;
    threshold: number;
  };
  charts: {
    distribution: Array<{
      range: string;
      min: number;
      max: number;
      count: number;
      percentage: number;
    }>;
    statusDistribution: Array<{
      name: string;
      value: number;
      percentage: number;
      color: string;
    }>;
    trend: Array<{
      date: string;
      sessionPeriod: number;
      label: string;
      attendancePercentage: number;
      presentCount: number;
      totalStudents: number;
    }>;
    sessionWise: Array<{
      sessionNumber: number;
      date: string;
      period: number;
      label: string;
      presentCount: number;
      absentCount: number;
      attendancePercentage: number;
    }>;
    sectionComparison?: Array<{
      section: string;
      averageAttendance: number;
      studentCount: number;
      sessionsCount: number;
    }>;
  };
  students: Array<{
    studentId: string;
    usn: string;
    studentName: string;
    section: string;
    totalSessions: number;
    presentCount: number;
    absentCount: number;
    attendancePercentage: number;
    status: 'ELIGIBLE' | 'SHORTAGE';
    lastRecordedDate: string | null;
  }>;
  defaulters: Array<{
    studentId: string;
    usn: string;
    studentName: string;
    section: string;
    totalSessions: number;
    presentCount: number;
    absentCount: number;
    attendancePercentage: number;
    shortageDelta: number;
  }>;
}

export interface MarksAnalyticsResult {
  subject: {
    id: string;
    name: string;
    code: string;
    semester: number;
    selectedSection: string;
    availableSections: string[];
    academicYear: string;
  };
  assessmentType: 'CIE1' | 'CIE2' | 'SEE';
  availableAssessments: Array<{
    type: 'CIE1' | 'CIE2' | 'SEE';
    label: string;
    status: string;
    maxMarks: number;
    isPublished: boolean;
  }>;
  kpis: {
    enrolledStudents: number;
    submittedCount: number;
    pendingCount: number;
    classAverage: number | null;
    highestMark: number | null;
    lowestMark: number | null;
    medianMark: number | null;
    passCount: number;
    passPercentage: number;
    failCount: number;
    maximumMarks: number;
    passingMarks: number;
    assessmentStatus: string;
    isPublished: boolean;
  };
  charts: {
    distribution: Array<{
      range: string;
      min: number;
      max: number;
      count: number;
      percentage: number;
    }>;
    assessmentComparison: Array<{
      metric: string;
      cie1Value: number | null;
      cie2Value: number | null;
      seeValue?: number | null;
      unit: string;
    }>;
    performanceTrend: Array<{
      assessment: string;
      averageMark: number | null;
      maxMarks: number;
      averagePercentage: number | null;
    }>;
    passDistribution: Array<{
      name: string;
      value: number;
      percentage: number;
      color: string;
    }>;
    summaryStats: {
      classAverage: number | null;
      medianScore: number | null;
      highestScore: number | null;
      lowestScore: number | null;
      scoreSpread: number | null;
      assessedStudentsCount: number;
    };
  };
  students: Array<{
    studentId: string;
    usn: string;
    studentName: string;
    section: string;
    cie1Marks: number | null;
    cie1Max: number | null;
    cie1Status: string;
    cie2Marks: number | null;
    cie2Max: number | null;
    cie2Status: string;
    finalScore: number | null;
    finalCieMarks?: number | null;
    externalMarks?: number | null;
    seeScaledMarks?: number | null;
    totalMarks?: number | null;
    vtuStatus?: 'PASS' | 'FAIL' | 'NOT_ENTERED';
    vtuReason?: string;
    completionStatus: string;
    performanceCategory: string;
  }>;
}

export const facultyAnalyticsService = {
  /**
   * Helper: Resolves active faculty assignments for a user and academic year
   */
  async getFacultyActiveAssignments(userId: string, academicYear?: string) {
    const teacher = await Teacher.findOne({ where: { userId } });
    const teacherId = teacher?.id;

    const whereClause: any = {
      [Op.or]: [{ userId }, ...(teacherId ? [{ teacherId }] : [])],
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
      order: [
        ['semester', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });

    return assignments;
  },

  /**
   * Step 1: Retrieves assigned semesters for the authenticated faculty member
   */
  async getAnalyticsSemesters(userId: string, academicYear?: string): Promise<AnalyticsSemesterItem[]> {
    const assignments = await this.getFacultyActiveAssignments(userId, academicYear);
    if (!assignments || assignments.length === 0) {
      return [];
    }

    // Group assignments by semester
    const semMap: { [sem: number]: any[] } = {};
    for (const a of assignments) {
      const s = Number(a.semester);
      if (!semMap[s]) semMap[s] = [];
      semMap[s].push(a);
    }

    const result: AnalyticsSemesterItem[] = [];

    for (const semStr of Object.keys(semMap)) {
      const sem = Number(semStr);
      const semAssignments = semMap[sem];

      // Unique subjects
      const subjectIds = Array.from(new Set(semAssignments.map((a) => a.subjectId || a.subject?.id).filter(Boolean)));
      
      // Unique sections
      const sectionsSet = new Set<string>();
      semAssignments.forEach((a) => {
        const secNorm = normalizeSection(a.section);
        sectionsSet.add(`Section ${secNorm}`);
      });
      const assignedSections = Array.from(sectionsSet);

      // Unique enrolled students across all assigned sections in this semester (NO double-counting)
      const allStudentsMap = new Map<string, any>();
      for (const a of semAssignments) {
        const { students } = await getEnrolledStudentsForAssignment(a);
        for (const st of students) {
          if (!allStudentsMap.has(st.id)) {
            allStudentsMap.set(st.id, st);
          }
        }
      }
      const totalStudentsCovered = allStudentsMap.size;

      // Department threshold
      const sampleAssignment = semAssignments[0];
      const deptSetting = sampleAssignment?.departmentId
        ? await DepartmentSetting.findOne({
            where: {
              departmentId: sampleAssignment.departmentId,
              academicYear: { [Op.in]: getAcademicYearVariants(sampleAssignment.academicYear || academicYear) },
            },
          })
        : null;
      const threshold = deptSetting ? Number(deptSetting.attendanceThreshold) : ATTENDANCE_THRESHOLD;

      // Attendance aggregation across assignments in this semester
      const assignmentIds = semAssignments.map((a) => a.id);
      const sessions = await AttendanceSession.findAll({
        where: {
          facultyAssignmentId: { [Op.in]: assignmentIds },
          status: { [Op.in]: ['SUBMITTED', 'LOCKED'] },
        },
      });
      const sessionsConducted = sessions.length;

      const records = await AttendanceRecord.findAll({
        where: {
          facultyAssignmentId: { [Op.in]: assignmentIds },
        },
        attributes: ['studentId', 'status'],
      });

      const totalRecords = records.length;
      const presentRecords = records.filter((r) => r.status === 'PRESENT').length;
      const averageAttendance = totalRecords > 0 ? Number(((presentRecords / totalRecords) * 100).toFixed(1)) : 0;

      // Student-wise attendance to find defaulters
      const studentAttendanceMap: { [studentId: string]: { total: number; present: number } } = {};
      for (const r of records) {
        if (!studentAttendanceMap[r.studentId]) {
          studentAttendanceMap[r.studentId] = { total: 0, present: 0 };
        }
        studentAttendanceMap[r.studentId].total++;
        if (r.status === 'PRESENT') {
          studentAttendanceMap[r.studentId].present++;
        }
      }

      let defaultersCount = 0;
      for (const stId of Object.keys(studentAttendanceMap)) {
        const stats = studentAttendanceMap[stId];
        if (stats.total > 0) {
          const pct = (stats.present / stats.total) * 100;
          if (pct < threshold) defaultersCount++;
        }
      }

      // Marks configuration and publication status
      const ayClean = sampleAssignment?.academicYear || academicYear || '2026-27';
      const configs = await AssessmentConfiguration.findAll({
        where: {
          subjectId: { [Op.in]: subjectIds },
          semester: sem,
          academicYear: { [Op.in]: getAcademicYearVariants(ayClean) },
        },
      });

      const configuredAssessments = configs.length;
      const publishedAssessments = configs.filter((c) => c.isPublished || c.status === 'PUBLISHED').length;

      let marksStatusText = 'Not Configured';
      if (publishedAssessments > 0) {
        marksStatusText = `${publishedAssessments} Published`;
      } else if (configuredAssessments > 0) {
        const savedCount = configs.filter((c) => ['SAVED', 'SUBMITTED', 'APPROVED'].includes(c.status)).length;
        marksStatusText = savedCount > 0 ? `${savedCount} Assessment(s) Recorded` : `${configuredAssessments} Configured`;
      }

      result.push({
        semester: sem,
        semesterName: `Semester ${sem}`,
        academicYear: ayClean,
        assignedSubjectsCount: subjectIds.length,
        assignedSectionsCount: assignedSections.length,
        assignedSections,
        totalStudentsCovered,
        attendanceSummary: {
          sessionsConducted,
          averageAttendance,
          defaultersCount,
          threshold,
        },
        marksSummary: {
          configuredAssessments,
          publishedAssessments,
          statusText: marksStatusText,
          hasMarksData: configuredAssessments > 0,
        },
      });
    }

    result.sort((a, b) => a.semester - b.semester);
    return result;
  },

  /**
   * Step 2: Retrieves assigned subjects for a specific semester
   */
  async getAnalyticsSubjects(
    userId: string,
    semester: number,
    academicYear?: string
  ): Promise<AnalyticsSubjectItem[]> {
    const assignments = await this.getFacultyActiveAssignments(userId, academicYear);
    const sem = Number(semester);
    const semAssignments = assignments.filter((a) => Number(a.semester) === sem);

    if (semAssignments.length === 0) {
      return [];
    }

    // Group by subjectId
    const subjectMap: { [subId: string]: any[] } = {};
    for (const a of semAssignments) {
      const sId = a.subjectId || a.subject?.id;
      if (!sId) continue;
      if (!subjectMap[sId]) subjectMap[sId] = [];
      subjectMap[sId].push(a);
    }

    const result: AnalyticsSubjectItem[] = [];

    for (const subId of Object.keys(subjectMap)) {
      const subAssignments = subjectMap[subId];
      const primaryAssignment = subAssignments[0];
      const subjectName = primaryAssignment.subject?.name || 'Assigned Subject';
      const subjectCode = primaryAssignment.subject?.code || 'SUB001';

      const sections = Array.from(
        new Set(subAssignments.map((a) => `Section ${normalizeSection(a.section)}`))
      );
      const assignmentIds = subAssignments.map((a) => a.id);

      // Deduplicated enrolled students across assigned sections
      const studentsMap = new Map<string, any>();
      for (const a of subAssignments) {
        const { students } = await getEnrolledStudentsForAssignment(a);
        for (const s of students) {
          if (!studentsMap.has(s.id)) {
            studentsMap.set(s.id, s);
          }
        }
      }
      const totalStudents = studentsMap.size;

      // Conducted attendance sessions
      const sessions = await AttendanceSession.findAll({
        where: {
          facultyAssignmentId: { [Op.in]: assignmentIds },
          status: { [Op.in]: ['SUBMITTED', 'LOCKED'] },
        },
      });
      const conductedSessions = sessions.length;

      // Attendance records
      const records = await AttendanceRecord.findAll({
        where: { facultyAssignmentId: { [Op.in]: assignmentIds } },
        attributes: ['status'],
      });
      const totalRecords = records.length;
      const presentRecords = records.filter((r) => r.status === 'PRESENT').length;
      const averageAttendance = totalRecords > 0 ? Number(((presentRecords / totalRecords) * 100).toFixed(1)) : 0;

      let attendanceStatus: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' | 'NO_DATA' = 'NO_DATA';
      if (conductedSessions > 0) {
        if (averageAttendance >= 85) attendanceStatus = 'EXCELLENT';
        else if (averageAttendance >= 75) attendanceStatus = 'GOOD';
        else attendanceStatus = 'NEEDS_ATTENTION';
      }

      // Check marks configurations & summaries
      const ayClean = primaryAssignment.academicYear || academicYear || '2026-27';
      const configs = await AssessmentConfiguration.findAll({
        where: {
          subjectId: subId,
          semester: sem,
          academicYear: { [Op.in]: getAcademicYearVariants(ayClean) },
        },
      });

      let marksStatus = 'Marks Not Configured';
      let marksAvailability: 'AVAILABLE' | 'PARTIAL' | 'NOT_CONFIGURED' = 'NOT_CONFIGURED';

      if (configs.length > 0) {
        const published = configs.filter((c) => c.isPublished || c.status === 'PUBLISHED');
        const configIds = configs.map((c) => c.id);
        const summariesCount = await StudentAssessmentSummary.count({
          where: { assessmentConfigurationId: { [Op.in]: configIds } },
        });

        if (published.length > 0) {
          marksStatus = `${published.map((p) => p.assessmentType).join(', ')} Published`;
          marksAvailability = 'AVAILABLE';
        } else if (summariesCount > 0) {
          marksStatus = `${configs.map((c) => c.assessmentType).join(' & ')} • ${summariesCount} Records`;
          marksAvailability = 'AVAILABLE';
        } else {
          marksStatus = `${configs.map((c) => c.assessmentType).join(', ')} Configured`;
          marksAvailability = 'PARTIAL';
        }
      }

      result.push({
        subjectId: subId,
        subjectName,
        subjectCode,
        semester: sem,
        sections,
        assignmentIds,
        totalStudents,
        conductedSessions,
        averageAttendance,
        attendanceStatus,
        marksStatus,
        marksAvailability,
      });
    }

    result.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
    return result;
  },

  /**
   * Step 3: Attendance Analytics Workspace for a Subject + Section
   */
  async getAnalyticsAttendance(
    userId: string,
    params: {
      subjectId: string;
      semester: number;
      section?: string;
      academicYear?: string;
      dateRange?: string; // 'ALL' | '30_DAYS' | '15_DAYS'
    }
  ): Promise<AttendanceAnalyticsResult> {
    const { subjectId, semester, section, academicYear, dateRange } = params;
    const sem = Number(semester);

    const assignments = await this.getFacultyActiveAssignments(userId, academicYear);
    const matchingAssignments = assignments.filter((a) => {
      const matchSubject = (a.subjectId || a.subject?.id) === subjectId;
      const matchSem = Number(a.semester) === sem;
      return matchSubject && matchSem;
    });

    if (matchingAssignments.length === 0) {
      throw new Error('Unauthorized or no active assignment found for this subject and semester.');
    }

    // Determine available sections for this faculty
    const availableSections = Array.from(
      new Set(matchingAssignments.map((a) => normalizeSection(a.section)))
    ).map((s) => `Section ${s}`);

    // Filter assignments by requested section if not 'ALL'
    let selectedSection = section || 'ALL';
    let targetAssignments = matchingAssignments;

    if (selectedSection && selectedSection !== 'ALL') {
      const normTarget = normalizeSection(selectedSection);
      targetAssignments = matchingAssignments.filter((a) => normalizeSection(a.section) === normTarget);
      if (targetAssignments.length === 0) {
        targetAssignments = matchingAssignments;
        selectedSection = 'ALL';
      }
    }

    const primaryAssignment = targetAssignments[0];
    const targetAssignmentIds = targetAssignments.map((a) => a.id);

    // Department setting for threshold
    const deptSetting = primaryAssignment.departmentId
      ? await DepartmentSetting.findOne({
          where: {
            departmentId: primaryAssignment.departmentId,
            academicYear: { [Op.in]: getAcademicYearVariants(primaryAssignment.academicYear || academicYear) },
          },
        })
      : null;
    const threshold = deptSetting ? Number(deptSetting.attendanceThreshold) : ATTENDANCE_THRESHOLD;

    // Enrolled students for target assignments (deduplicated)
    const enrolledStudentsMap = new Map<string, any>();
    for (const a of targetAssignments) {
      const { students } = await getEnrolledStudentsForAssignment(a);
      for (const s of students) {
        if (!enrolledStudentsMap.has(s.id)) {
          enrolledStudentsMap.set(s.id, {
            student: s,
            section: `Section ${normalizeSection(a.section)}`,
          });
        }
      }
    }

    // Conducted sessions
    const sessions = await AttendanceSession.findAll({
      where: {
        facultyAssignmentId: { [Op.in]: targetAssignmentIds },
        status: { [Op.in]: ['SUBMITTED', 'LOCKED'] },
      },
      order: [
        ['attendanceDate', 'ASC'],
        ['sessionPeriod', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });

    // Attendance records
    const records = await AttendanceRecord.findAll({
      where: {
        facultyAssignmentId: { [Op.in]: targetAssignmentIds },
      },
      include: [
        {
          model: Student,
          as: 'student',
          include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName'] }],
        },
      ],
    });

    const totalRecords = records.length;
    const presentRecords = records.filter((r) => r.status === 'PRESENT').length;
    const averageAttendance = totalRecords > 0 ? Number(((presentRecords / totalRecords) * 100).toFixed(1)) : 0;

    // Student metrics map
    const studentStatsMap = new Map<
      string,
      {
        student: any;
        section: string;
        total: number;
        present: number;
        absent: number;
        lastDate: string | null;
      }
    >();

    // Initialize all enrolled students
    for (const [sId, item] of enrolledStudentsMap.entries()) {
      studentStatsMap.set(sId, {
        student: item.student,
        section: item.section,
        total: 0,
        present: 0,
        absent: 0,
        lastDate: null,
      });
    }

    // Accumulate actual attendance records
    for (const r of records) {
      let stEntry = studentStatsMap.get(r.studentId);
      if (!stEntry && (r as any).student) {
        stEntry = {
          student: (r as any).student,
          section: selectedSection !== 'ALL' ? selectedSection : `Section ${normalizeSection(r.section)}`,
          total: 0,
          present: 0,
          absent: 0,
          lastDate: null,
        };
        studentStatsMap.set(r.studentId, stEntry);
      }
      if (stEntry) {
        stEntry.total++;
        if (r.status === 'PRESENT') stEntry.present++;
        else if (r.status === 'ABSENT') stEntry.absent++;
        const rDate = String(r.date);
        if (!stEntry.lastDate || rDate > stEntry.lastDate) {
          stEntry.lastDate = rDate;
        }
      }
    }

    // Calculate individual student stats & defaulters
    const studentsList: AttendanceAnalyticsResult['students'] = [];
    const defaultersList: AttendanceAnalyticsResult['defaulters'] = [];

    let meetingThresholdCount = 0;
    let belowThresholdCount = 0;

    // Distribution ranges buckets (<50, 50-64, 65-74, 75-84, 85-94, 95-100)
    const distBuckets = [
      { range: 'Below 50%', min: 0, max: 49.99, count: 0 },
      { range: '50–64%', min: 50, max: 64.99, count: 0 },
      { range: '65–74%', min: 65, max: 74.99, count: 0 },
      { range: '75–84%', min: 75, max: 84.99, count: 0 },
      { range: '85–94%', min: 85, max: 94.99, count: 0 },
      { range: '95–100%', min: 95, max: 100, count: 0 },
    ];

    for (const [stId, entry] of studentStatsMap.entries()) {
      const pct = entry.total > 0 ? Number(((entry.present / entry.total) * 100).toFixed(1)) : 100.0;
      const isShortage = entry.total > 0 && pct < threshold;

      if (isShortage) {
        belowThresholdCount++;
      } else {
        meetingThresholdCount++;
      }

      // Populate distribution buckets
      for (const b of distBuckets) {
        if (pct >= b.min && pct <= b.max) {
          b.count++;
          break;
        }
      }

      const stName = entry.student.user
        ? `${entry.student.user.firstName || ''} ${entry.student.user.lastName || ''}`.trim()
        : 'Student';
      const usn = entry.student.usn || entry.student.enrollmentNumber || 'N/A';

      studentsList.push({
        studentId: stId,
        usn,
        studentName: stName,
        section: entry.section,
        totalSessions: entry.total,
        presentCount: entry.present,
        absentCount: entry.absent,
        attendancePercentage: pct,
        status: isShortage ? 'SHORTAGE' : 'ELIGIBLE',
        lastRecordedDate: entry.lastDate,
      });

      if (isShortage) {
        defaultersList.push({
          studentId: stId,
          usn,
          studentName: stName,
          section: entry.section,
          totalSessions: entry.total,
          presentCount: entry.present,
          absentCount: entry.absent,
          attendancePercentage: pct,
          shortageDelta: Number((threshold - pct).toFixed(1)),
        });
      }
    }

    // Sort students list (Prioritize assigned USN ASC; fallback to Student Name A-Z)
    studentsList.sort((a, b) => compareStudentsByUsnOrName(a.usn, b.usn, a.studentName, b.studentName));

    // Defaulters sorted by lowest attendance first
    defaultersList.sort((a, b) => a.attendancePercentage - b.attendancePercentage);

    const totalStudentsCount = studentsList.length;

    // Build distribution chart data with percentages
    const distributionChartData = distBuckets.map((b) => ({
      range: b.range,
      min: b.min,
      max: b.max,
      count: b.count,
      percentage: totalStudentsCount > 0 ? Number(((b.count / totalStudentsCount) * 100).toFixed(1)) : 0,
    }));

    // Status distribution donut chart data
    const statusDistributionData = [
      {
        name: `Meeting Threshold (≥${threshold}%)`,
        value: meetingThresholdCount,
        percentage: totalStudentsCount > 0 ? Number(((meetingThresholdCount / totalStudentsCount) * 100).toFixed(1)) : 0,
        color: '#10b981', // emerald
      },
      {
        name: `Below Threshold (<${threshold}%)`,
        value: belowThresholdCount,
        percentage: totalStudentsCount > 0 ? Number(((belowThresholdCount / totalStudentsCount) * 100).toFixed(1)) : 0,
        color: '#f59e0b', // amber
      },
    ];

    // Filter sessions by dateRange if needed
    let filteredSessions = [...sessions];
    if (dateRange === '30_DAYS' || dateRange === '15_DAYS') {
      const days = dateRange === '30_DAYS' ? 30 : 15;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      filteredSessions = filteredSessions.filter((s) => String(s.attendanceDate) >= cutoffStr);
    }

    // Trend line chart data
    const trendData = filteredSessions.map((s) => {
      const dStr = String(s.attendanceDate);
      const tot = s.totalStudents || 0;
      const pres = s.presentCount || 0;
      const pct = tot > 0 ? Number(((pres / tot) * 100).toFixed(1)) : 100;
      return {
        date: dStr,
        sessionPeriod: s.sessionPeriod || 1,
        label: `${dStr} (P${s.sessionPeriod || 1})`,
        attendancePercentage: pct,
        presentCount: pres,
        totalStudents: tot,
      };
    });

    // Session-wise present/absent bar chart data
    const sessionWiseData = filteredSessions.map((s, idx) => {
      const dStr = String(s.attendanceDate);
      const tot = s.totalStudents || 0;
      const pres = s.presentCount || 0;
      const abs = s.absentCount || Math.max(0, tot - pres);
      const pct = tot > 0 ? Number(((pres / tot) * 100).toFixed(1)) : 0;
      return {
        sessionNumber: idx + 1,
        date: dStr,
        period: s.sessionPeriod || 1,
        label: `${dStr} (P${s.sessionPeriod || 1})`,
        presentCount: pres,
        absentCount: abs,
        attendancePercentage: pct,
      };
    });

    // Section comparison chart (only if multiple assigned sections exist)
    let sectionComparison: AttendanceAnalyticsResult['charts']['sectionComparison'] = undefined;
    if (availableSections.length > 1) {
      sectionComparison = [];
      for (const secName of availableSections) {
        const normSec = normalizeSection(secName);
        const secAssignments = matchingAssignments.filter((a) => normalizeSection(a.section) === normSec);
        const secAssignmentIds = secAssignments.map((a) => a.id);

        const secRecords = records.filter((r) => secAssignmentIds.includes(r.facultyAssignmentId));
        const secPresents = secRecords.filter((r) => r.status === 'PRESENT').length;
        const secAvg = secRecords.length > 0 ? Number(((secPresents / secRecords.length) * 100).toFixed(1)) : 0;

        const secStudents = studentsList.filter((s) => normalizeSection(s.section) === normSec).length;
        const secSessions = sessions.filter((s) => secAssignmentIds.includes(s.facultyAssignmentId)).length;

        sectionComparison.push({
          section: secName,
          averageAttendance: secAvg,
          studentCount: secStudents,
          sessionsCount: secSessions,
        });
      }
    }

    const latestRecordedDate = sessions.length > 0 ? String(sessions[sessions.length - 1].attendanceDate) : null;

    return {
      subject: {
        id: primaryAssignment.subject?.id || subjectId,
        name: primaryAssignment.subject?.name || 'Assigned Subject',
        code: primaryAssignment.subject?.code || 'SUB001',
        semester: sem,
        selectedSection,
        availableSections,
        academicYear: primaryAssignment.academicYear || academicYear || '2026-27',
      },
      kpis: {
        enrolledStudents: totalStudentsCount,
        conductedSessions: sessions.length,
        totalAttendanceRecords: totalRecords,
        averageAttendance,
        meetingThresholdCount,
        belowThresholdCount,
        unrecordedSessionsCount: null,
        unrecordedSessionsNote: 'Timetable schedule integration not configured',
        latestRecordedDate,
        threshold,
      },
      charts: {
        distribution: distributionChartData,
        statusDistribution: statusDistributionData,
        trend: trendData,
        sessionWise: sessionWiseData,
        sectionComparison,
      },
      students: studentsList,
      defaulters: defaultersList,
    };
  },

  /**
   * Step 3: Academic Marks Analytics Workspace for a Subject + Section
   */
  async getAnalyticsMarks(
    userId: string,
    params: {
      subjectId: string;
      semester: number;
      section?: string;
      academicYear?: string;
      assessmentType?: 'CIE1' | 'CIE2' | 'SEE';
    }
  ): Promise<MarksAnalyticsResult> {
    const { subjectId, semester, section, academicYear } = params;
    const sem = Number(semester);

    const assignments = await this.getFacultyActiveAssignments(userId, academicYear);
    const matchingAssignments = assignments.filter((a) => {
      const matchSubject = (a.subjectId || a.subject?.id) === subjectId;
      const matchSem = Number(a.semester) === sem;
      return matchSubject && matchSem;
    });

    if (matchingAssignments.length === 0) {
      throw new Error('Unauthorized or no active assignment found for this subject and semester.');
    }

    const availableSections = Array.from(
      new Set(matchingAssignments.map((a) => normalizeSection(a.section)))
    ).map((s) => `Section ${s}`);

    let selectedSection = section || 'ALL';
    let targetAssignments = matchingAssignments;

    if (selectedSection && selectedSection !== 'ALL') {
      const normTarget = normalizeSection(selectedSection);
      targetAssignments = matchingAssignments.filter((a) => normalizeSection(a.section) === normTarget);
      if (targetAssignments.length === 0) {
        targetAssignments = matchingAssignments;
        selectedSection = 'ALL';
      }
    }

    const primaryAssignment = targetAssignments[0];
    const ayClean = primaryAssignment.academicYear || academicYear || '2026-27';

    // Enrolled students for target section(s)
    const enrolledStudentsMap = new Map<string, any>();
    for (const a of targetAssignments) {
      const { students } = await getEnrolledStudentsForAssignment(a);
      for (const s of students) {
        if (!enrolledStudentsMap.has(s.id)) {
          enrolledStudentsMap.set(s.id, {
            student: s,
            section: `Section ${normalizeSection(a.section)}`,
          });
        }
      }
    }

    // Load Assessment Configurations for CIE1 and CIE2
    const configs = await AssessmentConfiguration.findAll({
      where: {
        subjectId,
        semester: sem,
        academicYear: { [Op.in]: getAcademicYearVariants(ayClean) },
      },
    });

    const cie1Config = configs.find((c) => c.assessmentType === 'CIE1');
    const cie2Config = configs.find((c) => c.assessmentType === 'CIE2');

    // Load ExternalExaminationMarks (Final SEE Marks)
    const externalRecords = await ExternalExaminationMarks.findAll({
      where: {
        subjectId,
        semester: sem,
        academicYear: { [Op.in]: getAcademicYearVariants(ayClean) },
      },
    });
    const externalMap = new Map<string, ExternalExaminationMarks>();
    for (const ext of externalRecords) {
      externalMap.set(ext.studentId, ext);
    }

    let seeStatus = 'NOT_CONFIGURED';
    let seeIsFinalized = false;
    if (externalRecords.length > 0) {
      seeIsFinalized = externalRecords.every((r) => r.status === 'FINALIZED');
      seeStatus = seeIsFinalized ? 'FINALIZED' : 'SAVED';
    }

    // Available assessments array for frontend tab switch
    const availableAssessments: MarksAnalyticsResult['availableAssessments'] = [
      {
        type: 'CIE1',
        label: 'CIE 1 Assessment',
        status: cie1Config?.status || 'NOT_CONFIGURED',
        maxMarks: cie1Config ? Number(cie1Config.maximumMarks) : 50,
        isPublished: Boolean(cie1Config?.isPublished),
      },
      {
        type: 'CIE2',
        label: 'CIE 2 Assessment',
        status: cie2Config?.status || 'NOT_CONFIGURED',
        maxMarks: cie2Config ? Number(cie2Config.maximumMarks) : 50,
        isPublished: Boolean(cie2Config?.isPublished),
      },
      {
        type: 'SEE',
        label: 'Final SEE Marks',
        status: seeStatus,
        maxMarks: 100,
        isPublished: seeIsFinalized,
      },
    ];

    // Selected assessment type
    let activeType: 'CIE1' | 'CIE2' | 'SEE' = params.assessmentType || (cie1Config ? 'CIE1' : 'CIE2');
    if (params.assessmentType === 'SEE') {
      activeType = 'SEE';
    } else if (!cie1Config && cie2Config && params.assessmentType !== 'CIE1') {
      activeType = 'CIE2';
    }

    const isLabOrPractical = Boolean(
      primaryAssignment.subject?.type?.toUpperCase().includes('LAB') ||
      primaryAssignment.subject?.type?.toUpperCase().includes('PRACTICAL') ||
      primaryAssignment.subject?.code?.toUpperCase().includes('L') ||
      primaryAssignment.subject?.name?.toUpperCase().includes('LAB') ||
      primaryAssignment.subject?.name?.toUpperCase().includes('PRACTICAL')
    );

    let maxMarks = 50.0;
    let passMarks = 20.0;
    if (activeType === 'SEE') {
      maxMarks = 100.0;
      passMarks = isLabOrPractical ? 40.0 : 35.0; // 35% theory, 40% practical for SEE raw component
    } else {
      const activeConfig = activeType === 'CIE1' ? cie1Config : cie2Config;
      maxMarks = activeConfig ? Number(activeConfig.maximumMarks) : 50.0;
      passMarks = Number((maxMarks * 0.4).toFixed(1)); // 40% standard academic rule
    }

    // Load summaries for CIE1 and CIE2
    const cie1Summaries = cie1Config
      ? await StudentAssessmentSummary.findAll({ where: { assessmentConfigurationId: cie1Config.id } })
      : [];
    const cie2Summaries = cie2Config
      ? await StudentAssessmentSummary.findAll({ where: { assessmentConfigurationId: cie2Config.id } })
      : [];

    const cie1Map = new Map<string, any>();
    for (const s of cie1Summaries) cie1Map.set(s.studentId, s);

    const cie2Map = new Map<string, any>();
    for (const s of cie2Summaries) cie2Map.set(s.studentId, s);

    // Also check FinalInternalMarks for consolidated marks if available
    const finalMarksRecords = await FinalInternalMarks.findAll({
      where: {
        subjectId,
        semester: sem,
        academicYear: { [Op.in]: getAcademicYearVariants(ayClean) },
      },
    });
    const finalMarksMap = new Map<string, any>();
    for (const f of finalMarksRecords) finalMarksMap.set(f.studentId, f);

    // Compute student rows and KPI values
    const studentsList: MarksAnalyticsResult['students'] = [];
    const marksValues: number[] = [];
    let submittedCount = 0;
    let passCount = 0;
    let failCount = 0;

    for (const [stId, item] of enrolledStudentsMap.entries()) {
      const student = item.student;
      const stName = student.user
        ? `${student.user.firstName || ''} ${student.user.lastName || ''}`.trim()
        : 'Student';
      const usn = student.usn || student.enrollmentNumber || 'N/A';

      const s1 = cie1Map.get(stId);
      const s2 = cie2Map.get(stId);
      const fin = finalMarksMap.get(stId);

      const cie1Val = s1 ? Number(s1.finalCieMarks) : fin?.cie1Marks !== undefined && fin?.cie1Marks !== null ? Number(fin.cie1Marks) : null;
      const cie2Val = s2 ? Number(s2.finalCieMarks) : fin?.cie2Marks !== undefined && fin?.cie2Marks !== null ? Number(fin.cie2Marks) : null;
      const finalScore = fin?.cieAverageOrPolicyResult !== undefined && fin?.cieAverageOrPolicyResult !== null ? Number(fin.cieAverageOrPolicyResult) : null;

      // Final internal marks (CIE out of 50M)
      let finalCie = fin?.finalInternalMarks !== undefined && fin?.finalInternalMarks !== null
        ? Number(fin.finalInternalMarks)
        : null;
      if (finalCie === null) {
        if (cie1Val !== null && cie2Val !== null) {
          finalCie = Math.round((cie1Val + cie2Val) / 2);
        } else if (cie1Val !== null) {
          finalCie = Math.round(cie1Val);
        } else if (cie2Val !== null) {
          finalCie = Math.round(cie2Val);
        }
      }

      // External examination marks (SEE out of 100M)
      const extRec = externalMap.get(stId);
      const rawExt = extRec?.externalMarks !== null && extRec?.externalMarks !== undefined && !isNaN(Number(extRec.externalMarks))
        ? Number(extRec.externalMarks)
        : null;
      const maxExt = extRec?.maximumMarks !== undefined ? Number(extRec.maximumMarks) : 100;

      const vtuCalc = calculateVtuPassingStatus(finalCie, rawExt, maxExt, isLabOrPractical);

      let completionStatus = 'PENDING';
      let performanceCategory = 'Pending';

      if (activeType === 'SEE') {
        if (rawExt !== null && !isNaN(rawExt)) {
          submittedCount++;
          marksValues.push(rawExt);
          completionStatus = 'COMPLETED';

          if (vtuCalc.status === 'PASS') {
            passCount++;
            const tot = vtuCalc.totalMarks ?? rawExt;
            if (tot >= 75) performanceCategory = 'Distinction (≥75%)';
            else if (tot >= 60) performanceCategory = 'First Class (60–74%)';
            else if (tot >= 50) performanceCategory = 'Second Class (50–59%)';
            else performanceCategory = 'Pass Class (40–49%)';
          } else {
            failCount++;
            performanceCategory = 'Below Passing (<40%)';
          }
        }
      } else {
        const activeVal = activeType === 'CIE1' ? cie1Val : cie2Val;
        if (activeVal !== null && !isNaN(activeVal)) {
          submittedCount++;
          marksValues.push(activeVal);
          completionStatus = 'COMPLETED';

          const pct = (activeVal / maxMarks) * 100;
          if (pct >= 40) {
            passCount++;
          } else {
            failCount++;
          }

          if (pct >= 75) performanceCategory = 'Distinction (≥75%)';
          else if (pct >= 60) performanceCategory = 'First Class (60–74%)';
          else if (pct >= 50) performanceCategory = 'Second Class (50–59%)';
          else if (pct >= 40) performanceCategory = 'Pass Class (40–49%)';
          else performanceCategory = 'Below Passing (<40%)';
        }
      }

      studentsList.push({
        studentId: stId,
        usn,
        studentName: stName,
        section: item.section,
        cie1Marks: cie1Val !== null ? Number(cie1Val) : null,
        cie1Max: cie1Config ? Number(cie1Config.maximumMarks) : null,
        cie1Status: s1?.completionStatus || (cie1Val !== null ? 'SAVED' : 'PENDING'),
        cie2Marks: cie2Val !== null ? Number(cie2Val) : null,
        cie2Max: cie2Config ? Number(cie2Config.maximumMarks) : null,
        cie2Status: s2?.completionStatus || (cie2Val !== null ? 'SAVED' : 'PENDING'),
        finalScore: finalScore !== null ? Number(finalScore) : null,
        finalCieMarks: finalCie !== null ? Number(finalCie) : null,
        externalMarks: rawExt !== null ? Number(rawExt) : null,
        seeScaledMarks: vtuCalc.seeScaled50 !== null ? Number(vtuCalc.seeScaled50) : null,
        totalMarks: vtuCalc.totalMarks !== null ? Number(vtuCalc.totalMarks) : null,
        vtuStatus: vtuCalc.status,
        vtuReason: vtuCalc.reason || (vtuCalc.status === 'PASS' ? 'All 3 VTU minimum criteria satisfied' : 'SEE marks pending entry'),
        completionStatus,
        performanceCategory,
      });
    }

    // Sort students list (Prioritize assigned USN ASC; fallback to Student Name A-Z)
    studentsList.sort((a, b) => compareStudentsByUsnOrName(a.usn, b.usn, a.studentName, b.studentName));

    const enrolledStudents = studentsList.length;
    const pendingCount = enrolledStudents - submittedCount;

    // Statistical calculations
    marksValues.sort((a, b) => a - b);
    const classAverage =
      marksValues.length > 0
        ? Number((marksValues.reduce((acc, v) => acc + v, 0) / marksValues.length).toFixed(1))
        : null;
    const highestMark = marksValues.length > 0 ? marksValues[marksValues.length - 1] : null;
    const lowestMark = marksValues.length > 0 ? marksValues[0] : null;

    let medianMark: number | null = null;
    if (marksValues.length > 0) {
      const mid = Math.floor(marksValues.length / 2);
      medianMark =
        marksValues.length % 2 !== 0
          ? marksValues[mid]
          : Number(((marksValues[mid - 1] + marksValues[mid]) / 2).toFixed(1));
    }

    const passPercentage =
      submittedCount > 0 ? Number(((passCount / submittedCount) * 100).toFixed(1)) : 0;

    // Distribution Histogram buckets (5 buckets dynamically scaled to maxMarks)
    const step = maxMarks / 5;
    const distBuckets = [
      {
        range: `0–${Math.round(step - 1)}`,
        min: 0,
        max: step - 0.01,
        count: 0,
      },
      {
        range: `${Math.round(step)}–${Math.round(step * 2 - 1)}`,
        min: step,
        max: step * 2 - 0.01,
        count: 0,
      },
      {
        range: `${Math.round(step * 2)}–${Math.round(step * 3 - 1)}`,
        min: step * 2,
        max: step * 3 - 0.01,
        count: 0,
      },
      {
        range: `${Math.round(step * 3)}–${Math.round(step * 4 - 1)}`,
        min: step * 3,
        max: step * 4 - 0.01,
        count: 0,
      },
      {
        range: `${Math.round(step * 4)}–${Math.round(maxMarks)}`,
        min: step * 4,
        max: maxMarks + 1,
        count: 0,
      },
    ];

    for (const v of marksValues) {
      for (const b of distBuckets) {
        if (v >= b.min && v <= b.max) {
          b.count++;
          break;
        }
      }
    }

    const marksDistributionData = distBuckets.map((b) => ({
      range: b.range,
      min: b.min,
      max: b.max,
      count: b.count,
      percentage: submittedCount > 0 ? Number(((b.count / submittedCount) * 100).toFixed(1)) : 0,
    }));

    // Assessment comparison data (CIE1 vs CIE2 vs SEE)
    const cie1Values = studentsList.map((s) => s.cie1Marks).filter((v): v is number => v !== null);
    const cie2Values = studentsList.map((s) => s.cie2Marks).filter((v): v is number => v !== null);
    const seeValues = studentsList.map((s) => s.externalMarks).filter((v): v is number => v !== null);

    const cie1Avg =
      cie1Values.length > 0
        ? Number((cie1Values.reduce((a, b) => a + b, 0) / cie1Values.length).toFixed(1))
        : null;
    const cie2Avg =
      cie2Values.length > 0
        ? Number((cie2Values.reduce((a, b) => a + b, 0) / cie2Values.length).toFixed(1))
        : null;
    const seeAvg =
      seeValues.length > 0
        ? Number((seeValues.reduce((a, b) => a + b, 0) / seeValues.length).toFixed(1))
        : null;

    const cie1MaxVal = cie1Values.length > 0 ? Math.max(...cie1Values) : null;
    const cie2MaxVal = cie2Values.length > 0 ? Math.max(...cie2Values) : null;
    const seeMaxVal = seeValues.length > 0 ? Math.max(...seeValues) : null;

    const cie1MinVal = cie1Values.length > 0 ? Math.min(...cie1Values) : null;
    const cie2MinVal = cie2Values.length > 0 ? Math.min(...cie2Values) : null;
    const seeMinVal = seeValues.length > 0 ? Math.min(...seeValues) : null;

    const cie1PassPct =
      cie1Values.length > 0
        ? Number(
            (
              (cie1Values.filter((v) => v >= (cie1Config ? Number(cie1Config.maximumMarks) * 0.4 : 20)).length /
                cie1Values.length) *
              100
            ).toFixed(1)
          )
        : null;

    const cie2PassPct =
      cie2Values.length > 0
        ? Number(
            (
              (cie2Values.filter((v) => v >= (cie2Config ? Number(cie2Config.maximumMarks) * 0.4 : 20)).length /
                cie2Values.length) *
              100
            ).toFixed(1)
          )
        : null;

    const seePassCount = studentsList.filter((s) => s.vtuStatus === 'PASS').length;
    const seePassPct =
      seeValues.length > 0
        ? Number(((seePassCount / seeValues.length) * 100).toFixed(1))
        : null;

    const assessmentComparison = [
      { metric: 'Class Average', cie1Value: cie1Avg, cie2Value: cie2Avg, seeValue: seeAvg, unit: 'Marks' },
      { metric: 'Highest Mark', cie1Value: cie1MaxVal, cie2Value: cie2MaxVal, seeValue: seeMaxVal, unit: 'Marks' },
      { metric: 'Lowest Mark', cie1Value: cie1MinVal, cie2Value: cie2MinVal, seeValue: seeMinVal, unit: 'Marks' },
      { metric: 'Pass Rate', cie1Value: cie1PassPct, cie2Value: cie2PassPct, seeValue: seePassPct, unit: '%' },
    ];

    // Performance Trend line across assessments
    const performanceTrend = [
      {
        assessment: 'CIE 1',
        averageMark: cie1Avg,
        maxMarks: cie1Config ? Number(cie1Config.maximumMarks) : 50,
        averagePercentage:
          cie1Avg !== null && cie1Config ? Number(((cie1Avg / Number(cie1Config.maximumMarks)) * 100).toFixed(1)) : null,
      },
      {
        assessment: 'CIE 2',
        averageMark: cie2Avg,
        maxMarks: cie2Config ? Number(cie2Config.maximumMarks) : 50,
        averagePercentage:
          cie2Avg !== null && cie2Config ? Number(((cie2Avg / Number(cie2Config.maximumMarks)) * 100).toFixed(1)) : null,
      },
      {
        assessment: 'Final SEE',
        averageMark: seeAvg,
        maxMarks: 100,
        averagePercentage: seeAvg !== null ? Number(seeAvg.toFixed(1)) : null,
      },
    ];

    // Pass / Below-Passing distribution donut
    const passDistribution = [
      {
        name: activeType === 'SEE' ? 'Passed (VTU Criteria)' : `Passed (≥${passMarks})`,
        value: passCount,
        percentage: enrolledStudents > 0 ? Number(((passCount / enrolledStudents) * 100).toFixed(1)) : 0,
        color: '#10b981', // emerald
      },
      {
        name: activeType === 'SEE' ? 'Below Passing / Failed' : `Below Passing (<${passMarks})`,
        value: failCount,
        percentage: enrolledStudents > 0 ? Number(((failCount / enrolledStudents) * 100).toFixed(1)) : 0,
        color: '#ef4444', // red
      },
      {
        name: 'Pending Marks',
        value: pendingCount,
        percentage: enrolledStudents > 0 ? Number(((pendingCount / enrolledStudents) * 100).toFixed(1)) : 0,
        color: '#9ca3af', // gray
      },
    ];

    const scoreSpread = highestMark !== null && lowestMark !== null ? Number((highestMark - lowestMark).toFixed(1)) : null;

    const activeConfig = activeType === 'CIE1' ? cie1Config : activeType === 'CIE2' ? cie2Config : null;
    const activeAssessmentStatus = activeType === 'SEE' ? seeStatus : activeConfig?.status || 'NOT_CONFIGURED';
    const activeIsPublished = activeType === 'SEE' ? seeIsFinalized : Boolean(activeConfig?.isPublished);

    return {
      subject: {
        id: primaryAssignment.subject?.id || subjectId,
        name: primaryAssignment.subject?.name || 'Assigned Subject',
        code: primaryAssignment.subject?.code || 'SUB001',
        semester: sem,
        selectedSection,
        availableSections,
        academicYear: ayClean,
      },
      assessmentType: activeType,
      availableAssessments,
      kpis: {
        enrolledStudents,
        submittedCount,
        pendingCount,
        classAverage,
        highestMark,
        lowestMark,
        medianMark,
        passCount,
        passPercentage,
        failCount,
        maximumMarks: maxMarks,
        passingMarks: passMarks,
        assessmentStatus: activeAssessmentStatus,
        isPublished: activeIsPublished,
      },
      charts: {
        distribution: marksDistributionData,
        assessmentComparison,
        performanceTrend,
        passDistribution,
        summaryStats: {
          classAverage,
          medianScore: medianMark,
          highestScore: highestMark,
          lowestScore: lowestMark,
          scoreSpread,
          assessedStudentsCount: submittedCount,
        },
      },
      students: studentsList,
    };
  },
};

export default facultyAnalyticsService;

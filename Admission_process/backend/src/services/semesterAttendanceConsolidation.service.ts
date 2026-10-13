import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import Department from '../models/Department';
import Section from '../models/Section';
import Student from '../models/Student';
import Subject from '../models/Subject';
import User from '../models/User';
import FacultyAssignment from '../models/FacultyAssignment';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';
import ConsolidatedAttendanceBackupFile from '../models/ConsolidatedAttendanceBackupFile';
import GoogleDriveIntegration from '../models/GoogleDriveIntegration';
import googleDriveService from './googleDrive.service';
import { ATTENDANCE_THRESHOLD, compareStudentsByUsnOrName } from './faculty.service';
import logger from '../utils/logger.util';
import { Op } from 'sequelize';

/**
 * Resolves the official institutional logo buffer
 */
function getInstitutionalLogoBuffer(): Buffer | null {
  const candidatePaths = [
    path.resolve(__dirname, '../assets/logo.png'),
    path.resolve(__dirname, '../../src/assets/logo.png'),
    path.resolve(process.cwd(), 'src/assets/logo.png'),
    path.resolve(process.cwd(), '../frontend/public/logo.png'),
    path.resolve(process.cwd(), 'public/logo.png'),
    'e:/JCER-ERP-SYSTEM/Admission_process/frontend/public/logo.png',
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p);
      }
    } catch {
      // Continue search
    }
  }
  return null;
}

/**
 * Normalizes section string to remove "Section " prefix
 */
function normalizeSectionName(sec?: string | null): string {
  if (!sec) return 'A';
  return sec.replace(/^Section\s+/i, '').trim() || 'A';
}

export interface ConsolidatedAttendanceData {
  department: {
    id: string;
    name: string;
    code: string;
  };
  academicYear: string;
  semester: number;
  fileName: string;
  sections: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string; code: string; credits?: number; type?: string }>;
  students: Array<{
    id: string;
    usn: string;
    name: string;
    section: string;
    sectionId: string | null;
    subjectStats: Record<string, { conducted: number; attended: number; percentage: number | null }>;
    totalConducted: number;
    totalAttended: number;
    overallPercentage: number | null;
    eligibility: 'Eligible' | 'Not Eligible' | 'No Records';
  }>;
  subjectSummaries: Array<{
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    conductedClasses: number;
    averagePercentage: number | null;
    eligibleCount: number;
    notEligibleCount: number;
    noRecordsCount: number;
  }>;
  sectionSummaries: Array<{
    section: string;
    totalStudents: number;
    averagePercentage: number | null;
    eligibleCount: number;
    notEligibleCount: number;
  }>;
}

export const semesterAttendanceConsolidationService = {
  /**
   * Authoritatively fetches all semester attendance data from PostgreSQL
   * POSTGRESQL IS THE SINGLE SOURCE OF TRUTH.
   */
  async fetchConsolidatedSemesterData(params: {
    academicYear: string;
    departmentId: string;
    semester: number;
  }): Promise<ConsolidatedAttendanceData> {
    const { academicYear, departmentId, semester } = params;

    // 1. Resolve Department
    const department = await Department.findByPk(departmentId);
    if (!department) {
      throw new Error(`Department not found for ID: ${departmentId}`);
    }

    const deptCode = (department.code || 'CSE').trim().toUpperCase();
    const deptName = department.name || deptCode;
    const isSemHandling = department.type === 'SEMESTER_HANDLING' || deptCode === 'AS';

    // 2. Resolve all active Sections for AY + Dept + Semester
    const sectionWhere: any = {
      semester,
      status: 'ACTIVE',
    };
    if (academicYear) {
      sectionWhere.academicYear = academicYear;
    }
    if (!isSemHandling) {
      sectionWhere.departmentId = departmentId;
    }

    const dbSections = await Section.findAll({
      where: sectionWhere,
      order: [['name', 'ASC']],
    });

    const sectionMap = new Map<string, string>(); // sectionId -> cleanName
    const sectionNames = new Set<string>();

    dbSections.forEach((s) => {
      const clean = normalizeSectionName(s.name);
      sectionMap.set(s.id, clean);
      sectionNames.add(clean);
    });

    // 3. Resolve all Students belonging to this cohort
    let dbStudents: Student[] = [];

    if (dbSections.length > 0) {
      const secIds = dbSections.map((s) => s.id);
      const studentWhere: any = {
        semester,
        [Op.or]: [
          { sectionId: { [Op.in]: secIds } },
          { section: { [Op.in]: Array.from(sectionNames).flatMap((name) => [name, `Section ${name}`, `Section  ${name}`]) } },
        ],
      };
      if (!isSemHandling) {
        studentWhere.departmentId = departmentId;
      }
      dbStudents = await Student.findAll({
        where: studentWhere,
        include: [
          { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: Section, as: 'sectionEntity', attributes: ['id', 'name'] },
        ],
      });
    }

    // Fallback: If section mapping yielded 0 students, query all students in this semester & dept scope
    if (dbStudents.length === 0) {
      const fallbackWhere: any = { semester };
      if (!isSemHandling) {
        fallbackWhere.departmentId = departmentId;
      }
      dbStudents = await Student.findAll({
        where: fallbackWhere,
        include: [
          { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: Section, as: 'sectionEntity', attributes: ['id', 'name'] },
        ],
      });
    }

    // Sort students deterministically: Prioritize assigned USN ASC; fallback to Student Name A-Z
    const sortedStudents = [...dbStudents].sort((a: any, b: any) => {
      const usnA = (a.usn || a.enrollmentNumber || '').trim();
      const usnB = (b.usn || b.enrollmentNumber || '').trim();
      const nameA = `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.trim();
      const nameB = `${b.user?.firstName || ''} ${b.user?.lastName || ''}`.trim();
      return compareStudentsByUsnOrName(usnA, usnB, nameA, nameB, a.rollNumber, b.rollNumber);
    });

    // 4. Resolve all Subjects for this Semester & Department
    const subjectWhere: any = {
      semester,
      status: 'ACTIVE',
    };
    if (!isSemHandling) {
      subjectWhere[Op.or] = [
        { departmentId },
        { departmentId: null as any },
      ];
    }
    const dbSubjects = await Subject.findAll({
      where: subjectWhere,
      order: [['code', 'ASC']],
    });

    // Also check active faculty assignments to ensure no assigned subject is missed
    const assignmentWhere: any = {
      semester,
      academicYear,
      status: 'ACTIVE',
    };
    if (!isSemHandling) {
      assignmentWhere.departmentId = departmentId;
    }
    const assignments = await FacultyAssignment.findAll({
      where: assignmentWhere,
      include: [{ model: Subject, as: 'subject' }],
    });

    const subjectMap = new Map<string, { id: string; name: string; code: string; credits?: number; type?: string }>();
    dbSubjects.forEach((sub) => {
      subjectMap.set(sub.id, {
        id: sub.id,
        name: sub.name,
        code: sub.code,
        credits: sub.credits,
        type: sub.type,
      });
    });

    assignments.forEach((a: any) => {
      if (a.subject && !subjectMap.has(a.subject.id)) {
        subjectMap.set(a.subject.id, {
          id: a.subject.id,
          name: a.subject.name,
          code: a.subject.code,
          credits: a.subject.credits,
          type: a.subject.type,
        });
      }
    });

    const subjects = Array.from(subjectMap.values()).sort((a, b) => a.code.localeCompare(b.code));

    // 5. Fetch all AttendanceSessions for this cohort
    const assignmentIds = assignments.map((a) => a.id);
    const sessionWhere: any = {
      semester,
      academicYear,
    };
    if (!isSemHandling) {
      sessionWhere.departmentId = departmentId;
      if (assignmentIds.length > 0) {
        sessionWhere.facultyAssignmentId = { [Op.in]: assignmentIds };
      }
    } else {
      sessionWhere[Op.or] = [
        { departmentId },
        ...(assignmentIds.length > 0 ? [{ facultyAssignmentId: { [Op.in]: assignmentIds } }] : []),
        { subjectId: { [Op.in]: Array.from(subjectMap.keys()) } },
      ];
    }
    const sessions = await AttendanceSession.findAll({
      where: sessionWhere,
      order: [['attendanceDate', 'ASC'], ['sessionPeriod', 'ASC']],
    });

    // 6. Fetch all AttendanceRecords for these sessions
    const sessionIds = sessions.map((s) => s.id);
    const studentIds = sortedStudents.map((st) => st.id);

    const recordOrConditions: any[] = [];
    if (sessionIds.length > 0) {
      recordOrConditions.push({ attendanceSessionId: { [Op.in]: sessionIds } });
    }
    const fallbackRecordWhere: any = {
      semester,
      academicYear,
    };
    if (!isSemHandling) {
      fallbackRecordWhere.departmentId = departmentId;
    }
    recordOrConditions.push(fallbackRecordWhere);

    const records = await AttendanceRecord.findAll({
      where: {
        ...(studentIds.length > 0 ? { studentId: { [Op.in]: studentIds } } : {}),
        [Op.or]: recordOrConditions,
      },
    });

    // 7. Group Conducted Sessions per Subject & Section
    // Map: `subjectId___cleanSection` -> count of sessions
    // Also `subjectId` -> total distinct sessions held across any section
    const subjectSectionSessionCount = new Map<string, number>();
    const subjectTotalSessionCount = new Map<string, number>();

    sessions.forEach((s) => {
      const secClean = normalizeSectionName(s.section);
      const key = `${s.subjectId}___${secClean}`;
      subjectSectionSessionCount.set(key, (subjectSectionSessionCount.get(key) || 0) + 1);

      subjectTotalSessionCount.set(s.subjectId, (subjectTotalSessionCount.get(s.subjectId) || 0) + 1);
    });

    // 8. Index student attendance records: `studentId___subjectId` -> { presentCount: number }
    const studentSubjectAttendance = new Map<string, number>();

    records.forEach((r) => {
      if (r.status === 'PRESENT') {
        const key = `${r.studentId}___${r.subjectId}`;
        studentSubjectAttendance.set(key, (studentSubjectAttendance.get(key) || 0) + 1);
      }
    });

    // 9. Build Student-level Consolidated Roster
    const studentRows = sortedStudents.map((st: any) => {
      const studentName = `${st.user?.firstName || ''} ${st.user?.lastName || ''}`.trim() || 'Student';
      const usn = st.usn || st.enrollmentNumber || 'N/A';
      const cleanSec = normalizeSectionName((st.sectionEntity?.name || st.section || 'A'));

      let studentTotalConducted = 0;
      let studentTotalAttended = 0;
      const subjectStats: Record<string, { conducted: number; attended: number; percentage: number | null }> = {};

      subjects.forEach((sub) => {
        // Conducted for this student is the number of sessions held for student's section in this subject
        // Fallback to subject total if section-specific sessions are not separated
        let conducted = subjectSectionSessionCount.get(`${sub.id}___${cleanSec}`) || 0;
        if (conducted === 0 && (subjectTotalSessionCount.get(sub.id) || 0) > 0) {
          conducted = subjectTotalSessionCount.get(sub.id) || 0;
        }

        const attended = studentSubjectAttendance.get(`${st.id}___${sub.id}`) || 0;
        
        // Critical validation: attended classes must never exceed conducted classes
        const validAttended = conducted > 0 ? Math.min(attended, conducted) : 0;
        const percentage = conducted > 0
          ? Math.min(100.0, Number(((validAttended / conducted) * 100).toFixed(2)))
          : null;

        subjectStats[sub.id] = {
          conducted,
          attended: validAttended,
          percentage,
        };

        studentTotalConducted += conducted;
        studentTotalAttended += validAttended;
      });

      const overallPercentage = studentTotalConducted > 0
        ? Math.min(100.0, Number(((studentTotalAttended / studentTotalConducted) * 100).toFixed(2)))
        : null;

      let eligibility: 'Eligible' | 'Not Eligible' | 'No Records' = 'No Records';
      if (studentTotalConducted > 0 && overallPercentage !== null) {
        eligibility = overallPercentage >= ATTENDANCE_THRESHOLD ? 'Eligible' : 'Not Eligible';
      }

      return {
        id: st.id,
        usn,
        name: studentName,
        section: cleanSec,
        sectionId: st.sectionId || null,
        subjectStats,
        totalConducted: studentTotalConducted,
        totalAttended: studentTotalAttended,
        overallPercentage,
        eligibility,
      };
    });

    // 10. Compute Subject Summaries (Sheet 2)
    const subjectSummaries = subjects.map((sub) => {
      let totalConducted = subjectTotalSessionCount.get(sub.id) || 0;
      let sumPct = 0;
      let countWithPct = 0;
      let eligible = 0;
      let notEligible = 0;
      let noRecords = 0;

      studentRows.forEach((st) => {
        const stats = st.subjectStats[sub.id];
        if (stats && stats.conducted > 0 && stats.percentage !== null) {
          sumPct += stats.percentage;
          countWithPct += 1;
          if (stats.percentage >= ATTENDANCE_THRESHOLD) {
            eligible += 1;
          } else {
            notEligible += 1;
          }
        } else {
          noRecords += 1;
        }
      });

      const avgPct = countWithPct > 0 ? Number((sumPct / countWithPct).toFixed(2)) : null;

      return {
        subjectId: sub.id,
        subjectCode: sub.code,
        subjectName: sub.name,
        conductedClasses: totalConducted,
        averagePercentage: avgPct,
        eligibleCount: eligible,
        notEligibleCount: notEligible,
        noRecordsCount: noRecords,
      };
    });

    // 11. Compute Section Summaries (Sheet 3)
    const sectionGroups = new Map<string, typeof studentRows>();
    studentRows.forEach((st) => {
      const group = sectionGroups.get(st.section) || [];
      group.push(st);
      sectionGroups.set(st.section, group);
    });

    const sectionSummaries = Array.from(sectionGroups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([sec, studentsInSec]) => {
        let sumPct = 0;
        let countWithPct = 0;
        let eligible = 0;
        let notEligible = 0;

        studentsInSec.forEach((st) => {
          if (st.overallPercentage !== null) {
            sumPct += st.overallPercentage;
            countWithPct += 1;
            if (st.overallPercentage >= ATTENDANCE_THRESHOLD) {
              eligible += 1;
            } else {
              notEligible += 1;
            }
          } else {
            notEligible += 1;
          }
        });

        const avgPct = countWithPct > 0 ? Number((sumPct / countWithPct).toFixed(2)) : null;

        return {
          section: `Section ${sec}`,
          totalStudents: studentsInSec.length,
          averagePercentage: avgPct,
          eligibleCount: eligible,
          notEligibleCount: notEligible,
        };
      });

    // Deterministic filename: Final_Attendance_<DEPARTMENT>_Sem<SEMESTER>_<ACADEMIC_YEAR>.xlsx
    // Normalize AY (e.g. "2026-2027" or "2026-27")
    const cleanAY = academicYear.replace(/\u2013|\u2014/g, '-').trim();
    const fileName = `Final_Attendance_${deptCode}_Sem${semester}_${cleanAY}.xlsx`;

    return {
      department: {
        id: department.id,
        name: deptName,
        code: deptCode,
      },
      academicYear,
      semester,
      fileName,
      sections: dbSections.map((s) => ({ id: s.id, name: s.name })),
      subjects,
      students: studentRows,
      subjectSummaries,
      sectionSummaries,
    };
  },

  /**
   * Generates Excel workbook buffer conforming exactly to the institution's consolidated format
   */
  async generateConsolidatedExcelBuffer(data: ConsolidatedAttendanceData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JCER College ERP - Consolidated Attendance Engine';
    workbook.created = new Date();

    const logoBuffer = getInstitutionalLogoBuffer();
    let logoImageId: number | undefined;
    if (logoBuffer) {
      try {
        logoImageId = workbook.addImage({
          buffer: logoBuffer as any,
          extension: 'png',
        });
      } catch (err: any) {
        logger.warn('Failed to attach logo to Excel workbook:', err.message);
      }
    }

    const fontInstTitle = { name: 'Times New Roman', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
    const fontInstSub = { name: 'Times New Roman', size: 11, bold: false, color: { argb: 'FF334155' } };
    const fontInstLoc = { name: 'Times New Roman', size: 13, bold: true, color: { argb: 'FF1E3A8A' } };
    const fontCohortTitle = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    const fontHeader = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FF000000' } };
    const fontBody = { name: 'Times New Roman', size: 10, bold: false };
    const borderThin: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 1: "Semester Attendance" (Main Consolidated Register)
    // ─────────────────────────────────────────────────────────────────────────
    const ws1 = workbook.addWorksheet('Semester Attendance', {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 6 }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9, // A4
        showGridLines: true,
      },
    });

    ws1.pageSetup.printTitlesRow = '5:6';

    const numSubjects = data.subjects.length;
    const totalCols = 7 + 2 * numSubjects;

    // ── Institutional Top Title Block (Rows 1 - 4) ──
    ws1.mergeCells(1, 1, 1, totalCols);
    const titleRow1 = ws1.getCell(1, 1);
    titleRow1.value = 'JAIN COLLEGE OF ENGINEERING & RESEARCH';
    titleRow1.font = fontInstTitle;
    titleRow1.alignment = { vertical: 'middle', horizontal: 'center' };
    ws1.getRow(1).height = 26;

    ws1.mergeCells(2, 1, 2, totalCols);
    const titleRow2 = ws1.getCell(2, 1);
    titleRow2.value = '(Approved by AICTE, Affiliated to VTU and Recognized by Govt. of Karnataka)';
    titleRow2.font = fontInstSub;
    titleRow2.alignment = { vertical: 'middle', horizontal: 'center' };
    ws1.getRow(2).height = 18;

    ws1.mergeCells(3, 1, 3, totalCols);
    const titleRow3 = ws1.getCell(3, 1);
    titleRow3.value = 'UDYAMBAG, BELAGAVI.';
    titleRow3.font = fontInstLoc;
    titleRow3.alignment = { vertical: 'middle', horizontal: 'center' };
    ws1.getRow(3).height = 22;

    ws1.mergeCells(4, 1, 4, totalCols);
    const titleRow4 = ws1.getCell(4, 1);
    titleRow4.value = `DEPARTMENT OF ${data.department.name.toUpperCase()} — SEMESTER ${data.semester} CONSOLIDATED ATTENDANCE REGISTER (${data.academicYear})`;
    titleRow4.font = fontCohortTitle;
    titleRow4.alignment = { vertical: 'middle', horizontal: 'center' };
    titleRow4.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' },
    };
    ws1.getRow(4).height = 20;

    // Embed JGI Logo at Left Corner (Rows 1 - 3)
    if (logoImageId !== undefined) {
      ws1.addImage(logoImageId, {
        tl: { col: 0.15, row: 0.15 },
        ext: { width: 66, height: 66 },
      });
    }

    // ── ROW 5: Multi-level Top Header ──
    // 1. Block "TOTAL NO. OF CLASS" over USN, Student Name, Section
    ws1.mergeCells(5, 1, 5, 3);
    const topClassBlock = ws1.getCell(5, 1);
    topClassBlock.value = 'TOTAL NO. OF CLASS';
    topClassBlock.font = { name: 'Times New Roman', size: 11, bold: true };
    topClassBlock.alignment = { vertical: 'middle', horizontal: 'center' };
    topClassBlock.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }, // Soft slate gray
    };

    // For each subject in the Conducted Classes block, write total conducted sessions on Row 5
    data.subjects.forEach((sub, i) => {
      const col = 4 + i;
      const subSummary = data.subjectSummaries.find((s) => s.subjectId === sub.id);
      const totalCond = subSummary ? subSummary.conductedClasses : 0;
      const cell = ws1.getCell(5, col);
      cell.value = totalCond;
      cell.font = { name: 'Times New Roman', size: 11, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
      };
      cell.border = borderThin;
    });

    // 2. Block "PERCENTAGE ATTENDANCE" over percentage subject columns
    const pctStartCol = 4 + numSubjects;
    const pctEndCol = 3 + 2 * numSubjects;
    if (numSubjects > 0) {
      ws1.mergeCells(5, pctStartCol, 5, pctEndCol);
      const pctBlock = ws1.getCell(5, pctStartCol);
      pctBlock.value = 'PERCENTAGE ATTENDANCE';
      pctBlock.font = { name: 'Times New Roman', size: 11, bold: true };
      pctBlock.alignment = { vertical: 'middle', horizontal: 'center' };
      pctBlock.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
      };
    }

    // 3. Overall Summary Top Block
    const overallStartCol = 4 + 2 * numSubjects;
    const overallEndCol = 7 + 2 * numSubjects;
    ws1.mergeCells(5, overallStartCol, 5, overallEndCol);
    const overallBlock = ws1.getCell(5, overallStartCol);
    overallBlock.value = 'OVERALL SUMMARY';
    overallBlock.font = { name: 'Times New Roman', size: 11, bold: true };
    overallBlock.alignment = { vertical: 'middle', horizontal: 'center' };
    overallBlock.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };

    ws1.getRow(5).height = 24;

    // ── ROW 6: Column Names ──
    const row6Values: string[] = [
      'USN',
      'Student Name',
      'Section',
      ...data.subjects.map((s) => s.code),
      ...data.subjects.map((s) => s.code),
      'Conducted',
      'Attended',
      'Overall %',
      'Eligibility',
    ];

    const row6 = ws1.getRow(6);
    row6.values = row6Values;
    row6.height = 24;

    row6.eachCell((cell, colNum) => {
      cell.font = fontHeader;
      cell.alignment = { vertical: 'middle', horizontal: colNum === 2 ? 'left' : 'center', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' }, // Clean light gray
      };
      cell.border = borderThin;
    });

    // ── Student Rows (Row 7+) ──
    data.students.forEach((st, idx) => {
      const rowNum = 7 + idx;
      const row = ws1.getRow(rowNum);

      const attendedValues = data.subjects.map((s) => {
        const stats = st.subjectStats[s.id];
        return stats ? stats.attended : 0;
      });

      const percentageValues = data.subjects.map((s) => {
        const stats = st.subjectStats[s.id];
        if (!stats || stats.percentage === null) return 'N/A';
        return Number(stats.percentage.toFixed(2));
      });

      const rowData = [
        st.usn,
        st.name,
        st.section,
        ...attendedValues,
        ...percentageValues,
        st.totalConducted,
        st.totalAttended,
        st.overallPercentage !== null ? Number(st.overallPercentage.toFixed(2)) : 'N/A',
        st.eligibility,
      ];

      row.values = rowData;
      row.height = 20;

      const isEven = idx % 2 === 0;
      const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

      row.eachCell((cell, colNumber) => {
        cell.font = fontBody;
        cell.border = borderThin;

        // Default fill
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBg },
        };

        // Alignments
        if (colNumber === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        // Conditional formatting for Subject Percentages
        if (colNumber >= pctStartCol && colNumber <= pctEndCol) {
          const val = cell.value;
          if (typeof val === 'number') {
            cell.numFmt = '0.00"%"';
            if (val >= ATTENDANCE_THRESHOLD) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }; // Soft Green
              cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FF006100' } };
            } else if (val >= 75.0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }; // Soft Yellow
              cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FF9C6500' } };
            } else {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }; // Soft Red
              cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FF9C0006' } };
            }
          }
        }

        // Overall Percentage formatting
        if (colNumber === 6 + 2 * numSubjects) {
          const val = cell.value;
          if (typeof val === 'number') {
            cell.numFmt = '0.00"%"';
            if (val >= ATTENDANCE_THRESHOLD) {
              cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FF006100' } };
            } else {
              cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FF9C0006' } };
            }
          }
        }

        // Eligibility formatting
        if (colNumber === 7 + 2 * numSubjects) {
          const val = String(cell.value);
          if (val === 'Eligible') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
            cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FF006100' } };
          } else if (val === 'Not Eligible') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
            cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FF9C0006' } };
          }
        }
      });
    });

    // Set Column Widths for Sheet 1
    ws1.getColumn(1).width = 16; // USN
    ws1.getColumn(2).width = 30; // Student Name
    ws1.getColumn(3).width = 10; // Section
    for (let c = 4; c <= 3 + 2 * numSubjects; c++) {
      ws1.getColumn(c).width = 12;
    }
    ws1.getColumn(4 + 2 * numSubjects).width = 14; // Conducted
    ws1.getColumn(5 + 2 * numSubjects).width = 14; // Attended
    ws1.getColumn(6 + 2 * numSubjects).width = 14; // Overall %
    ws1.getColumn(7 + 2 * numSubjects).width = 16; // Eligibility

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 2: "Attendance Summary" (Subject-level Overview)
    // ─────────────────────────────────────────────────────────────────────────
    const ws2 = workbook.addWorksheet('Attendance Summary', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }],
      pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    ws2.mergeCells('A1:G1');
    const ws2Title1 = ws2.getCell('A1');
    ws2Title1.value = 'JAIN COLLEGE OF ENGINEERING & RESEARCH';
    ws2Title1.font = fontInstTitle;
    ws2Title1.alignment = { vertical: 'middle', horizontal: 'center' };
    ws2.getRow(1).height = 24;

    ws2.mergeCells('A2:G2');
    const ws2Title2 = ws2.getCell('A2');
    ws2Title2.value = '(Approved by AICTE, Affiliated to VTU and Recognized by Govt. of Karnataka)';
    ws2Title2.font = fontInstSub;
    ws2Title2.alignment = { vertical: 'middle', horizontal: 'center' };
    ws2.getRow(2).height = 18;

    ws2.mergeCells('A3:G3');
    const ws2Title3 = ws2.getCell('A3');
    ws2Title3.value = 'UDYAMBAG, BELAGAVI.';
    ws2Title3.font = fontInstLoc;
    ws2Title3.alignment = { vertical: 'middle', horizontal: 'center' };
    ws2.getRow(3).height = 20;

    ws2.mergeCells('A4:G4');
    const ws2Title4 = ws2.getCell('A4');
    ws2Title4.value = `${data.department.name} - Semester ${data.semester} (${data.academicYear}) Subject Attendance Summary`;
    ws2Title4.font = fontCohortTitle;
    ws2Title4.alignment = { vertical: 'middle', horizontal: 'center' };
    ws2.getRow(4).height = 22;

    if (logoImageId !== undefined) {
      ws2.addImage(logoImageId, {
        tl: { col: 0.1, row: 0.1 },
        ext: { width: 58, height: 58 },
      });
    }

    const ws2Headers = [
      'Subject Code',
      'Subject Name',
      'Conducted Classes',
      'Average Attendance %',
      `Eligible (>=${ATTENDANCE_THRESHOLD}%)`,
      `Not Eligible (<${ATTENDANCE_THRESHOLD}%)`,
      'No Records',
    ];

    const row5ws2 = ws2.getRow(5);
    row5ws2.values = ws2Headers;
    row5ws2.height = 24;
    row5ws2.eachCell((cell) => {
      cell.font = fontHeader;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = borderThin;
    });

    data.subjectSummaries.forEach((sub, idx) => {
      const row = ws2.getRow(6 + idx);
      row.values = [
        sub.subjectCode,
        sub.subjectName,
        sub.conductedClasses,
        sub.averagePercentage !== null ? Number(sub.averagePercentage.toFixed(2)) : 'N/A',
        sub.eligibleCount,
        sub.notEligibleCount,
        sub.noRecordsCount,
      ];
      row.height = 20;
      row.eachCell((cell, colNum) => {
        cell.font = fontBody;
        cell.border = borderThin;
        cell.alignment = { vertical: 'middle', horizontal: colNum === 2 ? 'left' : 'center' };
        if (colNum === 4 && typeof cell.value === 'number') {
          cell.numFmt = '0.00"%"';
        }
      });
    });

    ws2.getColumn(1).width = 16;
    ws2.getColumn(2).width = 36;
    ws2.getColumn(3).width = 18;
    ws2.getColumn(4).width = 22;
    ws2.getColumn(5).width = 18;
    ws2.getColumn(6).width = 20;
    ws2.getColumn(7).width = 16;

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 3: "Section Summary" (Section-level Breakdown)
    // ─────────────────────────────────────────────────────────────────────────
    const ws3 = workbook.addWorksheet('Section Summary', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }],
      pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    ws3.mergeCells('A1:E1');
    const ws3Title1 = ws3.getCell('A1');
    ws3Title1.value = 'JAIN COLLEGE OF ENGINEERING & RESEARCH';
    ws3Title1.font = fontInstTitle;
    ws3Title1.alignment = { vertical: 'middle', horizontal: 'center' };
    ws3.getRow(1).height = 24;

    ws3.mergeCells('A2:E2');
    const ws3Title2 = ws3.getCell('A2');
    ws3Title2.value = '(Approved by AICTE, Affiliated to VTU and Recognized by Govt. of Karnataka)';
    ws3Title2.font = fontInstSub;
    ws3Title2.alignment = { vertical: 'middle', horizontal: 'center' };
    ws3.getRow(2).height = 18;

    ws3.mergeCells('A3:E3');
    const ws3Title3 = ws3.getCell('A3');
    ws3Title3.value = 'UDYAMBAG, BELAGAVI.';
    ws3Title3.font = fontInstLoc;
    ws3Title3.alignment = { vertical: 'middle', horizontal: 'center' };
    ws3.getRow(3).height = 20;

    ws3.mergeCells('A4:E4');
    const ws3Title4 = ws3.getCell('A4');
    ws3Title4.value = `${data.department.name} - Semester ${data.semester} (${data.academicYear}) Section Attendance Breakdown`;
    ws3Title4.font = fontCohortTitle;
    ws3Title4.alignment = { vertical: 'middle', horizontal: 'center' };
    ws3.getRow(4).height = 22;

    if (logoImageId !== undefined) {
      ws3.addImage(logoImageId, {
        tl: { col: 0.1, row: 0.1 },
        ext: { width: 58, height: 58 },
      });
    }

    const ws3Headers = [
      'Section',
      'Total Students',
      'Average Attendance %',
      `Eligible (>=${ATTENDANCE_THRESHOLD}%)`,
      `Not Eligible (<${ATTENDANCE_THRESHOLD}%)`,
    ];

    const row5ws3 = ws3.getRow(5);
    row5ws3.values = ws3Headers;
    row5ws3.height = 24;
    row5ws3.eachCell((cell) => {
      cell.font = fontHeader;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = borderThin;
    });

    data.sectionSummaries.forEach((sec, idx) => {
      const row = ws3.getRow(6 + idx);
      row.values = [
        sec.section,
        sec.totalStudents,
        sec.averagePercentage !== null ? Number(sec.averagePercentage.toFixed(2)) : 'N/A',
        sec.eligibleCount,
        sec.notEligibleCount,
      ];
      row.height = 20;
      row.eachCell((cell, colNum) => {
        cell.font = fontBody;
        cell.border = borderThin;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (colNum === 3 && typeof cell.value === 'number') {
          cell.numFmt = '0.00"%"';
        }
      });
    });

    ws3.getColumn(1).width = 18;
    ws3.getColumn(2).width = 18;
    ws3.getColumn(3).width = 24;
    ws3.getColumn(4).width = 20;
    ws3.getColumn(5).width = 22;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },

  /**
   * Syncs the consolidated semester attendance workbook to Google Drive.
   * Updates the existing file in place or creates a single stable canonical file.
   */
  async syncConsolidatedSemesterAttendanceToDrive(params: {
    academicYear: string;
    departmentId: string;
    semester: number;
  }): Promise<{
    backupRecord: ConsolidatedAttendanceBackupFile;
    googleDriveFileId: string;
    fileName: string;
    stats: {
      totalSections: number;
      totalStudents: number;
      totalSubjects: number;
    };
  }> {
    const data = await this.fetchConsolidatedSemesterData(params);
    const buffer = await this.generateConsolidatedExcelBuffer(data);

    // 1. Check if Google Drive integration is active
    const integration = await GoogleDriveIntegration.findOne({
      where: { status: 'CONNECTED' },
    });

    if (!integration || !integration.encryptedRefreshToken) {
      throw new Error('Google Drive integration is not connected. Please connect from Dean Settings.');
    }

    // 2. Ensure Semester Folder exists directly under AY -> Dept -> Semester
    const semesterFolderId = await googleDriveService.ensureSemesterFolderHierarchy(
      data.academicYear,
      data.department.code,
      data.semester
    );

    // 3. Find existing backup file record
    let backupRecord = await ConsolidatedAttendanceBackupFile.findOne({
      where: {
        academicYear: data.academicYear,
        departmentId: data.department.id,
        semester: data.semester,
      },
    });

    // 4. Upload or update Google Drive workbook
    const googleDriveFileId = await googleDriveService.uploadOrUpdateConsolidatedWorkbook(
      semesterFolderId,
      data.fileName,
      buffer,
      backupRecord?.googleDriveFileId || null
    );

    // 5. Update or create backup file registry
    if (backupRecord) {
      backupRecord.googleDriveFolderId = semesterFolderId;
      backupRecord.googleDriveFileId = googleDriveFileId;
      backupRecord.fileName = data.fileName;
      backupRecord.status = 'SYNCED';
      backupRecord.lastSyncedAt = new Date();
      backupRecord.lastError = null;
      await backupRecord.save();
    } else {
      backupRecord = await ConsolidatedAttendanceBackupFile.create({
        academicYear: data.academicYear,
        departmentId: data.department.id,
        semester: data.semester,
        googleDriveFolderId: semesterFolderId,
        googleDriveFileId,
        fileName: data.fileName,
        status: 'SYNCED',
        lastSyncedAt: new Date(),
      });
    }

    logger.info(
      `✓ [Consolidation Service] Synced consolidated semester attendance workbook ${data.fileName} (Drive ID: ${googleDriveFileId})`
    );

    return {
      backupRecord,
      googleDriveFileId,
      fileName: data.fileName,
      stats: {
        totalSections: data.sections.length,
        totalStudents: data.students.length,
        totalSubjects: data.subjects.length,
      },
    };
  },

  /**
   * Retrieves current consolidated backup status for HOD / Dean
   */
  async getConsolidatedBackupStatus(params: {
    academicYear: string;
    departmentId: string;
    semester: number;
  }) {
    const { academicYear, departmentId, semester } = params;

    const backupRecord = await ConsolidatedAttendanceBackupFile.findOne({
      where: {
        academicYear,
        departmentId,
        semester,
      },
    });

    const data = await this.fetchConsolidatedSemesterData(params);

    return {
      academicYear,
      departmentId,
      departmentCode: data.department.code,
      departmentName: data.department.name,
      semester,
      fileName: data.fileName,
      googleDriveFileId: backupRecord?.googleDriveFileId || null,
      status: backupRecord?.status || 'NOT_SYNCED',
      lastSyncedAt: backupRecord?.lastSyncedAt || null,
      lastError: backupRecord?.lastError || null,
      stats: {
        totalSections: data.sections.length,
        sectionNames: data.sections.map((s) => s.name),
        totalStudents: data.students.length,
        totalSubjects: data.subjects.length,
        subjectCodes: data.subjects.map((s) => s.code),
      },
    };
  },
};

export default semesterAttendanceConsolidationService;

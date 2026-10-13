import { Op } from 'sequelize';
import ExcelJS from 'exceljs';
import { embedOfficialCollegeBanner } from '../utils/excelBranding.util';
import FacultyAssignment from '../models/FacultyAssignment';
import Subject from '../models/Subject';
import Department from '../models/Department';
import User from '../models/User';
import Student from '../models/Student';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';
import { getEnrolledStudentsForAssignment, buildAssignmentCohortWhere } from './faculty.service';

/**
 * Normalizes section string to remove "Section " prefix
 */
function normalizeSection(sec?: string | null): string {
  if (!sec) return 'A';
  return sec.replace(/^Section\s+/i, '').trim() || 'A';
}

export interface AttendanceWorkbookResult {
  buffer: Buffer;
  filename: string;
  metadata: {
    assignmentId: string;
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    semester: number;
    section: string;
    academicYear: string;
    facultyName: string;
    totalClasses: number;
    totalStudents: number;
  };
}

export const attendanceExcelService = {
  /**
   * Generates the official Class-wise Attendance Register Excel spreadsheet
   * Shared by both Faculty Manual Export and Automatic Google Drive Backup.
   */
  async generateAttendanceWorkbookBuffer(assignmentId: string): Promise<AttendanceWorkbookResult> {
    const assignment = await FacultyAssignment.findByPk(assignmentId, {
      include: [
        { model: Subject, as: 'subject' },
        { model: Department, as: 'department' },
      ],
    });

    if (!assignment || assignment.status !== 'ACTIVE') {
      throw new Error(`Active teaching assignment not found for ID: ${assignmentId}`);
    }

    const rawAssignment = assignment as any;
    const facultyUser = await User.findByPk(assignment.userId);
    const facultyName = facultyUser
      ? `${facultyUser.firstName || ''} ${facultyUser.lastName || ''}`.trim() || facultyUser.email
      : 'Faculty';

    const subjectName = rawAssignment.subject?.name || 'Assigned Subject';
    const subjectCode = rawAssignment.subject?.code || 'SUB001';
    const departmentName = rawAssignment.department?.name || rawAssignment.department?.code || 'Computer Science & Engineering';
    const departmentCode = rawAssignment.department?.code || 'CSE';
    const cleanSection = normalizeSection(assignment.section);
    const academicYear = assignment.academicYear || '2026-27';
    const semester = assignment.semester;

    const { students } = await getEnrolledStudentsForAssignment(assignment);
    if (!students || students.length === 0) {
      throw new Error('No students enrolled in this section roster.');
    }

    // Sort students deterministically based on semester rule:
    // Sem 1: Name A-Z (case-insensitive), tie-breaker USN ASC
    // Sem 2+: USN ASC (case-insensitive), tie-breaker Name A-Z
    const isSemester1 = Number(semester) === 1;
    students.sort((a: any, b: any) => {
      if (isSemester1) {
        const nameA = `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.trim().toLowerCase();
        const nameB = `${b.user?.firstName || ''} ${b.user?.lastName || ''}`.trim().toLowerCase();
        const cmp = nameA.localeCompare(nameB);
        if (cmp !== 0) return cmp;
        const usnA = (a.usn || a.enrollmentNumber || '').trim().toLowerCase();
        const usnB = (b.usn || b.enrollmentNumber || '').trim().toLowerCase();
        return usnA.localeCompare(usnB);
      } else {
        const usnA = (a.usn || a.enrollmentNumber || '').trim().toLowerCase();
        const usnB = (b.usn || b.enrollmentNumber || '').trim().toLowerCase();
        const cmp = usnA.localeCompare(usnB);
        if (cmp !== 0) return cmp;
        const nameA = `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.trim().toLowerCase();
        const nameB = `${b.user?.firstName || ''} ${b.user?.lastName || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      }
    });

    // Fetch attendance sessions and records chronologically across transfer lineage
    const cohortWhere = buildAssignmentCohortWhere(assignment);

    const sessions = await AttendanceSession.findAll({
      where: cohortWhere,
      order: [['attendanceDate', 'ASC'], ['sessionPeriod', 'ASC']],
    });

    const sessionIds = sessions.map((s) => s.id);
    const recordsWhere = sessionIds.length > 0
      ? { [Op.or]: [{ attendanceSessionId: { [Op.in]: sessionIds } }, cohortWhere] }
      : cohortWhere;

    const attendanceRecords = await AttendanceRecord.findAll({
      where: recordsWhere,
      order: [['date', 'ASC'], ['sessionPeriod', 'ASC']],
    });

    // Ensure all students who have historical attendance records are included in the roster
    const existingStudentIds = new Set(students.map((s: any) => s.id));
    const missingStudentIds = Array.from(new Set(attendanceRecords.map((r: any) => r.studentId))).filter(
      (id) => !existingStudentIds.has(id)
    );
    if (missingStudentIds.length > 0) {
      const extraStudents = await Student.findAll({
        where: { id: { [Op.in]: missingStudentIds } },
        include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }],
      });
      students.push(...extraStudents);
      // Re-sort students deterministically
      students.sort((a: any, b: any) => {
        if (isSemester1) {
          const nameA = `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.trim().toLowerCase();
          const nameB = `${b.user?.firstName || ''} ${b.user?.lastName || ''}`.trim().toLowerCase();
          const cmp = nameA.localeCompare(nameB);
          if (cmp !== 0) return cmp;
          const usnA = (a.usn || a.enrollmentNumber || '').trim().toLowerCase();
          const usnB = (b.usn || b.enrollmentNumber || '').trim().toLowerCase();
          return usnA.localeCompare(usnB);
        } else {
          const usnA = (a.usn || a.enrollmentNumber || '').trim().toLowerCase();
          const usnB = (b.usn || b.enrollmentNumber || '').trim().toLowerCase();
          const cmp = usnA.localeCompare(usnB);
          if (cmp !== 0) return cmp;
          const nameA = `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.trim().toLowerCase();
          const nameB = `${b.user?.firstName || ''} ${b.user?.lastName || ''}`.trim().toLowerCase();
          return nameA.localeCompare(nameB);
        }
      });
    }

    // Map unique sessions with distinct date / period columns
    interface FormattedSession {
      id: string;
      rawDate: string;
      formattedDate: string;
      period: number;
      columnHeader: string;
    }

    const sessionList: FormattedSession[] = [];

    if (sessions.length > 0) {
      // Deduplicate distinct date & period combinations (preserves idempotency on retries)
      const uniqueSessionMap = new Map<string, typeof sessions[0]>();
      sessions.forEach((s) => {
        const dStr = typeof s.attendanceDate === 'string' ? s.attendanceDate : String(s.attendanceDate);
        const p = s.sessionPeriod || 1;
        const key = `${dStr}___${p}`;
        if (!uniqueSessionMap.has(key)) {
          uniqueSessionMap.set(key, s);
        } else {
          const existing = uniqueSessionMap.get(key)!;
          if (s.facultyAssignmentId === assignment.id || (s.updatedAt && existing.updatedAt && s.updatedAt > existing.updatedAt)) {
            uniqueSessionMap.set(key, s);
          }
        }
      });
      const uniqueSessions = Array.from(uniqueSessionMap.values()).sort((a, b) => {
        const dComp = String(a.attendanceDate).localeCompare(String(b.attendanceDate));
        if (dComp !== 0) return dComp;
        return (a.sessionPeriod || 1) - (b.sessionPeriod || 1);
      });

      // Count periods per date to format headers
      const datePeriodCounts: Record<string, number> = {};
      uniqueSessions.forEach((s) => {
        const dStr = typeof s.attendanceDate === 'string' ? s.attendanceDate : String(s.attendanceDate);
        datePeriodCounts[dStr] = (datePeriodCounts[dStr] || 0) + 1;
      });

      uniqueSessions.forEach((s) => {
        const dStr = typeof s.attendanceDate === 'string' ? s.attendanceDate : String(s.attendanceDate);
        // Format YYYY-MM-DD -> DD-MM-YYYY
        const parts = dStr.split('-');
        const formattedDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dStr;
        const columnHeader = datePeriodCounts[dStr] > 1 ? `${formattedDate} P${s.sessionPeriod || 1}` : formattedDate;

        sessionList.push({
          id: s.id,
          rawDate: dStr,
          formattedDate,
          period: s.sessionPeriod || 1,
          columnHeader,
        });
      });
    } else if (attendanceRecords.length > 0) {
      // Fallback if legacy records exist without AttendanceSession
      const legacyDates = new Set<string>();
      attendanceRecords.forEach((r) => {
        const dStr = (r.date as any) instanceof Date ? (r.date as any).toISOString().split('T')[0] : String(r.date);
        const p = r.sessionPeriod || 1;
        legacyDates.add(`${dStr}___${p}`);
      });

      Array.from(legacyDates).sort().forEach((key) => {
        const [dStr, pStr] = key.split('___');
        const p = parseInt(pStr, 10) || 1;
        const parts = dStr.split('-');
        const formattedDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dStr;
        sessionList.push({
          id: key,
          rawDate: dStr,
          formattedDate,
          period: p,
          columnHeader: `${formattedDate} P${p}`,
        });
      });
    }

    const totalClasses = sessionList.length;

    // Build Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JCER College ERP';
    workbook.created = new Date();

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 1: Attendance Register
    // ─────────────────────────────────────────────────────────────────────────
    const ws = workbook.addWorksheet('Attendance Register', {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 8 }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9, // A4
        showGridLines: true,
      },
    });

    // Set Print Title Row (Header repeats when printed)
    ws.pageSetup.printTitlesRow = '8:8';

    // Institutional Official Banner (Rows 1 - 2)
    const totalCols = Math.max(7 + sessionList.length, 7);
    ws.getRow(1).height = 38;
    ws.getRow(2).height = 38;
    embedOfficialCollegeBanner(workbook, ws, {
      totalCols,
      startCol: 1,
      startRow: 0.10,
    });

    // Report Title (Row 3, below banner)
    ws.mergeCells(3, 1, 3, Math.min(totalCols, 7));
    const subTitleCell = ws.getCell(3, 1);
    subTitleCell.value = 'CLASS-WISE ATTENDANCE REGISTER';
    subTitleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1E40AF' } };
    subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(3).height = 22;

    // Academic Metadata Block (Rows 4 - 6)
    ws.getCell('A4').value = 'Subject:';
    ws.getCell('A4').font = { bold: true };
    ws.getCell('B4').value = `${subjectName} (${subjectCode})`;
    ws.getCell('B4').font = { bold: true };

    ws.getCell('A5').value = 'Department:';
    ws.getCell('A5').font = { bold: true };
    ws.getCell('B5').value = departmentName;

    ws.getCell('A6').value = 'Section:';
    ws.getCell('A6').font = { bold: true };
    ws.getCell('B6').value = `Section ${cleanSection}`;

    ws.getCell('D4').value = 'Semester:';
    ws.getCell('D4').font = { bold: true };
    ws.getCell('E4').value = `Semester ${semester}`;

    ws.getCell('D5').value = 'Academic Year:';
    ws.getCell('D5').font = { bold: true };
    ws.getCell('E5').value = academicYear;

    ws.getCell('D6').value = 'Faculty:';
    ws.getCell('D6').font = { bold: true };
    ws.getCell('E6').value = facultyName;

    // Table Header (Row 8)
    const headers = [
      'SL NO',
      'USN',
      'STUDENT NAME',
      ...sessionList.map((s) => s.columnHeader),
      'TOTAL CLASSES',
      'ATTENDED CLASSES',
      'PERCENTAGE',
      'ELIGIBILITY',
    ];

    const headerRow = ws.getRow(8);
    headerRow.values = headers;
    headerRow.height = 30;

    headerRow.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' }, // Dark slate navy
      };
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 3 ? 'left' : 'center',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        right: { style: 'thin', color: { argb: 'FF334155' } },
      };
    });

    // Student Attendance Matrix Rows (Row 9+)
    const recordMap = new Map<string, string>(); // `studentId___sessionId` or `studentId___date___period` -> 'PRESENT' | 'ABSENT'
    attendanceRecords.forEach((r) => {
      const dStr = (r.date as any) instanceof Date ? (r.date as any).toISOString().split('T')[0] : String(r.date);
      if (r.attendanceSessionId) {
        recordMap.set(`${r.studentId}___${r.attendanceSessionId}`, r.status);
      }
      recordMap.set(`${r.studentId}___${dStr}___${r.sessionPeriod || 1}`, r.status);
    });

    const defaulters: Array<{ student: any; attended: number; percentage: number }> = [];

    students.forEach((st: any, idx: number) => {
      const rowNum = 9 + idx;
      const row = ws.getRow(rowNum);

      let studentAttendedCount = 0;
      const sessionValues: number[] = [];

      sessionList.forEach((s) => {
        let status = recordMap.get(`${st.id}___${s.id}`);
        if (!status) {
          status = recordMap.get(`${st.id}___${s.rawDate}___${s.period}`);
        }

        const isPresent = status === 'PRESENT';
        const numVal = isPresent ? 1 : 0;
        sessionValues.push(numVal);
        if (isPresent) studentAttendedCount++;
      });

      const percentage = totalClasses > 0 ? Math.round((studentAttendedCount / totalClasses) * 100) : 0;
      const isEligible = percentage >= 85;
      const eligibilityText = isEligible ? 'Eligible' : 'Not Eligible';

      if (!isEligible && totalClasses > 0) {
        defaulters.push({ student: st, attended: studentAttendedCount, percentage });
      }

      const sName = st.user ? `${st.user.firstName || ''} ${st.user.lastName || ''}`.trim() : 'Student';

      row.values = [
        idx + 1,
        (st.usn || st.enrollmentNumber || 'N/A').toUpperCase(),
        sName.toUpperCase(),
        ...sessionValues,
        totalClasses,
        studentAttendedCount,
        `${percentage}%`,
        eligibilityText,
      ];

      row.height = 20;

      // Cell Styling
      row.eachCell((cell, colNumber) => {
        const isSessionCol = colNumber > 3 && colNumber <= 3 + sessionList.length;
        const isTotalCol = colNumber === 4 + sessionList.length;
        const isAttendedCol = colNumber === 5 + sessionList.length;
        const isPercentageCol = colNumber === 6 + sessionList.length;
        const isEligibilityCol = colNumber === 7 + sessionList.length;

        cell.font = { name: 'Calibri', size: 10 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { bold: true, color: { argb: 'FF64748B' } };
        } else if (colNumber === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { bold: true, color: { argb: 'FF1E293B' } };
        } else if (colNumber === 3) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.font = { bold: true, color: { argb: 'FF0F172A' } };
        } else if (isSessionCol) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          const val = cell.value;
          if (val === 1) {
            cell.font = { bold: true, color: { argb: 'FF15803D' } }; // Dark green
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }; // Soft green tint
          } else {
            cell.font = { bold: true, color: { argb: 'FFDC2626' } }; // Crimson red
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } }; // Soft red tint
          }
        } else if (isTotalCol || isAttendedCol) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { bold: true };
        } else if (isPercentageCol) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { bold: true, color: isEligible ? { argb: 'FF15803D' } : { argb: 'FFDC2626' } };
        } else if (isEligibilityCol) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { bold: true, color: isEligible ? { argb: 'FF15803D' } : { argb: 'FFDC2626' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: isEligible ? { argb: 'FFF0FDF4' } : { argb: 'FFFEF2F2' },
          };
        }
      });
    });

    // Auto-fit Column Widths
    ws.getColumn(1).width = 8;  // SL NO
    ws.getColumn(2).width = 18; // USN
    ws.getColumn(3).width = 34; // STUDENT NAME

    for (let c = 4; c <= 3 + sessionList.length; c++) {
      ws.getColumn(c).width = 14;
    }

    const lastColNum = 7 + sessionList.length;
    ws.getColumn(lastColNum - 3).width = 15; // TOTAL CLASSES
    ws.getColumn(lastColNum - 2).width = 18; // ATTENDED CLASSES
    ws.getColumn(lastColNum - 1).width = 14; // PERCENTAGE
    ws.getColumn(lastColNum).width = 16;     // ELIGIBILITY

    // Enable Autofilter on Table Headers
    const lastColLetter = ws.getColumn(lastColNum).letter;
    ws.autoFilter = `A8:${lastColLetter}8`;

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 2: Attendance Summary & Defaulters
    // ─────────────────────────────────────────────────────────────────────────
    const wsSummary = workbook.addWorksheet('Attendance Summary', {
      pageSetup: {
        orientation: 'portrait',
        paperSize: 9,
      },
    });

    // Institutional Official Banner (Rows 1 - 2)
    wsSummary.getRow(1).height = 36;
    wsSummary.getRow(2).height = 36;
    embedOfficialCollegeBanner(workbook, wsSummary, {
      totalCols: 7,
      startCol: 1,
      startRow: 0.10,
    });

    // Report Title (Row 3, below banner)
    wsSummary.mergeCells('A3:G3');
    wsSummary.getCell('A3').value = 'ATTENDANCE SUMMARY & DEFAULTER ANALYSIS';
    wsSummary.getCell('A3').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1E40AF' } };
    wsSummary.getCell('A3').alignment = { vertical: 'middle', horizontal: 'center' };
    wsSummary.getRow(3).height = 22;

    // Metric Summary Table
    wsSummary.getCell('A4').value = 'Metric';
    wsSummary.getCell('B4').value = 'Value';
    wsSummary.getRow(4).font = { bold: true };
    wsSummary.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    const summaryMetrics = [
      ['Subject', `${subjectName} (${subjectCode})`],
      ['Department', departmentName],
      ['Section / Semester', `Section ${cleanSection} / Semester ${semester}`],
      ['Academic Year', academicYear],
      ['Faculty In-Charge', facultyName],
      ['Total Classes Conducted', totalClasses],
      ['Total Enrolled Students', students.length],
      ['Eligible Students (>= 85%)', students.length - defaulters.length],
      ['Attendance Shortage (< 85%)', defaulters.length],
    ];

    summaryMetrics.forEach((m, idx) => {
      const r = wsSummary.getRow(5 + idx);
      r.values = [m[0], m[1]];
      r.font = { name: 'Calibri', size: 10 };
      r.getCell(1).font = { bold: true };
    });

    // Defaulter List Table
    const dHeaderRow = 16;
    wsSummary.mergeCells(`A${dHeaderRow - 1}:G${dHeaderRow - 1}`);
    wsSummary.getCell(`A${dHeaderRow - 1}`).value = 'ATTENDANCE SHORTAGE / DEFAULTER ROSTER (< 85%)';
    wsSummary.getCell(`A${dHeaderRow - 1}`).font = { bold: true, color: { argb: 'FFDC2626' } };

    const defHeaders = ['SL NO', 'USN', 'STUDENT NAME', 'ATTENDED', 'TOTAL', 'PERCENTAGE', 'STATUS'];
    const defRow = wsSummary.getRow(dHeaderRow);
    defRow.values = defHeaders;
    defRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    defRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };

    defaulters.forEach((d, dIdx) => {
      const dRowNum = dHeaderRow + 1 + dIdx;
      const st = d.student;
      const sName = st.user ? `${st.user.firstName || ''} ${st.user.lastName || ''}`.trim() : 'Student';
      const pct = d.percentage;
      const attended = d.attended;

      const dRow = wsSummary.getRow(dRowNum);
      dRow.values = [
        dIdx + 1,
        (st.usn || st.enrollmentNumber || 'N/A').toUpperCase(),
        sName.toUpperCase(),
        attended,
        totalClasses,
        `${pct}%`,
        'Not Eligible',
      ];
      dRow.height = 20;
      dRow.eachCell((cell, colNum) => {
        cell.alignment = { vertical: 'middle', horizontal: colNum === 3 ? 'left' : 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
    });

    wsSummary.getColumn(1).width = 8;
    wsSummary.getColumn(2).width = 18;
    wsSummary.getColumn(3).width = 34;
    wsSummary.getColumn(4).width = 18;
    wsSummary.getColumn(5).width = 16;
    wsSummary.getColumn(6).width = 14;
    wsSummary.getColumn(7).width = 16;

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    // Sanitize filename
    const cleanSubj = subjectCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanAY = academicYear.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Attendance_${cleanSubj}_Sec${cleanSection}_${cleanAY}.xlsx`;

    return {
      buffer,
      filename,
      metadata: {
        assignmentId: assignment.id,
        subjectId: assignment.subjectId,
        subjectName,
        subjectCode,
        departmentId: assignment.departmentId,
        departmentName,
        departmentCode,
        semester,
        section: cleanSection,
        academicYear,
        facultyName,
        totalClasses,
        totalStudents: students.length,
      },
    };
  },
};

export default attendanceExcelService;

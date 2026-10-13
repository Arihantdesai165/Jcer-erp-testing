import ExcelJS from 'exceljs';
import { embedOfficialCollegeBanner } from '../utils/excelBranding.util';
import AssessmentConfiguration from '../models/AssessmentConfiguration';
import StudentQuestionMarks from '../models/StudentQuestionMarks';
import StudentAssessmentSummary from '../models/StudentAssessmentSummary';
import AssignmentConfiguration from '../models/AssignmentConfiguration';
import StudentAssignmentMarks from '../models/StudentAssignmentMarks';
import StudentAssignmentSummary from '../models/StudentAssignmentSummary';
import FinalInternalMarks from '../models/FinalInternalMarks';
import ExternalExaminationMarks from '../models/ExternalExaminationMarks';
import Subject from '../models/Subject';
import Department from '../models/Department';
import Student from '../models/Student';
import User from '../models/User';
import FacultyAssignment from '../models/FacultyAssignment';
import { Op } from 'sequelize';
import { calculateFinalInternalMarks, calculateVtuPassingStatus } from '../utils/bitwiseCalculation.util';

const getAYVariants = (ay?: string): string[] => {
  if (!ay || ay === 'ALL') return [];
  const clean = ay.trim().replace(/\u2013|\u2014/g, '-');
  const enDash = clean.replace(/-/g, '–');
  const emDash = clean.replace(/-/g, '—');
  return Array.from(new Set([clean, enDash, emDash, ay.trim()]));
};

export interface BitwiseMarksExportResult {
  buffer: Buffer;
  filename: string;
  metadata: {
    academicYear: string;
    departmentCode: string;
    departmentName: string;
    departmentId: string;
    semester: number;
    subjectCode: string;
    subjectName: string;
    subjectId: string;
  };
}

export const bitwiseMarksExcelService = {
  /**
   * Generates or updates the official Subject Bitwise Marks Excel Workbook
   * Containing sheets: CIE-1 Bitwise, CIE-2 Bitwise, Assignment Marks, Final Internal Marks, External Marks
   */
  async generateSubjectMarksWorkbook(
    subjectId: string,
    semester: number,
    academicYear: string,
    departmentId: string,
    existingBuffer?: Buffer | null
  ): Promise<BitwiseMarksExportResult> {
    const subject = await Subject.findByPk(subjectId);
    const department = await Department.findByPk(departmentId);

    const deptCode = department?.code || 'CSE';
    const deptName = department?.name || 'Computer Science & Engineering';
    const subjCode = subject?.code || 'SUB001';
    const subjName = subject?.name || 'Assigned Subject';

    const cleanAY = academicYear.trim().replace(/\u2013|\u2014/g, '-');
    const cleanSubjName = subjName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${subjCode}_${cleanSubjName}.xlsx`;

    // Fetch assigned faculty name
    const ayVariants = getAYVariants(academicYear);
    const assignment = await FacultyAssignment.findOne({
      where: {
        subjectId,
        semester,
        academicYear: ayVariants.length > 0 ? { [Op.in]: ayVariants } : academicYear,
        status: 'ACTIVE',
      },
      include: [
        { model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] },
      ],
      order: [['createdAt', 'ASC']],
    });

    let facultyName = '';
    const rawAssignment = assignment as any;
    if (rawAssignment?.user) {
      const u = rawAssignment.user;
      facultyName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '';
    }

    if (!facultyName) {
      const anyAssign = await FacultyAssignment.findOne({
        where: { subjectId, semester, status: 'ACTIVE' },
        include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] }],
      });
      const rawAny = anyAssign as any;
      if (rawAny?.user) {
        const u = rawAny.user;
        facultyName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '';
      }
    }

    const workbook = new ExcelJS.Workbook();
    if (existingBuffer && existingBuffer.length > 0) {
      try {
        await workbook.xlsx.load(existingBuffer as any);
      } catch (e) {
        // start with fresh workbook if loading fails
      }
    }

    workbook.creator = 'JCER ERP Assessment Cell';
    workbook.lastModifiedBy = 'JCER ERP Faculty Portal';
    workbook.created = new Date();
    workbook.modified = new Date();

    // 1. Fetch Consolidated Students for this cohort
    const students = await Student.findAll({
      where: {
        departmentId,
        semester,
      },
      include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] }],
      order: [['usn', 'ASC'], ['enrollmentNumber', 'ASC']],
    });

    // Deduplicate students by id
    const seenIds = new Set<string>();
    const uniqueStudents: typeof students = [];
    for (const s of students) {
      if (!seenIds.has(s.id)) {
        seenIds.add(s.id);
        uniqueStudents.push(s);
      }
    }

    // 2. Build CIE-1 and CIE-2 Sheets
    await this.populateCieSheet(workbook, 'CIE-1 Bitwise', 'CIE1', subjectId, semester, academicYear, departmentId, uniqueStudents, deptName, subjCode, subjName, facultyName);
    await this.populateCieSheet(workbook, 'CIE-2 Bitwise', 'CIE2', subjectId, semester, academicYear, departmentId, uniqueStudents, deptName, subjCode, subjName, facultyName);

    // 3. Build Assignment Marks Sheet
    await this.populateAssignmentSheet(workbook, 'Assignment Marks', subjectId, semester, academicYear, departmentId, uniqueStudents, deptName, subjCode, subjName, facultyName);

    // 4. Build Final Internal Marks Sheet
    await this.populateFinalInternalSheet(workbook, 'Final Internal Marks', subjectId, semester, academicYear, departmentId, uniqueStudents, deptName, subjCode, subjName, facultyName);

    // 5. Build External Examination Marks Sheet
    await this.populateExternalMarksSheet(workbook, 'External Marks', subjectId, semester, academicYear, departmentId, uniqueStudents, deptName, subjCode, subjName, facultyName);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    return {
      buffer,
      filename,
      metadata: {
        academicYear: cleanAY,
        departmentCode: deptCode,
        departmentName: deptName,
        departmentId,
        semester,
        subjectCode: subjCode,
        subjectName: subjName,
        subjectId,
      },
    };
  },

  /**
   * Generates or updates CIE bitwise worksheet
   */
  async populateCieSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    assessmentType: 'CIE1' | 'CIE2',
    subjectId: string,
    semester: number,
    academicYear: string,
    departmentId: string,
    students: any[],
    deptName: string,
    subjCode: string,
    subjName: string,
    facultyName?: string
  ) {
    let sheet = workbook.getWorksheet(sheetName);
    if (sheet) {
      workbook.removeWorksheet(sheet.id);
    }
    sheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 6 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    const ayVariants = getAYVariants(academicYear);
    const config = await AssessmentConfiguration.findOne({
      where: {
        academicYear: ayVariants.length > 0 ? { [Op.in]: ayVariants } : academicYear,
        departmentId,
        semester,
        subjectId,
        assessmentType,
      },
    });

    // 1. Institutional Official Banner (Rows 1 - 2)
    sheet.getRow(1).height = 36;
    sheet.getRow(2).height = 36;
    embedOfficialCollegeBanner(workbook, sheet, {
      totalCols: 18,
      startCol: 1,
      startRow: 0.10,
    });

    // 2. Department & Assessment Title (Row 3, below banner)
    sheet.mergeCells('A3:Z3');
    const deptCell = sheet.getCell('A3');
    deptCell.value = `Department of ${deptName} — Continuous Internal Evaluation (${assessmentType === 'CIE1' ? 'CIE-1' : 'CIE-2'})`;
    deptCell.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FF1E293B' } };
    deptCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(3).height = 22;

    // 3. Academic Metadata Header (Row 4)
    sheet.mergeCells('A4:Z4');
    const subCell = sheet.getCell('A4');
    const maxMarksVal = Math.round(Number(config?.maximumMarks || 50));
    subCell.value = `Faculty: ${facultyName || 'Staff'} | Subject: ${subjCode} - ${subjName} | Semester: ${semester} | Academic Year: ${academicYear} | Max Marks: ${maxMarksVal}`;
    subCell.font = { name: 'Times New Roman', size: 10.5, bold: true, italic: true, color: { argb: 'FF475569' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(4).height = 20;

    if (!config || !Array.isArray(config.questionPattern) || config.questionPattern.length === 0) {
      sheet.mergeCells('A5:H5');
      sheet.getCell('A5').value = 'Assessment question pattern not yet configured.';
      sheet.getCell('A5').font = { name: 'Times New Roman', italic: true, color: { argb: 'FF64748B' } };
      return;
    }

    // Row 5: Main Questions & Super-Headers
    // Row 6: Subquestions & Column Titles
    const row5 = sheet.getRow(5);
    const row6 = sheet.getRow(6);
    row5.height = 24;
    row6.height = 22;

    // Fixed Left Columns
    sheet.getCell('A5').value = 'Sl. No.';
    sheet.mergeCells('A5:A6');
    sheet.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('A5').font = { name: 'Times New Roman', bold: true, size: 11 };
    sheet.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    sheet.getColumn(1).width = 8;

    sheet.getCell('B5').value = 'USN';
    sheet.mergeCells('B5:B6');
    sheet.getCell('B5').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('B5').font = { name: 'Times New Roman', bold: true, size: 11 };
    sheet.getCell('B5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    sheet.getColumn(2).width = 18;

    sheet.getCell('C5').value = 'Student Name';
    sheet.mergeCells('C5:C6');
    sheet.getCell('C5').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('C5').font = { name: 'Times New Roman', bold: true, size: 11 };
    sheet.getCell('C5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    sheet.getColumn(3).width = 34;

    let colIdx = 4; // Start at column D
    const subquestionColMap: Record<string, number> = {}; // key: `${qId}___${subId}` => colIdx
    const qTotalColMap: Record<string, number> = {}; // key: qId => colIdx

    for (const q of config.questionPattern) {
      const startCol = colIdx;
      for (const sub of q.subquestions) {
        const cell6 = row6.getCell(colIdx);
        cell6.value = `${sub.label} (${Number.isInteger(Number(sub.maxMarks)) ? Math.round(Number(sub.maxMarks)) : sub.maxMarks}M)`;
        cell6.alignment = { horizontal: 'center', vertical: 'middle' };
        cell6.font = { name: 'Times New Roman', bold: true, size: 10 };
        cell6.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' },
        };
        sheet.getColumn(colIdx).width = 10;
        subquestionColMap[`${q.id}___${sub.id}`] = colIdx;
        colIdx++;
      }

      // Main question total column
      const totalCol = colIdx;
      const cell6Total = row6.getCell(totalCol);
      cell6Total.value = 'Total';
      cell6Total.alignment = { horizontal: 'center', vertical: 'middle' };
      cell6Total.font = { name: 'Times New Roman', bold: true, size: 10, color: { argb: 'FF1E293B' } };
      cell6Total.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
      };
      sheet.getColumn(totalCol).width = 11;
      qTotalColMap[q.id] = totalCol;
      colIdx++;

      // Merge Question header across its subquestions + total
      const qStartLetter = sheet.getColumn(startCol).letter;
      const qEndLetter = sheet.getColumn(totalCol).letter;
      sheet.mergeCells(`${qStartLetter}5:${qEndLetter}5`);
      const qCell = sheet.getCell(`${qStartLetter}5`);
      qCell.value = `${q.label} (Max ${Number.isInteger(Number(q.maxMarks)) ? Math.round(Number(q.maxMarks)) : q.maxMarks}M)`;
      qCell.alignment = { horizontal: 'center', vertical: 'middle' };
      qCell.font = { name: 'Times New Roman', bold: true, size: 11, color: { argb: 'FF1E293B' } };
      qCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
      };
    }

    // Attempt rules / Best-of Group columns
    const groupColMap: Record<string, number> = {};
    if (config.attemptRules?.type === 'GROUPED_BEST_OF' && Array.isArray(config.attemptRules.groups)) {
      for (const grp of config.attemptRules.groups) {
        sheet.mergeCells(`${sheet.getColumn(colIdx).letter}5:${sheet.getColumn(colIdx).letter}6`);
        const grpCell = sheet.getCell(`${sheet.getColumn(colIdx).letter}5`);
        grpCell.value = `${grp.name}\n(Max ${Number.isInteger(Number(grp.maxMarks)) ? Math.round(Number(grp.maxMarks)) : grp.maxMarks}M)`;
        grpCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        grpCell.font = { name: 'Times New Roman', bold: true, size: 10, color: { argb: 'FF1E293B' } };
        grpCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2E8F0' },
        };
        sheet.getColumn(colIdx).width = 15;
        groupColMap[grp.id] = colIdx;
        colIdx++;
      }
    }

    // Final CIE Marks Column
    const finalCol = colIdx;
    sheet.mergeCells(`${sheet.getColumn(finalCol).letter}5:${sheet.getColumn(finalCol).letter}6`);
    const finalCell = sheet.getCell(`${sheet.getColumn(finalCol).letter}5`);
    finalCell.value = `Final ${assessmentType === 'CIE1' ? 'CIE-1' : 'CIE-2'}\n(Max ${Number.isInteger(Number(config.maximumMarks)) ? Math.round(Number(config.maximumMarks)) : config.maximumMarks}M)`;
    finalCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    finalCell.font = { name: 'Times New Roman', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    finalCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF475569' },
    };
    sheet.getColumn(finalCol).width = 16;

    // Fetch student marks from DB
    const studentMarksRecords = await StudentQuestionMarks.findAll({
      where: { assessmentConfigurationId: config.id },
    });
    const studentSummaries = await StudentAssessmentSummary.findAll({
      where: { assessmentConfigurationId: config.id },
    });

    const marksMap: Record<string, number | null> = {}; // `${studentId}___${qId}___${subId}`
    for (const r of studentMarksRecords) {
      marksMap[`${r.studentId}___${r.questionId}___${r.subquestionId}`] = r.marksObtained !== null ? Number(r.marksObtained) : null;
    }

    const summaryMap: Record<string, StudentAssessmentSummary> = {};
    for (const s of studentSummaries) {
      summaryMap[s.studentId] = s;
    }

    // Populate Student Rows (Row 7+)
    let curRowIdx = 7;
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const sRow = sheet.getRow(curRowIdx);
      sRow.height = 20;

      sRow.getCell(1).value = i + 1;
      sRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      sRow.getCell(2).value = (student.usn || student.enrollmentNumber || 'N/A').toUpperCase();
      sRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      sRow.getCell(2).font = { bold: true };

      const rawName = student.user ? `${student.user.firstName || ''} ${student.user.lastName || ''}`.trim() : 'STUDENT';
      const studentName = (rawName || 'STUDENT').toUpperCase();
      sRow.getCell(3).value = studentName;
      sRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
      sRow.getCell(3).font = { bold: true };

      const summary = summaryMap[student.id];

      // Track if student attempted any subquestions
      let studentHasAnyAttempt = false;

      // Populate Subquestion marks & Question Totals
      for (const q of config.questionPattern) {
        let qHasAttempt = false;
        for (const sub of q.subquestions) {
          const cIdx = subquestionColMap[`${q.id}___${sub.id}`];
          const markVal = marksMap[`${student.id}___${q.id}___${sub.id}`];
          const cell = sRow.getCell(cIdx);
          if (markVal !== null && markVal !== undefined) {
            cell.value = Number.isInteger(markVal) ? Math.round(markVal) : Math.round(Number(markVal));
            cell.numFmt = '0';
            qHasAttempt = true;
            studentHasAnyAttempt = true;
          } else {
            cell.value = '';
          }
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        const qTotalCol = qTotalColMap[q.id];
        const qTotalVal = summary?.rawQuestionTotals?.[q.id];
        const totalCell = sRow.getCell(qTotalCol);
        if (qHasAttempt && qTotalVal !== undefined) {
          totalCell.value = Number.isInteger(Number(qTotalVal)) ? Math.round(Number(qTotalVal)) : Math.round(Number(qTotalVal));
          totalCell.numFmt = '0';
        } else {
          totalCell.value = '';
        }
        totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
        totalCell.font = { bold: true };
      }

      // Populate Group Best-of
      if (summary?.bestOfDetails?.groups && Array.isArray(summary.bestOfDetails.groups)) {
        for (const grp of summary.bestOfDetails.groups) {
          const gCol = groupColMap[grp.groupId];
          if (gCol) {
            const gCell = sRow.getCell(gCol);
            if (studentHasAnyAttempt && grp.selectedMarks !== undefined) {
              gCell.value = Number.isInteger(Number(grp.selectedMarks)) ? Math.round(Number(grp.selectedMarks)) : Math.round(Number(grp.selectedMarks));
              gCell.numFmt = '0';
            } else {
              gCell.value = '';
            }
            gCell.alignment = { horizontal: 'center', vertical: 'middle' };
            gCell.font = { bold: true, color: { argb: 'FF1E40AF' } };
          }
        }
      }

      // Populate Final CIE Mark
      const finCell = sRow.getCell(finalCol);
      if (studentHasAnyAttempt && summary?.finalCieMarks !== undefined) {
        const finalNum = Number(summary.finalCieMarks);
        finCell.value = Number.isInteger(finalNum) ? Math.round(finalNum) : Math.round(finalNum);
        finCell.numFmt = '0';
      } else {
        finCell.value = '';
      }
      finCell.alignment = { horizontal: 'center', vertical: 'middle' };
      finCell.font = { bold: true, color: { argb: 'FF047857' } };

      curRowIdx++;
    }

    // Apply crisp visible table borders to all cells
    for (let r = 5; r < curRowIdx; r++) {
      const row = sheet.getRow(r);
      for (let c = 1; c <= finalCol; c++) {
        row.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } },
        };
      }
    }
  },

  /**
   * Generates or updates Assignment Marks worksheet
   */
  /**
   * Generates or updates Assignment Marks worksheet
   */
  async populateAssignmentSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    subjectId: string,
    semester: number,
    academicYear: string,
    departmentId: string,
    students: any[],
    deptName: string,
    subjCode: string,
    subjName: string,
    facultyName?: string
  ) {
    let sheet = workbook.getWorksheet(sheetName);
    if (sheet) workbook.removeWorksheet(sheet.id);
    sheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 5 }],
      pageSetup: { orientation: 'portrait', fitToPage: true },
    });

    const ayVariants = getAYVariants(academicYear);
    const config = await AssignmentConfiguration.findOne({
      where: {
        academicYear: ayVariants.length > 0 ? { [Op.in]: ayVariants } : academicYear,
        departmentId,
        semester,
        subjectId,
      },
    });

    // 1. Institutional Official Banner (Rows 1 - 2)
    sheet.getRow(1).height = 36;
    sheet.getRow(2).height = 36;
    embedOfficialCollegeBanner(workbook, sheet, {
      totalCols: 10,
      startCol: 1,
      startRow: 0.10,
    });

    // 2. Department & Assessment Title (Row 3, below banner)
    sheet.mergeCells('A3:J3');
    const deptCell = sheet.getCell('A3');
    deptCell.value = `Department of ${deptName} — Assignment Assessment Register`;
    deptCell.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FF1E293B' } };
    deptCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(3).height = 22;

    // 3. Academic Metadata Header (Row 4)
    sheet.mergeCells('A4:J4');
    const subCell = sheet.getCell('A4');
    subCell.value = `Faculty: ${facultyName || 'Staff'} | Subject: ${subjCode} - ${subjName} | Semester: ${semester} | Academic Year: ${academicYear} | Max Marks: ${config?.maximumMarks || 25}`;
    subCell.font = { name: 'Times New Roman', size: 10.5, bold: true, italic: true, color: { argb: 'FF475569' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(4).height = 20;

    // Columns Header (Row 5)
    const headerRow = sheet.getRow(5);
    headerRow.height = 24;

    headerRow.getCell(1).value = 'Sl. No.';
    headerRow.getCell(1).font = { name: 'Times New Roman', bold: true, size: 11 };
    sheet.getColumn(1).width = 8;
    headerRow.getCell(2).value = 'USN';
    headerRow.getCell(2).font = { name: 'Times New Roman', bold: true, size: 11 };
    sheet.getColumn(2).width = 18;
    headerRow.getCell(3).value = 'Student Name';
    headerRow.getCell(3).font = { name: 'Times New Roman', bold: true, size: 11 };
    sheet.getColumn(3).width = 34;

    const components = config?.components && config.components.length > 0
      ? config.components
      : [{ id: 'assignment', label: 'Assignment', maxMarks: 25 }];

    let colIdx = 4;
    const compColMap: Record<string, number> = {};
    for (const comp of components) {
      headerRow.getCell(colIdx).value = `${comp.label.toUpperCase()}\n(${comp.maxMarks}M)`;
      headerRow.getCell(colIdx).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      headerRow.getCell(colIdx).font = { name: 'Times New Roman', bold: true, size: 10 };
      sheet.getColumn(colIdx).width = Math.max(14, comp.label.length + 4);
      compColMap[comp.id] = colIdx;
      colIdx++;
    }

    // Assignment Total Column
    headerRow.getCell(colIdx).value = `Assignment Total\n(25M)`;
    headerRow.getCell(colIdx).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerRow.getCell(colIdx).font = { name: 'Times New Roman', bold: true, size: 11, color: { argb: 'FF1E293B' } };
    sheet.getColumn(colIdx).width = 18;
    const scaledTotalCol = colIdx;

    for (let c = 1; c <= colIdx; c++) {
      headerRow.getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: c === scaledTotalCol ? 'FFCBD5E1' : 'FFE2E8F0' },
      };
      if (!headerRow.getCell(c).font) {
        headerRow.getCell(c).font = { name: 'Times New Roman', bold: true, size: 11 };
      }
    }

    // Fetch Assignment marks
    let assignmentMarks: StudentAssignmentMarks[] = [];
    let assignmentSummaries: StudentAssignmentSummary[] = [];
    if (config) {
      assignmentMarks = await StudentAssignmentMarks.findAll({
        where: { assignmentConfigurationId: config.id },
      });
      assignmentSummaries = await StudentAssignmentSummary.findAll({
        where: { assignmentConfigurationId: config.id },
      });
    }

    const marksMap: Record<string, number | null> = {};
    for (const r of assignmentMarks) {
      marksMap[`${r.studentId}___${r.componentId}`] = r.marksObtained !== null ? Number(r.marksObtained) : null;
    }
    const sumMap: Record<string, StudentAssignmentSummary> = {};
    for (const s of assignmentSummaries) {
      sumMap[s.studentId] = s;
    }

    // Populate rows
    let curRow = 6;
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const r = sheet.getRow(curRow);
      r.height = 20;

      r.getCell(1).value = i + 1;
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      r.getCell(2).value = (student.usn || student.enrollmentNumber || 'N/A').toUpperCase();
      r.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      r.getCell(2).font = { bold: true };

      const rawName = student.user ? `${student.user.firstName || ''} ${student.user.lastName || ''}`.trim() : 'STUDENT';
      const studentName = (rawName || 'STUDENT').toUpperCase();
      r.getCell(3).value = studentName;
      r.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
      r.getCell(3).font = { bold: true };

      for (const comp of components) {
        const cIdx = compColMap[comp.id];
        const rawVal = marksMap[`${student.id}___${comp.id}`];
        if (rawVal !== null && rawVal !== undefined) {
          const num = Number(rawVal);
          r.getCell(cIdx).value = Number.isInteger(num) ? Math.round(num) : Math.round(num);
          r.getCell(cIdx).numFmt = '0';
        } else {
          r.getCell(cIdx).value = '';
        }
        r.getCell(cIdx).alignment = { horizontal: 'center', vertical: 'middle' };
      }

      const summary = sumMap[student.id];
      if (summary?.scaledTotal !== undefined && summary?.scaledTotal !== null) {
        const scN = Number(summary.scaledTotal);
        r.getCell(scaledTotalCol).value = Number.isInteger(scN) ? Math.round(scN) : Math.round(scN);
        r.getCell(scaledTotalCol).numFmt = '0';
      } else {
        r.getCell(scaledTotalCol).value = '';
      }
      r.getCell(scaledTotalCol).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(scaledTotalCol).font = { bold: true, color: { argb: 'FF581C87' } };

      curRow++;
    }

    for (let r = 5; r < curRow; r++) {
      const row = sheet.getRow(r);
      for (let c = 1; c <= colIdx; c++) {
        row.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } },
        };
      }
    }
  },

  /**
   * Generates or updates Final Internal Marks worksheet
   */
  async populateFinalInternalSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    subjectId: string,
    semester: number,
    academicYear: string,
    departmentId: string,
    students: any[],
    deptName: string,
    subjCode: string,
    subjName: string,
    facultyName?: string
  ) {
    let sheet = workbook.getWorksheet(sheetName);
    if (sheet) workbook.removeWorksheet(sheet.id);
    sheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 5 }],
      pageSetup: { orientation: 'portrait', fitToPage: true },
    });

    // 1. Institutional Official Banner (Rows 1 - 2)
    sheet.getRow(1).height = 36;
    sheet.getRow(2).height = 36;
    embedOfficialCollegeBanner(workbook, sheet, {
      totalCols: 10,
      startCol: 1,
      startRow: 0.10,
    });

    // 2. Department & Assessment Title (Row 3, below banner)
    sheet.mergeCells('A3:I3');
    const deptCell = sheet.getCell('A3');
    deptCell.value = `Department of ${deptName} — Final Continuous Internal Evaluation (CIE) Marks Statement`;
    deptCell.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FF1E293B' } };
    deptCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(3).height = 22;

    // 3. Academic Metadata Header (Row 4)
    sheet.mergeCells('A4:I4');
    const subCell = sheet.getCell('A4');
    subCell.value = `Faculty: ${facultyName || 'Staff'} | Subject: ${subjCode} - ${subjName} | Semester: ${semester} | Academic Year: ${academicYear} | Max Final CIE Marks: 50`;
    subCell.font = { name: 'Times New Roman', size: 10.5, bold: true, italic: true, color: { argb: 'FF475569' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(4).height = 20;

    // Columns Header (Row 5)
    const headerRow = sheet.getRow(5);
    headerRow.height = 24;

    const headers = [
      { label: 'Sl. No.', width: 8 },
      { label: 'USN', width: 18 },
      { label: 'Student Name', width: 34 },
      { label: 'CIE-1 (50M)', width: 14 },
      { label: 'CIE-2 (50M)', width: 14 },
      { label: 'CIE Avg (50M)', width: 15 },
      { label: 'Scaled Down (25M)', width: 18 },
      { label: 'Assignment (25M)', width: 16 },
      { label: 'Final Internal (50M)', width: 20 },
    ];

    for (let c = 0; c < headers.length; c++) {
      const cell = headerRow.getCell(c + 1);
      cell.value = headers[c].label;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { name: 'Times New Roman', bold: true, size: 11, color: { argb: c === 8 ? 'FFFFFFFF' : 'FF1E293B' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: c === 8 ? 'FF475569' : 'FFE2E8F0' },
      };
      sheet.getColumn(c + 1).width = headers[c].width;
    }

    const ayVariants = getAYVariants(academicYear);
    const ayClause = ayVariants.length > 0 ? { [Op.in]: ayVariants } : academicYear;

    // 1. CIE-1 Summary
    const cie1Config = await AssessmentConfiguration.findOne({
      where: { academicYear: ayClause, departmentId, semester, subjectId, assessmentType: 'CIE1' },
    });
    const cie1Summaries = cie1Config
      ? await StudentAssessmentSummary.findAll({ where: { assessmentConfigurationId: cie1Config.id } })
      : [];
    const cie1Map = new Map<string, number>();
    for (const s of cie1Summaries) {
      if (s.finalCieMarks !== null && s.finalCieMarks !== undefined) {
        cie1Map.set(s.studentId, Number(s.finalCieMarks));
      }
    }

    // 2. CIE-2 Summary
    const cie2Config = await AssessmentConfiguration.findOne({
      where: { academicYear: ayClause, departmentId, semester, subjectId, assessmentType: 'CIE2' },
    });
    const cie2Summaries = cie2Config
      ? await StudentAssessmentSummary.findAll({ where: { assessmentConfigurationId: cie2Config.id } })
      : [];
    const cie2Map = new Map<string, number>();
    for (const s of cie2Summaries) {
      if (s.finalCieMarks !== null && s.finalCieMarks !== undefined) {
        cie2Map.set(s.studentId, Number(s.finalCieMarks));
      }
    }

    // 3. Assignment Summary
    const assignConfig = await AssignmentConfiguration.findOne({
      where: { academicYear: ayClause, departmentId, semester, subjectId },
    });
    const assignSummaries = assignConfig
      ? await StudentAssignmentSummary.findAll({ where: { assignmentConfigurationId: assignConfig.id } })
      : [];
    const assignScaledMap = new Map<string, number>();
    for (const a of assignSummaries) {
      if (a.scaledTotal !== null && a.scaledTotal !== undefined) {
        assignScaledMap.set(a.studentId, Number(a.scaledTotal));
      }
    }

    // 4. Saved Final Internal Marks
    const finalRecords = await FinalInternalMarks.findAll({
      where: { academicYear: ayClause, departmentId, semester, subjectId },
    });
    const finalMap: Record<string, FinalInternalMarks> = {};
    for (const r of finalRecords) {
      finalMap[r.studentId] = r;
    }

    const policy = {
      cieRule: 'AVERAGE' as 'AVERAGE' | 'BEST_OF',
      cieWeight: 50,
      assignmentWeight: 25,
      finalMaxMarks: 50,
      scalingFormula: 'STANDARD_VTU_50' as 'STANDARD_VTU_50' | 'DIRECT_SUM' | 'CUSTOM',
    };

    const formatNum = (v: any) => {
      if (v === null || v === undefined || v === '') return '';
      const n = Number(v);
      if (isNaN(n)) return '';
      return Number.isInteger(n) ? Math.round(n) : Math.round(n);
    };

    let curRow = 6;
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const r = sheet.getRow(curRow);
      r.height = 20;

      r.getCell(1).value = i + 1;
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      r.getCell(2).value = (student.usn || student.enrollmentNumber || 'N/A').toUpperCase();
      r.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      r.getCell(2).font = { bold: true };

      const rawName = student.user ? `${student.user.firstName || ''} ${student.user.lastName || ''}`.trim() : 'STUDENT';
      const studentName = (rawName || 'STUDENT').toUpperCase();
      r.getCell(3).value = studentName;
      r.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
      r.getCell(3).font = { bold: true };

      const rec = finalMap[student.id];
      const c1 = rec?.cie1Marks !== null && rec?.cie1Marks !== undefined
        ? Number(rec.cie1Marks)
        : (cie1Map.has(student.id) ? cie1Map.get(student.id)! : null);

      const c2 = rec?.cie2Marks !== null && rec?.cie2Marks !== undefined
        ? Number(rec.cie2Marks)
        : (cie2Map.has(student.id) ? cie2Map.get(student.id)! : null);

      const aScaled = rec?.assignmentScaledMarks !== null && rec?.assignmentScaledMarks !== undefined
        ? Number(rec.assignmentScaledMarks)
        : (assignScaledMap.has(student.id) ? assignScaledMap.get(student.id)! : null);

      const calc = calculateFinalInternalMarks(c1, c2, aScaled, policy);

      const cieAvg = rec?.cieAverageOrPolicyResult !== null && rec?.cieAverageOrPolicyResult !== undefined
        ? Number(rec.cieAverageOrPolicyResult)
        : calc.cieResult;

      const scaled25 = calc.cieScaled25;

      const finalVal = rec?.finalInternalMarks !== null && rec?.finalInternalMarks !== undefined
        ? Number(rec.finalInternalMarks)
        : calc.finalInternalMarks;

      const val4 = formatNum(c1);
      r.getCell(4).value = val4;
      r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      if (val4 !== '') r.getCell(4).numFmt = '0';

      const val5 = formatNum(c2);
      r.getCell(5).value = val5;
      r.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      if (val5 !== '') r.getCell(5).numFmt = '0';

      const val6 = formatNum(cieAvg);
      r.getCell(6).value = val6;
      r.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(6).font = { bold: true };
      if (val6 !== '') r.getCell(6).numFmt = '0';

      const val7 = formatNum(scaled25);
      r.getCell(7).value = val7;
      r.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(7).font = { bold: true, color: { argb: 'FF2563EB' } };
      if (val7 !== '') r.getCell(7).numFmt = '0';

      const val8 = formatNum(aScaled);
      r.getCell(8).value = val8;
      r.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
      if (val8 !== '') r.getCell(8).numFmt = '0';

      const val9 = formatNum(finalVal);
      r.getCell(9).value = val9;
      r.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(9).font = { bold: true, color: { argb: 'FF047857' } };
      if (val9 !== '') r.getCell(9).numFmt = '0';

      curRow++;
    }

    for (let r = 5; r < curRow; r++) {
      const row = sheet.getRow(r);
      for (let c = 1; c <= headers.length; c++) {
        row.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } },
        };
      }
    }
  },

  /**
   * Generates or updates External Examination Marks worksheet
   */
  async populateExternalMarksSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    subjectId: string,
    semester: number,
    academicYear: string,
    departmentId: string,
    students: any[],
    deptName: string,
    subjCode: string,
    subjName: string,
    facultyName?: string
  ) {
    let sheet = workbook.getWorksheet(sheetName);
    if (sheet) workbook.removeWorksheet(sheet.id);
    sheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 5 }],
      pageSetup: { orientation: 'portrait', fitToPage: true },
    });

    // 1. Institutional Official Banner (Rows 1 - 2)
    sheet.getRow(1).height = 36;
    sheet.getRow(2).height = 36;
    embedOfficialCollegeBanner(workbook, sheet, {
      totalCols: 8,
      startCol: 1,
      startRow: 0.10,
    });

    // 2. Department & Assessment Title (Row 3, below banner)
    sheet.mergeCells('A3:G3');
    const deptCell = sheet.getCell('A3');
    deptCell.value = `Department of ${deptName} — VTU External Semester Examination Marks`;
    deptCell.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FF1E293B' } };
    deptCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(3).height = 22;

    // 3. Academic Metadata Header (Row 4)
    sheet.mergeCells('A4:G4');
    const subCell = sheet.getCell('A4');
    subCell.value = `Faculty: ${facultyName || 'Staff'} | Subject: ${subjCode} - ${subjName} | Semester: ${semester} | Academic Year: ${academicYear}`;
    subCell.font = { name: 'Times New Roman', size: 10.5, bold: true, italic: true, color: { argb: 'FF475569' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(4).height = 20;

    const headerRow = sheet.getRow(5);
    headerRow.height = 24;

    const headers = [
      { label: 'Sl. No.', width: 8 },
      { label: 'USN', width: 18 },
      { label: 'Student Name', width: 34 },
      { label: 'Final Internal (50M)', width: 22 },
      { label: 'External Marks', width: 18 },
      { label: 'Max External Marks', width: 20 },
      { label: 'Status', width: 16 },
    ];

    for (let c = 0; c < headers.length; c++) {
      const cell = headerRow.getCell(c + 1);
      cell.value = headers[c].label;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { name: 'Times New Roman', bold: true, size: 11, color: { argb: c === 3 ? 'FFFFFFFF' : 'FF1E293B' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: c === 3 ? 'FF475569' : 'FFE2E8F0' },
      };
      sheet.getColumn(c + 1).width = headers[c].width;
    }

    const ayVariants = getAYVariants(academicYear);
    const ayClause = ayVariants.length > 0 ? { [Op.in]: ayVariants } : academicYear;

    // Fetch CIE-1, CIE-2, Assignment, and Final Internal data for live Final Internal matching
    const cie1Config = await AssessmentConfiguration.findOne({
      where: { academicYear: ayClause, departmentId, semester, subjectId, assessmentType: 'CIE1' },
    });
    const cie1Summaries = cie1Config
      ? await StudentAssessmentSummary.findAll({ where: { assessmentConfigurationId: cie1Config.id } })
      : [];
    const cie1Map = new Map<string, number>();
    for (const s of cie1Summaries) {
      if (s.finalCieMarks !== null && s.finalCieMarks !== undefined) {
        cie1Map.set(s.studentId, Number(s.finalCieMarks));
      }
    }

    const cie2Config = await AssessmentConfiguration.findOne({
      where: { academicYear: ayClause, departmentId, semester, subjectId, assessmentType: 'CIE2' },
    });
    const cie2Summaries = cie2Config
      ? await StudentAssessmentSummary.findAll({ where: { assessmentConfigurationId: cie2Config.id } })
      : [];
    const cie2Map = new Map<string, number>();
    for (const s of cie2Summaries) {
      if (s.finalCieMarks !== null && s.finalCieMarks !== undefined) {
        cie2Map.set(s.studentId, Number(s.finalCieMarks));
      }
    }

    const assignConfig = await AssignmentConfiguration.findOne({
      where: { academicYear: ayClause, departmentId, semester, subjectId },
    });
    const assignSummaries = assignConfig
      ? await StudentAssignmentSummary.findAll({ where: { assignmentConfigurationId: assignConfig.id } })
      : [];
    const assignScaledMap = new Map<string, number>();
    for (const a of assignSummaries) {
      if (a.scaledTotal !== null && a.scaledTotal !== undefined) {
        assignScaledMap.set(a.studentId, Number(a.scaledTotal));
      }
    }

    const finalRecords = await FinalInternalMarks.findAll({
      where: { academicYear: ayClause, departmentId, semester, subjectId },
    });
    const finalMap: Record<string, FinalInternalMarks> = {};
    for (const r of finalRecords) {
      finalMap[r.studentId] = r;
    }

    const policy = {
      cieRule: 'AVERAGE' as 'AVERAGE' | 'BEST_OF',
      cieWeight: 50,
      assignmentWeight: 25,
      finalMaxMarks: 50,
      scalingFormula: 'STANDARD_VTU_50' as 'STANDARD_VTU_50' | 'DIRECT_SUM' | 'CUSTOM',
    };

    const extRecords = await ExternalExaminationMarks.findAll({
      where: {
        academicYear: ayClause,
        departmentId,
        semester,
        subjectId,
      },
    });
    const extMap: Record<string, ExternalExaminationMarks> = {};
    for (const r of extRecords) {
      extMap[r.studentId] = r;
    }

    let curRow = 6;
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const r = sheet.getRow(curRow);
      r.height = 20;

      // 1. Sl. No.
      r.getCell(1).value = i + 1;
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      // 2. USN
      r.getCell(2).value = (student.usn || student.enrollmentNumber || 'N/A').toUpperCase();
      r.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      r.getCell(2).font = { bold: true };

      // 3. Student Name
      const rawName = student.user ? `${student.user.firstName || ''} ${student.user.lastName || ''}`.trim() : 'STUDENT';
      const studentName = (rawName || 'STUDENT').toUpperCase();
      r.getCell(3).value = studentName;
      r.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
      r.getCell(3).font = { bold: true };

      // 4. Final Internal (50M) - placed after Student Name
      const recFinal = finalMap[student.id];
      const c1 = recFinal?.cie1Marks !== null && recFinal?.cie1Marks !== undefined
        ? Number(recFinal.cie1Marks)
        : (cie1Map.has(student.id) ? cie1Map.get(student.id)! : null);

      const c2 = recFinal?.cie2Marks !== null && recFinal?.cie2Marks !== undefined
        ? Number(recFinal.cie2Marks)
        : (cie2Map.has(student.id) ? cie2Map.get(student.id)! : null);

      const aScaled = recFinal?.assignmentScaledMarks !== null && recFinal?.assignmentScaledMarks !== undefined
        ? Number(recFinal.assignmentScaledMarks)
        : (assignScaledMap.has(student.id) ? assignScaledMap.get(student.id)! : null);

      const calc = calculateFinalInternalMarks(c1, c2, aScaled, policy);

      const finalVal = recFinal?.finalInternalMarks !== null && recFinal?.finalInternalMarks !== undefined
        ? Number(recFinal.finalInternalMarks)
        : (calc.finalInternalMarks !== null ? calc.finalInternalMarks : (c1 !== null || c2 !== null || aScaled !== null ? 0 : 0));

      const finalN = Number(finalVal);
      r.getCell(4).value = Number.isInteger(finalN) ? Math.round(finalN) : Math.round(finalN);
      r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(4).font = { bold: true, color: { argb: 'FF047857' } };
      r.getCell(4).numFmt = '0';

      // 5. External Marks
      const recExt = extMap[student.id];
      if (recExt?.externalMarks !== null && recExt?.externalMarks !== undefined) {
        const extN = Number(recExt.externalMarks);
        r.getCell(5).value = Number.isInteger(extN) ? Math.round(extN) : Math.round(extN);
        r.getCell(5).numFmt = '0';
      } else {
        r.getCell(5).value = '';
      }
      r.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

      // 6. Max External Marks
      const maxExt = recExt?.maximumMarks !== null && recExt?.maximumMarks !== undefined ? Number(recExt.maximumMarks) : 100;
      r.getCell(6).value = Number.isInteger(maxExt) ? Math.round(maxExt) : Math.round(maxExt);
      r.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(6).numFmt = '0';

      // 7. Status (VTU Scheme Passing Evaluation)
      const isLabOrPractical = Boolean(
        (subjName && (subjName.toUpperCase().includes('LAB') || subjName.toUpperCase().includes('PRACTICAL'))) ||
        (subjCode && (subjCode.toUpperCase().includes('L') || subjCode.toUpperCase().includes('LAB')))
      );
      const vtuResult = calculateVtuPassingStatus(
        finalVal,
        recExt?.externalMarks !== null && recExt?.externalMarks !== undefined ? Number(recExt.externalMarks) : null,
        maxExt,
        isLabOrPractical
      );
      const statusCell = r.getCell(7);
      statusCell.value = vtuResult.status;
      statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (vtuResult.status === 'PASS') {
        statusCell.font = { name: 'Times New Roman', bold: true, color: { argb: 'FF047857' } };
      } else if (vtuResult.status === 'FAIL') {
        statusCell.font = { name: 'Times New Roman', bold: true, color: { argb: 'FFE11D48' } };
      } else {
        statusCell.font = { name: 'Times New Roman', color: { argb: 'FF64748B' } };
      }

      curRow++;
    }

    for (let r = 5; r < curRow; r++) {
      const row = sheet.getRow(r);
      for (let c = 1; c <= headers.length; c++) {
        row.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } },
        };
      }
    }
  },
};

export default bitwiseMarksExcelService;

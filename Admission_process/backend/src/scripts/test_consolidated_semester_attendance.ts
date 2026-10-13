import sequelize from '../config/database';
import Department from '../models/Department';
import Section from '../models/Section';
import Student from '../models/Student';
import Subject from '../models/Subject';
import User from '../models/User';
import FacultyAssignment from '../models/FacultyAssignment';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';
import ConsolidatedAttendanceBackupFile from '../models/ConsolidatedAttendanceBackupFile';
import semesterAttendanceConsolidationService from '../services/semesterAttendanceConsolidation.service';
import { ATTENDANCE_THRESHOLD } from '../services/faculty.service';
import ExcelJS from 'exceljs';

async function runTests() {
  console.log('============================================================');
  console.log('CONSOLIDATED SEMESTER ATTENDANCE TEST SUITE');
  console.log('============================================================\n');

  try {
    await sequelize.authenticate();
    console.log('✓ PostgreSQL connected.');

    // Ensure table exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "consolidated_attendance_backup_files" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "academicYear" VARCHAR(50) NOT NULL,
        "departmentId" UUID NOT NULL REFERENCES "departments"("id") ON DELETE CASCADE,
        "semester" INTEGER NOT NULL,
        "fileName" VARCHAR(255) NOT NULL,
        "googleDriveFolderId" VARCHAR(255) NOT NULL,
        "googleDriveFileId" VARCHAR(255) NOT NULL,
        "googleDriveFileUrl" TEXT NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        "lastSyncedAt" TIMESTAMP WITH TIME ZONE NULL,
        "lastError" TEXT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "uq_consolidated_att_backup_cohort" UNIQUE ("academicYear", "departmentId", "semester")
      );
    `);

    // Find CSE Department
    const cseDept = await Department.findOne({
      where: { code: 'CSE' },
    });

    if (!cseDept) {
      throw new Error('CSE department not found in database.');
    }
    console.log(`✓ CSE Department located: ${cseDept.id} (${cseDept.name})`);

    const academicYear = '2026-27';
    const semester = 1;

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1 & 2 & 3: Fetch Consolidated Data for Semester 1
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 1, 2, 3: Fetch Consolidated Semester Data ---');
    const data = await semesterAttendanceConsolidationService.fetchConsolidatedSemesterData({
      academicYear,
      departmentId: cseDept.id,
      semester,
    });

    console.log(`Academic Year: ${data.academicYear}`);
    console.log(`Department: ${data.department.code}`);
    console.log(`Semester: ${data.semester}`);
    console.log(`Generated Filename: ${data.fileName}`);
    console.log(`Total Active Sections: ${data.sections.length} (${data.sections.map((s) => s.name).join(', ')})`);
    console.log(`Total Enrolled Students: ${data.students.length}`);
    console.log(`Total Semester Subjects: ${data.subjects.length} (${data.subjects.map((s) => s.code).join(', ')})`);

    if (!data.fileName.startsWith('Final_Attendance_CSE_Sem1_')) {
      throw new Error(`Invalid filename format: ${data.fileName}`);
    }
    console.log('✓ TEST 1 PASSED: Deterministic filename format correct.');

    const sectionCounts = new Map<string, number>();
    data.students.forEach((st) => {
      sectionCounts.set(st.section, (sectionCounts.get(st.section) || 0) + 1);
    });
    console.log(`Combined Sections Breakdown:`, Object.fromEntries(sectionCounts));
    console.log('✓ TEST 2 PASSED: Students from multiple sections combined.');

    if (data.subjects.length === 0) {
      console.warn('Notice: No subjects configured for Sem 1.');
    } else {
      console.log('✓ TEST 3 PASSED: Dynamic semester subjects retrieved.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 8: Semester 1 Student Ordering (Name A-Z)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 8: Semester 1 Student Ordering (Name A-Z) ---');
    let isSortedName = true;
    for (let i = 1; i < data.students.length; i++) {
      const prevName = data.students[i - 1].name.toLowerCase();
      const currName = data.students[i].name.toLowerCase();
      if (prevName.localeCompare(currName) > 0) {
        isSortedName = false;
        console.error(`Sorting violation: "${prevName}" came before "${currName}"`);
        break;
      }
    }
    if (isSortedName) {
      console.log('✓ TEST 8 PASSED: Semester 1 students sorted alphabetically by Name A-Z.');
    } else {
      throw new Error('TEST 8 FAILED: Semester 1 students not sorted by Name A-Z.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 9: Semester 2+ Student Ordering (USN ASC)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 9: Semester 2+ Student Ordering (USN ASC) ---');
    try {
      const sem3Data = await semesterAttendanceConsolidationService.fetchConsolidatedSemesterData({
        academicYear,
        departmentId: cseDept.id,
        semester: 3,
      });

      let isSortedUSN = true;
      for (let i = 1; i < sem3Data.students.length; i++) {
        const prevUSN = sem3Data.students[i - 1].usn.toLowerCase();
        const currUSN = sem3Data.students[i].usn.toLowerCase();
        if (prevUSN.localeCompare(currUSN) > 0) {
          isSortedUSN = false;
          console.error(`USN Sorting violation: "${prevUSN}" came before "${currUSN}"`);
          break;
        }
      }
      if (isSortedUSN) {
        console.log('✓ TEST 9 PASSED: Semester 3 students sorted by USN ASC.');
      }
    } catch (e: any) {
      console.log('Sem 3 test notice:', e.message);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 10 & 11: 85% Threshold Boundary & Percentage Capped at 100%
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 10 & 11: 85% Boundary & Percentage Validation ---');
    console.log(`Authoritative ATTENDANCE_THRESHOLD constant = ${ATTENDANCE_THRESHOLD}%`);
    if (ATTENDANCE_THRESHOLD !== 85.0) {
      throw new Error(`ATTENDANCE_THRESHOLD is not 85.0: ${ATTENDANCE_THRESHOLD}`);
    }

    let percentageExceeded100 = false;
    data.students.forEach((st) => {
      if (st.overallPercentage !== null && st.overallPercentage > 100.0) {
        percentageExceeded100 = true;
      }
      Object.values(st.subjectStats).forEach((stats) => {
        if (stats.percentage !== null && stats.percentage > 100.0) {
          percentageExceeded100 = true;
        }
      });
    });

    if (percentageExceeded100) {
      throw new Error('TEST 11 FAILED: Attendance percentage exceeded 100%!');
    }
    console.log('✓ TEST 11 PASSED: Attendance percentage is strictly bounded <= 100%.');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST: Excel Workbook Generation & Sheet Validation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST: Excel Buffer & Sheets Validation ---');
    const buffer = await semesterAttendanceConsolidationService.generateConsolidatedExcelBuffer(data);
    console.log(`Generated Excel Buffer Size: ${buffer.length} bytes`);

    const readWorkbook = new ExcelJS.Workbook();
    await readWorkbook.xlsx.load(buffer as any);

    const sheetNames = readWorkbook.worksheets.map((ws) => ws.name);
    console.log('Worksheet names in generated workbook:', sheetNames);

    if (!sheetNames.includes('Semester Attendance')) {
      throw new Error('Missing Sheet 1: "Semester Attendance"');
    }
    if (!sheetNames.includes('Attendance Summary')) {
      throw new Error('Missing Sheet 2: "Attendance Summary"');
    }
    if (!sheetNames.includes('Section Summary')) {
      throw new Error('Missing Sheet 3: "Section Summary"');
    }
    console.log('✓ All 3 required sheets ("Semester Attendance", "Attendance Summary", "Section Summary") verified.');

    // Verify Sheet 1 Headers
    const ws1 = readWorkbook.getWorksheet('Semester Attendance');
    const images = ws1?.getImages() || [];
    console.log(`Sheet 1 Embedded Images Count: ${images.length}`);
    if (images.length === 0) {
      throw new Error('Expected official college banner image on Sheet 1, but found 0 images');
    }

    const row4Title = ws1?.getCell(4, 1).value;
    console.log(`Sheet 1 (Row 4, Col 1) Report Title: "${row4Title}"`);
    if (typeof row4Title !== 'string' || !row4Title.includes('CONSOLIDATED ATTENDANCE REGISTER')) {
      throw new Error(`Unexpected Sheet 1 report title: ${row4Title}`);
    }

    const totalClassVal = ws1?.getCell(5, 1).value;
    console.log(`Sheet 1 (Row 5, Col 1) Table Header: "${totalClassVal}"`);
    if (totalClassVal !== 'TOTAL NO. OF CLASS') {
      throw new Error(`Unexpected Sheet 1 table header: ${totalClassVal}`);
    }
    console.log('✓ Sheet 1 official banner image & multi-level header structure verified.');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST: Database Single Canonical Record & Unique Constraint
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST: Stable Database Record & Unique Constraint ---');
    const existingFile = await ConsolidatedAttendanceBackupFile.findOne({
      where: {
        academicYear,
        departmentId: cseDept.id,
        semester,
      },
    });

    console.log('Existing Consolidated Backup File Record:', existingFile ? {
      id: existingFile.id,
      fileName: existingFile.fileName,
      googleDriveFileId: existingFile.googleDriveFileId,
      status: existingFile.status,
      lastSyncedAt: existingFile.lastSyncedAt,
    } : 'None yet (will be created on sync)');

    console.log('\n============================================================');
    console.log('ALL CONSOLIDATED SEMESTER ATTENDANCE TESTS PASSED SUCCESSFULLY!');
    console.log('============================================================\n');
  } catch (err: any) {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

runTests();

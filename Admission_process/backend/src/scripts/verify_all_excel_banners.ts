import ExcelJS from 'exceljs';
import { semesterAttendanceConsolidationService } from '../services/semesterAttendanceConsolidation.service';
import { attendanceExcelService } from '../services/attendanceExcel.service';
import { bitwiseMarksExcelService } from '../services/bitwiseMarksExcel.service';
import Department from '../models/Department';
import Subject from '../models/Subject';
import FacultyAssignment from '../models/FacultyAssignment';
import {
  getOfficialCollegeBannerBuffer,
  OFFICIAL_BANNER_ASPECT_RATIO,
} from '../utils/excelBranding.util';

async function runVerification() {
  console.log('================================================================');
  console.log('🔍 VERIFYING OFFICIAL COLLEGE BANNER IN ALL EXCEL EXPORTS');
  console.log('================================================================\n');

  // 1. Verify Banner Buffer Loading
  const bannerBuffer = getOfficialCollegeBannerBuffer();
  if (!bannerBuffer) {
    throw new Error('FAILED: Official college banner buffer is null!');
  }
  console.log(`✓ Official college banner loaded successfully. Size: ${bannerBuffer.length} bytes`);
  if (bannerBuffer.length !== 828233) {
    console.warn(`Note: Banner buffer size is ${bannerBuffer.length} bytes (expected 828233 bytes)`);
  }

  // 2. Locate Active Data
  const cseDept = await Department.findOne({ where: { code: 'CSE' } });
  if (!cseDept) {
    throw new Error('CSE Department not found in database');
  }

  // ─── VERIFICATION 1: Consolidated Semester Attendance Register ─────────────
  console.log('\n--- 1. Consolidated Semester Attendance Register ---');
  const consolidatedData = await semesterAttendanceConsolidationService.fetchConsolidatedSemesterData({
    academicYear: '2026-27',
    departmentId: cseDept.id,
    semester: 1,
  });
  const consolidatedBuf = await semesterAttendanceConsolidationService.generateConsolidatedExcelBuffer(consolidatedData);
  console.log(`Generated Consolidated Excel: ${consolidatedBuf.length} bytes`);

  const wb1 = new ExcelJS.Workbook();
  await wb1.xlsx.load(consolidatedBuf as any);

  const sheets1 = ['Semester Attendance', 'Attendance Summary', 'Section Summary'];
  for (const sName of sheets1) {
    const ws = wb1.getWorksheet(sName);
    if (!ws) throw new Error(`Missing worksheet: ${sName}`);

    const images = ws.getImages();
    console.log(`[${sName}] Embedded Images Count: ${images.length}`);
    if (images.length === 0) {
      throw new Error(`FAILED: No banner image in sheet ${sName}`);
    }

    const img = images[0];
    const { width, height } = (img.range as any).ext;
    const ratio = width / height;
    console.log(`[${sName}] Banner Dimensions: ${width}x${height} px (Aspect Ratio: ${ratio.toFixed(4)}, Target: ${OFFICIAL_BANNER_ASPECT_RATIO.toFixed(4)})`);
    if (Math.abs(ratio - OFFICIAL_BANNER_ASPECT_RATIO) > 0.05) {
      throw new Error(`FAILED: Banner aspect ratio distorted in ${sName} (got: ${ratio})`);
    }

    const { col, row } = (img.range as any).tl;
    console.log(`[${sName}] Banner Anchor: col=${col}, row=${row}`);

    // Check that Row 1-3 have NO duplicate college text
    const cellA1 = ws.getCell(1, 1).value;
    if (cellA1 && String(cellA1).includes('JAIN COLLEGE')) {
      throw new Error(`FAILED: Found duplicate text header in cell A1 of ${sName}`);
    }

    // Check Row 4 has the report title
    const cellA4 = ws.getCell(4, 1).value;
    console.log(`[${sName}] Row 4 Report Title: "${cellA4}"`);
    if (!cellA4 || String(cellA4).trim().length === 0) {
      throw new Error(`FAILED: Missing report title in Row 4 of ${sName}`);
    }
  }
  console.log('✓ Consolidated Attendance Register verified with official banner on all 3 sheets.');

  // ─── VERIFICATION 2: Subject/Class-wise Attendance Register ────────────────
  console.log('\n--- 2. Subject/Class-wise Attendance Register ---');
  let assignment = await FacultyAssignment.findByPk('61950ce5-d2f2-4fbf-a54d-ba62ad85f89d');
  if (!assignment) {
    assignment = await FacultyAssignment.findOne({
      where: { status: 'ACTIVE', semester: 1 },
      include: [{ model: Subject, as: 'subject' }],
    });
  }
  if (!assignment) {
    throw new Error('No active Semester 1 FacultyAssignment found');
  }

  const { buffer: classBuf, filename: classFilename } = await attendanceExcelService.generateAttendanceWorkbookBuffer(
    assignment.id
  );
  console.log(`Generated Class Attendance Excel: ${classFilename} (${classBuf.length} bytes)`);

  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(classBuf as any);

  const sheets2 = ['Attendance Register', 'Attendance Summary'];
  for (const sName of sheets2) {
    const ws = wb2.getWorksheet(sName);
    if (!ws) throw new Error(`Missing worksheet: ${sName}`);

    const images = ws.getImages();
    console.log(`[${sName}] Embedded Images Count: ${images.length}`);
    if (images.length === 0) {
      throw new Error(`FAILED: No banner image in sheet ${sName}`);
    }

    const img = images[0];
    const { width, height } = (img.range as any).ext;
    const ratio = width / height;
    console.log(`[${sName}] Banner Dimensions: ${width}x${height} px (Aspect Ratio: ${ratio.toFixed(4)})`);
    if (Math.abs(ratio - OFFICIAL_BANNER_ASPECT_RATIO) > 0.05) {
      throw new Error(`FAILED: Banner aspect ratio distorted in ${sName} (got: ${ratio})`);
    }

    const cellA1 = ws.getCell(1, 1).value;
    if (cellA1 && String(cellA1).includes('JAIN COLLEGE')) {
      throw new Error(`FAILED: Found duplicate text header in cell A1 of ${sName}`);
    }

    const cellA3 = ws.getCell(3, 1).value;
    console.log(`[${sName}] Row 3 Title: "${cellA3}"`);
    if (!cellA3 || !String(cellA3).includes('ATTENDANCE')) {
      throw new Error(`FAILED: Missing attendance title in Row 3 of ${sName}`);
    }
  }
  console.log('✓ Class-wise Attendance Register verified with official banner on all sheets.');

  // ─── VERIFICATION 3: Bitwise Marks Excel Workbook ─────────────────────────
  console.log('\n--- 3. Bitwise Marks Excel Workbook ---');
  const subject = await Subject.findOne();
  if (!subject) throw new Error('No Subject found in database');

  const { buffer: marksBuf, filename: marksFilename } = await bitwiseMarksExcelService.generateSubjectMarksWorkbook(
    subject.id,
    1,
    '2026-27',
    cseDept.id
  );
  console.log(`Generated Marks Excel: ${marksFilename} (${marksBuf.length} bytes)`);

  const wb3 = new ExcelJS.Workbook();
  await wb3.xlsx.load(marksBuf as any);

  const sheets3 = ['CIE-1 Bitwise', 'CIE-2 Bitwise', 'Assignment Marks', 'Final Internal Marks', 'External Marks'];
  for (const sName of sheets3) {
    const ws = wb3.getWorksheet(sName);
    if (!ws) throw new Error(`Missing worksheet: ${sName}`);

    const images = ws.getImages();
    console.log(`[${sName}] Embedded Images Count: ${images.length}`);
    if (images.length === 0) {
      throw new Error(`FAILED: No banner image in sheet ${sName}`);
    }

    const img = images[0];
    const { width, height } = (img.range as any).ext;
    const ratio = width / height;
    console.log(`[${sName}] Banner Dimensions: ${width}x${height} px (Aspect Ratio: ${ratio.toFixed(4)})`);
    if (Math.abs(ratio - OFFICIAL_BANNER_ASPECT_RATIO) > 0.05) {
      throw new Error(`FAILED: Banner aspect ratio distorted in ${sName}`);
    }

    const cellA1 = ws.getCell(1, 1).value;
    if (cellA1 && String(cellA1).includes('JAIN COLLEGE')) {
      throw new Error(`FAILED: Found duplicate text header in cell A1 of ${sName}`);
    }

    const cellA3 = ws.getCell(3, 1).value;
    console.log(`[${sName}] Row 3 Department/Assessment Title: "${cellA3}"`);
    if (!cellA3 || String(cellA3).trim().length === 0) {
      throw new Error(`FAILED: Missing assessment title in Row 3 of ${sName}`);
    }

    const cellA4 = ws.getCell(4, 1).value;
    console.log(`[${sName}] Row 4 Metadata: "${cellA4}"`);
    if (!cellA4 || !String(cellA4).includes('Faculty:')) {
      throw new Error(`FAILED: Missing metadata in Row 4 of ${sName}`);
    }
  }
  console.log('✓ Bitwise Marks Workbook verified with official banner on all 5 sheets.');

  console.log('\n================================================================');
  console.log('🎉 ALL EXCEL EXPORTS ACROSS THE ERP HAVE BEEN FULLY VERIFIED!');
  console.log('================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  });

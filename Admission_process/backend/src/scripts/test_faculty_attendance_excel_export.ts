import db from '../config/database';
import User from '../models/User';
import Student from '../models/Student';
import FacultyAssignment from '../models/FacultyAssignment';
import AttendanceSession from '../models/AttendanceSession';
import AttendanceRecord from '../models/AttendanceRecord';
import Subject from '../models/Subject';
import Section from '../models/Section';
import AcademicYear from '../models/AcademicYear';
import { facultyService } from '../services/faculty.service';
import ExcelJS from 'exceljs';

async function runExcelExportVerification() {
  console.log('================================================================');
  console.log('=== VERIFYING FACULTY ATTENDANCE EXCEL EXPORT (EXCELJS) ===');
  console.log('================================================================\n');

  try {
    await db.authenticate();
    console.log('✓ Database connection authenticated.');

    // 1. Find an assignment with attendance sessions
    const sessions = await AttendanceSession.findAll({
      order: [['attendanceDate', 'ASC'], ['sessionPeriod', 'ASC']],
    });

    console.log(`Found ${sessions.length} total AttendanceSessions in database.`);

    let targetAssignmentId: string | null = null;
    let targetFacultyUserId: string | null = null;

    const activeAssignment = await FacultyAssignment.findOne({
      where: { status: 'ACTIVE', semester: 1 },
    });
    if (!activeAssignment) {
      throw new Error('No active FacultyAssignment found in database!');
    }
    targetAssignmentId = activeAssignment.id;
    targetFacultyUserId = activeAssignment.userId;

    console.log(`Selected Target Assignment ID: ${targetAssignmentId}, Faculty User ID: ${targetFacultyUserId}`);

    const assignment = await FacultyAssignment.findByPk(targetAssignmentId, {
      include: [
        { model: Subject, as: 'subject' },
      ],
    });

    if (!assignment) {
      throw new Error(`Assignment not found: ${targetAssignmentId}`);
    }

    console.log(`Assignment details:`);
    console.log(`- Subject: ${(assignment as any).subject?.name} (${(assignment as any).subject?.code})`);
    console.log(`- Section: ${(assignment as any).section?.name}`);
    console.log(`- Semester: ${assignment.semester}`);
    console.log(`- AY: ${(assignment as any).academicYear?.year || (assignment as any).academicYear}`);

    // 2. Execute Excel Export via Service
    console.log('\n--> Calling facultyService.exportFacultyAttendanceExcel...');
    const exportResult = await facultyService.exportFacultyAttendanceExcel(targetFacultyUserId!, targetAssignmentId);

    console.log(`✓ Export successful!`);
    console.log(`- Filename: ${exportResult.filename}`);
    console.log(`- Buffer size: ${exportResult.buffer.length} bytes`);

    // 3. Parse and inspect generated Excel workbook using ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exportResult.buffer as any);

    console.log(`\n--- Workbook Inspection ---`);
    console.log(`Total Sheets: ${workbook.worksheets.length}`);
    workbook.worksheets.forEach((ws, idx) => {
      console.log(`Sheet ${idx + 1}: "${ws.name}" (Rows: ${ws.rowCount}, Cols: ${ws.columnCount})`);
    });

    const regSheet = workbook.getWorksheet('Attendance Register');
    if (!regSheet) {
      throw new Error('FAILED: "Attendance Register" sheet missing!');
    }
    console.log('✓ Sheet 1 "Attendance Register" found.');

    const summarySheet = workbook.getWorksheet('Attendance Summary');
    if (summarySheet) {
      console.log('✓ Sheet 2 "Attendance Summary" found.');
    }

    // 4. Verify Academic Metadata Block in Sheet 1
    const images = regSheet.getImages() || [];
    console.log(`\nSheet 1 Embedded Images Count: ${images.length}`);
    if (images.length === 0) {
      throw new Error('FAILED: Expected official college banner image on Sheet 1, got 0 images');
    }

    const titleCell = regSheet.getCell('A3').value || regSheet.getCell('A2').value;
    console.log(`Title Header (Row 3): "${titleCell}"`);
    if (typeof titleCell !== 'string' || !titleCell.includes('ATTENDANCE REGISTER')) {
      throw new Error(`FAILED: Title in A3 is not ATTENDANCE REGISTER (got: ${titleCell})`);
    }

    // Print Header Info Rows (Row 3-6)
    for (let r = 3; r <= 6; r++) {
      const rowVals: string[] = [];
      regSheet.getRow(r).eachCell((cell) => {
        if (cell.value) rowVals.push(String(cell.value));
      });
      console.log(`Row ${r}: ${rowVals.join(' | ')}`);
    }

    // 5. Verify Table Header (Row 8)
    const headerRow = regSheet.getRow(8);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell) => {
      headers.push(String(cell.value));
    });

    console.log(`\nTable Headers (Row 8, Count: ${headers.length}):`);
    console.log(headers.join(' | '));

    // Mandatory initial columns
    if (headers[0] !== 'SL NO' || headers[1] !== 'USN' || headers[2] !== 'STUDENT NAME') {
      throw new Error(`FAILED: Leading headers mismatch! Expected SL NO, USN, STUDENT NAME, got: ${headers.slice(0, 3).join(', ')}`);
    }

    // Mandatory trailing columns
    const totalClassesIdx = headers.indexOf('TOTAL CLASSES');
    const attendedClassesIdx = headers.indexOf('ATTENDED CLASSES');
    const percentageIdx = headers.indexOf('PERCENTAGE');
    const eligibilityIdx = headers.indexOf('ELIGIBILITY');

    if (totalClassesIdx === -1 || attendedClassesIdx === -1 || percentageIdx === -1 || eligibilityIdx === -1) {
      throw new Error(`FAILED: Summary trailing headers missing! headers: ${headers.join(', ')}`);
    }

    console.log('✓ Column structure verified.');

    // Dynamic date columns are between index 3 and totalClassesIdx
    const dateColumns = headers.slice(3, totalClassesIdx);
    console.log(`Dynamic Date/Period Columns (${dateColumns.length}):`, dateColumns);

    // 6. Verify Views / Freeze Panes
    const views = regSheet.views || [];
    console.log('Sheet Views / Freeze panes config:', JSON.stringify(views));
    const freezeView = views.find((v: any) => v.state === 'frozen') as any;
    if (!freezeView || freezeView.ySplit !== 8 || freezeView.xSplit !== 3) {
      console.warn('WARNING: Freeze panes view differs:', freezeView);
    } else {
      console.log('✓ Freeze panes properly configured (xSplit: 3, ySplit: 8).');
    }

    // 7. Verify Student Data Rows (Row 9+)
    console.log('\n--- Verifying Student Data Rows against Database ---');
    const totalDataRows = regSheet.rowCount - 8;
    console.log(`Total Student Data Rows: ${totalDataRows}`);

    if (totalDataRows <= 0) {
      console.log('NOTE: 0 students in section or no data rows rendered.');
    } else {
      // Query raw database attendance records for comparison
      const dbSessions = await AttendanceSession.findAll({
        where: { facultyAssignmentId: targetAssignmentId },
        order: [['attendanceDate', 'ASC'], ['sessionPeriod', 'ASC']],
      });

      console.log(`Database has ${dbSessions.length} sessions for this assignment.`);

      // Sample up to 10 rows for deep verification
      const sampleLimit = Math.min(10, totalDataRows);
      for (let i = 1; i <= sampleLimit; i++) {
        const rowNum = 8 + i;
        const row = regSheet.getRow(rowNum);

        const slNo = row.getCell(1).value;
        const usn = row.getCell(2).value;
        const studentName = row.getCell(3).value;
        const totalClasses = Number(row.getCell(totalClassesIdx + 1).value);
        const attendedClasses = Number(row.getCell(attendedClassesIdx + 1).value);
        const percentageStr = String(row.getCell(percentageIdx + 1).value);
        const eligibility = String(row.getCell(eligibilityIdx + 1).value);

        // Verify SL NO
        if (slNo !== i) {
          throw new Error(`Row ${rowNum}: SL NO is ${slNo}, expected ${i}`);
        }

        // Verify date column values are strictly numeric 1 or 0
        let dateSum = 0;
        for (let c = 4; c <= totalClassesIdx; c++) {
          const val = row.getCell(c).value;
          if (val !== 0 && val !== 1) {
            throw new Error(`Row ${rowNum}, Col ${c}: Attendance value must be 1 or 0 (numeric), got: ${val} (${typeof val})`);
          }
          dateSum += (val as number);
        }

        // Verify calculations
        if (attendedClasses !== dateSum) {
          throw new Error(`Row ${rowNum}: Attended classes ${attendedClasses} does not match sum of date columns ${dateSum}`);
        }

        if (totalClasses !== dbSessions.length) {
          throw new Error(`Row ${rowNum}: Total classes ${totalClasses} does not match DB session count ${dbSessions.length}`);
        }

        const expectedPercentage = totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 100) : 0;
        if (percentageStr !== `${expectedPercentage}%`) {
          throw new Error(`Row ${rowNum}: Percentage ${percentageStr} does not match expected ${expectedPercentage}%`);
        }

        const expectedEligibility = expectedPercentage >= 85 ? 'Eligible' : 'Not Eligible';
        if (eligibility !== expectedEligibility) {
          throw new Error(`Row ${rowNum}: Eligibility ${eligibility} does not match expected ${expectedEligibility} for ${expectedPercentage}%`);
        }

        console.log(`✓ Row ${i} Verified: SL NO ${slNo} | USN ${usn} | Name: ${studentName} | Attended: ${attendedClasses}/${totalClasses} | ${percentageStr} | ${eligibility}`);
      }
    }

    console.log('\n================================================================');
    console.log('=== ALL EXCEL EXPORT SPECIFICATIONS FULLY VERIFIED! ===');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ ERROR DURING EXCEL EXPORT VERIFICATION:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runExcelExportVerification();

import { Request, Response, NextFunction } from 'express';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import UsnRegistry from '../models/UsnRegistry';
import User from '../models/User';
import Student from '../models/Student';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import Department from '../models/Department';
import db from '../config/database';
import { calculateStudentCohort } from '../utils/batchCohort.util';

/**
 * POST /api/admin/onboarding/usn-registry
 * Uploads pre-allocated USN Registry file
 */
export const uploadUSNRegistry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    let valid = 0;
    let invalid = 0;
    const errors: string[] = [];
    const registriesToCreate: any[] = [];

    for (const row of rows) {
      const usn = (row.usn || row.USN || '').toString().trim().toUpperCase();
      const studentName = (row.studentName || row.name || row.Name || '').toString().trim();
      const departmentCode = (row.departmentCode || row.department || row.Branch || '').toString().trim().toUpperCase();
      const semester = parseInt(row.semester || row.sem || '1', 10);

      if (!usn || !studentName || !departmentCode) {
        invalid++;
        errors.push(`Row missing required fields: USN=${usn}, Name=${studentName}, Dept=${departmentCode}`);
        continue;
      }

      registriesToCreate.push({
        usn,
        studentName,
        departmentCode,
        semester: isNaN(semester) ? 1 : semester,
        status: 'AVAILABLE'
      });
      valid++;
    }

    if (registriesToCreate.length > 0) {
      await UsnRegistry.bulkCreate(registriesToCreate, { 
        updateOnDuplicate: ['studentName', 'departmentCode', 'semester'] 
      });
    }

    return res.json({
      success: true,
      message: `Successfully processed USN Registry file.`,
      data: {
        total: rows.length,
        valid,
        invalid,
        errors
      }
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/onboarding/usn-registry
 * Returns registry list based on filters
 */
export const getUSNRegistry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { semester, department, status } = req.query as any;
    const where: any = {};
    if (semester) {
      where.semester = parseInt(semester, 10);
    }
    if (department) {
      where.departmentCode = department.toUpperCase();
    }
    if (status) {
      where.status = status.toUpperCase();
    }

    const list = await UsnRegistry.findAll({ 
      where, 
      order: [['usn', 'ASC']] 
    });

    return res.json({
      success: true,
      data: list
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/onboarding/students/bulk
 * Onboards students in bulk via Excel spreadsheet
 */
export const bulkUploadStudents = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const preview = req.body.preview === 'true';

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    const errors: Array<{ usn: string; name: string; reason: string }> = [];
    const validStudents: any[] = [];
    let readyToCreate = 0;
    let rejected = 0;

    // Cache departments mapping to speed up verification
    const departments = await Department.findAll();
    const deptMap = new Map<string, Department>();
    departments.forEach(d => {
      deptMap.set(d.code.toUpperCase(), d);
    });
    // Support VTU department code aliases (e.g. CI -> CSE-AIML)
    const VTU_ALIASES: Record<string, string> = {
      'CI': 'CSE-AIML',
      'CS': 'CSE',
      'EC': 'ECE',
      'CV': 'CV',
      'ME': 'ME',
      'IS': 'ISE',
      'CD': 'CSE-DS',
      'CB': 'CSBS',
      'EE': 'EEE'
    };
    for (const [vtu, branchCode] of Object.entries(VTU_ALIASES)) {
      const dept = deptMap.get(branchCode);
      if (dept && !deptMap.has(vtu)) {
        deptMap.set(vtu, dept);
      }
    }

    for (const row of rows) {
      const usn = (row.usn || row.USN || '').toString().trim().toUpperCase();
      const name = (row.studentName || row.name || row.Name || '').toString().trim();
      const email = (row.email || row.Email || '').toString().trim();
      const phone = (row.phone || row.Phone || '').toString().trim();
      const departmentCode = (row.departmentCode || row.department || row.Branch || '').toString().trim().toUpperCase();
      const semester = parseInt(row.semester || row.sem || '1', 10);
      const fatherName = (row.fatherName || row.FatherName || '').toString().trim();
      const motherName = (row.motherName || row.MotherName || '').toString().trim();
      const parentPhone = (row.parentPhone || row.ParentPhone || '').toString().trim();
      const parentEmail = (row.parentEmail || row.ParentEmail || '').toString().trim();
      const address = (row.address || row.Address || '').toString().trim();
      const dobStr = (row.dateOfBirth || row.dob || row.DOB || '').toString().trim();

      if (!usn || !name || !email || !departmentCode) {
        rejected++;
        errors.push({ usn, name, reason: 'Missing mandatory fields (USN, Name, Email, or Department)' });
        continue;
      }

      // Verify department exists
      const dept = deptMap.get(departmentCode);
      if (!dept) {
        rejected++;
        errors.push({ usn, name, reason: `Invalid department code: ${departmentCode}` });
        continue;
      }

      // Verify USN registry reservation
      const registryEntry = await UsnRegistry.findOne({ where: { usn } });
      if (!registryEntry) {
        rejected++;
        errors.push({ usn, name, reason: 'USN is not registered in pre-allocated USN registry' });
        continue;
      }
      if (registryEntry.status === 'CLAIMED') {
        rejected++;
        errors.push({ usn, name, reason: 'USN has already been claimed/onboarded' });
        continue;
      }

      // Check for user duplicate email
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        rejected++;
        errors.push({ usn, name, reason: `Email '${email}' is already in use` });
        continue;
      }

      validStudents.push({
        usn,
        name,
        email,
        phone,
        departmentId: dept.id,
        departmentCode,
        semester: isNaN(semester) ? 1 : semester,
        fatherName,
        motherName,
        parentPhone,
        parentEmail,
        address,
        dateOfBirth: dobStr ? new Date(dobStr) : null
      });
      readyToCreate++;
    }

    if (!preview && validStudents.length > 0) {
      const transaction = await db.transaction();
      try {
        const passwordHash = await bcrypt.hash('password123', 10);
        
        for (const s of validStudents) {
          const names = s.name.split(' ');
          const firstName = names[0];
          const lastName = names.slice(1).join(' ') || 'Student';

          const user = await User.create({
            username: s.usn.toLowerCase(),
            email: s.email,
            passwordHash,
            role: 'STUDENT',
            status: 'ACTIVE',
            firstName,
            lastName,
            phone: s.phone,
          }, { transaction });

          const isSem1 = Number(s.semester || 1) === 1;
          const isLateral = Number(s.semester || 1) === 3;
          const cohortInfo = calculateStudentCohort({
            academicYear: '2026-2027',
            semester: Number(s.semester || 1),
            initialSemester: isLateral ? 3 : 1,
            entrySemester: isLateral ? 3 : 1,
            admissionType: isLateral ? 'LATERAL' : 'FRESH',
            usn: s.usn,
          });
          const batchYear = cohortInfo.cohortStartYear;
          const admissionBatch = cohortInfo.batchDisplay;
          const seqStr = String(s.usn.slice(-3));
          const enrollmentNumber = s.usn;
          const rollNumber = isSem1 ? `${batchYear}${s.departmentCode}${seqStr}` : null;

          const newStudent = await Student.create({
            userId: user.id,
            usn: s.usn,
            enrollmentNumber,
            rollNumber,
            batchYear,
            admissionBatch,
            departmentId: s.departmentId,
            semester: s.semester || 1,
            dateOfBirth: s.dateOfBirth,
            address: s.address,
            fatherName: s.fatherName,
            motherName: s.motherName,
            parentPhone: s.parentPhone,
            parentEmail: s.parentEmail,
            admissionStatus: 'APPROVED',
            admissionType: isLateral ? 'LATERAL' : 'FRESH',
            initialSemester: s.semester === 3 ? 3 : 1,
            currentAcademicYear: '2026-2027',
          }, { transaction });

          await StudentAcademicEnrollment.create({
            studentId: newStudent.id,
            academicYearId: '2026-27',
            schemeId: '2025',
            departmentId: s.departmentId,
            semesterId: s.semester || 1,
            sectionId: null,
            rollNumber,
            entrySemester: s.semester === 3 ? 3 : 1,
            status: 'ACTIVE',
          }, { transaction });

          // Update registry entry status
          await UsnRegistry.update({ status: 'CLAIMED' }, { 
            where: { usn: s.usn }, 
            transaction 
          });
        }
        
        await transaction.commit();
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    }

    return res.json({
      success: true,
      message: preview 
        ? `Spreadsheet validation complete. ${readyToCreate} student records ready for upload.`
        : `Successfully onboarded ${validStudents.length} student records.`,
      data: {
        readyToCreate,
        rejected,
        errors,
        validStudents: preview ? validStudents : undefined,
        created: preview ? undefined : validStudents.length
      }
    });
  } catch (err) {
    return next(err);
  }
};

import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import Section from '../models/Section';
import Student from '../models/Student';
import StudentAcademicEnrollment from '../models/StudentAcademicEnrollment';
import Department from '../models/Department';
import User from '../models/User';
import Admission from '../models/Admission';
import AdmissionPersonalDetail from '../models/AdmissionPersonalDetail';
import AuditLog from '../models/AuditLog';
import { HttpException } from '../utils/error.util';
import logger from '../utils/logger.util';
import { findDepartmentCanonical, getBranchEquivalents } from '../utils/departmentCanonical.util';

export interface StudentAllocationInput {
  studentId: string;
  rollNumber?: string;
}

export class SectionAllocationService {
  /**
   * Helper to safely extract clean section code: 'Section A' -> 'A'
   * Guarantees that internal UUIDs are NEVER returned as section code/name.
   */
  public static getCleanSectionCode(nameOrCode: string | null | undefined): string {
    if (!nameOrCode || typeof nameOrCode !== 'string') return '—';
    const trimmed = nameOrCode.trim();
    if (!trimmed) return '—';

    // If string matches UUID pattern, reject it immediately
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      return '—';
    }

    const cleaned = trimmed
      .replace(/^(Section|Sec|Division|Div)\s*/i, '')
      .trim()
      .toUpperCase();

    return cleaned || trimmed;
  }

  /**
   * Validates that an ID is a valid UUID format before sending to PostgreSQL.
   * Prevents PostgreSQL 'invalid input syntax for type uuid' errors.
   */
  public static validateUuid(id: string | null | undefined, paramName = 'sectionId'): string {
    if (!id || typeof id !== 'string') {
      throw new HttpException('Invalid section identifier.', 400, 'INVALID_SECTION_ID');
    }
    const trimmed = id.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    if (!isUuid) {
      throw new HttpException('Invalid section identifier.', 400, 'INVALID_SECTION_ID');
    }
    return trimmed;
  }

  /**
   * Resolves a department for a branch code (e.g., 'AIML' -> 'CSE-AIML', 'CSE' -> 'CSE').
   */
  public static async findDepartmentByBranchCode(branchCode: string | null | undefined, transaction?: any): Promise<Department | null> {
    if (!branchCode || branchCode === 'ALL') return null;
    return await findDepartmentCanonical(branchCode, { transaction });
  }

  /**
   * Validates whether an authenticated HOD is authorized to view/manage a given section.
   * - AS HOD handles all Semester 1 & 2 sections across all branches.
   * - Standard HOD handles their own department sections + Semester 1 & 2 sections created for their branch.
   */
  public static async isHodAuthorizedForSection(
    section: Section,
    departmentId: string,
    dept?: Department | null,
    transaction?: any
  ): Promise<boolean> {
    if (section.departmentId === departmentId) return true;
    const currentDept = dept || (await Department.findByPk(departmentId, { ...(transaction ? { transaction } : {}) }));
    if (!currentDept) return false;

    // 1. Applied Science HOD can access all Semester 1 & 2 sections
    const isSemHandling = currentDept.type === 'SEMESTER_HANDLING' || currentDept.code === 'AS';
    if (isSemHandling && [1, 2].includes(section.semester)) {
      return true;
    }

    // 2. Department HOD (e.g. CSE HOD) can access Semester 1 & 2 sections belonging to their branch
    if ([1, 2].includes(section.semester) && section.branch) {
      const cleanBranch = section.branch.trim();
      const branchCodes = getBranchEquivalents(currentDept.code);
      if (branchCodes.some((code) => code.toUpperCase() === cleanBranch.toUpperCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Resolves a student's active section allocation.
   * Single authoritative logic across the entire system.
   */
  public static resolveStudentSection(
    student: any,
    siblingSections: Section[]
  ): {
    isAllocated: boolean;
    sectionId: string | null;
    sectionCode: string;
    sectionName: string;
  } {
    const enc = student.academicEnrollments?.[0];
    const encSecId = enc?.sectionId ? String(enc.sectionId).trim() : null;
    const studentSecId = student.sectionId ? String(student.sectionId).trim() : null;
    const studentSecName = student.section ? String(student.section).trim() : null;

    // Helper to test if a string matches section by id or name
    const matchSection = (candidate: string | null): Section | undefined => {
      if (!candidate) return undefined;
      const candClean = SectionAllocationService.getCleanSectionCode(candidate);
      return siblingSections.find((s) => {
        if (s.id.toLowerCase() === candidate.toLowerCase()) return true;
        const sClean = SectionAllocationService.getCleanSectionCode(s.name);
        if (s.name.toLowerCase() === candidate.toLowerCase()) return true;
        if (candClean !== '—' && sClean !== '—' && sClean === candClean) return true;
        return false;
      });
    };

    // 1. Check authoritative enrollment sectionId
    const foundByEnc = matchSection(encSecId);
    if (foundByEnc) {
      const code = SectionAllocationService.getCleanSectionCode(foundByEnc.name);
      return {
        isAllocated: true,
        sectionId: foundByEnc.id,
        sectionCode: code,
        sectionName: foundByEnc.name,
      };
    }

    // 2. Check student.sectionId
    const foundBySecId = matchSection(studentSecId);
    if (foundBySecId) {
      const code = SectionAllocationService.getCleanSectionCode(foundBySecId.name);
      return {
        isAllocated: true,
        sectionId: foundBySecId.id,
        sectionCode: code,
        sectionName: foundBySecId.name,
      };
    }

    // 3. Check student.section (string name)
    const foundByName = matchSection(studentSecName);
    if (foundByName) {
      const code = SectionAllocationService.getCleanSectionCode(foundByName.name);
      return {
        isAllocated: true,
        sectionId: foundByName.id,
        sectionCode: code,
        sectionName: foundByName.name,
      };
    }

    return {
      isAllocated: false,
      sectionId: null,
      sectionCode: '—',
      sectionName: 'Unallocated',
    };
  }

  /**
   * GET /sections/branches-overview
   * Returns live dynamic branches overview for the selected semester and academic year.
   */
  public async getBranchesOverview(
    departmentId: string,
    semester: number | string = 1,
    academicYear: string = '2026-27'
  ): Promise<{
    semester: number;
    academicYear: string;
    department: { id: string; name: string; code: string; type?: string };
    branches: Array<{
      branchCode: string;
      branchName: string;
      departmentId: string;
      totalStudents: number;
      sectionCount: number;
      allocatedStudents: number;
      unallocatedStudents: number;
    }>;
  }> {
    const semNum = Number(semester) || 1;
    const dept = await Department.findByPk(departmentId);
    if (!dept) {
      throw new HttpException('Department not found.', 404, 'DEPT_NOT_FOUND');
    }

    const isSemHandling = dept.type === 'SEMESTER_HANDLING' || dept.code === 'AS';
    let branches: any[] = [];

    const startYear = academicYear ? String(academicYear).split(/[-–]/)[0].trim() : '2026';
    const ayMatchCondition = {
      [Op.or]: [
        { [Op.iLike]: `${startYear}-%` },
        { [Op.iLike]: `${startYear}–%` },
        { [Op.eq]: academicYear },
        { [Op.eq]: startYear },
      ],
    };

    if (isSemHandling) {
      const standardDepts = await Department.findAll({
        where: { type: 'STANDARD' },
        order: [['code', 'ASC']],
      });

      branches = await Promise.all(
        standardDepts.map(async (d) => {
          const rawCode = d.code;
          const displayCode = rawCode === 'CSE-AIML' ? 'AIML' : rawCode;

          const totalStudents = await Student.count({
            where: {
              departmentId: d.id,
              semester: semNum,
            },
            include: [
              {
                model: StudentAcademicEnrollment,
                as: 'academicEnrollments',
                where: {
                  status: 'ACTIVE',
                  academicYearId: ayMatchCondition,
                },
                required: true,
              },
            ],
          });

          const branchCodes = getBranchEquivalents(d.code);
          const sections = await Section.findAll({
            where: {
              departmentId: [departmentId, d.id],
              semester: semNum,
              status: 'ACTIVE',
              academicYear: ayMatchCondition,
              [Op.or]: [
                { branch: { [Op.in]: branchCodes } },
                { branch: null, departmentId: d.id },
              ],
            },
          });

          const secIds = sections.map((s) => s.id);
          const secNames = sections.map((s) => s.name);
          const secCodes = sections.map((s) => SectionAllocationService.getCleanSectionCode(s.name));

          let allocatedStudents = 0;
          if (sections.length > 0) {
            allocatedStudents = await Student.count({
              where: {
                departmentId: d.id,
                semester: semNum,
                [Op.or]: [
                  { sectionId: { [Op.in]: secIds } },
                  { '$academicEnrollments.sectionId$': { [Op.in]: secIds } },
                  { section: { [Op.in]: secNames } },
                  { section: { [Op.in]: secCodes } },
                ],
              },
              include: [
                {
                  model: StudentAcademicEnrollment,
                  as: 'academicEnrollments',
                  where: {
                    status: 'ACTIVE',
                    academicYearId: ayMatchCondition,
                  },
                  required: true,
                },
              ],
            });
          } else {
            allocatedStudents = await Student.count({
              where: {
                departmentId: d.id,
                semester: semNum,
                [Op.or]: [
                  { sectionId: { [Op.ne]: null } },
                  { '$academicEnrollments.sectionId$': { [Op.ne]: null } },
                ],
              },
              include: [
                {
                  model: StudentAcademicEnrollment,
                  as: 'academicEnrollments',
                  where: {
                    status: 'ACTIVE',
                    academicYearId: ayMatchCondition,
                  },
                  required: true,
                },
              ],
            });
          }

          const unallocatedStudents = Math.max(0, totalStudents - allocatedStudents);

          return {
            branchCode: d.code,
            displayCode: displayCode,
            branchName: d.name,
            departmentId: d.id,
            totalStudents,
            sectionCount: sections.length,
            allocatedStudents,
            unallocatedStudents,
          };
        })
      );

      const hasAnyStudents = branches.some((b) => b.totalStudents > 0);
      if (hasAnyStudents) {
        branches = branches.filter((b) => b.totalStudents > 0 || b.sectionCount > 0);
      }
    } else {
      const rawCode = dept.code;
      const displayCode = rawCode === 'CSE-AIML' ? 'AIML' : rawCode;

      const totalStudents = await Student.count({
        where: {
          departmentId: dept.id,
          semester: semNum,
        },
        include: [
          {
            model: StudentAcademicEnrollment,
            as: 'academicEnrollments',
            where: {
              status: 'ACTIVE',
              academicYearId: ayMatchCondition,
            },
            required: true,
          },
        ],
      });

      const branchCodes = getBranchEquivalents(dept.code);
      const sections = await Section.findAll({
        where: {
          semester: semNum,
          status: 'ACTIVE',
          academicYear: ayMatchCondition,
          [Op.or]: [
            { departmentId: dept.id },
            { branch: { [Op.in]: branchCodes } },
          ],
        },
      });

      const secIds = sections.map((s) => s.id);
      const secNames = sections.map((s) => s.name);
      const secCodes = sections.map((s) => SectionAllocationService.getCleanSectionCode(s.name));

      let allocatedStudents = 0;
      if (sections.length > 0) {
        allocatedStudents = await Student.count({
          where: {
            departmentId: dept.id,
            semester: semNum,
            [Op.or]: [
              { sectionId: { [Op.in]: secIds } },
              { '$academicEnrollments.sectionId$': { [Op.in]: secIds } },
              { section: { [Op.in]: secNames } },
              { section: { [Op.in]: secCodes } },
            ],
          },
          include: [
            {
              model: StudentAcademicEnrollment,
              as: 'academicEnrollments',
              where: {
                status: 'ACTIVE',
                academicYearId: ayMatchCondition,
              },
              required: true,
            },
          ],
        });
      } else {
        allocatedStudents = await Student.count({
          where: {
            departmentId: dept.id,
            semester: semNum,
            [Op.or]: [
              { sectionId: { [Op.ne]: null } },
              { '$academicEnrollments.sectionId$': { [Op.ne]: null } },
            ],
          },
          include: [
            {
              model: StudentAcademicEnrollment,
              as: 'academicEnrollments',
              where: {
                status: 'ACTIVE',
                academicYearId: ayMatchCondition,
              },
              required: true,
            },
          ],
        });
      }

      const unallocatedStudents = Math.max(0, totalStudents - allocatedStudents);

      branches = [
        {
          branchCode: dept.code,
          displayCode: displayCode,
          branchName: dept.name,
          departmentId: dept.id,
          totalStudents,
          sectionCount: sections.length,
          allocatedStudents,
          unallocatedStudents,
        },
      ];
    }

    return {
      semester: semNum,
      academicYear,
      department: {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        type: dept.type,
      },
      branches,
    };
  }

  /**
   * GET /sections
   * Fetch all sections for department, semester, academicYear with capacity metrics.
   */
  public async getSections(
    departmentId: string,
    semester?: number | string,
    academicYear?: string,
    branch?: string
  ): Promise<any[]> {
    const dept = await Department.findByPk(departmentId);
    if (!dept) {
      throw new HttpException('Department not found.', 404, 'DEPT_NOT_FOUND');
    }
    const isSemHandling = dept.type === 'SEMESTER_HANDLING' || dept.code === 'AS';

    const semNum = semester && semester !== 'ALL' ? Number(semester) : null;

    let where: any = {
      status: 'ACTIVE',
    };

    if (isSemHandling) {
      // Applied Science HOD handles Semester 1 & 2 sections
      if (semNum && !isNaN(semNum) && semNum >= 1 && semNum <= 8) {
        where.semester = semNum;
      } else {
        where.semester = { [Op.in]: [1, 2] };
      }

      if (branch && branch !== 'ALL') {
        const cleanBranch = branch.trim();
        const branchCodes = getBranchEquivalents(cleanBranch);
        const branchDept = await SectionAllocationService.findDepartmentByBranchCode(cleanBranch);
        const targetDeptIds = branchDept ? [departmentId, branchDept.id] : [departmentId];
        where.departmentId = { [Op.in]: targetDeptIds };
        where[Op.or] = [
          { branch: { [Op.in]: branchCodes } },
          ...(branchDept ? [{ branch: null, departmentId: branchDept.id }] : []),
        ];
      } else {
        where.departmentId = departmentId;
      }
    } else {
      // Standard HOD (e.g. CSE HOD, CSE-AIML HOD)
      const branchCodes = getBranchEquivalents(dept.code);

      if (semNum && [1, 2].includes(semNum)) {
        where.semester = semNum;
        where[Op.or] = [
          { departmentId },
          { branch: { [Op.in]: branchCodes } },
        ];
      } else if (semNum) {
        where.departmentId = departmentId;
        where.semester = semNum;
      } else {
        where[Op.or] = [
          { departmentId },
          { semester: { [Op.in]: [1, 2] }, branch: { [Op.in]: branchCodes } },
        ];
      }
    }

    if (academicYear && academicYear !== 'ALL') {
      const startYear = String(academicYear).split(/[-–]/)[0].trim();
      where.academicYear = {
        [Op.or]: [
          { [Op.iLike]: `${startYear}-%` },
          { [Op.iLike]: `${startYear}–%` },
          { [Op.eq]: academicYear },
          { [Op.eq]: startYear },
        ],
      };
    }

    const sections = await Section.findAll({
      where,
      order: [['semester', 'ASC'], ['branch', 'ASC'], ['name', 'ASC']],
    });

    if (!sections || sections.length === 0) {
      return [];
    }

    // Calculate live allocation counts per section
    const results = await Promise.all(
      sections.map(async (sec) => {
        const cleanCode = SectionAllocationService.getCleanSectionCode(sec.name);
        
        let targetDeptId = sec.departmentId;
        if (sec.branch && sec.branch !== 'ALL') {
          const branchDept = await SectionAllocationService.findDepartmentByBranchCode(sec.branch);
          if (branchDept) targetDeptId = branchDept.id;
        }

        const studentWhere: any = {
          departmentId: targetDeptId,
          semester: sec.semester,
          [Op.or]: [
            { sectionId: sec.id },
            { '$academicEnrollments.sectionId$': sec.id },
            { section: sec.name },
            { section: cleanCode },
            { section: `Section ${cleanCode}` },
          ],
        };

        const secAy = sec.academicYear || academicYear;
        const secStartYear = secAy ? String(secAy).split(/[-–]/)[0].trim() : '2026';
        const secAyMatch = {
          [Op.or]: [
            { [Op.iLike]: `${secStartYear}-%` },
            { [Op.iLike]: `${secStartYear}–%` },
            { [Op.eq]: secAy },
            { [Op.eq]: secStartYear },
          ],
        };

        const studentCount = await Student.count({
          where: studentWhere,
          include: [
            {
              model: StudentAcademicEnrollment,
              as: 'academicEnrollments',
              where: {
                status: 'ACTIVE',
                academicYearId: secAyMatch,
              },
              required: true,
            },
          ],
        });

        const capacity = sec.capacity || 15;
        const availableCapacity = Math.max(0, capacity - studentCount);
        const fillPercentage =
          capacity > 0 ? Math.round((studentCount / capacity) * 1000) / 10 : 0;

        return {
          id: sec.id,
          code: cleanCode,
          sectionName: cleanCode,
          name: sec.name,
          branch: sec.branch || null,
          departmentId: sec.departmentId,
          semester: sec.semester,
          academicYear: sec.academicYear,
          capacity,
          classroom: sec.classroom || null,
          description: sec.description || null,
          status: sec.status,
          studentCount,
          allocatedCount: studentCount,
          availableCapacity,
          fillPercentage,
          createdAt: sec.createdAt,
          updatedAt: sec.updatedAt,
        };
      })
    );

    return results;
  }

  /**
   * GET /sections/:sectionId
   * Retrieve a single section by UUID with full capacity metrics.
   */
  public async getSectionById(sectionId: string, departmentId: string): Promise<any> {
    const validId = SectionAllocationService.validateUuid(sectionId, 'sectionId');

    const section = await Section.findByPk(validId);
    if (!section) {
      throw new HttpException('Section not found.', 404, 'SECTION_NOT_FOUND');
    }

    const isAuth = await SectionAllocationService.isHodAuthorizedForSection(section, departmentId);
    if (!isAuth) {
      throw new HttpException('You do not have access to this section.', 403, 'SECTION_ACCESS_DENIED');
    }

    const cleanCode = SectionAllocationService.getCleanSectionCode(section.name);

    let targetDeptId = section.departmentId;
    if (section.branch && section.branch !== 'ALL') {
      const branchDept = await SectionAllocationService.findDepartmentByBranchCode(section.branch);
      if (branchDept) targetDeptId = branchDept.id;
    }

    const studentWhere: any = {
      departmentId: targetDeptId,
      semester: section.semester,
      [Op.or]: [
        { sectionId: section.id },
        { '$academicEnrollments.sectionId$': section.id },
        { section: section.name },
        { section: cleanCode },
        { section: `Section ${cleanCode}` },
      ],
    };

    const secAy = section.academicYear;
    const secStartYear = secAy ? String(secAy).split(/[-–]/)[0].trim() : '2026';
    const secAyMatch = {
      [Op.or]: [
        { [Op.iLike]: `${secStartYear}-%` },
        { [Op.iLike]: `${secStartYear}–%` },
        { [Op.eq]: secAy },
        { [Op.eq]: secStartYear },
      ],
    };

    const studentCount = await Student.count({
      where: studentWhere,
      include: [
        {
          model: StudentAcademicEnrollment,
          as: 'academicEnrollments',
          where: {
            status: 'ACTIVE',
            academicYearId: secAyMatch,
          },
          required: true,
        },
      ],
    });

    const capacity = section.capacity || 15;
    const availableCapacity = Math.max(0, capacity - studentCount);
    const fillPercentage =
      capacity > 0 ? Math.round((studentCount / capacity) * 1000) / 10 : 0;

    return {
      id: section.id,
      code: cleanCode,
      sectionName: cleanCode,
      name: section.name,
      branch: section.branch || null,
      departmentId: section.departmentId,
      semester: section.semester,
      academicYear: section.academicYear,
      capacity,
      classroom: section.classroom || null,
      description: section.description || null,
      status: section.status,
      studentCount,
      allocatedCount: studentCount,
      availableCapacity,
      fillPercentage,
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    };
  }

  /**
   * GET /sections/:sectionId/students
   * Retrieve all students currently allocated to this section.
   */
  public async getSectionStudents(
    sectionId: string,
    departmentId: string
  ): Promise<{ section: any; students: any[] }> {
    const sectionMeta = await this.getSectionById(sectionId, departmentId);

    let targetDeptId = sectionMeta.departmentId;
    if (sectionMeta.branch && sectionMeta.branch !== 'ALL') {
      const branchDept = await SectionAllocationService.findDepartmentByBranchCode(sectionMeta.branch);
      if (branchDept) targetDeptId = branchDept.id;
    }

    const cleanCode = SectionAllocationService.getCleanSectionCode(sectionMeta.name);

    const studentWhere: any = {
      departmentId: targetDeptId,
      semester: sectionMeta.semester,
      [Op.or]: [
        { sectionId: sectionMeta.id },
        { '$academicEnrollments.sectionId$': sectionMeta.id },
        { section: sectionMeta.name },
        { section: cleanCode },
        { section: `Section ${cleanCode}` },
      ],
    };

    const secAy = sectionMeta.academicYear;
    const secStartYear = secAy ? String(secAy).split(/[-–]/)[0].trim() : '2026';
    const secAyMatch = {
      [Op.or]: [
        { [Op.iLike]: `${secStartYear}-%` },
        { [Op.iLike]: `${secStartYear}–%` },
        { [Op.eq]: secAy },
        { [Op.eq]: secStartYear },
      ],
    };

    const students = await Student.findAll({
      where: studentWhere,
      include: [
        {
          model: StudentAcademicEnrollment,
          as: 'academicEnrollments',
          where: {
            status: 'ACTIVE',
            academicYearId: secAyMatch,
          },
          required: true,
        },
        {
          model: Department,
          as: 'department',
          attributes: ['id', 'name', 'code'],
          required: false,
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'status'],
          required: false,
        },
        {
          model: Admission,
          as: 'admission',
          required: false,
          include: [
            {
              model: AdmissionPersonalDetail,
              as: 'studentpersonaldetails',
              required: false,
            },
          ],
        },
      ],
      order: [
        ['usn', 'ASC NULLS LAST'],
        [sequelize.fn('LOWER', sequelize.fn('COALESCE', sequelize.col('user.firstName'), '')), 'ASC'],
        [sequelize.fn('LOWER', sequelize.fn('COALESCE', sequelize.col('user.lastName'), '')), 'ASC'],
        ['id', 'ASC'],
      ],
    });

    const mappedStudents = students.map((s: any) => {
      const enc = s.academicEnrollments?.[0];
      const pd = s.admission?.studentpersonaldetails;
      const fullName = [
        pd?.firstName || s.user?.firstName || '',
        pd?.middleName || '',
        pd?.lastName || s.user?.lastName || '',
      ].filter(Boolean).join(' ').trim() || s.name || 'Student';

      const roll = sectionMeta.semester === 1 ? (enc?.rollNumber || s.rollNumber || null) : null;

      return {
        id: s.id,
        userId: s.userId,
        usn: s.usn || null,
        enrollmentNumber: s.enrollmentNumber || null,
        rollNumber: roll,
        name: fullName,
        email: s.user?.email || pd?.email || 'N/A',
        phone: pd?.phone || s.user?.phone || 'N/A',
        semester: s.semester,
        branch: s.department?.code || null,
        branchName: s.department?.name || null,
        sectionId: sectionMeta.id,
        section: {
          id: sectionMeta.id,
          code: sectionMeta.code,
          name: sectionMeta.name,
        },
        currentSectionCode: sectionMeta.code,
        currentSection: sectionMeta.code, // Displays clean 'A', NEVER UUID!
        admissionType: s.admissionType || s.admission?.admissionType || 'REGULAR',
        admissionStatus: s.admission?.applicationStatus || s.admissionStatus || 'ACTIVE',
        gender: s.gender || pd?.gender || null,
        category: pd?.category || null,
      };
    });

    return {
      section: sectionMeta,
      students: mappedStudents,
    };
  }

  /**
   * GET /sections/:sectionId/cohort
   * Authoritative available students logic.
   * Segregates students so students in Section A NEVER appear when allocating Section B.
   */
  public async getAvailableStudents(
    sectionId: string,
    departmentId: string
  ): Promise<{
    section: any;
    stats: any;
    availableStudents: any[];
    students: any[];
    siblingSections: any[];
  }> {
    const sectionMeta = await this.getSectionById(sectionId, departmentId);

    let targetDeptId = sectionMeta.departmentId;
    if (sectionMeta.branch && sectionMeta.branch !== 'ALL') {
      const branchDept = await SectionAllocationService.findDepartmentByBranchCode(sectionMeta.branch);
      if (branchDept) targetDeptId = branchDept.id;
    }

    // Fetch sibling sections
    const siblingWhere: any = {
      semester: sectionMeta.semester,
      status: 'ACTIVE',
    };
    if (sectionMeta.branch && sectionMeta.branch !== 'ALL') {
      const cleanBranch = sectionMeta.branch.trim();
      const branchCodes = getBranchEquivalents(cleanBranch);
      siblingWhere[Op.or] = [
        { branch: { [Op.in]: branchCodes } },
        { departmentId: targetDeptId },
      ];
    } else {
      siblingWhere.departmentId = targetDeptId;
    }

    const siblingSections = await Section.findAll({
      where: siblingWhere,
      order: [['name', 'ASC']],
    });

    // Fetch cohort students
    const studentWhere: any = {
      departmentId: targetDeptId,
      semester: sectionMeta.semester,
    };

    const secAy = sectionMeta.academicYear;
    const secStartYear = secAy ? String(secAy).split(/[-–]/)[0].trim() : '2026';
    const secAyMatch = {
      [Op.or]: [
        { [Op.iLike]: `${secStartYear}-%` },
        { [Op.iLike]: `${secStartYear}–%` },
        { [Op.eq]: secAy },
        { [Op.eq]: secStartYear },
      ],
    };

    const allStudents = await Student.findAll({
      where: studentWhere,
      include: [
        {
          model: StudentAcademicEnrollment,
          as: 'academicEnrollments',
          where: {
            status: 'ACTIVE',
            academicYearId: secAyMatch,
          },
          required: true,
        },
        {
          model: Department,
          as: 'department',
          attributes: ['id', 'name', 'code'],
          required: false,
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'status'],
          required: false,
        },
        {
          model: Admission,
          as: 'admission',
          required: false,
          include: [
            {
              model: AdmissionPersonalDetail,
              as: 'studentpersonaldetails',
              required: false,
            },
          ],
        },
      ],
      order: [
        ['usn', 'ASC NULLS LAST'],
        [sequelize.fn('LOWER', sequelize.fn('COALESCE', sequelize.col('user.firstName'), '')), 'ASC'],
        [sequelize.fn('LOWER', sequelize.fn('COALESCE', sequelize.col('user.lastName'), '')), 'ASC'],
        ['id', 'ASC'],
      ],
    });

    // Authoritative classification for each student
    const classifiedStudents = allStudents.map((s: any) => {
      const resolved = SectionAllocationService.resolveStudentSection(s, siblingSections);
      const isAllocatedToThisSection = resolved.isAllocated && resolved.sectionId === sectionMeta.id;
      const isAllocatedToOtherSection = resolved.isAllocated && resolved.sectionId !== sectionMeta.id;
      const isUnallocated = !resolved.isAllocated;

      const pd = s.admission?.studentpersonaldetails;
      const fullName = [
        pd?.firstName || s.user?.firstName || '',
        pd?.middleName || '',
        pd?.lastName || s.user?.lastName || '',
      ].filter(Boolean).join(' ').trim() || s.name || 'Student';

      return {
        id: s.id,
        userId: s.userId,
        usn: s.usn || null,
        enrollmentNumber: s.enrollmentNumber || null,
        rollNumber: s.rollNumber || null,
        name: fullName,
        email: s.user?.email || pd?.email || 'N/A',
        phone: pd?.phone || s.user?.phone || 'N/A',
        semester: s.semester,
        branch: s.department?.code || null,
        branchName: s.department?.name || null,
        admissionType: s.admissionType || s.admission?.admissionType || 'REGULAR',
        admissionStatus: s.admission?.applicationStatus || s.admissionStatus || 'ACTIVE',
        gender: s.gender || pd?.gender || null,
        category: pd?.category || null,
        isAllocated: resolved.isAllocated,
        isUnallocated,
        isAllocatedToThisSection,
        isAllocatedToOtherSection,
        currentSectionId: resolved.sectionId,
        currentSectionCode: resolved.sectionCode,
        currentSection: resolved.sectionCode, // Clean code e.g. "A" or "—", NEVER UUID!
        section: resolved.isAllocated
          ? {
              id: resolved.sectionId!,
              code: resolved.sectionCode,
              name: resolved.sectionName,
            }
          : null,
      };
    });

    const unallocatedList = classifiedStudents.filter((s) => s.isUnallocated);
    unallocatedList.sort((a, b) => {
      const nameComp = a.name.localeCompare(b.name);
      if (nameComp !== 0) return nameComp;
      return (a.enrollmentNumber || a.usn || '').localeCompare(b.enrollmentNumber || b.usn || '');
    });
    const thisSectionList = classifiedStudents.filter((s) => s.isAllocatedToThisSection);
    const otherSectionsList = classifiedStudents.filter((s) => s.isAllocatedToOtherSection);

    const sectionCapacity = sectionMeta.capacity || 15;
    const remainingCapacity = Math.max(0, sectionCapacity - thisSectionList.length);
    const fillPercentage =
      sectionCapacity > 0 ? Math.round((thisSectionList.length / sectionCapacity) * 1000) / 10 : 0;

    const stats = {
      totalDepartmentStudents: classifiedStudents.length,
      unallocatedStudents: unallocatedList.length,
      thisSectionAllocated: thisSectionList.length,
      otherSectionsAllocated: otherSectionsList.length,
      sectionCapacity,
      remainingCapacity,
      fillPercentage,
    };

    const cleanSiblings = siblingSections.map((s) => ({
      id: s.id,
      name: s.name,
      code: SectionAllocationService.getCleanSectionCode(s.name),
      branch: s.branch || null,
      capacity: s.capacity,
      semester: s.semester,
      academicYear: s.academicYear,
    }));

    return {
      section: sectionMeta,
      stats,
      availableStudents: unallocatedList, // Only unallocated students!
      students: classifiedStudents,
      siblingSections: cleanSiblings,
    };
  }

  /**
   * POST /sections/:sectionId/allocate
   * Atomic transactional allocation with strict capacity and duplicate validation.
   */
  public async allocateStudents(
    sectionId: string,
    departmentId: string,
    studentAllocations: StudentAllocationInput[],
    actorUser?: any
  ): Promise<{ success: boolean; message: string; allocatedCount: number }> {
    const validId = SectionAllocationService.validateUuid(sectionId, 'sectionId');

    if (!Array.isArray(studentAllocations) || studentAllocations.length === 0) {
      throw new HttpException('No students selected for allocation.', 400, 'NO_STUDENTS_SELECTED');
    }

    const transaction = await sequelize.transaction();
    try {
      // 1. Lock and validate section
      const section = await Section.findByPk(validId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!section) {
        throw new HttpException('Section not found.', 404, 'SECTION_NOT_FOUND');
      }

      const isAuth = await SectionAllocationService.isHodAuthorizedForSection(section, departmentId, null, transaction);
      if (!isAuth) {
        throw new HttpException('You do not have access to this section.', 403, 'SECTION_ACCESS_DENIED');
      }

      let targetDeptId = section.departmentId;
      if (section.branch && section.branch !== 'ALL') {
        const branchDept = await SectionAllocationService.findDepartmentByBranchCode(section.branch, transaction);
        if (branchDept) targetDeptId = branchDept.id;
      }

      const cleanCode = SectionAllocationService.getCleanSectionCode(section.name);

      // 2. Fetch sibling sections to check existing allocations
      const siblingWhere: any = { semester: section.semester, status: 'ACTIVE' };
      if (section.branch && section.branch !== 'ALL') {
        const cleanBranch = section.branch.trim();
        const branchCodes = getBranchEquivalents(cleanBranch);
        siblingWhere[Op.or] = [
          { branch: { [Op.in]: branchCodes } },
          { departmentId: targetDeptId },
        ];
      } else {
        siblingWhere.departmentId = targetDeptId;
      }

      const siblingSections = await Section.findAll({
        where: siblingWhere,
        transaction,
      });

      // 3. Count currently allocated students in this section
      const studentCountWhere: any = {
        departmentId: targetDeptId,
        semester: section.semester,
        [Op.or]: [
          { sectionId: section.id },
          { '$academicEnrollments.sectionId$': section.id },
          { section: section.name },
          { section: cleanCode },
          { section: `Section ${cleanCode}` },
        ],
      };

      const currentAllocated = await Student.count({
        where: studentCountWhere,
        include: [
          {
            model: StudentAcademicEnrollment,
            as: 'academicEnrollments',
            required: false,
          },
        ],
        transaction,
      });

      const capacity = section.capacity || 15;
      const remainingCapacity = Math.max(0, capacity - currentAllocated);

      // 4. Validate Capacity Constraint
      if (studentAllocations.length > remainingCapacity) {
        throw new HttpException(
          `Section ${cleanCode || section.name} has only ${remainingCapacity} seats remaining. You selected ${studentAllocations.length} students.`,
          400,
          'SECTION_CAPACITY_EXCEEDED'
        );
      }

      const targetStudentIds = studentAllocations.map((a) => a.studentId);

      // 5. Fetch and lock each selected student row directly (No outer joins with FOR UPDATE)
      const students = await Student.findAll({
        where: {
          id: { [Op.in]: targetStudentIds },
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (students.length !== targetStudentIds.length) {
        throw new HttpException('One or more selected students could not be found.', 404, 'STUDENT_NOT_FOUND');
      }

      // Fetch active enrollments separately within the transaction
      const activeEnrollments = await StudentAcademicEnrollment.findAll({
        where: {
          studentId: { [Op.in]: targetStudentIds },
          status: 'ACTIVE',
        },
        transaction,
      });
      const enrollmentMap = new Map<string, StudentAcademicEnrollment>();
      activeEnrollments.forEach((e) => enrollmentMap.set(e.studentId, e));

      // 6. Validate every student
      for (const st of students) {
        if (st.departmentId !== targetDeptId) {
          throw new HttpException(
            `Student ${st.usn || st.enrollmentNumber || st.id} does not belong to the target branch department.`,
            403,
            'STUDENT_DEPARTMENT_MISMATCH'
          );
        }

        if (st.semester !== section.semester) {
          throw new HttpException(
            `Student ${st.usn || st.enrollmentNumber || st.id} is in Semester ${st.semester}, but section is Semester ${section.semester}.`,
            400,
            'STUDENT_SEMESTER_MISMATCH'
          );
        }

        // Attach enrollment for section resolution
        const enc = enrollmentMap.get(st.id);
        (st as any).academicEnrollments = enc ? [enc] : [];

        // DUPLICATE ALLOCATION PREVENTION
        const resolved = SectionAllocationService.resolveStudentSection(st, siblingSections);
        if (resolved.isAllocated) {
          const secDisplay = resolved.sectionCode !== '—' ? `Section ${resolved.sectionCode}` : 'another section';
          throw new HttpException(
            `Student ${st.usn || st.enrollmentNumber || st.id} is already allocated to ${secDisplay}. Re-allocation rejected. Use Move Student to transfer allocated students.`,
            409,
            'ALLOCATION_CONFLICT'
          );
        }
      }

      // 7. Perform atomic dual-table allocation
      const rollMap = new Map(studentAllocations.map((a) => [a.studentId, a.rollNumber]));

      for (const st of students) {
        const explicitRoll = section.semester === 1 ? rollMap.get(st.id) : null;
        const rollToSet =
          section.semester === 1
            ? explicitRoll !== undefined && explicitRoll !== null && String(explicitRoll).trim().length > 0
              ? String(explicitRoll).trim()
              : st.rollNumber
            : null;

        // Synchronize Student table
        await st.update(
          {
            sectionId: section.id,
            section: section.name,
            rollNumber: rollToSet,
          },
          { transaction }
        );

        // Synchronize StudentAcademicEnrollment table safely
        const existingEnrollment = enrollmentMap.get(st.id);
        if (existingEnrollment) {
          await existingEnrollment.update(
            {
              sectionId: section.id,
              rollNumber: rollToSet,
              academicYearId: section.academicYear || existingEnrollment.academicYearId || '2026-27',
            },
            { transaction }
          );
        } else {
          await StudentAcademicEnrollment.create(
            {
              studentId: st.id,
              departmentId: st.departmentId,
              semesterId: section.semester,
              academicYearId: section.academicYear || '2026-27',
              schemeId: '2025',
              sectionId: section.id,
              rollNumber: rollToSet,
              entrySemester: st.initialSemester || section.semester || 1,
              status: 'ACTIVE',
            },
            { transaction }
          );
        }
      }

      // 8. Safe Audit Log
      try {
        let validActorUserId: string | null = null;
        if (actorUser?.id) {
          const userExists = await User.findByPk(actorUser.id, { attributes: ['id'], transaction });
          if (userExists) validActorUserId = userExists.id;
        }

        await AuditLog.create(
          {
            userId: validActorUserId,
            action: 'Bulk Allocation',
            ipAddress: '127.0.0.1',
            userAgent: 'HOD Portal',
            details: {
              actor: validActorUserId,
              role: actorUser?.role,
              departmentId,
              sectionId: section.id,
              sectionName: section.name,
              sectionCode: cleanCode || section.name,
              semester: section.semester,
              academicYear: section.academicYear,
              allocatedCount: studentAllocations.length,
              studentIds: targetStudentIds,
              timestamp: new Date().toISOString(),
            },
          },
          { transaction }
        );
      } catch (auditErr) {
        logger.warn('Non-blocking audit log creation error during allocation:', auditErr);
      }

      await transaction.commit();

      return {
        success: true,
        message: `Successfully allocated ${studentAllocations.length} students to Section ${cleanCode || section.name}.`,
        allocatedCount: studentAllocations.length,
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * PATCH /sections/:sectionId/students/:studentId/move
   * Transactional transfer of student from Section A to Section B.
   */
  public async moveStudent(
    sourceSectionId: string,
    studentId: string,
    targetSectionId: string,
    departmentId: string,
    newRollNumber?: string,
    actorUser?: any
  ): Promise<{ success: boolean; message: string }> {
    const validSourceId = SectionAllocationService.validateUuid(sourceSectionId, 'sourceSectionId');
    const validTargetId = SectionAllocationService.validateUuid(targetSectionId, 'targetSectionId');

    const transaction = await sequelize.transaction();
    try {
      const sourceSection = await Section.findByPk(validSourceId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const targetSection = await Section.findByPk(validTargetId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!sourceSection || !targetSection) {
        throw new HttpException('Source or target section not found.', 404, 'SECTION_NOT_FOUND');
      }

      const isSourceAuth = await SectionAllocationService.isHodAuthorizedForSection(sourceSection, departmentId, null, transaction);
      const isTargetAuth = await SectionAllocationService.isHodAuthorizedForSection(targetSection, departmentId, null, transaction);

      if (!isSourceAuth || !isTargetAuth) {
        throw new HttpException('You do not have access to these sections.', 403, 'SECTION_ACCESS_DENIED');
      }

      if (sourceSection.semester !== targetSection.semester) {
        throw new HttpException('Target section must be in the same semester.', 400, 'SEMESTER_MISMATCH');
      }

      let targetDeptId = targetSection.departmentId;
      if (targetSection.branch && targetSection.branch !== 'ALL') {
        const branchDept = await SectionAllocationService.findDepartmentByBranchCode(targetSection.branch, transaction);
        if (branchDept) targetDeptId = branchDept.id;
      }

      const targetCleanCode = SectionAllocationService.getCleanSectionCode(targetSection.name);

      // Check target section capacity
      const targetCountWhere: any = {
        departmentId: targetDeptId,
        semester: targetSection.semester,
        [Op.or]: [
          { sectionId: targetSection.id },
          { '$academicEnrollments.sectionId$': targetSection.id },
          { section: targetSection.name },
          { section: targetCleanCode },
        ],
      };

      const targetAllocated = await Student.count({
        where: targetCountWhere,
        include: [
          {
            model: StudentAcademicEnrollment,
            as: 'academicEnrollments',
            required: false,
          },
        ],
        transaction,
      });

      if (targetAllocated >= targetSection.capacity) {
        throw new HttpException(
          `Target Section ${targetCleanCode} is already at full capacity (${targetSection.capacity}/${targetSection.capacity}).`,
          400,
          'TARGET_SECTION_FULL'
        );
      }

      const student = await Student.findOne({
        where: {
          id: studentId,
          departmentId: targetDeptId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!student) {
        throw new HttpException('Student not found.', 404, 'STUDENT_NOT_FOUND');
      }

      const rollToSet =
        targetSection.semester === 1
          ? newRollNumber
            ? String(newRollNumber).trim()
            : student.rollNumber
          : null;

      // Update both tables atomically
      await student.update(
        {
          sectionId: targetSection.id,
          section: targetSection.name,
          rollNumber: rollToSet,
        },
        { transaction }
      );

      await StudentAcademicEnrollment.update(
        {
          sectionId: targetSection.id,
          rollNumber: rollToSet,
        },
        {
          where: {
            studentId: student.id,
            status: 'ACTIVE',
          },
          transaction,
        }
      );

      // Safe Audit Log
      try {
        let validActorUserId: string | null = null;
        if (actorUser?.id) {
          const userExists = await User.findByPk(actorUser.id, { attributes: ['id'], transaction });
          if (userExists) validActorUserId = userExists.id;
        }

        await AuditLog.create(
          {
            userId: validActorUserId,
            action: 'Student Moved',
            ipAddress: '127.0.0.1',
            userAgent: 'HOD Portal',
            details: {
              actor: validActorUserId,
              role: actorUser?.role,
              departmentId,
              studentId: student.id,
              fromSectionId: sourceSection.id,
              fromSectionName: sourceSection.name,
              toSectionId: targetSection.id,
              toSectionName: targetSection.name,
              toSectionCode: targetCleanCode,
              timestamp: new Date().toISOString(),
            },
          },
          { transaction }
        );
      } catch (auditErr) {
        logger.warn('Non-blocking audit log creation error during student move:', auditErr);
      }

      await transaction.commit();

      return {
        success: true,
        message: `Student successfully moved to Section ${targetCleanCode}.`,
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * DELETE /sections/:sectionId/students/:studentId
   * Remove student from section -> becomes UNALLOCATED.
   */
  public async removeStudent(
    sectionId: string,
    studentId: string,
    departmentId: string,
    actorUser?: any
  ): Promise<{ success: boolean; message: string }> {
    const validId = SectionAllocationService.validateUuid(sectionId, 'sectionId');

    const transaction = await sequelize.transaction();
    try {
      const section = await Section.findByPk(validId, { transaction });
      if (!section) {
        throw new HttpException('Section not found.', 404, 'SECTION_NOT_FOUND');
      }

      const isAuth = await SectionAllocationService.isHodAuthorizedForSection(section, departmentId, null, transaction);
      if (!isAuth) {
        throw new HttpException('You do not have access to this section.', 403, 'SECTION_ACCESS_DENIED');
      }

      let targetDeptId = section.departmentId;
      if (section.branch && section.branch !== 'ALL') {
        const branchDept = await SectionAllocationService.findDepartmentByBranchCode(section.branch, transaction);
        if (branchDept) targetDeptId = branchDept.id;
      }

      const student = await Student.findOne({
        where: {
          id: studentId,
          departmentId: targetDeptId,
          semester: section.semester,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!student) {
        throw new HttpException('Student not found.', 404, 'STUDENT_NOT_FOUND');
      }

      // Remove section allocation on both tables
      await student.update(
        {
          sectionId: null,
          section: null,
          rollNumber: null,
        },
        { transaction }
      );

      await StudentAcademicEnrollment.update(
        {
          sectionId: null,
          rollNumber: null,
        },
        {
          where: {
            studentId: student.id,
            status: 'ACTIVE',
          },
          transaction,
        }
      );

      // Safe Audit Log
      try {
        let validActorUserId: string | null = null;
        if (actorUser?.id) {
          const userExists = await User.findByPk(actorUser.id, { attributes: ['id'], transaction });
          if (userExists) validActorUserId = userExists.id;
        }

        await AuditLog.create(
          {
            userId: validActorUserId,
            action: 'Student Removed from Section',
            ipAddress: '127.0.0.1',
            userAgent: 'HOD Portal',
            details: {
              actor: validActorUserId,
              role: actorUser?.role,
              departmentId,
              studentId: student.id,
              sectionId: section.id,
              sectionName: section.name,
              timestamp: new Date().toISOString(),
            },
          },
          { transaction }
        );
      } catch (auditErr) {
        logger.warn('Non-blocking audit log creation error during student remove:', auditErr);
      }

      await transaction.commit();

      const cleanCode = SectionAllocationService.getCleanSectionCode(section.name);
      return {
        success: true,
        message: `Student removed from Section ${cleanCode}. Student is now unallocated.`,
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * POST /sections/:sectionId/unallocate-all
   * Atomically unallocate ALL students currently assigned to this section.
   * Clears sectionId, section, and rollNumber (for sem 1) relationships without deleting student records.
   */
  public async unallocateAllStudents(
    sectionId: string,
    departmentId: string,
    actorUser?: any
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      sectionId: string;
      sectionName: string;
      affectedCount: number;
    };
  }> {
    const validId = SectionAllocationService.validateUuid(sectionId, 'sectionId');

    const transaction = await sequelize.transaction();
    try {
      // 1. Find section by exact UUID with lock
      const section = await Section.findByPk(validId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!section) {
        throw new HttpException('Section not found.', 404, 'SECTION_NOT_FOUND');
      }

      // 2. Validate authorization & department scope
      const isAuth = await SectionAllocationService.isHodAuthorizedForSection(section, departmentId, null, transaction);
      if (!isAuth) {
        throw new HttpException('You do not have access to this section.', 403, 'SECTION_ACCESS_DENIED');
      }

      let targetDeptId = section.departmentId;
      if (section.branch && section.branch !== 'ALL') {
        const branchDept = await SectionAllocationService.findDepartmentByBranchCode(section.branch, transaction);
        if (branchDept) targetDeptId = branchDept.id;
      }

      const cleanCode = SectionAllocationService.getCleanSectionCode(section.name);

      // 3. Find all students currently allocated to this exact sectionId
      const studentWhere: any = {
        departmentId: targetDeptId,
        semester: section.semester,
        [Op.or]: [
          { sectionId: section.id },
          { '$academicEnrollments.sectionId$': section.id },
          { section: section.name },
          { section: cleanCode },
          { section: `Section ${cleanCode}` },
        ],
      };

      const secAy = section.academicYear;
      const secStartYear = secAy ? String(secAy).split(/[-–]/)[0].trim() : '2026';
      const secAyMatch = {
        [Op.or]: [
          { [Op.iLike]: `${secStartYear}-%` },
          { [Op.iLike]: `${secStartYear}–%` },
          { [Op.eq]: secAy },
          { [Op.eq]: secStartYear },
        ],
      };

      const students = await Student.findAll({
        where: studentWhere,
        include: [
          {
            model: StudentAcademicEnrollment,
            as: 'academicEnrollments',
            where: {
              status: 'ACTIVE',
              academicYearId: secAyMatch,
            },
            required: true,
          },
        ],
        transaction,
      });

      const affectedCount = students.length;

      if (affectedCount === 0) {
        await transaction.commit();
        return {
          success: true,
          message: `No students are currently allocated to ${section.name}.`,
          data: {
            sectionId: section.id,
            sectionName: section.name,
            affectedCount: 0,
          },
        };
      }

      const studentIds = students.map((s) => s.id);

      // Lock selected student rows directly (no outer joins with FOR UPDATE)
      await Student.findAll({
        where: { id: { [Op.in]: studentIds } },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      // 4. Atomically clear section allocation on Student table
      // Preserves student records, user accounts, attendance, marks, and academic data
      await Student.update(
        {
          sectionId: null,
          section: null,
          rollNumber: section.semester === 1 ? null : undefined,
        },
        {
          where: {
            [Op.or]: [
              { id: { [Op.in]: studentIds } },
              { sectionId: section.id, departmentId: targetDeptId },
            ],
          },
          transaction,
        }
      );

      // 5. Atomically clear section allocation on StudentAcademicEnrollment table
      await StudentAcademicEnrollment.update(
        {
          sectionId: null,
          rollNumber: section.semester === 1 ? null : undefined,
        },
        {
          where: {
            studentId: { [Op.in]: studentIds },
            status: 'ACTIVE',
            [Op.or]: [
              { sectionId: section.id },
              { academicYearId: secAyMatch },
            ],
          },
          transaction,
        }
      );

      // 6. Create administrative audit event
      try {
        let validActorUserId: string | null = null;
        if (actorUser?.id) {
          const userExists = await User.findByPk(actorUser.id, { attributes: ['id'], transaction });
          if (userExists) validActorUserId = userExists.id;
        }

        await AuditLog.create(
          {
            userId: validActorUserId,
            action: 'SECTION_STUDENTS_BULK_UNALLOCATED',
            ipAddress: '127.0.0.1',
            userAgent: 'HOD Portal',
            details: {
              actor: validActorUserId,
              role: actorUser?.role,
              departmentId: targetDeptId,
              sectionId: section.id,
              sectionName: section.name,
              semester: section.semester,
              academicYear: section.academicYear,
              branch: section.branch,
              affectedStudentCount: affectedCount,
              studentIds,
              timestamp: new Date().toISOString(),
            },
          },
          { transaction }
        );
      } catch (auditErr) {
        logger.warn('Non-blocking audit log creation error during bulk unallocation:', auditErr);
      }

      await transaction.commit();

      return {
        success: true,
        message: `${affectedCount} students unallocated successfully from ${section.name}.`,
        data: {
          sectionId: section.id,
          sectionName: section.name,
          affectedCount,
        },
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * Manual section creation.
   * Uses user-entered section name with branch, semester & academic year uniqueness check.
   */
  public async createSection(
    departmentId: string,
    data: {
      name: string;
      semester: number;
      capacity: number;
      branch?: string;
      academicYear?: string;
      classroom?: string;
      description?: string;
    },
    actorUser?: any
  ): Promise<any> {
    const semNum = Number(data.semester);
    if (!semNum || isNaN(semNum) || semNum < 1 || semNum > 8) {
      throw new HttpException('Valid semester number (1-8) is required.', 400, 'INVALID_SEMESTER');
    }

    const dept = await Department.findByPk(departmentId);
    const isSemHandling = dept?.type === 'SEMESTER_HANDLING';

    if (isSemHandling && ![1, 2].includes(semNum)) {
      throw new HttpException('Applied Science sections can only be created for Semester 1 or Semester 2.', 400, 'INVALID_SEMESTER');
    }

    const capNum = Number(data.capacity);
    if (!capNum || isNaN(capNum) || capNum <= 0) {
      throw new HttpException('Capacity must be a positive integer.', 400, 'INVALID_CAPACITY');
    }

    const ay = String(data.academicYear || '2026-27').trim();

    const sectionName = data.name ? String(data.name).trim() : '';
    if (!sectionName) {
      throw new HttpException('Please enter a section name.', 400, 'INVALID_NAME');
    }

    const cleanLetter = SectionAllocationService.getCleanSectionCode(sectionName);
    const branchVal = data.branch && data.branch !== 'ALL' ? data.branch : null;

    // Enforce uniqueness within Department/Branch + Semester + Academic Year + Section Name
    const existingWhere: any = {
      departmentId,
      semester: semNum,
      academicYear: ay,
      status: 'ACTIVE',
      [Op.or]: [
        { name: sectionName },
        ...(cleanLetter ? [{ name: `Section ${cleanLetter}` }, { name: cleanLetter }] : []),
      ],
    };

    if (branchVal) {
      const branchCodes = getBranchEquivalents(branchVal);
      existingWhere.branch = { [Op.in]: branchCodes };
    }

    const existing = await Section.findOne({ where: existingWhere });

    if (existing) {
      throw new HttpException(
        `Section "${sectionName}" already exists for this branch, semester and academic year.`,
        400,
        'SECTION_ALREADY_EXISTS'
      );
    }

    const canonicalBranch = branchVal ? (getBranchEquivalents(branchVal)[0] || branchVal) : null;

    const newSection = await Section.create({
      departmentId,
      semester: semNum,
      branch: canonicalBranch,
      academicYear: ay,
      name: sectionName,
      capacity: capNum,
      classroom: data.classroom ? String(data.classroom).trim() : null,
      description: data.description ? String(data.description).trim() : null,
      createdBy: actorUser?.id || null,
      status: 'ACTIVE',
    });

    const displayCode = cleanLetter || sectionName;

    return {
      id: newSection.id,
      code: displayCode,
      sectionName: displayCode,
      name: newSection.name,
      branch: newSection.branch,
      semester: newSection.semester,
      academicYear: newSection.academicYear,
      capacity: newSection.capacity,
      classroom: newSection.classroom,
      description: newSection.description,
      status: newSection.status,
      studentCount: 0,
      availableCapacity: newSection.capacity,
      fillPercentage: 0,
      createdAt: newSection.createdAt,
    };
  }
}

export const sectionAllocationService = new SectionAllocationService();
export default sectionAllocationService;

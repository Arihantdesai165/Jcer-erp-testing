import db from '../config/database';
import Student from '../models/Student';
import Department from '../models/Department';
import User from '../models/User';
import { getHodStudents } from '../controllers/hod.controller';

async function runValidation() {
  try {
    await db.authenticate();
    console.log('--- VALIDATION: Applied Science Student Branch Logic ---');

    // 1. Get AS department and standard departments
    const asDept = await Department.findOne({ where: { code: 'AS' } });
    if (!asDept) {
      throw new Error('Applied Science department (AS) not found in DB.');
    }
    console.log(`✓ Found AS Department: ID=${asDept.id}, Name=${asDept.name}, Type=${(asDept as any).type}`);

    const standardDepts = await Department.findAll({ where: { type: 'STANDARD' } });
    console.log('✓ Standard Departments in DB:', standardDepts.map(d => `${d.code} (${d.name})`));

    // 2. Mock request/response helper for getHodStudents
    async function callGetHodStudents(query: any = {}) {
      return new Promise<{ statusCode: number; json: any }>((resolve) => {
        const req: any = {
          departmentId: asDept!.id,
          isSemesterHandling: true,
          user: { id: 'test-hod', role: 'HOD', departmentId: asDept!.id },
          query,
        };
        const res: any = {
          statusCode: 200,
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json(payload: any) {
            resolve({ statusCode: this.statusCode, json: payload });
            return this;
          },
        };
        const next = (err: any) => {
          console.error('Error in controller:', err);
          resolve({ statusCode: 500, json: { error: err.message } });
        };
        getHodStudents(req, res, next);
      });
    }

    // 3. Fetch all pages of students for Applied Science HOD (limit 100 per page, 4 pages = 400 students)
    const page1Res = await callGetHodStudents({ page: 1, limit: 100 });
    const totalCount = page1Res.json?.data?.pagination?.total || 0;
    const totalPages = page1Res.json?.data?.pagination?.totalPages || 1;
    console.log(`\nTotal Semester-1 & 2 students in pagination count for AS HOD: ${totalCount} across ${totalPages} pages`);

    let allStudents: any[] = [];
    for (let p = 1; p <= totalPages; p++) {
      const pRes = await callGetHodStudents({ page: p, limit: 100 });
      allStudents = allStudents.concat(pRes.json?.data?.students || []);
    }

    console.log(`Fetched total ${allStudents.length} student items across all pages.`);

    let allChecksPassed = true;

    if (totalCount !== 400 || allStudents.length !== 400) {
      console.error(`❌ Expected 400 students for Applied Science HOD, but got totalCount=${totalCount}, array length=${allStudents.length}`);
      allChecksPassed = false;
    } else {
      console.log('✓ Exactly 400 students resolved for Applied Science HOD.');
    }

    // Check branch distributions and ensure NONE have AS
    const branchCounts: Record<string, number> = {};
    let asCount = 0;
    allStudents.forEach((st) => {
      const b = st.actualBranch || st.branch;
      branchCounts[b] = (branchCounts[b] || 0) + 1;
      if (b === 'AS' || st.branchCode === 'AS' || st.department?.code === 'AS') {
        asCount++;
      }
    });

    console.log('Branch breakdown across all 400 Sem 1 students:', branchCounts);
    console.log(`Number of students with AS as branch: ${asCount}`);

    if (asCount > 0) {
      console.error('❌ FAILURE: Found students displaying AS as branch!');
      allChecksPassed = false;
    } else {
      console.log('✓ PASS: No student displays AS as Actual Branch.');
    }

    if (branchCounts['CSE'] === 80) {
      console.log('✓ PASS: Exactly 80 CSE Semester-1 test students display as CSE.');
    } else {
      console.error(`❌ Expected 80 CSE students, got ${branchCounts['CSE']}`);
      allChecksPassed = false;
    }

    if (branchCounts['AIML'] === 80) {
      console.log('✓ PASS: Exactly 80 CSE-AIML students display as AIML.');
    } else {
      console.error(`❌ Expected 80 AIML students, got ${branchCounts['AIML']}`);
      allChecksPassed = false;
    }

    if (branchCounts['ECE'] === 80) {
      console.log('✓ PASS: Exactly 80 ECE students display as ECE.');
    } else {
      console.error(`❌ Expected 80 ECE students, got ${branchCounts['ECE']}`);
      allChecksPassed = false;
    }

    if (branchCounts['ME'] === 80) {
      console.log('✓ PASS: Exactly 80 ME students display as ME.');
    } else {
      console.error(`❌ Expected 80 ME students, got ${branchCounts['ME']}`);
      allChecksPassed = false;
    }

    if (branchCounts['CV'] === 80) {
      console.log('✓ PASS: Exactly 80 CV students display as CV.');
    } else {
      console.error(`❌ Expected 80 CV students, got ${branchCounts['CV']}`);
      allChecksPassed = false;
    }

    // 4. Test individual branch filters
    console.log('\n--- Testing Branch Filters ---');
    const branchesToTest = ['CSE', 'AIML', 'ECE', 'ME', 'CV'];
    for (const b of branchesToTest) {
      const res = await callGetHodStudents({ branch: b, limit: 100 });
      const students: any[] = res.json?.data?.students || [];
      const total = res.json?.data?.pagination?.total || 0;
      const expectedActualBranch = b;
      const allMatch = students.every(s => s.actualBranch === expectedActualBranch);
      console.log(`Branch Filter '${b}': returned ${students.length} students (total count: ${total}), all matching '${expectedActualBranch}': ${allMatch}`);
      if (total !== 80 || !allMatch) {
        console.error(`❌ Branch filter '${b}' failed! Expected 80 students matching '${expectedActualBranch}', got ${total}`);
        allChecksPassed = false;
      } else {
        console.log(`✓ PASS: Filter '${b}' correctly returned 80 ${b} students.`);
      }
    }

    // 5. Test Semester 1 & 2 filtering
    console.log('\n--- Testing Semester Filters ---');
    const sem1Res = await callGetHodStudents({ semester: 1, limit: 100 });
    console.log(`Semester 1 filter total: ${sem1Res.json?.data?.pagination?.total}`);
    if (sem1Res.json?.data?.pagination?.total === 400) {
      console.log('✓ PASS: Semester 1 filter correctly returned 400 students.');
    } else {
      console.error('❌ Semester 1 filter failed.');
      allChecksPassed = false;
    }

    const sem2Res = await callGetHodStudents({ semester: 2, limit: 100 });
    console.log(`Semester 2 filter total: ${sem2Res.json?.data?.pagination?.total}`);
    if (sem2Res.json?.data?.pagination?.total === 0) {
      console.log('✓ PASS: Semester 2 filter correctly returned 0 students.');
    } else {
      console.error('❌ Semester 2 filter failed.');
      allChecksPassed = false;
    }

    // 6. Test Normal HOD (e.g. CSE HOD)
    console.log('\n--- Testing Normal HOD Scoping (Unchanged) ---');
    const cseDept = standardDepts.find(d => d.code === 'CSE');
    if (cseDept) {
      const normalHodRes = await new Promise<{ statusCode: number; json: any }>((resolve) => {
        const req: any = {
          departmentId: cseDept.id,
          isSemesterHandling: false,
          user: { id: 'test-cse-hod', role: 'HOD', departmentId: cseDept.id },
          query: { limit: 100 },
        };
        const res: any = {
          statusCode: 200,
          status(code: number) { this.statusCode = code; return this; },
          json(payload: any) { resolve({ statusCode: this.statusCode, json: payload }); return this; },
        };
        getHodStudents(req, res, (err) => resolve({ statusCode: 500, json: { error: err.message } }));
      });

      const normalStudents: any[] = normalHodRes.json?.data?.students || [];
      const allCse = normalStudents.every(s => s.branch === 'CSE' || s.actualBranch === 'CSE');
      console.log(`Normal CSE HOD returned ${normalStudents.length} students. All belong to CSE: ${allCse}`);
      if (allCse && normalStudents.length > 0) {
        console.log('✓ PASS: Normal CSE HOD scoping is intact and unchanged.');
      } else {
        console.error('❌ Normal CSE HOD scoping discrepancy.');
        allChecksPassed = false;
      }
    }

    console.log('\n========================================');
    if (allChecksPassed) {
      console.log('🎉 ALL VALIDATION CHECKS PASSED PERFECTLY!');
    } else {
      console.log('❌ SOME VALIDATION CHECKS FAILED.');
    }
    console.log('========================================\n');

  } catch (err) {
    console.error('Validation error:', err);
  } finally {
    process.exit(0);
  }
}

runValidation();

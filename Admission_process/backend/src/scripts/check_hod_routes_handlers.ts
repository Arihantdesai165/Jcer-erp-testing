import * as hodController from '../controllers/hod.controller';
import hodRoutes from '../routes/hod.routes';

console.log('[CHECK HOD CONTROLLER EXPORTS]');
const controllerExports = Object.keys(hodController);
console.log(`Total Exports in hod.controller.ts: ${controllerExports.length}`);

// Check specific routes in hod.routes.ts
const routeNamesInRoutes = [
  'getHodDashboard',
  'getHodDepartment',
  'getHodStudents',
  'getHodStudentSemesters',
  'getHodStudentSections',
  'getHodStudentById',
  'getHodSections',
  'createHodSection',
  'bulkDistributeStudents',
  'getHodSectionById',
  'updateHodSection',
  'deleteHodSection',
  'getHodSectionStudents',
  'getHodSectionCohort',
  'bulkAllocateStudentsToSection',
  'moveStudentSection',
  'removeStudentFromSection',
  'getHodFacultyList',
  'createFacultyWithAuthorization',
  'getHodFacultyAssignments',
  'getHodFacultyDetail',
  'updateFacultyAssignment',
  'toggleFacultyAccess',
  'resetFacultyPassword',
  'toggleFacultyStatus',
  'getHodSubjects',
  'createHodSubject',
  'updateHodSubject',
  'deleteHodSubject',
  'assignHodSubject',
  'getHodAttendanceOverview',
  'getHodAttendanceDefaulters',
  'getHodAttendanceSessions',
  'getHodAcademicsOverview',
  'getHodBitwiseAnalysis',
  'getHodStudentPerformance',
  'getHodSheetAccessMatrix',
  'updateHodSheetAccess',
  'getHodSheetSyncHistory',
  'getHodReports',
  'getHodSettings',
  'updateHodProfile',
  'updateHodPassword'
];

console.log('\n[CHECKING CONTROLLER FUNCTIONS USED IN HOD ROUTES]');
for (const fnName of routeNamesInRoutes) {
  const fn = (hodController as any)[fnName];
  if (typeof fn !== 'function') {
    console.error(`❌ MISSING CONTROLLER FUNCTION: ${fnName} is ${typeof fn}`);
  } else {
    console.log(`  OK: ${fnName}`);
  }
}

process.exit(0);

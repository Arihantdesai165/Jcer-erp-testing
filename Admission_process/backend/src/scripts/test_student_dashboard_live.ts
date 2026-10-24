import axios from 'axios';

async function verifyStudentApis() {
  console.log('--- TESTING FULL STUDENT DASHBOARD APIS WITH ARIHANT CREDENTIALS ---');
  
  const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
    email: '2JR26CV001',
    password: '12345678',
  });

  const token = loginRes.data.data.token;
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
  console.log('✅ Logged in successfully as:', loginRes.data.data.user.name, `(${loginRes.data.data.user.role})`);

  // 1. Overview
  const overview = await axios.get('http://localhost:5000/api/student/overview', authHeaders);
  console.log('✅ Overview API: Status', overview.status, '| Name:', overview.data.data.student.name);

  // 2. Attendance Summary
  const attSummary = await axios.get('http://localhost:5000/api/student/attendance/summary', authHeaders);
  console.log('✅ Attendance Summary: Total Classes:', attSummary.data.data.totalClasses, '| Overall %:', attSummary.data.data.overallPercentage);

  // 3. Attendance History
  const attHistory = await axios.get('http://localhost:5000/api/student/attendance/history', authHeaders);
  console.log('✅ Attendance History: Total Records:', attHistory.data.data.totalRecords);

  // 4. Marks
  const marks = await axios.get('http://localhost:5000/api/student/marks', authHeaders);
  console.log('✅ Marks API: Subjects Count:', marks.data.data.marksBySubject.length);

  // 5. Profile
  const profile = await axios.get('http://localhost:5000/api/student/profile', authHeaders);
  console.log('✅ Profile API: Personal Name:', profile.data.data.personal.firstName, '| Masked Aadhaar:', profile.data.data.personal.aadhaarMasked);

  console.log('\n🎉 ALL 5 STUDENT DASHBOARD APIS ARE FULLY OPERATIONAL AND VERIFIED!');
  process.exit(0);
}

verifyStudentApis().catch(err => {
  console.error('❌ API Error:', err.response?.data || err.message);
  process.exit(1);
});

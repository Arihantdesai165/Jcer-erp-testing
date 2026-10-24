import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Edit, X, Lock, Download, Save, Loader2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import userManagementService, { StudentProfile } from '../../../services/userManagement.service';
import { toast } from 'react-toastify';
import { BulkOnboardingModal } from '../../../components/admin/BulkOnboardingModal';
import { ShowStudentsRangeSelector } from '../../../components/common/ShowStudentsRangeSelector';

export const StudentManagementPage: React.FC = () => {
  const { user: _currentUser } = useSelector((state: RootState) => state.auth);

  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1 });

  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [semFilter, setSemFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Controlled edit form state
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    status: 'ACTIVE',
    semester: 1,
    address: '',
  });

  const fetchStudents = async (page = 1, limitOverride?: number) => {
    setLoading(true);
    try {
      const currentLimit = limitOverride ?? pagination.limit;
      const res = await userManagementService.getStudents({
        page,
        limit: currentLimit,
        search: searchTerm || undefined,
        departmentId: deptFilter !== 'ALL' ? deptFilter : undefined,
        semester: semFilter !== 'ALL' ? semFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined
      });
      if (res.success) {
        setStudents(res.data);
        setStats(res.stats);
        setPagination(res.pagination);
      }
    } catch (err: any) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents(1);
  }, [deptFilter, semFilter, statusFilter]);

  // Debounced Search
  useEffect(() => {
    const delay = setTimeout(() => fetchStudents(1), 500);
    return () => clearTimeout(delay);
  }, [searchTerm]);

  const handleEditClick = (student: StudentProfile) => {
    setSelectedStudent(student);
    // Initialise controlled form from the student record
    setEditForm({
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      email: student.user.email,
      phone: student.user.phone || '',
      status: student.user.status,
      semester: student.semester,
      address: '',
    });
    setIsEditModalOpen(true);
  };

  const handleSaveStudent = async () => {
    if (!selectedStudent) return;
    setEditSaving(true);
    try {
      await userManagementService.updateStudent(selectedStudent.id, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        phone: editForm.phone,
        status: editForm.status,
        semester: editForm.semester,
        address: editForm.address || undefined,
      });
      toast.success('Student profile updated successfully!');
      setIsEditModalOpen(false);
      fetchStudents(pagination.page);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update student.');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-6 animate-fade-in max-w-7xl pb-8">
        
        {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Students Management</h2>
          <p className="text-sm text-neutral-500">Manage admitted students, view profiles, and update records.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 flex items-center gap-2 transition-all"
          >
            <Plus size={16} /> Add Student
          </button>
          <button 
            onClick={() => setIsBulkModalOpen(true)}
            className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl shadow-md shadow-violet-500/20 flex items-center gap-2 transition-all"
          >
            <Download className="rotate-180" size={16} /> Bulk Upload (USN Verified)
          </button>
        </div>
      </div>

      {/* STATS & FILTERS */}
      <div className="glass-panel rounded-2xl shadow-ambient border border-neutral-200/50 dark:border-neutral-800/40 p-5">
        
        <div className="flex items-center gap-6 mb-5 text-sm">
          <div className="font-bold text-neutral-700 dark:text-neutral-300">
            Total Students: <span className="text-violet-600 dark:text-violet-400">{stats.total}</span>
          </div>
          <div className="font-bold text-emerald-600">
            Active: <span>{stats.active}</span>
          </div>
          <div className="font-bold text-rose-600">
            Inactive/Suspended: <span>{stats.inactive}</span>
          </div>
        </div>

        <div className="flex flex-wrap md:flex-nowrap gap-4 justify-between items-center bg-neutral-50 dark:bg-neutral-800/30 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800/50">
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Dept:</span>
              <select 
                value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none focus:border-violet-500 shadow-sm min-w-[120px]"
              >
                <option value="ALL">All Depts</option>
                {/* Fallback to code if ID is needed, or just let backend handle it if we adapt it. For now, assuming mock UUIDs aren't available, we use ALL */}
                <option value="CSE">Computer Science & Engineering</option>
                <option value="CSE-AIML">Computer Science & Engineering (AIML)</option>
                <option value="ECE">Electronics & Communication Engineering</option>
                <option value="ME">Mechanical Engineering</option>
                <option value="CV">Civil Engineering</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Sem:</span>
              <select 
                value={semFilter} onChange={e => setSemFilter(e.target.value)}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none focus:border-violet-500 shadow-sm"
              >
                <option value="ALL">All Sems</option>
                {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Status:</span>
              <select 
                value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none focus:border-violet-500 shadow-sm"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
              <input 
                type="text" 
                placeholder="Search by name, email..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-medium focus:border-violet-500 outline-none shadow-sm"
              />
            </div>
            <ShowStudentsRangeSelector
              value={pagination.limit}
              onChange={(newLimit) => {
                setPagination(prev => ({ ...prev, limit: newLimit }));
                fetchStudents(1, newLimit);
              }}
            />
          </div>
        </div>

      </div>

      {/* STUDENTS LIST TABLE */}
      <div className="glass-panel rounded-2xl shadow-ambient border border-neutral-200/50 dark:border-neutral-800/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white border-b border-neutral-800 text-xs uppercase tracking-wider font-extrabold">
              <tr className="text-white">
                <th className="px-5 py-4 font-bold text-white">No</th>
                <th className="px-5 py-4 font-bold text-white">Name</th>
                <th className="px-5 py-4 font-bold text-white">Enrollment #</th>
                <th className="px-5 py-4 font-bold text-white">Dept & Sem</th>
                <th className="px-5 py-4 font-bold text-white">Status</th>
                <th className="px-5 py-4 font-bold text-right text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60 bg-white dark:bg-transparent">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-neutral-500 font-semibold">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                      Loading students...
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-neutral-500 font-semibold">
                    No students found matching your filters.
                  </td>
                </tr>
              ) : (
                students.map((student, index) => {
                  const no = (pagination.page - 1) * pagination.limit + index + 1;
                  return (
                    <tr key={student.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-colors group">
                      <td className="px-5 py-4 font-semibold text-neutral-500">{no}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                           <img 
                            src={student.user.profileImage || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'} 
                            alt={student.user.firstName}
                            className="w-10 h-10 rounded-xl object-cover border border-neutral-200 dark:border-neutral-700 bg-neutral-100" 
                          />
                          <div className="flex flex-col">
                            <span className="font-bold text-neutral-900 dark:text-white">
                              {student.user.firstName} {student.user.lastName}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-md text-xs font-mono">
                          {student.enrollmentNumber}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-neutral-800 dark:text-neutral-200">{student.department.code || 'N/A'}</span>
                          <span className="text-[10px] font-bold text-neutral-500 uppercase">Sem {student.semester}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center w-max gap-1.5 ${
                          student.user.status === 'ACTIVE' 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                            : student.user.status === 'SUSPENDED'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${student.user.status === 'ACTIVE' ? 'bg-emerald-500' : student.user.status === 'SUSPENDED' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                          {student.user.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEditClick(student)}
                            className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 flex items-center justify-center transition-colors"
                          >
                            <Edit size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-4 border-t border-neutral-200/60 dark:border-neutral-700/60 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/30">
            <span className="text-xs font-semibold text-neutral-500">
              Showing page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex gap-1">
              <button 
                disabled={pagination.page === 1}
                onClick={() => fetchStudents(pagination.page - 1)}
                className="px-3 py-1.5 rounded-md text-xs font-bold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 disabled:opacity-50 hover:bg-neutral-50"
              >
                Previous
              </button>
              <button 
                disabled={pagination.page === pagination.totalPages}
                onClick={() => fetchStudents(pagination.page + 1)}
                className="px-3 py-1.5 rounded-md text-xs font-bold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 disabled:opacity-50 hover:bg-neutral-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* EDIT MODAL PLACEHOLDER (To match layout, we build a static UI for now) */}
      {isEditModalOpen && selectedStudent && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-800/50">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Edit size={18} className="text-violet-600" />
                  Edit Student - {selectedStudent.user.firstName}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5 font-mono">{selectedStudent.enrollmentNumber}</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-8 flex-1">
              
              {/* Account Status Section */}
              <section>
                <h4 className="text-xs font-black text-neutral-400 tracking-widest uppercase mb-4 flex items-center gap-2">
                  <Lock size={12} /> Account Actions
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex flex-col justify-center gap-2">
                    <button
                      type="button"
                      className="w-full py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 transition-colors"
                      onClick={() => toast.info('Password reset request sent to admin queue.')}
                    >
                      Reset Password
                    </button>
                    <button
                      type="button"
                      className="w-full py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 transition-colors"
                      onClick={() => toast.info('Student will be prompted to change password on next login.')}
                    >
                      Force Password Change
                    </button>
                  </div>
                </div>
              </section>

              {/* Editable Fields */}
              <section>
                <h4 className="text-xs font-black text-neutral-400 tracking-widest uppercase mb-4">Edit Profile Data</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">First Name</label>
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))}
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Last Name</label>
                    <input
                      type="text"
                      value={editForm.lastName}
                      onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))}
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Email</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Phone</label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Semester</label>
                    <select
                      value={editForm.semester}
                      onChange={e => setEditForm(f => ({ ...f, semester: parseInt(e.target.value) }))}
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500"
                    >
                      {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Account Status</label>
                    <select
                      value={editForm.status}
                      onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500"
                    >
                      <option value="ACTIVE">✅ Active</option>
                      <option value="INACTIVE">⏸️ Inactive</option>
                      <option value="SUSPENDED">🚫 Suspended</option>
                    </select>
                  </div>
                </div>
              </section>

            </div>

            <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex justify-end gap-3">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveStudent}
                disabled={editSaving}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-md shadow-violet-500/20 transition-all disabled:opacity-60 flex items-center gap-2"
              >
                {editSaving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ADD NEW MODAL PLACEHOLDER */}
      {isAddModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-800/50">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Plus size={18} className="text-violet-600" />
                Add New Student (Manual Entry)
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl text-xs font-semibold text-amber-800 dark:text-amber-300 flex gap-2">
                Note: Creating a student here bypasses the standard Admission Workflow. Use this only for exceptional cases.
              </div>

              <section>
                <h4 className="text-xs font-black text-neutral-400 tracking-widest uppercase mb-3">Personal Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">First Name *</label>
                    <input type="text" className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Last Name *</label>
                    <input type="text" className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Email (Personal) *</label>
                    <input type="email" className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500" />
                  </div>
                </div>
              </section>

              <section>
                <h4 className="text-xs font-black text-neutral-400 tracking-widest uppercase mb-3">Academic Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Department *</label>
                    <select className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500">
                      <option>Computer Science</option>
                      <option>Computer Science & Engineering (AIML)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Batch (Cohort) *</label>
                    <select className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500">
                      <option>2026–2030</option>
                      <option>2025–2029</option>
                      <option>2024–2028</option>
                      <option>2023–2027</option>
                    </select>
                  </div>
                </div>
              </section>

              <div className="space-y-2 mt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-violet-600 bg-neutral-100 border-neutral-300 focus:ring-violet-500" />
                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Generate and dispatch credentials immediately</span>
                </label>
              </div>

            </div>
            <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex justify-end gap-3">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  toast.success('Student added successfully!');
                  setIsAddModalOpen(false);
                }}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-md shadow-violet-500/20 transition-all"
              >
                Create Student
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* BULK ONBOARDING MODAL */}
      <BulkOnboardingModal 
        isOpen={isBulkModalOpen} 
        onClose={() => setIsBulkModalOpen(false)} 
        onSuccess={() => fetchStudents(1)} 
      />
    </>
  );
};

export default StudentManagementPage;
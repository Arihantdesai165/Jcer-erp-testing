import React, { useEffect, useState } from 'react';
import API from '../../services/api';
import admissionService, { AdmissionApplication } from '../../services/admission.service';
import { toast } from 'react-toastify';
import { getAcademicYear } from '../../utils/date.util';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { 
  FileText, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Filter, 
  RefreshCw, 
  FileSpreadsheet, 
  FileCheck2, 
  Calendar,
  Building2,
  Users,
  Award,
  Sparkles,
  ShieldCheck,
  Search
} from 'lucide-react';
import { useAcademicYear } from '../../context/AcademicYearContext';

interface ReportPreset {
  id: string;
  title: string;
  description: string;
  status?: string;
  category: 'STATUS' | 'DEMOGRAPHIC' | 'QUOTA' | 'BRANCH';
  icon: any;
}

export const ReportGenerationPage: React.FC = () => {
  const { academicYears } = useAcademicYear();
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);

  // Filter States
  const [selectedReport, setSelectedReport] = useState<string>('APPROVED_ADMISSIONS');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [quotaFilter, setQuotaFilter] = useState<string>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const reportPresets: ReportPreset[] = [
    {
      id: 'APPROVED_ADMISSIONS',
      title: 'Approved Admissions',
      description: 'Enrolled and Principal signed-off student admissions',
      status: 'ENROLLED',
      category: 'STATUS',
      icon: CheckCircle2,
    },
    {
      id: 'REJECTED_ADMISSIONS',
      title: 'Rejected Admissions',
      description: 'Returned and rejected student admission files',
      status: 'REJECTED',
      category: 'STATUS',
      icon: XCircle,
    },
    {
      id: 'PENDING_APPROVALS',
      title: 'Pending Principal Approvals',
      description: 'Verified files awaiting final Principal authorization',
      status: 'APPROVED',
      category: 'STATUS',
      icon: Clock,
    },
    {
      id: 'ADMISSION_SUMMARY',
      title: 'Admission Summary',
      description: 'Complete list across all admission statuses',
      status: 'ALL',
      category: 'STATUS',
      icon: FileText,
    },
    {
      id: 'BRANCH_ADMISSIONS',
      title: 'Branch-wise Admissions',
      description: 'Admissions grouped by engineering branch',
      category: 'BRANCH',
      icon: Building2,
    },
    {
      id: 'CATEGORY_ADMISSIONS',
      title: 'Category-wise Admissions',
      description: 'Demographic breakdown by Category (GM/SC/ST/OBC)',
      category: 'DEMOGRAPHIC',
      icon: Users,
    },
    {
      id: 'GENDER_ADMISSIONS',
      title: 'Gender-wise Admissions',
      description: 'Applicant distribution by Male / Female / Other',
      category: 'DEMOGRAPHIC',
      icon: Users,
    },
    {
      id: 'ADMISSION_TYPE_REPORT',
      title: 'Admission Type Report',
      description: 'Quota distribution (KCET / DCET / Management)',
      category: 'QUOTA',
      icon: Award,
    },
  ];

  const fetchInitialData = async () => {
    try {
      const branchRes = await API.get('/branches');
      if (branchRes.data.data) {
        setBranches(branchRes.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch branches', err);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const preset = reportPresets.find(r => r.id === selectedReport);
      const queryStatus = preset?.status || (selectedReport === 'ADMISSION_SUMMARY' ? undefined : undefined);

      const res = await admissionService.listApplications({
        status: queryStatus,
        branchId: branchFilter !== 'ALL' ? branchFilter : undefined,
        admissionType: quotaFilter !== 'ALL' ? quotaFilter : undefined,
        academicYear: yearFilter !== 'ALL' ? yearFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search || undefined,
        limit: 1000
      });

      setApplications(res.applications || []);
    } catch (err: any) {
      console.error('Failed to fetch report data', err);
      toast.error('Failed to load report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchReportData();
    // eslint-disable-next-line
  }, [selectedReport, branchFilter, quotaFilter, yearFilter, startDate, endDate, search]);

  // Export to Excel (.xlsx)
  const exportToExcel = () => {
    if (applications.length === 0) {
      toast.warn('No data available to export.');
      return;
    }

    const exportRows = applications.map((app, idx) => ({
      'Sl No': idx + 1,
      'Admission Number': app.applicationNumber,
      'Student Name': app.user ? `${app.user.firstName || ''} ${app.user.lastName || ''}`.trim() : 'N/A',
      'Phone': app.studentpersonaldetails?.phone || app.user?.phone || 'N/A',
      'Branch': app.branch?.code || 'N/A',
      'Admission Quota': app.admissionType || 'N/A',
      'Qualification': app.qualification || 'N/A',
      'Status': app.applicationStatus,
      'Verified By': app.reviewedBy || 'Nodal Officer',
      'Submitted Date': app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : 'N/A',
      'Verified Date': app.verifiedAt ? new Date(app.verifiedAt).toLocaleDateString() : 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Admission Report');

    const fileName = `${selectedReport}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success(`Excel report downloaded successfully: ${fileName}`);
  };

  // Export to CSV
  const exportToCSV = () => {
    if (applications.length === 0) {
      toast.warn('No data available to export.');
      return;
    }

    const exportRows = applications.map((app, idx) => ({
      'Sl No': idx + 1,
      'Admission Number': app.applicationNumber,
      'Student Name': app.user ? `${app.user.firstName || ''} ${app.user.lastName || ''}`.trim() : 'N/A',
      'Phone': app.studentpersonaldetails?.phone || app.user?.phone || 'N/A',
      'Branch': app.branch?.code || 'N/A',
      'Admission Quota': app.admissionType || 'N/A',
      'Qualification': app.qualification || 'N/A',
      'Status': app.applicationStatus,
      'Verified By': app.reviewedBy || 'Nodal Officer',
      'Submitted Date': app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedReport}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV report downloaded successfully!');
  };

  // Export to PDF
  const exportToPDF = () => {
    if (applications.length === 0) {
      toast.warn('No data available to export.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text(`College Admission Report — ${selectedReport.replace(/_/g, ' ')}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()} | Total Records: ${applications.length}`, 14, 22);

    let startY = 30;
    doc.setFontSize(9);
    doc.text('Sl | Adm No | Student Name | Branch | Quota | Status | Verified By | Submitted Date', 14, startY);

    applications.slice(0, 30).forEach((app, idx) => {
      startY += 7;
      if (startY > 190) {
        doc.addPage();
        startY = 20;
      }
      const sName = app.user ? `${app.user.firstName || ''} ${app.user.lastName || ''}`.trim() : 'Student';
      const line = `${idx + 1}. | ${app.applicationNumber} | ${sName} | ${app.branch?.code || 'N/A'} | ${app.admissionType || 'N/A'} | ${app.applicationStatus} | ${app.reviewedBy || 'Admin'} | ${app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : 'N/A'}`;
      doc.text(line.substring(0, 130), 14, startY);
    });

    const fileName = `${selectedReport}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    toast.success(`PDF report downloaded successfully: ${fileName}`);
  };

  const activePreset = reportPresets.find(r => r.id === selectedReport);

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      {/* ═══ BANNER ═══ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-2xl border border-white/10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-extrabold uppercase tracking-widest text-indigo-300 border border-white/10">
            <FileText size={14} />
            Institutional Admission Reports
          </div>
          <h1 className="text-3xl font-black tracking-tight">Admission Report Generator & Exporter</h1>
          <p className="text-slate-300 text-sm max-w-xl leading-relaxed font-medium">
            Generate official admission audit reports, status statements, and quota rosters. Export directly into Excel, CSV, or PDF format.
          </p>
        </div>
      </div>

      {/* ═══ REPORT PRESETS GRID ═══ */}
      <div className="space-y-3">
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles size={18} className="text-indigo-600" />
          Select Report Type
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {reportPresets.map((preset) => {
            const Icon = preset.icon;
            const isSelected = selectedReport === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => setSelectedReport(preset.id)}
                className={`cursor-pointer p-5 rounded-2xl border transition-all duration-300 space-y-2 flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20 -translate-y-1'
                    : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 hover:border-indigo-400 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`size-10 rounded-xl flex items-center justify-center ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600'
                  }`}>
                    <Icon size={20} />
                  </div>
                  {isSelected && <span className="text-[10px] font-black uppercase bg-white/20 px-2 py-0.5 rounded-md">Selected</span>}
                </div>

                <div>
                  <h3 className={`text-xs font-black ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {preset.title}
                  </h3>
                  <p className={`text-[10px] font-medium leading-relaxed mt-1 ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                    {preset.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ FILTERS & EXPORT TOOLBAR ═══ */}
      <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-slate-200 dark:border-neutral-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-neutral-800 pb-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Report Parameters: {activePreset?.title}
            </h3>
            <p className="text-xs text-slate-500 font-medium">Filter records before generating export bundle</p>
          </div>

          {/* Export Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md transition-all hover:scale-[1.02]"
            >
              <FileSpreadsheet size={16} /> Export Excel (.xlsx)
            </button>

            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md transition-all hover:scale-[1.02]"
            >
              <FileText size={16} /> Export CSV
            </button>

            <button
              onClick={exportToPDF}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md transition-all hover:scale-[1.02]"
            >
              <Download size={16} /> Export PDF
            </button>
          </div>
        </div>

        {/* Filter Selection Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Academic Year</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-bold outline-none"
            >
              <option value="ALL">All Academic Years</option>
              {academicYears.map((ay) => (
                <option key={ay.id || ay.year} value={ay.year}>{ay.year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Engineering Branch</label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-bold outline-none"
            >
              <option value="ALL">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Admission Quota</label>
            <select
              value={quotaFilter}
              onChange={(e) => setQuotaFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-bold outline-none"
            >
              <option value="ALL">All Quotas</option>
              <option value="KCET">KCET</option>
              <option value="DCET">DCET</option>
              <option value="MANAGEMENT">MANAGEMENT</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-bold outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-bold outline-none"
            />
          </div>
        </div>
      </div>

      {/* ═══ LIVE REPORT PREVIEW TABLE ═══ */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200 dark:border-neutral-800 overflow-hidden shadow-sm space-y-4">
        <div className="p-5 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Generated Report Records ({applications.length})
            </h3>
            <p className="text-xs text-slate-500 font-medium">Live data preview before downloading export file</p>
          </div>

          <button
            onClick={() => fetchReportData()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 text-xs font-bold"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-2">
            <RefreshCw size={24} className="animate-spin text-indigo-600 mx-auto" />
            <p className="text-xs font-bold text-slate-400">Loading report records...</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <FileText size={32} className="text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No matching admission records found</p>
            <p className="text-xs text-slate-400">Try adjusting your filters or date range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#111111] dark:bg-neutral-950 text-white font-extrabold uppercase text-[11px] tracking-wider border-b border-neutral-800">
                  <th className="py-3.5 px-4">#</th>
                  <th className="py-3.5 px-4">Admission No</th>
                  <th className="py-3.5 px-4">Student Name</th>
                  <th className="py-3.5 px-4">Phone</th>
                  <th className="py-3.5 px-4">Branch</th>
                  <th className="py-3.5 px-4">Quota</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Verified By</th>
                  <th className="py-3.5 px-4">Submitted Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                {applications.map((app, idx) => {
                  const sName = app.user ? `${app.user.firstName || ''} ${app.user.lastName || ''}`.trim() : 'Guest Applicant';
                  return (
                    <tr key={app.id} className="hover:bg-slate-50/80 dark:hover:bg-neutral-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-black text-slate-900 dark:text-white">#{app.applicationNumber}</td>
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">{sName}</td>
                      <td className="py-3 px-4 text-slate-500 font-medium">{app.studentpersonaldetails?.phone || app.user?.phone || 'N/A'}</td>
                      <td className="py-3 px-4 font-extrabold text-indigo-600 dark:text-indigo-400">{app.branch?.code || 'N/A'}</td>
                      <td className="py-3 px-4 font-bold text-slate-600">{app.admissionType || 'N/A'}</td>
                      <td className="py-3 px-4 font-extrabold text-slate-700 dark:text-slate-300">{app.applicationStatus}</td>
                      <td className="py-3 px-4 text-slate-500 font-medium">{app.reviewedBy || 'Admin Officer'}</td>
                      <td className="py-3 px-4 text-slate-400 font-medium">{app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportGenerationPage;

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserPlus, 
  Download, 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  ArrowRight, 
  Users, 
  Calendar, 
  GraduationCap, 
  BookOpen, 
  Layers, 
  ShieldCheck, 
  Loader2, 
  FileText, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Info,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import existingStudentOnboardingService, {
  OnboardingContext,
  ValidationResponse,
  ValidatedStudentRow,
  OnboardingBatchRecord,
} from '../../../services/existingStudentOnboarding.service';

const DEFAULT_DEPARTMENTS = [
  { id: '1', name: 'Computer Science & Engineering', code: 'CSE' },
  { id: '2', name: 'Electronics & Communication Engineering', code: 'ECE' },
  { id: '3', name: 'Mechanical Engineering', code: 'ME' },
  { id: '4', name: 'Civil Engineering', code: 'CV' },
  { id: '5', name: 'Computer Science & Engineering (AIML)', code: 'CSE-AIML' },
];

export const ExistingStudentOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Active Tab: 'ONBOARD' | 'HISTORY'
  const [activeTab, setActiveTab] = useState<'ONBOARD' | 'HISTORY'>('ONBOARD');

  // Academic Context Selection
  const [contextLoading, setContextLoading] = useState<boolean>(false);
  const [context, setContext] = useState<OnboardingContext>({
    departments: DEFAULT_DEPARTMENTS,
    academicYears: ['2026-2027', '2025-2026', '2024-2025'],
    schemes: ['2025', '2022', '2021', '2018'],
    semesters: [1, 2, 3, 4, 5, 6, 7, 8],
    sections: ['A', 'B', 'C', 'D'],
  });

  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('');
  const [selectedScheme, setSelectedScheme] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<number | ''>('');
  const [selectedDepartmentCode, setSelectedDepartmentCode] = useState<string>('');

  // File & Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [validating, setValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
  const [importing, setImporting] = useState<boolean>(false);
  const [importSuccessData, setImportSuccessData] = useState<{
    batchId: string;
    totalImported: number;
    failedCount: number;
  } | null>(null);

  // Preview Table Filter & Search
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'VALID' | 'WARNING' | 'ERROR'>('ALL');
  const [previewPage, setPreviewPage] = useState<number>(1);
  const previewPageSize = 10;

  // History Tab State
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyBatches, setHistoryBatches] = useState<OnboardingBatchRecord[]>([]);
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyTotalPages, setHistoryTotalPages] = useState<number>(1);
  const [historyTotalCount, setHistoryTotalCount] = useState<number>(0);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<OnboardingBatchRecord | null>(null);

  // Load initial academic context
  useEffect(() => {
    fetchContext();
  }, []);

  // Reload history when switching to HISTORY tab
  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchHistory(historyPage);
    }
  }, [activeTab, historyPage]);

  const fetchContext = async () => {
    try {
      setContextLoading(true);
      const data = await existingStudentOnboardingService.getContext();
      if (data) {
        setContext(data);
      }
    } catch (err: any) {
      console.warn('Notice loading academic context (using fallback defaults):', err);
    } finally {
      setContextLoading(false);
    }
  };

  const fetchHistory = async (page: number) => {
    try {
      setHistoryLoading(true);
      const data = await existingStudentOnboardingService.getHistory(page, 10);
      setHistoryBatches(data.batches);
      setHistoryTotalCount(data.pagination.total);
      setHistoryTotalPages(data.pagination.totalPages);
    } catch (err: any) {
      toast.error('Failed to load onboarding history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      toast.info('Downloading Excel template...');
      await existingStudentOnboardingService.downloadTemplate({
        academicYear: selectedAcademicYear,
        scheme: selectedScheme,
        semester: selectedSemester || undefined,
        departmentCode: selectedDepartmentCode || 'CSE',
      });
      toast.success('Template downloaded successfully.');
    } catch (err: any) {
      console.error('Failed to download Excel template:', err);
      toast.error('Failed to download Excel template.');
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Please upload a valid Excel file (.xlsx, .xls) or .csv');
      return;
    }
    setSelectedFile(file);
    setValidationResult(null);
    setImportSuccessData(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleValidate = async () => {
    if (!selectedAcademicYear) {
      toast.warn('Please select an Academic Year first.');
      return;
    }
    if (!selectedScheme) {
      toast.warn('Please select a Scheme (Syllabus) first.');
      return;
    }
    if (selectedSemester === '' || !selectedSemester) {
      toast.warn('Please select a Current Semester first.');
      return;
    }
    if (!selectedDepartmentCode) {
      toast.warn('Please select a Department first.');
      return;
    }
    if (!selectedFile) {
      toast.error('Please select an Excel file first.');
      return;
    }

    try {
      setValidating(true);
      const res = await existingStudentOnboardingService.validateFile(selectedFile, {
        academicYear: selectedAcademicYear,
        scheme: selectedScheme,
        semester: Number(selectedSemester),
        departmentCode: selectedDepartmentCode,
      });
      setValidationResult(res);
      setPreviewPage(1);
      if (res.errorCount > 0) {
        toast.warn(`Spreadsheet validated with ${res.errorCount} blocking errors. Please review preview below.`);
      } else {
        toast.success(`Validation successful! ${res.validRecords} student records ready for onboarding.`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Validation failed. Please verify the spreadsheet format.');
    } finally {
      setValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!validationResult || !validationResult.canImport) {
      toast.error('Cannot import while blocking errors exist. Please fix the spreadsheet.');
      return;
    }

    const validRecords = validationResult.rows
      .filter((r) => r.status === 'VALID' || r.status === 'WARNING')
      .map((r) => r.data);

    if (validRecords.length === 0) {
      toast.error('No valid records to import.');
      return;
    }

    try {
      setImporting(true);
      const res = await existingStudentOnboardingService.importStudents({
        fileName: selectedFile?.name || 'existing_students_import.xlsx',
        academicYear: selectedAcademicYear || '2026-2027',
        scheme: selectedScheme || '2025',
        semester: Number(selectedSemester) || 3,
        departmentCode: selectedDepartmentCode || 'CSE',
        records: validRecords,
      });

      setImportSuccessData(res);
      toast.success(`Successfully onboarded ${res.totalImported} existing students!`);
    } catch (err: any) {
      console.error('Import error details:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to complete student onboarding.');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setImportSuccessData(null);
    setSelectedAcademicYear('');
    setSelectedScheme('');
    setSelectedSemester('');
    setSelectedDepartmentCode('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Filtered preview rows
  const filteredPreviewRows = (validationResult?.rows || []).filter((row) => {
    const matchesFilter =
      previewFilter === 'ALL' ||
      (previewFilter === 'VALID' && row.status === 'VALID') ||
      (previewFilter === 'WARNING' && row.status === 'WARNING') ||
      (previewFilter === 'ERROR' && row.status === 'ERROR');

    const searchLower = previewSearch.toLowerCase();
    const matchesSearch =
      !previewSearch ||
      (row.data.name && row.data.name.toLowerCase().includes(searchLower)) ||
      (row.data.usn && row.data.usn.toLowerCase().includes(searchLower)) ||
      (row.data.enrollmentNumber && row.data.enrollmentNumber.toLowerCase().includes(searchLower)) ||
      (row.data.departmentCode && row.data.departmentCode.toLowerCase().includes(searchLower)) ||
      (row.data.studentEmail && row.data.studentEmail.toLowerCase().includes(searchLower));

    return matchesFilter && matchesSearch;
  });

  const previewTotalPages = Math.ceil(filteredPreviewRows.length / previewPageSize) || 1;
  const paginatedPreviewRows = filteredPreviewRows.slice(
    (previewPage - 1) * previewPageSize,
    previewPage * previewPageSize
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-900/30 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <UserPlus className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white">Existing Student Onboarding</h1>
                <p className="text-sm font-medium text-slate-300 mt-0.5">
                  Add students admitted before the ERP admission system.
                </p>
              </div>
            </div>
          </div>

          {/* Tab switchers */}
          <div className="flex items-center bg-slate-950/60 p-1.5 rounded-xl border border-white/10 backdrop-blur-md self-start md:self-auto">
            <button
              onClick={() => setActiveTab('ONBOARD')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'ONBOARD'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              Onboard Students
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'HISTORY'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock className="w-4 h-4" />
              Import History
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: ONBOARD STUDENTS */}
      {activeTab === 'ONBOARD' && (
        <div className="space-y-6">
          {/* STEP 1: Academic Context & Template */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-slate-200 dark:border-neutral-800 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-black flex items-center justify-center text-sm border border-indigo-200 dark:border-indigo-800/40">
                  1
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">Academic Context & Template</h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">
                    Select target batch parameters and download the standardized template.
                  </p>
                </div>
              </div>

              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 font-bold text-xs transition-all shadow-sm"
              >
                <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Download Excel Template
              </button>
            </div>

            {/* Context Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
              {/* Academic Year */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                  Academic Year
                </label>
                <select
                  value={selectedAcademicYear}
                  onChange={(e) => setSelectedAcademicYear(e.target.value)}
                  className={`w-full px-3 py-2 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 transition-colors ${
                    !selectedAcademicYear ? 'text-slate-400 dark:text-neutral-500' : 'text-slate-800 dark:text-white'
                  }`}
                >
                  <option value="" disabled>
                    Select Academic Year
                  </option>
                  {context.academicYears.map((yr) => (
                    <option key={yr} value={yr} className="text-slate-800 dark:text-white">
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scheme */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                  Scheme (Syllabus)
                </label>
                <select
                  value={selectedScheme}
                  onChange={(e) => setSelectedScheme(e.target.value)}
                  className={`w-full px-3 py-2 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 transition-colors ${
                    !selectedScheme ? 'text-slate-400 dark:text-neutral-500' : 'text-slate-800 dark:text-white'
                  }`}
                >
                  <option value="" disabled>
                    Select Scheme
                  </option>
                  {context.schemes.map((sc) => (
                    <option key={sc} value={sc} className="text-slate-800 dark:text-white">
                      Scheme {sc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                  Current Semester
                </label>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value === '' ? '' : Number(e.target.value))}
                  className={`w-full px-3 py-2 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 transition-colors ${
                    selectedSemester === '' ? 'text-slate-400 dark:text-neutral-500' : 'text-slate-800 dark:text-white'
                  }`}
                >
                  <option value="" disabled>
                    Select Current Semester
                  </option>
                  {context.semesters.map((sem) => (
                    <option key={sem} value={sem} className="text-slate-800 dark:text-white">
                      Semester {sem}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                  Department
                </label>
                <select
                  value={selectedDepartmentCode}
                  onChange={(e) => setSelectedDepartmentCode(e.target.value)}
                  className={`w-full px-3 py-2 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 transition-colors ${
                    !selectedDepartmentCode ? 'text-slate-400 dark:text-neutral-500' : 'text-slate-800 dark:text-white'
                  }`}
                >
                  <option value="" disabled>
                    Select Department
                  </option>
                  {context.departments.map((dept) => (
                    <option key={dept.id} value={dept.code} className="text-slate-800 dark:text-white">
                      {dept.code} — {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Hint alert */}
            <div className="mt-4 flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 text-xs">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Important Onboarding Rule:</span> Pre-ERP existing students will be enrolled without ERP Application Numbers (<code className="bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded font-mono">application_number = NULL</code>). They will immediately be accessible in Student Master, HOD lists, and Teacher attendance/marks sheets.
              </div>
            </div>
          </div>

          {/* STEP 2: Excel Upload Dropzone */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-slate-200 dark:border-neutral-800 shadow-sm">
            <div className="flex items-center gap-3 pb-5 border-b border-slate-100 dark:border-neutral-800">
              <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-black flex items-center justify-center text-sm border border-indigo-200 dark:border-indigo-800/40">
                2
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Upload Spreadsheet</h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  Upload the completed Excel file containing existing student records.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />

              {!selectedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[1.01]'
                      : 'border-slate-300 dark:border-neutral-700 hover:border-indigo-400 hover:bg-slate-50/50 dark:hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 shadow-inner">
                    <FileSpreadsheet className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">
                    Click to browse or drag and drop your Excel file here
                  </p>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
                    Supports .xlsx, .xls, and .csv (Max file size: 15MB)
                  </p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-50 dark:bg-neutral-800/50 rounded-2xl border border-slate-200 dark:border-neutral-700 gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-200 dark:border-emerald-800/40">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white break-all">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-neutral-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Ready for validation
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <button
                      onClick={handleReset}
                      className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-neutral-700 hover:bg-slate-300 dark:hover:bg-neutral-600 text-slate-700 dark:text-neutral-200 font-bold text-xs transition-all flex items-center gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      Remove
                    </button>
                    <button
                      onClick={handleValidate}
                      disabled={validating}
                      className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {validating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Validating Spreadsheet...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Validate Spreadsheet
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* STEP 3: Validation Summary & Metrics */}
          {validationResult && (
            <div className="space-y-6">
              {/* Metric Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-sm">
                  <p className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">Total Rows</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {validationResult.totalRecords}
                  </p>
                </div>

                <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 shadow-sm">
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Valid Rows</p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {validationResult.validRecords}
                  </p>
                </div>

                <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/40 shadow-sm">
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Warnings</p>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                    {validationResult.warningCount}
                  </p>
                </div>

                <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-rose-200 dark:border-rose-900/40 shadow-sm">
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Errors</p>
                  <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                    {validationResult.errorCount}
                  </p>
                </div>

                <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-purple-200 dark:border-purple-900/40 shadow-sm">
                  <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Duplicates</p>
                  <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                    {validationResult.duplicateCount}
                  </p>
                </div>
              </div>

              {/* Status Banner */}
              {validationResult.errorCount > 0 ? (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Blocking Errors Detected</p>
                    <p className="mt-0.5 text-rose-700 dark:text-rose-300/80">
                      Import is locked until all {validationResult.errorCount} row errors (such as duplicate USNs, duplicate emails, or missing mandatory fields) are resolved. Please review the table below or upload a corrected file.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm">Ready For Import</p>
                      <p className="mt-0.5 text-emerald-700 dark:text-emerald-300/80">
                        All {validationResult.validRecords} student records verified without blocking errors. Click "Confirm & Import Students" to complete enrollment.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleConfirmImport}
                    disabled={importing}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 flex-shrink-0 disabled:opacity-50"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importing Records...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Confirm & Import Students
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* STEP 4: Preview Table */}
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-sm overflow-hidden">
                {/* Table Top Controls */}
                <div className="p-4 border-b border-slate-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs">
                      3
                    </span>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">Validation Preview</h4>
                    <span className="text-xs text-slate-400">({filteredPreviewRows.length} shown)</span>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Status Filter Buttons */}
                    <div className="flex items-center bg-slate-100 dark:bg-neutral-800 p-1 rounded-xl text-xs font-semibold">
                      <button
                        onClick={() => { setPreviewFilter('ALL'); setPreviewPage(1); }}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          previewFilter === 'ALL' ? 'bg-white dark:bg-neutral-700 shadow-xs text-slate-900 dark:text-white font-bold' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        All ({validationResult.totalRecords})
                      </button>
                      <button
                        onClick={() => { setPreviewFilter('VALID'); setPreviewPage(1); }}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          previewFilter === 'VALID' ? 'bg-white dark:bg-neutral-700 shadow-xs text-emerald-600 font-bold' : 'text-slate-500 hover:text-emerald-600'
                        }`}
                      >
                        Valid
                      </button>
                      <button
                        onClick={() => { setPreviewFilter('WARNING'); setPreviewPage(1); }}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          previewFilter === 'WARNING' ? 'bg-white dark:bg-neutral-700 shadow-xs text-amber-600 font-bold' : 'text-slate-500 hover:text-amber-600'
                        }`}
                      >
                        Warnings ({validationResult.warningCount})
                      </button>
                      <button
                        onClick={() => { setPreviewFilter('ERROR'); setPreviewPage(1); }}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          previewFilter === 'ERROR' ? 'bg-white dark:bg-neutral-700 shadow-xs text-rose-600 font-bold' : 'text-slate-500 hover:text-rose-600'
                        }`}
                      >
                        Errors ({validationResult.errorCount})
                      </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search preview..."
                        value={previewSearch}
                        onChange={(e) => { setPreviewSearch(e.target.value); setPreviewPage(1); }}
                        className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 w-44"
                      />
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-black text-white font-extrabold border-b border-black uppercase tracking-wider">
                        <th className="py-3.5 px-3 text-white font-extrabold">#</th>
                        <th className="py-3.5 px-3 text-white font-extrabold">Status</th>
                        <th className="py-3.5 px-3 text-white font-extrabold">USN</th>
                        <th className="py-3.5 px-3 text-white font-extrabold">Student Name</th>
                        <th className="py-3.5 px-3 text-white font-extrabold">Enrollment No</th>
                        <th className="py-3.5 px-3 text-white font-extrabold">Department</th>
                        <th className="py-3.5 px-3 text-white font-extrabold">Scheme</th>
                        <th className="py-3.5 px-3 text-white font-extrabold">Sem</th>
                        <th className="py-3.5 px-3 text-white font-extrabold">Sec</th>
                        <th className="py-3.5 px-3 text-white font-extrabold">Roll No</th>
                        <th className="py-3.5 px-3 text-white font-extrabold">Academic Year</th>
                        <th className="py-3.5 px-3 text-white font-extrabold">Type</th>
                        <th className="py-3.5 px-3 text-white font-extrabold">Validation Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/60 font-medium">
                      {paginatedPreviewRows.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="py-8 text-center text-slate-400">
                            No records match the current preview filter.
                          </td>
                        </tr>
                      ) : (
                        paginatedPreviewRows.map((row) => (
                          <tr
                            key={row.rowIndex}
                            className={`hover:bg-slate-50/50 dark:hover:bg-neutral-800/20 transition-colors ${
                              row.status === 'ERROR'
                                ? 'bg-rose-50/20 dark:bg-rose-950/10'
                                : row.status === 'WARNING'
                                ? 'bg-amber-50/10 dark:bg-amber-950/5'
                                : ''
                            }`}
                          >
                            <td className="py-3 px-3 text-slate-400 font-mono font-bold">
                              {row.rowIndex}
                            </td>

                            <td className="py-3 px-3">
                              {row.status === 'VALID' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
                                  <Check className="w-3 h-3" /> Valid
                                </span>
                              )}
                              {row.status === 'WARNING' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-bold text-[10px]">
                                  <AlertTriangle className="w-3 h-3" /> Warning
                                </span>
                              )}
                              {row.status === 'ERROR' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold text-[10px]">
                                  <X className="w-3 h-3" /> Error
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                              {row.data.usn || <span className="text-slate-400 font-normal italic">NULL</span>}
                            </td>

                            <td className="py-3 px-3 font-bold text-slate-800 dark:text-neutral-200">
                              {row.data.name}
                            </td>

                            <td className="py-3 px-3 font-mono text-slate-600 dark:text-neutral-400">
                              {row.data.enrollmentNumber || '—'}
                            </td>

                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-neutral-800 rounded font-semibold text-slate-700 dark:text-neutral-300">
                                {row.data.departmentCode}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-slate-600 dark:text-neutral-400">
                              {row.data.scheme}
                            </td>

                            <td className="py-3 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                              Sem {row.data.currentSemester}
                            </td>

                            <td className="py-3 px-3 text-slate-700 dark:text-neutral-300 font-bold">
                              {row.data.section || '—'}
                            </td>

                            <td className="py-3 px-3 text-slate-600 dark:text-neutral-400 font-mono">
                              {row.data.rollNumber || '—'}
                            </td>

                            <td className="py-3 px-3 text-slate-600 dark:text-neutral-400">
                              {row.data.academicYear}
                            </td>

                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded font-bold text-[10px]">
                                {row.data.admissionType}
                              </span>
                            </td>

                            <td className="py-3 px-3 max-w-xs">
                              {row.errors.length > 0 && (
                                <ul className="text-[11px] text-rose-600 dark:text-rose-400 list-disc list-inside space-y-0.5">
                                  {row.errors.map((err, idx) => (
                                    <li key={idx}>{err}</li>
                                  ))}
                                </ul>
                              )}
                              {row.warnings.length > 0 && (
                                <ul className="text-[11px] text-amber-600 dark:text-amber-400 list-disc list-inside space-y-0.5">
                                  {row.warnings.map((warn, idx) => (
                                    <li key={idx}>{warn}</li>
                                  ))}
                                </ul>
                              )}
                              {row.errors.length === 0 && row.warnings.length === 0 && (
                                <span className="text-[11px] text-slate-400">Ready for onboarding</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Preview Pagination */}
                {previewTotalPages > 1 && (
                  <div className="p-3 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between text-xs text-slate-500">
                    <div>
                      Page {previewPage} of {previewTotalPages}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                        disabled={previewPage === 1}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-neutral-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-neutral-800"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPreviewPage((p) => Math.min(previewTotalPages, p + 1))}
                        disabled={previewPage === previewTotalPages}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-neutral-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-neutral-800"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUCCESS MODAL / BANNER */}
          {importSuccessData && (
            <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 shadow-md animate-fadeIn">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-black tracking-tight">Onboarding Batch Complete!</h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                    Successfully onboarded <strong>{importSuccessData.totalImported}</strong> existing students into the ERP system. They have been assigned their academic semester and section, and are now available in Student Master and HOD/Faculty modules.
                  </p>

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={() => navigate('/admin/students')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Users className="w-4 h-4" />
                      View in Student Master
                    </button>
                    <button
                      onClick={() => {
                        handleReset();
                        setActiveTab('HISTORY');
                      }}
                      className="px-4 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-bold hover:bg-emerald-100/50 transition-all flex items-center gap-1.5"
                    >
                      <Clock className="w-4 h-4" />
                      View Import History
                    </button>
                    <button
                      onClick={handleReset}
                      className="px-4 py-2 rounded-xl bg-transparent hover:bg-emerald-200/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold transition-all"
                    >
                      Onboard Another Batch
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: IMPORT HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                <Clock className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Existing Student Onboarding History</h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  Audit log of previous existing student batch imports.
                </p>
              </div>
            </div>

            <button
              onClick={() => fetchHistory(historyPage)}
              className="p-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800 text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-black text-white font-extrabold border-b border-black uppercase tracking-wider">
                  <th className="py-3.5 px-4 text-white font-extrabold">Date & Time</th>
                  <th className="py-3.5 px-4 text-white font-extrabold">File Name</th>
                  <th className="py-3.5 px-4 text-white font-extrabold">Academic Year</th>
                  <th className="py-3.5 px-4 text-white font-extrabold">Scheme</th>
                  <th className="py-3.5 px-4 text-white font-extrabold">Semester</th>
                  <th className="py-3.5 px-4 text-white font-extrabold">Department</th>
                  <th className="py-3.5 px-4 text-white font-extrabold">Section</th>
                  <th className="py-3.5 px-4 text-white font-extrabold">Total</th>
                  <th className="py-3.5 px-4 text-white font-extrabold">Successful</th>
                  <th className="py-3.5 px-4 text-white font-extrabold">Failed</th>
                  <th className="py-3.5 px-4 text-white font-extrabold">Imported By</th>
                  <th className="py-3.5 px-4 text-white font-extrabold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-800 font-medium">
                {historyLoading ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                      Loading history...
                    </td>
                  </tr>
                ) : historyBatches.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      No onboarding history found. Use the "Onboard Students" tab to upload your first batch.
                    </td>
                  </tr>
                ) : (
                  historyBatches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-slate-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-neutral-400">
                        {new Date(batch.createdAt).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">
                        {batch.fileName}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-neutral-300">
                        {batch.academicYear}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-neutral-300">
                        {batch.scheme}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                        Sem {batch.semester}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-neutral-800 rounded font-bold text-slate-700 dark:text-neutral-300">
                          {batch.departmentCode || 'ALL'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 dark:text-neutral-300 font-bold">
                        {batch.section || 'ALL'}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        {batch.totalRecords}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                        {batch.successfulRecords}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-rose-600 dark:text-rose-400">
                        {batch.failedRecords}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-neutral-300">
                        {batch.operator ? `${batch.operator.firstName || ''} ${batch.operator.lastName || ''}`.trim() : 'Admin'}
                      </td>

                      <td className="py-3.5 px-4">
                        {batch.status === 'COMPLETED' && (
                          <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
                            COMPLETED
                          </span>
                        )}
                        {batch.status === 'PARTIAL' && (
                          <span className="px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-bold text-[10px]">
                            PARTIAL
                          </span>
                        )}
                        {batch.status === 'FAILED' && (
                          <span className="px-2.5 py-1 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold text-[10px]">
                            FAILED
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* History Pagination */}
          {historyTotalPages > 1 && (
            <div className="p-4 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing {(historyPage - 1) * 10 + 1} to {Math.min(historyPage * 10, historyTotalCount)} of {historyTotalCount} batches
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-neutral-800 font-bold"
                >
                  Previous
                </button>
                <button
                  onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                  disabled={historyPage === historyTotalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-neutral-800 font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExistingStudentOnboardingPage;

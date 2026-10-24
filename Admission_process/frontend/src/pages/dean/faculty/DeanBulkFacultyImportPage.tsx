import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  ArrowLeft,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCheck,
  RefreshCw,
  Shield,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react';
import deanService from '../../../services/dean.service';

interface ValidationRow {
  rowNumber: number;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  gender?: string | null;
  email: string;
  phone?: string | null;
  designation: string;
  joiningDate?: string;
  coreDepartmentInput: string;
  coreDepartmentId?: string;
  coreDepartmentName?: string;
  coreDepartmentCode?: string;
  status?: string;
  isValid: boolean;
  errors: string[];
}

interface ValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  departments: Array<{ id: string; name: string; code: string }>;
  results: ValidationRow[];
}

interface ImportedFacultyResult {
  teacherId?: string;
  userId?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  gender?: string;
  name: string;
  email: string;
  temporaryPassword?: string;
  designation?: string;
  coreDepartmentId?: string;
  coreDepartmentName?: string;
  coreDepartmentCode?: string;
  status: string;
}

export const DeanBulkFacultyImportPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [validationData, setValidationData] = useState<ValidationSummary | null>(null);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);
  const [importedAccounts, setImportedAccounts] = useState<ImportedFacultyResult[]>([]);
  const [showPasswords, setShowPasswords] = useState<boolean>(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'VALID' | 'ERRORS'>('ALL');

  // Step 1: Download Template
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setGeneralError(null);
    try {
      const blob = await deanService.downloadBulkFacultyTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'JCER_Global_Faculty_Import_Template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Failed to download template:', err);
      setGeneralError('Failed to generate Excel template. Please try again.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Step 2: File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setValidationData(null);
      setGeneralError(null);
      setImportSuccess(false);
      setImportedAccounts([]);
    }
  };

  // Step 3: Validate File
  const handleValidate = async () => {
    if (!selectedFile) {
      setGeneralError('Please select an Excel file (.xlsx) to validate.');
      return;
    }

    setValidating(true);
    setGeneralError(null);
    try {
      const response = await deanService.validateBulkFaculty(selectedFile);
      
      const payload = response?.data || response;
      const rawRows = Array.isArray(payload?.rows)
        ? payload.rows
        : Array.isArray(payload?.results)
        ? payload.results
        : Array.isArray(payload?.validRecords) || Array.isArray(payload?.errors)
        ? [...(payload.validRecords || []), ...(payload.errors || [])]
        : [];

      const parsedRows: ValidationRow[] = rawRows.map((r: any, idx: number) => ({
        rowNumber: r.rowNumber ?? idx + 2,
        firstName: r.firstName ?? r.rowData?.firstName ?? '',
        middleName: r.middleName ?? r.rowData?.middleName ?? '',
        lastName: r.lastName ?? r.rowData?.lastName ?? '',
        gender: r.gender ?? r.rowData?.gender ?? '',
        email: r.email ?? r.rowData?.email ?? '',
        phone: r.phone ?? r.rowData?.phone ?? null,
        designation: r.designation ?? r.rowData?.designation ?? '',
        joiningDate: r.joiningDate ?? r.rowData?.joiningDate ?? '',
        coreDepartmentInput: r.coreDepartmentInput ?? r.coreDepartment ?? r.rowData?.coreDepartment ?? '',
        coreDepartmentId: r.coreDepartmentId,
        coreDepartmentName: r.coreDepartmentName,
        coreDepartmentCode: r.coreDepartmentCode,
        isValid: r.isValid !== undefined ? Boolean(r.isValid) : r.status === 'VALID',
        status: r.status || (r.isValid ? 'VALID' : 'INVALID'),
        errors: Array.isArray(r.errors)
          ? r.errors
          : Array.isArray(r.errorMessages)
          ? r.errorMessages
          : [],
      }));

      const totalRows = payload?.summary?.total ?? payload?.totalRows ?? payload?.totalRecords ?? parsedRows.length;
      const validRows = payload?.summary?.valid ?? payload?.validRows ?? payload?.validCount ?? parsedRows.filter((r) => r.isValid).length;
      const invalidRows = payload?.summary?.invalid ?? payload?.invalidRows ?? payload?.errorCount ?? parsedRows.filter((r) => !r.isValid).length;

      setValidationData({
        totalRows,
        validRows,
        invalidRows,
        departments: payload?.departments || [],
        results: parsedRows,
      });

      if (response?.success === false) {
        setGeneralError(response?.message || 'Some validation issues were found in the uploaded file.');
      }
    } catch (err: any) {
      console.error('Validation error:', err);
      const status = err?.response?.status;
      if (status === 403) {
        setGeneralError('You are not authorized to perform bulk faculty import.');
      } else if (status === 422) {
        setGeneralError(err?.response?.data?.message || 'Excel validation failed. Please correct the highlighted rows.');
      } else if (status === 400) {
        setGeneralError(err?.response?.data?.error || err?.response?.data?.message || 'Invalid Excel file format or data.');
      } else if (status === 409) {
        setGeneralError(err?.response?.data?.message || 'Conflict detected in faculty records.');
      } else if (status >= 500) {
        setGeneralError('Unable to validate the Excel file. Please try again.');
      } else {
        setGeneralError(
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Failed to validate the Excel file. Please ensure it follows the official template.'
        );
      }
    } finally {
      setValidating(false);
    }
  };

  // Step 4: Download Error Report
  const handleDownloadErrorReport = () => {
    if (!validationData || validationData.invalidRows === 0) return;

    const invalidRecords = (validationData.results || []).filter((r) => !r.isValid);
    const csvRows = [
      ['Row #', 'First Name', 'Middle Name', 'Last Name', 'Gender', 'Email', 'Phone', 'Designation', 'Joining Date', 'Core Department', 'Validation Errors'].join(','),
      ...invalidRecords.map((r) =>
        [
          r.rowNumber,
          `"${(r.firstName || '').replace(/"/g, '""')}"`,
          `"${(r.middleName || '').replace(/"/g, '""')}"`,
          `"${(r.lastName || '').replace(/"/g, '""')}"`,
          `"${(r.gender || '').replace(/"/g, '""')}"`,
          `"${(r.email || '').replace(/"/g, '""')}"`,
          `"${(r.phone || '').replace(/"/g, '""')}"`,
          `"${(r.designation || '').replace(/"/g, '""')}"`,
          `"${(r.joiningDate || '').replace(/"/g, '""')}"`,
          `"${(r.coreDepartmentInput || '').replace(/"/g, '""')}"`,
          `"${(r.errors || []).join('; ').replace(/"/g, '""')}"`,
        ].join(',')
      ),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Faculty_Import_Errors_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Step 5: Final Import
  const handleImport = async () => {
    if (!validationData || validationData.validRows === 0) return;

    const validRecords = (validationData.results || [])
      .filter((r) => r.isValid)
      .map((r) => ({
        firstName: r.firstName,
        middleName: r.middleName,
        lastName: r.lastName,
        gender: r.gender,
        email: r.email,
        phone: r.phone,
        designation: r.designation,
        joiningDate: r.joiningDate,
        coreDepartmentId: r.coreDepartmentId,
        coreDepartmentCode: r.coreDepartmentCode,
        coreDepartmentName: r.coreDepartmentName,
      }));

    setImporting(true);
    setGeneralError(null);
    try {
      const response = await deanService.importBulkFaculty(validRecords);
      if (response.success) {
        const importedData: ImportedFacultyResult[] = response.data?.imported || [];
        setImportedAccounts(importedData);
        setImportSuccess(true);
      } else {
        setGeneralError(response.message || 'Import failed.');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      const status = err?.response?.status;
      if (status === 403) {
        setGeneralError('You are not authorized to perform bulk faculty import.');
      } else {
        setGeneralError(
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          'An error occurred while importing faculty records.'
        );
      }
    } finally {
      setImporting(false);
    }
  };

  // Step 6: Download Credentials CSV
  const handleDownloadCredentials = () => {
    if (!importedAccounts || importedAccounts.length === 0) return;

    const csvRows = [
      ['First Name', 'Middle Name', 'Last Name', 'Gender', 'Login Email', 'Temporary Password', 'Core Department', 'Status'].join(','),
      ...importedAccounts.map((acc) => [
        `"${(acc.firstName || acc.name.split(' ')[0] || '').replace(/"/g, '""')}"`,
        `"${(acc.middleName || '').replace(/"/g, '""')}"`,
        `"${(acc.lastName || acc.name.split(' ').slice(1).join(' ') || '').replace(/"/g, '""')}"`,
        `"${(acc.gender || '').replace(/"/g, '""')}"`,
        `"${(acc.email || '').replace(/"/g, '""')}"`,
        `"${(acc.temporaryPassword || '').replace(/"/g, '""')}"`,
        `"${(acc.coreDepartmentName || acc.coreDepartmentCode || '').replace(/"/g, '""')}"`,
        `"${(acc.status || 'ACTIVE').replace(/"/g, '""')}"`,
      ].join(',')),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Faculty_Login_Credentials_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const copyCredential = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const allRows = validationData?.results || [];
  const filteredResults = allRows.filter((row) => {
    if (filterMode === 'VALID') return row.isValid;
    if (filterMode === 'ERRORS') return !row.isValid;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/dean/faculty/create"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Create Options</span>
          </Link>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <Link
            to="/dean/faculty"
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            Faculty Directory
          </Link>
        </div>
      </div>

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Bulk Faculty Import
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Upload faculty records in bulk using the official Excel template. All created faculty become globally active with login credentials.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={downloadingTemplate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            {downloadingTemplate ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Download Excel Template</span>
          </button>
        </div>

        {/* Global Directory Info */}
        <div className="mt-6 p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-3">
          <Shield className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-extrabold text-[13px] text-indigo-950 dark:text-indigo-100">
              One Global Faculty Directory:
            </p>
            <p className="text-indigo-800 dark:text-indigo-300 leading-relaxed">
              Faculty members created via bulk import receive an active User Login account (with their Faculty College Email) and a Faculty profile with status <strong className="font-bold">ACTIVE</strong>. Their core department is their permanent home, and any departmental HOD can allocate them for teaching assignments.
            </p>
          </div>
        </div>
      </div>

      {generalError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{generalError}</span>
        </div>
      )}

      {/* ── Step 1 & 2: Upload and Validate Card ──────────────────────────────── */}
      {!importSuccess && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80 space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span>Step 1: Upload Faculty Excel File</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Select your filled template to validate records against live database departments and existing faculty accounts.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 hover:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{selectedFile ? selectedFile.name : 'Choose Excel File (.xlsx)'}</span>
            </button>

            {selectedFile && (
              <button
                type="button"
                onClick={handleValidate}
                disabled={validating}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {validating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Validating Records...</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    <span>Validate & Preview</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3: Validation Summary & Preview Table ─────────────────────────── */}
      {validationData && !importSuccess && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Step 2: Validation Results & Review
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Review verified rows and any detected errors before committing to the database.
              </p>
            </div>

            {/* Metrics pills */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                Total: {validationData.totalRows}
              </span>
              <span className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Valid: {validationData.validRows}
              </span>
              {validationData.invalidRows > 0 && (
                <span className="px-3 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/60 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Errors: {validationData.invalidRows}
                </span>
              )}
            </div>
          </div>

          {/* Filters & Actions Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  filterMode === 'ALL'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                All ({validationData.totalRows})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('VALID')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  filterMode === 'VALID'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                Valid Only ({validationData.validRows})
              </button>
              {validationData.invalidRows > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterMode('ERRORS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    filterMode === 'ERRORS'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  Errors Only ({validationData.invalidRows})
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {validationData.invalidRows > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadErrorReport}
                  className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Error Report</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleImport}
                disabled={importing || validationData.validRows === 0}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importing {validationData.validRows} Records...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Import ({validationData.validRows} Valid)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold text-[10px] border-b border-neutral-800">
                <tr>
                  <th className="py-3.5 px-3 font-bold text-white">Row</th>
                  <th className="py-3.5 px-3 font-bold text-white">First Name</th>
                  <th className="py-3.5 px-3 font-bold text-white">Middle Name</th>
                  <th className="py-3.5 px-3 font-bold text-white">Last Name</th>
                  <th className="py-3.5 px-3 font-bold text-white">Gender</th>
                  <th className="py-3.5 px-3 font-bold text-white">Email</th>
                  <th className="py-3.5 px-3 font-bold text-white">Designation</th>
                  <th className="py-3.5 px-3 font-bold text-white">Joining Date</th>
                  <th className="py-3.5 px-3 font-bold text-white">Core Department</th>
                  <th className="py-3.5 px-3 font-bold text-white text-center">Status</th>
                  <th className="py-3.5 px-4 font-bold text-white">Errors & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredResults.length > 0 ? (
                  filteredResults.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={
                        row.isValid
                          ? 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
                          : 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70'
                      }
                    >
                      <td className="py-3 px-3 font-mono font-bold text-slate-500">{row.rowNumber}</td>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{row.firstName || '—'}</td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{row.middleName || '—'}</td>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{row.lastName || '—'}</td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{row.gender || '—'}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">{row.email || '—'}</td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{row.designation || '—'}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">{row.joiningDate || '—'}</td>
                      <td className="py-3 px-3">
                        {row.coreDepartmentCode ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold">
                              {row.coreDepartmentCode}
                            </span>
                            <span className="text-[11px] text-slate-500">{row.coreDepartmentName}</span>
                          </span>
                        ) : (
                          <span className="text-rose-600 font-semibold">{row.coreDepartmentInput || '—'}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold uppercase">
                            <CheckCircle2 className="w-3 h-3" /> Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 text-rose-700 dark:text-rose-300 text-[10px] font-extrabold uppercase">
                            <XCircle className="w-3 h-3" /> Invalid
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {row.isValid ? (
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            Ready for import
                          </span>
                        ) : (
                          <div className="space-y-1">
                            {row.errors.map((err, i) => (
                              <div key={i} className="flex items-start gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                                <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>{err}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400 text-xs">
                      No rows match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Step 4: Success & Credential Delivery Card ─────────────────────────── */}
      {importSuccess && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 border border-emerald-200 dark:border-emerald-900/60 bg-white/95 dark:bg-slate-900/95 shadow-xl space-y-6 animate-in zoom-in-95">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-100 dark:border-emerald-900/40 pb-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  Faculty Import Successful
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{importedAccounts.length}</strong> faculty account(s) have been created and are immediately <span className="font-bold text-emerald-600">ACTIVE</span> in the Global Directory.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadCredentials}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/25 transition-all cursor-pointer shrink-0"
            >
              <Key className="w-4 h-4" />
              <span>Download Login Credentials (.csv)</span>
            </button>
          </div>

          {/* Security Notice */}
          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <Key className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-extrabold text-[13px] text-amber-950 dark:text-amber-100">
                Temporary Credentials Security Notice:
              </p>
              <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                Temporary login passwords have been generated for these faculty members. Please download the credentials file or copy passwords now to distribute to faculty. For security, faculty will be prompted to set a new password upon their first login. Passwords are not permanently stored in plaintext and will not be displayed in the general faculty list.
              </p>
            </div>
          </div>

          {/* Credentials Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span>Created Faculty Accounts ({importedAccounts.length})</span>
              </h3>

              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors cursor-pointer"
              >
                {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPasswords ? 'Mask Passwords' : 'Reveal Passwords'}</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase tracking-wider font-extrabold text-[10px] border-b border-neutral-800">
                  <tr>
                    <th className="py-3.5 px-4 font-bold text-white">Faculty Name</th>
                    <th className="py-3.5 px-4 font-bold text-white">Login Email</th>
                    <th className="py-3.5 px-4 font-bold text-white">Temporary Password</th>
                    <th className="py-3.5 px-4 font-bold text-white">Core Department</th>
                    <th className="py-3.5 px-4 font-bold text-white text-center">Status</th>
                    <th className="py-3.5 px-3 font-bold text-white text-center">Copy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {importedAccounts.map((acc, idx) => (
                    <tr key={acc.userId || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {acc.name}
                        {acc.designation && (
                          <div className="text-[11px] font-normal text-slate-500">{acc.designation}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                        {acc.email}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 text-xs">
                          {showPasswords ? acc.temporaryPassword : '••••••••••••'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                          {acc.coreDepartmentCode && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold">
                              {acc.coreDepartmentCode}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-600 dark:text-slate-400">{acc.coreDepartmentName || '—'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold uppercase">
                          <CheckCircle2 className="w-3 h-3" /> {acc.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => copyCredential(`Email: ${acc.email}\nPassword: ${acc.temporaryPassword}`, idx)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Copy login credentials"
                        >
                          {copiedIdx === idx ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleDownloadCredentials}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Credentials CSV</span>
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => {
                  setImportSuccess(false);
                  setValidationData(null);
                  setSelectedFile(null);
                  setImportedAccounts([]);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Import More Records
              </button>
              <button
                type="button"
                onClick={() => navigate('/dean/faculty')}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/25 transition-all cursor-pointer"
              >
                Go to Faculty Directory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanBulkFacultyImportPage;



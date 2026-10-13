import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import admissionService from '../../../services/admission.service';
import { 
  GraduationCap, Search, Download, Ban, CheckCircle2, Clock, X, 
  AlertTriangle, Loader2, RefreshCw, ChevronLeft, ChevronRight,
  TrendingUp, Users, BadgeCheck, FileSpreadsheet, Upload
} from 'lucide-react';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { getAcademicYear } from '../../../utils/date.util';
import { useAcademicYear } from '../../../context/AcademicYearContext';
import { ShowStudentsRangeSelector } from '../../../components/common/ShowStudentsRangeSelector';

interface USNApplicant {
  id: string;
  applicationNumber: string;
  academicYear: string;
  admissionType: string;
  qualification: string | null;
  applicationStatus: string;
  applicationType?: string;
  entrySemester?: number;
  semester?: number;
  usn: string | null;
  user?: {
    student?: {
      semester?: number;
    };
  } | null;
  branch: {
    id: string;
    name: string;
    code: string;
  } | null;
  studentpersonaldetails: {
    firstName: string;
    middleName?: string | null;
    lastName: string;
  } | null;
}

const getFullName = (details: any) => {
  if (!details) return 'N/A';
  const middle = details.middleName ? ` ${details.middleName}` : '';
  return `${details.firstName}${middle} ${details.lastName}`.replace(/\s+/g, ' ').trim();
};

const getSemesterDisplay = (app: USNApplicant): string => {
  const sem = app.user?.student?.semester || app.entrySemester || (app.qualification === 'DIPLOMA' || app.admissionType === 'DCET' || app.applicationType === 'LATERAL_ENTRY' ? 3 : 1);
  return `${sem}${sem === 1 ? 'st' : sem === 2 ? 'nd' : sem === 3 ? 'rd' : 'th'} Sem`;
};

export const AdminUsnAllocationPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Summary Metrics State
  const [summary, setSummary] = useState({
    totalEligible: 0,
    assigned: 0,
    pending: 0,
    completionRate: 0,
  });
  const [loadingSummary, setLoadingSummary] = useState(false);

  // List & Filter States
  const [applicants, setApplicants] = useState<USNApplicant[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const { academicYear: contextAcademicYear, academicYears: availableAcademicYears } = useAcademicYear();

  const [academicYear, setAcademicYear] = useState<string>(contextAcademicYear || '2027-28');

  // Synchronize when centralized academic year context loads
  useEffect(() => {
    if (contextAcademicYear && (!academicYear || academicYear === '2026-2027' || academicYear === '2027-2028')) {
      setAcademicYear(contextAcademicYear);
    }
  }, [contextAcademicYear]);

  const [branchId, setBranchId] = useState('ALL');
  const [semester, setSemester] = useState('ALL');
  const [entryType, setEntryType] = useState('ALL');
  const [usnStatus, setUsnStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);

  // Draft changes: applicationId -> USN string
  const [draftChanges, setDraftChanges] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [asyncValidation, setAsyncValidation] = useState<Record<string, { loading: boolean; error?: string; valid?: boolean }>>({});

  // Keep track of active debounce timeouts per applicant id
  const validationTimeouts = useRef<Record<string, any>>({});

  // Confirmation / Review modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [previewList, setPreviewList] = useState<{
    idx: number;
    name: string;
    appNum: string;
    semester: string;
    newUsn: string;
    isChanged: boolean;
    valid: boolean;
    error?: string;
  }[]>([]);

  // Cleanup validation timeouts on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(validationTimeouts.current).forEach(clearTimeout);
    };
  }, []);

  // 1. Debounce Search Input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // 2. Fetch Branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const list = await admissionService.getBranches();
        setBranches(list);
      } catch (err) {
        console.error('Failed to fetch branches:', err);
      }
    };
    fetchBranches();
  }, []);

  // 3. Fetch Summary Metrics (synchronized with academic year and filters)
  const fetchSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const data = await admissionService.getUsnSummary({
        academicYear: academicYear !== 'ALL' ? academicYear : undefined,
        branchId: branchId !== 'ALL' ? branchId : undefined,
        semester: semester !== 'ALL' ? semester : undefined,
        entryType: entryType !== 'ALL' ? entryType : undefined,
      });
      setSummary(data);
    } catch (err) {
      console.error('Failed to fetch USN summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, [academicYear, branchId, semester, entryType]);

  // 4. Fetch Eligible Applicants
  const fetchApplicants = useCallback(async () => {
    try {
      setLoadingList(true);
      const res = await admissionService.listUsnEligible({
        academicYear,
        branchId,
        semester: semester !== 'ALL' ? semester : undefined,
        entryType,
        usnStatus,
        search: debouncedSearch,
        alphabet: 'ALL', // A-Z filter UI removed entirely
        sortBy,
        sortOrder,
        page,
        limit,
      });
      if (res.success) {
        setApplicants(res.applicants);
        setTotalRecords(res.total);
        setTotalPages(res.totalPages);
      }
    } catch (err) {
      toast.error('Unable to load USN allocation list.');
    } finally {
      setLoadingList(false);
    }
  }, [academicYear, branchId, semester, entryType, usnStatus, debouncedSearch, sortBy, sortOrder, page, limit]);

  useEffect(() => {
    fetchSummary();
    fetchApplicants();
  }, [fetchSummary, fetchApplicants]);

  // 5. Unsaved Changes Alert Protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(draftChanges).length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved USN changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [draftChanges]);

  // 6. Asynchronous Validation against Registry and Database Uniqueness
  const runAsyncValidation = useCallback(async (appId: string, appNum: string, usn: string) => {
    if (!usn) return;
    setAsyncValidation(prev => ({
      ...prev,
      [appId]: { loading: true }
    }));
    try {
      const res = await admissionService.validateImportUsns([{ applicationNumber: appNum, usn }]);
      if (res.success && res.results?.[0]) {
        const rowResult = res.results[0];
        setAsyncValidation(prev => ({
          ...prev,
          [appId]: {
            loading: false,
            valid: rowResult.valid,
            error: rowResult.valid ? undefined : rowResult.error
          }
        }));
      } else {
        setAsyncValidation(prev => ({
          ...prev,
          [appId]: { loading: false, error: 'Validation check failed' }
        }));
      }
    } catch (err: any) {
      setAsyncValidation(prev => ({
        ...prev,
        [appId]: {
          loading: false,
          error: err.response?.data?.error || 'Validation error'
        }
      }));
    }
  }, []);

  // 7. Handle Manual USN Input changes with real-time format/logic checking
  const handleUsnChange = (
    appId: string,
    val: string,
    branchCode: string | undefined,
    appAcademicYear: string | undefined,
    appNum: string
  ) => {
    const rawVal = val.trim().toUpperCase();

    // Update draft changes locally
    setDraftChanges(prev => {
      const next = { ...prev };
      if (rawVal === '') {
        next[appId] = '';
      } else {
        next[appId] = rawVal;
      }
      return next;
    });

    // Clear timeout if user is typing
    if (validationTimeouts.current[appId]) {
      clearTimeout(validationTimeouts.current[appId]);
    }

    if (rawVal === '') {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[appId];
        return next;
      });
      setAsyncValidation(prev => {
        const next = { ...prev };
        delete next[appId];
        return next;
      });
      return;
    }

    // Real-time format validation
    const match = rawVal.match(/^2JR(\d{2})([A-Z]{2})(\d{3})$/);
    let localErr = '';
    if (!match) {
      localErr = 'Invalid USN format (e.g. 2JR23CS101)';
    } else {
      // Year suffix check
      const usnYear = match[1];
      if (appAcademicYear) {
        const startYear = appAcademicYear.split('-')[0].trim();
        if (startYear.length === 4) {
          const expectedYearSuffix = startYear.substring(2);
          if (usnYear !== expectedYearSuffix) {
            localErr = `USN year suffix '${usnYear}' does not match academic year '${appAcademicYear}' (expected '${expectedYearSuffix}')`;
          }
        }
      }

      // Branch code check
      if (!localErr && branchCode) {
        const usnDept = match[2];
        const VTU_BRANCH_CODES: Record<string, string> = {
          'CSE': 'CS',
          'CSE-AIML': 'CI',
          'AIML': 'CI',
          'AI&ML': 'CI',
          'AI-ML': 'CI',
          'CV': 'CV',
          'CIVIL': 'CV',
          'CE': 'CV',
          'ECE': 'EC',
          'ME': 'ME',
          'MECHANICAL': 'ME',
          'ISE': 'IS',
          'IS': 'IS',
          'CSE-DS': 'CD',
          'DS': 'CD',
          'CSBS': 'CB',
          'EEE': 'EE',
          'EE': 'EE'
        };
        const normBranch = branchCode.toUpperCase().trim();
        const expectedDept = VTU_BRANCH_CODES[normBranch] || normBranch.substring(0, 2);
        if (expectedDept !== usnDept) {
          localErr = `Department code '${usnDept}' does not match applicant branch '${branchCode}' (expected '${expectedDept}')`;
        }
      }
    }

    // Check local duplicate in draft changes
    if (!localErr) {
      const localDuplicateAppId = Object.entries(draftChanges).find(([key, existingVal]) => {
        return key !== appId && existingVal === rawVal;
      })?.[0];

      if (localDuplicateAppId) {
        localErr = `Duplicate USN entered in this batch.`;
      }
    }

    if (localErr) {
      setValidationErrors(prev => ({ ...prev, [appId]: localErr }));
      setAsyncValidation(prev => {
        const next = { ...prev };
        delete next[appId];
        return next;
      });
    } else {
      // Clear local validation errors
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[appId];
        return next;
      });

      // Clear previous valid status while typing
      setAsyncValidation(prev => {
        const next = { ...prev };
        delete next[appId];
        return next;
      });

      // Trigger debounced async validation against database/registry
      validationTimeouts.current[appId] = setTimeout(() => {
        runAsyncValidation(appId, appNum, rawVal);
      }, 500);
    }
  };

  // Filter actual pending changes
  const actualDraftChanges = Object.entries(draftChanges).filter(([appId, val]) => {
    const applicantInfo = applicants.find(a => a.id === appId);
    return applicantInfo ? applicantInfo.usn !== val : true;
  });

  const errorCount = Object.keys(validationErrors).length + 
    Object.entries(asyncValidation).filter(([_, status]) => status.error).length;

  const pendingCount = actualDraftChanges.length;

  // 8. Open Review and Save Modal (Two-Stage Workflow) - Shows all students in current list
  const handleReviewSave = async () => {
    setLoadingList(true);
    try {
      const listToPreview = [];
      let index = 1;

      // Iterate through all applicants present in the current view/filter
      for (const applicantInfo of applicants) {
        const appId = applicantInfo.id;
        const isChanged = draftChanges[appId] !== undefined && draftChanges[appId] !== applicantInfo.usn;
        const currentDraftUsn = draftChanges[appId] !== undefined ? draftChanges[appId] : (applicantInfo.usn || '');
        const localErr = validationErrors[appId];
        const asyncErr = asyncValidation[appId]?.error;

        let isValid = true;
        let displayUsn = currentDraftUsn;

        if (isChanged) {
          if (currentDraftUsn === '') {
            displayUsn = '— (Remove Allocation)';
            isValid = true;
          } else {
            const hasError = !!(localErr || asyncErr);
            const isAsyncValid = asyncValidation[appId]?.valid;
            isValid = !hasError && !!isAsyncValid;
          }
        } else if (!currentDraftUsn) {
          displayUsn = '—';
          isValid = true;
        }

        listToPreview.push({
          idx: index++,
          name: getFullName(applicantInfo.studentpersonaldetails),
          appNum: applicantInfo.applicationNumber,
          semester: getSemesterDisplay(applicantInfo),
          newUsn: displayUsn,
          isChanged,
          valid: isValid,
          error: localErr || asyncErr
        });
      }

      setPreviewList(listToPreview);
      setShowConfirmModal(true);
    } catch (err) {
      toast.error('Failed to generate preview list.');
    } finally {
      setLoadingList(false);
    }
  };

  // Helper: normalize application number (strip BOM, trim, collapse whitespace, uppercase)
  const normalizeApplicationNumber = (value: unknown): string => {
    return String(value ?? '')
      .replace(/^\uFEFF/, '')   // strip BOM
      .trim()
      .replace(/\u00A0/g, ' ')  // NBSP → space
      .replace(/\s+/g, '')      // collapse remaining whitespace
      .toUpperCase();
  };

  // 9. Excel Import & Verification
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setLoadingList(true);
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json<any>(worksheet);

        // --- Validate required headers ---
        // Get header keys from the first row
        const headers = jsonRows.length > 0 ? Object.keys(jsonRows[0]) : [];
        const normalizeHeader = (h: string) => h.trim().replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').toUpperCase();
        const normalizedHeaders = headers.map(normalizeHeader);
        const requiredCols = ['APPLICATION NUMBER', 'USN'];
        const missingCols = requiredCols.filter(col => !normalizedHeaders.includes(col));
        if (missingCols.length > 0) {
          toast.error(`Invalid USN template. Required columns: SL NO., APPLICATION NUMBER, STUDENT NAME, USN`);
          return;
        }

        if (jsonRows.length === 0) {
          toast.error('No records found in the uploaded file.');
          return;
        }

        // --- Build a normalized lookup map from the CURRENTLY LOADED applicants list ---
        // This guarantees we find applicants that are already visible in the table
        // even if the backend query uses a different case/spacing.
        const applicantMap = new Map<string, USNApplicant>(
          applicants.map(app => [normalizeApplicationNumber(app.applicationNumber), app])
        );

        // --- Parse and normalize each row ---
        const formattedRows: { applicationNumber: string; usn: string }[] = [];
        const parseErrors: string[] = [];

        jsonRows.forEach((row, idx) => {
          // Find the APPLICATION NUMBER column (case-insensitive header match)
          let appNum = '';
          let usnVal = '';
          for (const key of Object.keys(row)) {
            const nk = normalizeHeader(key);
            if (nk === 'APPLICATION NUMBER') appNum = String(row[key] ?? '');
            if (nk === 'USN') usnVal = String(row[key] ?? '');
          }

          const normalizedApp = normalizeApplicationNumber(appNum);
          const normalizedUsn = usnVal.trim().toUpperCase();

          if (!normalizedApp) {
            parseErrors.push(`Row ${idx + 2}: APPLICATION NUMBER is empty.`);
            return;
          }

          // Check if this applicant is already in the loaded page
          if (!applicantMap.has(normalizedApp)) {
            parseErrors.push(`Row ${idx + 2}: Application number "${normalizedApp}" not found in current filter. Make sure the filters match the Excel file.`);
          }

          formattedRows.push({ applicationNumber: normalizedApp, usn: normalizedUsn });
        });

        if (formattedRows.length === 0) {
          toast.error('No valid rows found in the Excel file.');
          return;
        }

        // --- Call backend validate-import API (normalized app numbers) ---
        const res = await admissionService.validateImportUsns(formattedRows);
        if (res.success) {
          const nextDrafts = { ...draftChanges };
          const nextErrors = { ...validationErrors };
          const nextAsyncValidation = { ...asyncValidation };

          let matched = 0;
          let valid = 0;
          const rowErrors: string[] = [...parseErrors];

          res.results.forEach((row: any) => {
            if (row.applicationId) {
              // Stage 1 FOUND — applicant exists, update draft regardless of USN validity
              matched++;
              nextDrafts[row.applicationId] = row.usn;
              if (!row.valid) {
                nextErrors[row.applicationId] = row.error || 'Import validation error';
                rowErrors.push(`${row.applicationNumber}: ${row.error}`);
              } else {
                valid++;
                delete nextErrors[row.applicationId];
                nextAsyncValidation[row.applicationId] = { loading: false, valid: true };
              }
            } else {
              // Stage 1 FAILED — applicant truly not found in DB
              rowErrors.push(`Application "${row.applicationNumber}" not found in database.`);
            }
          });

          setDraftChanges(nextDrafts);
          setValidationErrors(nextErrors);
          setAsyncValidation(nextAsyncValidation);

          // Show ONE clean summary instead of per-row toasts
          const errorCount = rowErrors.length;
          if (errorCount === 0) {
            toast.success(
              `✓ IMPORT COMPLETE — ${formattedRows.length} row(s) processed. ${valid} valid USN(s) ready for Review & Save.`,
              { autoClose: 6000 }
            );
          } else {
            toast.warning(
              `Import completed with issues — ${matched} found, ${valid} valid, ${errorCount} error(s). Check the USN fields for details.`,
              { autoClose: 8000 }
            );
            // Log individual errors to console for admin debugging
            rowErrors.forEach(e => console.warn('[USN Import]', e));
          }
        }
      } catch (err: any) {
        toast.error('Failed to parse Excel import sheet. Please ensure the file is in .xlsx format.');
      } finally {
        setLoadingList(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // 10. Commit Assignments via database transaction
  const handleConfirmSave = async () => {
    const assignmentsToCommit: { applicationId: string; usn: string | null }[] = [];

    // Gather changes
    actualDraftChanges.forEach(([applicationId, usn]) => {
      assignmentsToCommit.push({ applicationId, usn: usn || null });
    });

    if (assignmentsToCommit.length === 0) return;

    try {
      setSavingChanges(true);
      await admissionService.bulkAssignUsns(assignmentsToCommit);
      toast.success('USN assignments saved successfully.');
      setDraftChanges({});
      setValidationErrors({});
      setAsyncValidation({});
      setShowConfirmModal(false);
      fetchSummary();
      fetchApplicants();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Database transaction failed. Changes rolled back.');
    } finally {
      setSavingChanges(false);
    }
  };

  const handleDiscardChanges = () => {
    if (window.confirm('Discard all unsaved drafts and imported sheets?')) {
      setDraftChanges({});
      setValidationErrors({});
      setAsyncValidation({});
    }
  };

  // Helper to generate beautifully styled Excel sheets with custom widths, colors and borders
  const generateStyledExcelFile = async (
    sheetTitle: string,
    rows: { slNo: number; appNum: string; name: string; semester: string; usn: string }[],
    fileName: string
  ) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JCER ERP System';
    workbook.lastModifiedBy = 'Admin';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet(sheetTitle, {
      views: [{ showGridLines: true }]
    });

    // Define columns with generous initial widths so text never overlaps or clips
    worksheet.columns = [
      { header: 'SL NO.', key: 'slNo', width: 12 },
      { header: 'APPLICATION NUMBER', key: 'appNum', width: 32 },
      { header: 'STUDENT NAME', key: 'name', width: 36 },
      { header: 'CURRENT SEMESTER', key: 'semester', width: 22 },
      { header: 'USN', key: 'usn', width: 24 },
    ];

    // Populate data rows
    rows.forEach(r => {
      worksheet.addRow({
        slNo: r.slNo,
        appNum: r.appNum,
        name: r.name,
        semester: r.semester,
        usn: r.usn,
      });
    });

    // Style Header Row (Row 1) - Dark Slate Navy theme with white bold text
    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' } // Crisp White
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' } // Deep Slate / Navy (#0F172A)
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: false
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: 'FF020617' } },
        right: { style: 'thin', color: { argb: 'FF334155' } },
      };
    });

    // Style Data Rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      row.height = 24;
      const isEven = rowNumber % 2 === 0;

      row.eachCell((cell, colNumber) => {
        cell.font = {
          name: 'Segoe UI',
          size: 10.5,
          color: { argb: 'FF0F172A' }
        };

        // Subtle alternating zebra fill for easy scanning
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' }
        };

        // Clean grid cell borders
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        // Formatting & alignment by column
        if (colNumber === 1) {
          // SL NO.
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF64748B' } };
        } else if (colNumber === 2) {
          // APPLICATION NUMBER
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF1E293B' } };
        } else if (colNumber === 3) {
          // STUDENT NAME
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
        } else if (colNumber === 4) {
          // CURRENT SEMESTER
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF475569' } };
        } else if (colNumber === 5) {
          // USN
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF4338CA' } };
        }
      });
    });

    // Auto-fit column widths based on maximum content length with safety padding
    worksheet.columns.forEach(column => {
      let maxLen = 0;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const cellLength = cell.value ? String(cell.value).length : 0;
        if (cellLength > maxLen) {
          maxLen = cellLength;
        }
      });
      column.width = Math.max(maxLen + 5, column.width || 16);
    });

    // Add AutoFilter dropdown arrows on the header row
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 5 }
    };

    // Generate buffer & trigger download in browser
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  // 11. Excel Export of Currently Filtered Records
  const handleExportExcel = async () => {
    try {
      const exportRows = applicants.map((app, idx) => ({
        slNo: (page - 1) * limit + idx + 1,
        appNum: app.applicationNumber || 'N/A',
        name: getFullName(app.studentpersonaldetails),
        semester: getSemesterDisplay(app),
        usn: draftChanges[app.id] !== undefined ? draftChanges[app.id] : (app.usn || ''),
      }));

      const branchName = branchId !== 'ALL' ? branches.find(b => b.id === branchId)?.code || 'All' : 'All';
      const semName = semester !== 'ALL' ? `Sem${semester}_` : '';
      const fileName = `USN_Allocations_${branchName}_${semName}${entryType}_${academicYear}.xlsx`;

      await generateStyledExcelFile(
        'USN Allocations',
        exportRows,
        fileName
      );
      toast.success('USN Allocations exported successfully.');
    } catch (err) {
      console.error('Export Excel error:', err);
      toast.error('Failed to export Excel file.');
    }
  };

  // 12. Prefilled Excel Template Download (exactly 5 fields)
  const handleDownloadTemplate = async () => {
    try {
      const templateRows = applicants.map((app, idx) => ({
        slNo: (page - 1) * limit + idx + 1,
        appNum: app.applicationNumber || 'N/A',
        name: getFullName(app.studentpersonaldetails),
        semester: getSemesterDisplay(app),
        usn: '',
      }));

      await generateStyledExcelFile(
        'USN Template',
        templateRows,
        `USN_Allocation_Template_${academicYear}.xlsx`
      );
      toast.success('USN Template downloaded successfully.');
    } catch (err) {
      console.error('Download template error:', err);
      toast.error('Failed to generate formatted Excel template.');
    }
  };

  const handleFilterChange = (setter: (v: string) => void, val: string) => {
    if (Object.keys(draftChanges).length > 0) {
      if (!window.confirm('You have unsaved changes. Changing filters will reload the list and discard unsaved drafts. Proceed?')) {
        return;
      }
    }
    setDraftChanges({});
    setValidationErrors({});
    setAsyncValidation({});
    setter(val);
    setPage(1);
  };

  const hasChanges = actualDraftChanges.length > 0;

  return (
    <div className={`space-y-6 animate-fade-in w-full relative ${hasChanges ? 'pb-32' : 'pb-24'}`}>
      
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-neutral-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
            <GraduationCap className="text-violet-600 dark:text-violet-400" size={26} /> USN Allocation & Entry
          </h2>
          <p className="text-xs text-neutral-500 font-semibold mt-1">Assign and manage verified official university serial numbers.</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap self-end sm:self-auto select-none">
          <button 
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-355 hover:bg-neutral-200 dark:hover:bg-neutral-750 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm border border-neutral-200/50 dark:border-neutral-750 cursor-pointer"
          >
            <Download size={14} /> Download Template
          </button>
          
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-violet-500/10 cursor-pointer"
          >
            <Upload size={14} /> Import USNs
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleExcelImport}
            accept=".xlsx, .xls"
            className="hidden"
          />

          <button 
            type="button"
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm border border-emerald-500 cursor-pointer"
          >
            <FileSpreadsheet size={14} /> Export Excel
          </button>
        </div>
      </div>

      {/* ── KPI ANALYTICS CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* TOTAL ELIGIBLE */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Total Eligible</p>
            {loadingSummary ? (
              <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-lg mt-1" />
            ) : (
              <h3 className="text-2xl font-black text-neutral-850 dark:text-white">
                {summary.totalEligible}
              </h3>
            )}
            <p className="text-[10px] font-semibold text-neutral-450 dark:text-neutral-500">Verified & approved applicants</p>
          </div>
          <div className="p-3 bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 rounded-xl">
            <Users size={22} />
          </div>
        </div>

        {/* USN ASSIGNED */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">USN Assigned</p>
            {loadingSummary ? (
              <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-lg mt-1" />
            ) : (
              <h3 className="text-2xl font-black text-emerald-650 dark:text-emerald-450">
                {summary.assigned}
              </h3>
            )}
            <p className="text-[10px] font-semibold text-neutral-450 dark:text-neutral-500">Allocated registry matches</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 rounded-xl">
            <BadgeCheck size={22} />
          </div>
        </div>

        {/* USN PENDING */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">USN Pending</p>
            {loadingSummary ? (
              <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-lg mt-1" />
            ) : (
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-450">
                {summary.pending}
              </h3>
            )}
            <p className="text-[10px] font-semibold text-neutral-450 dark:text-neutral-500">Awaiting USN allocation</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-450 rounded-xl">
            <Clock size={22} />
          </div>
        </div>

        {/* ALLOTMENT RATE */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Allotment Rate</p>
            {loadingSummary ? (
              <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded-lg mt-1" />
            ) : (
              <h3 className="text-2xl font-black text-neutral-900 dark:text-white">
                {summary.completionRate}%
              </h3>
            )}
            <div className="w-full bg-neutral-100 dark:bg-neutral-850 h-1.5 rounded-full overflow-hidden mt-1.5 max-w-[120px]">
              <div className="bg-violet-600 h-full rounded-full transition-all duration-500" style={{ width: `${summary.completionRate}%` }} />
            </div>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400 rounded-xl">
            <TrendingUp size={22} />
          </div>
        </div>

      </div>

      {/* ── FILTER & SEARCH PANEL ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 rounded-3xl p-5 shadow-sm space-y-4 select-none">
        <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Filter Applicants</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          
          {/* Academic Year */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase text-neutral-450 tracking-wider">Academic Year</label>
            <select
              value={academicYear}
              onChange={(e) => handleFilterChange(setAcademicYear, e.target.value)}
              className="w-full text-xs font-semibold bg-neutral-50 dark:bg-neutral-955 border border-neutral-200/80 dark:border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:border-violet-500 transition-colors cursor-pointer"
            >
              <option value="ALL">All Operational Years</option>
              {availableAcademicYears.map(opt => (
                <option key={opt.id || opt.year} value={opt.year}>
                  {opt.year} {opt.year === contextAcademicYear ? '(Current Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Branch */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase text-neutral-450 tracking-wider">Branch</label>
            <select
              value={branchId}
              onChange={(e) => handleFilterChange(setBranchId, e.target.value)}
              className="w-full text-xs font-semibold bg-neutral-50 dark:bg-neutral-955 border border-neutral-200/80 dark:border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:border-violet-500 transition-colors cursor-pointer"
            >
              <option value="ALL">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase text-neutral-450 tracking-wider">Semester</label>
            <select
              value={semester}
              onChange={(e) => handleFilterChange(setSemester, e.target.value)}
              className="w-full text-xs font-semibold bg-neutral-50 dark:bg-neutral-955 border border-neutral-200/80 dark:border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:border-violet-500 transition-colors cursor-pointer"
            >
              <option value="ALL">All Semesters</option>
              <option value="1">1st Sem</option>
              <option value="2">2nd Sem</option>
              <option value="3">3rd Sem</option>
              <option value="4">4th Sem</option>
              <option value="5">5th Sem</option>
              <option value="6">6th Sem</option>
              <option value="7">7th Sem</option>
              <option value="8">8th Sem</option>
            </select>
          </div>

          {/* Entry Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase text-neutral-450 tracking-wider">Entry Type</label>
            <select
              value={entryType}
              onChange={(e) => handleFilterChange(setEntryType, e.target.value)}
              className="w-full text-xs font-semibold bg-neutral-50 dark:bg-neutral-955 border border-neutral-200/80 dark:border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:border-violet-500 transition-colors cursor-pointer"
            >
              <option value="ALL">All Entry Types</option>
              <option value="REGULAR">Regular</option>
              <option value="LATERAL">Lateral Entry</option>
            </select>
          </div>

          {/* USN Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase text-neutral-450 tracking-wider">USN Status</label>
            <select
              value={usnStatus}
              onChange={(e) => handleFilterChange(setUsnStatus, e.target.value)}
              className="w-full text-xs font-semibold bg-neutral-50 dark:bg-neutral-955 border border-neutral-200/80 dark:border-neutral-800 rounded-xl px-3 py-2.5 outline-none focus:border-violet-500 transition-colors cursor-pointer"
            >
              <option value="ALL">All</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>

        </div>

        {/* Search + Range */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student name or application number..."
              className="w-full pl-9 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-955 border border-neutral-200/80 dark:border-neutral-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-neutral-955 dark:text-white transition-all shadow-inner"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
            {search && (
              <button 
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 rounded-full cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <ShowStudentsRangeSelector
            value={limit}
            onChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* ── APPLICANT TABLE ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto min-h-[300px] relative">
          
          {loadingList && applicants.length > 0 && (
            <div className="absolute inset-0 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
              <Loader2 className="animate-spin text-violet-600" size={32} />
            </div>
          )}

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-bold uppercase tracking-wider select-none">
                <th className="py-4 px-5 w-16 text-center">SL. NO.</th>
                <th
                  className="py-4 px-4 cursor-pointer hover:text-violet-400 transition-colors"
                  onClick={() => {
                    const newOrder = sortBy === 'applicationNumber' && sortOrder === 'ASC' ? 'DESC' : 'ASC';
                    setSortBy('applicationNumber');
                    setSortOrder(newOrder);
                  }}
                  title="Sort by Application Number"
                >
                  <div className="flex items-center gap-1.5">
                    <span>APPLICATION NUMBER</span>
                    {sortBy === 'applicationNumber' && (
                      <span className="text-violet-400 text-xs">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="py-4 px-4 cursor-pointer hover:text-violet-400 transition-colors"
                  onClick={() => {
                    const newOrder = sortBy === 'name' && sortOrder === 'ASC' ? 'DESC' : 'ASC';
                    setSortBy('name');
                    setSortOrder(newOrder);
                  }}
                  title="Sort by Student Name"
                >
                  <div className="flex items-center gap-1.5">
                    <span>STUDENT NAME</span>
                    {sortBy === 'name' && (
                      <span className="text-violet-400 text-xs">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="py-4 px-4 text-center w-36">CURRENT SEMESTER</th>
                <th
                  className="py-4 px-4 min-w-[220px] cursor-pointer hover:text-violet-400 transition-colors"
                  onClick={() => {
                    const newOrder = sortBy === 'usn' && sortOrder === 'ASC' ? 'DESC' : 'ASC';
                    setSortBy('usn');
                    setSortOrder(newOrder);
                  }}
                  title="Sort by USN"
                >
                  <div className="flex items-center gap-1.5">
                    <span>USN</span>
                    {sortBy === 'usn' && (
                      <span className="text-violet-400 text-xs">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingList && applicants.length === 0 ? (
                // Table Row Skeletons
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="border-b border-neutral-100 dark:border-neutral-800 animate-pulse">
                    <td className="py-4 px-5 text-center"><div className="h-4 w-6 bg-neutral-200 dark:bg-neutral-800 rounded mx-auto" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-40 bg-neutral-200 dark:bg-neutral-800 rounded font-mono" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-48 bg-neutral-200 dark:bg-neutral-800 rounded" /></td>
                    <td className="py-4 px-4 text-center"><div className="h-6 w-20 bg-neutral-200 dark:bg-neutral-800 rounded-lg mx-auto" /></td>
                    <td className="py-3 px-4"><div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-800 rounded-xl" /></td>
                  </tr>
                ))
              ) : applicants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 select-none">
                      <GraduationCap className="text-neutral-300 dark:text-neutral-800" size={48} />
                      <p className="text-sm font-black text-neutral-500 uppercase tracking-widest">No Eligible Applicants Found</p>
                      <p className="text-xs text-neutral-400 max-w-sm">
                        Try changing the selected Academic Year, Branch, Entry Type, USN Status, or Search query.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                applicants.map((app, idx) => {
                  const globalIdx = (page - 1) * limit + idx + 1; // Recalculated dynamic Sl. No.
                  const branchCode = app.branch?.code || '';
                  
                  const isDraft = draftChanges[app.id] !== undefined;
                  const draftVal = isDraft ? draftChanges[app.id] : (app.usn || '');
                  const validationError = validationErrors[app.id];
                  const asyncErr = asyncValidation[app.id]?.error;
                  const asyncValid = asyncValidation[app.id]?.valid;
                  const asyncLoading = asyncValidation[app.id]?.loading;

                  return (
                    <tr 
                      key={app.id}
                      className="border-b border-neutral-100 dark:border-neutral-800/80 hover:bg-neutral-50/50 dark:hover:bg-neutral-955/20 transition-colors"
                    >
                      {/* Sl. No. */}
                      <td className="py-4 px-5 text-center font-bold text-neutral-400 text-xs">
                        {String(globalIdx).padStart(2, '0')}
                      </td>
                      
                      {/* Application No */}
                      <td className="py-4 px-4 font-bold text-slate-800 dark:text-neutral-200 font-mono text-xs">
                        {app.applicationNumber}
                      </td>

                      {/* Applicant Name */}
                      <td className="py-4 px-4">
                        <div className="font-extrabold text-neutral-800 dark:text-neutral-200 uppercase tracking-wide text-xs">
                          {getFullName(app.studentpersonaldetails)}
                        </div>
                      </td>

                      {/* Current Semester */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 border border-slate-200/80 dark:border-neutral-700">
                          {getSemesterDisplay(app)}
                        </span>
                      </td>

                      {/* USN Allotment Input */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={draftVal}
                            onChange={(e) => handleUsnChange(app.id, e.target.value, branchCode, app.academicYear, app.applicationNumber)}
                            placeholder="Enter USN (e.g. 2JR23CS101)"
                            className={`w-full max-w-[240px] px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border rounded-xl text-xs font-semibold uppercase tracking-wider outline-none transition-all font-mono ${
                              validationError || asyncErr
                                ? 'border-rose-500 focus:border-rose-600 bg-rose-50/10' 
                                : isDraft
                                  ? 'border-violet-500 focus:border-violet-600 bg-violet-50/5 dark:bg-violet-950/5'
                                  : 'border-neutral-200/80 dark:border-neutral-800 focus:border-violet-500'
                            }`}
                          />
                          {validationError && (
                            <p className="text-[10px] font-bold text-rose-500 flex items-center gap-1 leading-tight">
                              ✕ {validationError}
                            </p>
                          )}
                          {!validationError && asyncErr && (
                            <p className="text-[10px] font-bold text-rose-500 flex items-center gap-1 leading-tight">
                              ✕ {asyncErr}
                            </p>
                          )}
                          {!validationError && !asyncErr && asyncValid && (
                            <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 leading-none">
                              ✓ USN available
                            </p>
                          )}
                          {!validationError && !asyncErr && !asyncValid && asyncLoading && (
                            <p className="text-[10px] font-bold text-neutral-400 flex items-center gap-1 leading-none animate-pulse">
                              Checking availability...
                            </p>
                          )}
                          {!validationError && !asyncErr && !asyncValid && !asyncLoading && isDraft && (
                            <p className="text-[10px] font-bold text-violet-500 flex items-center gap-1 leading-none">
                              ✎ Unsaved Draft
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-955/25 flex items-center justify-between select-none">
            <span className="text-xs font-bold text-neutral-400">
              Showing page {page} of {totalPages} ({totalRecords} total applicants)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                className="p-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 disabled:opacity-40 transition-all cursor-pointer text-slate-700 dark:text-neutral-350"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i + 1)}
                  className={`w-7 h-7 text-xs font-black rounded-lg transition-colors cursor-pointer ${
                    page === i + 1
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                className="p-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 disabled:opacity-40 transition-all cursor-pointer text-slate-700 dark:text-neutral-350"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── STICKY BOTTOM ACTION BAR ── */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-neutral-900 text-slate-800 dark:text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between gap-8 z-50 border border-neutral-200 dark:border-neutral-800 max-w-xl w-[90%] md:w-auto animate-slide-up no-print select-none">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
            </span>
            <span className="text-xs font-black tracking-wide uppercase">
              {pendingCount} USN change(s) pending {errorCount > 0 && <span className="text-rose-500">({errorCount} errors)</span>}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDiscardChanges}
              className="px-3.5 py-2 text-xs font-bold text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
            >
              Reset Changes
            </button>
            <button
              type="button"
              onClick={handleReviewSave}
              disabled={errorCount > 0}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-violet-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Review & Save
            </button>
          </div>
        </div>
      )}

      {/* ── TWO-STAGE BATCH PREVIEW & CONFIRMATION MODAL ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-4xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in duration-200 flex flex-col max-h-[90vh]">
            
            <div className="flex items-center justify-between border-b border-neutral-150 dark:border-neutral-800 pb-3 flex-shrink-0">
              <div>
                <h3 className="text-base font-black text-neutral-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" size={20} /> Review USN Assignments
                </h3>
                <p className="text-[10px] text-neutral-400 font-semibold mt-0.5">Please verify all allocations before confirming. The transaction is atomic.</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Validation overview cards */}
            <div className="grid grid-cols-3 gap-4 flex-shrink-0 select-none">
              <div className="bg-neutral-50 dark:bg-neutral-955 border border-neutral-200/50 dark:border-neutral-800 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-neutral-450 uppercase tracking-wide">Total Students</span>
                <p className="text-lg font-black text-neutral-850 dark:text-white">{previewList.length}</p>
              </div>
              <div className="bg-violet-50/40 dark:bg-violet-950/10 border border-violet-200/30 dark:border-violet-900/55 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Pending Changes</span>
                <p className="text-lg font-black text-violet-600 dark:text-violet-400">{previewList.filter(p => p.isChanged && p.valid).length}</p>
              </div>
              <div className="bg-rose-50/40 dark:bg-rose-950/10 border border-rose-200/30 dark:border-rose-900/55 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wide">Validation Errors</span>
                <p className="text-lg font-black text-rose-600">{previewList.filter(p => !p.valid).length}</p>
              </div>
            </div>

            {previewList.filter(p => !p.valid).length > 0 && (
              <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-600 flex items-start gap-2 flex-shrink-0">
                <Ban size={16} className="shrink-0 mt-0.5" />
                <p className="text-xs font-bold leading-tight">
                  Resolve all validation errors before saving. Uniqueness database checks, format mismatches, or duplicate entries must be resolved before committing.
                </p>
              </div>
            )}

            {/* Preview List Grid */}
            <div className="overflow-y-auto flex-grow border border-neutral-150 dark:border-neutral-800 rounded-2xl bg-neutral-50/30 dark:bg-neutral-955/10">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-black text-white border-b border-neutral-800 font-black uppercase tracking-widest text-[9px] select-none sticky top-0">
                    <th className="py-3 px-4 w-12 text-center">SL NO.</th>
                    <th className="py-3 px-4">APPLICATION NUMBER</th>
                    <th className="py-3 px-4">STUDENT NAME</th>
                    <th className="py-3 px-4 text-center">CURRENT SEMESTER</th>
                    <th className="py-3 px-4">USN</th>
                    <th className="py-3 px-4 text-center">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {previewList.map((item, idx) => (
                    <tr 
                      key={idx}
                      className={`border-b border-neutral-100 dark:border-neutral-850 hover:bg-neutral-100/50 ${
                        !item.valid ? 'bg-rose-50/15' : item.isChanged ? 'bg-violet-50/15 dark:bg-violet-950/15' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-bold text-slate-400">{String(item.idx).padStart(2, '0')}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-neutral-200 font-mono">{item.appNum}</td>
                      <td className="py-3 px-4 font-bold text-slate-700 dark:text-neutral-300">{item.name}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 border border-slate-200/80 dark:border-neutral-700">
                          {item.semester}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold tracking-wider uppercase font-mono">
                        {item.isChanged ? (
                          <span className="text-violet-600 dark:text-violet-400 font-black">{item.newUsn}</span>
                        ) : (
                          <span className="text-slate-600 dark:text-neutral-400">{item.newUsn}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {!item.valid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                            ✕ {item.error || 'Error'}
                          </span>
                        ) : item.isChanged ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400">
                            ✎ Ready to Save
                          </span>
                        ) : item.newUsn && item.newUsn !== '—' && item.newUsn !== '— (Remove Allocation)' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                            ✓ Assigned
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-neutral-150 dark:border-neutral-800 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-355 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                type="button"
                disabled={savingChanges || previewList.filter(p => !p.valid).length > 0 || actualDraftChanges.length === 0}
                onClick={handleConfirmSave}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 text-xs font-bold rounded-xl transition-all shadow-md shadow-violet-600/10 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {savingChanges ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Saving...
                  </>
                ) : 'Confirm & Save'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default AdminUsnAllocationPage;

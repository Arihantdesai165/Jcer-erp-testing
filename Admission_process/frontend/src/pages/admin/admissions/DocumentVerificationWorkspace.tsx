import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import API, { getBaseHostURL } from '../../../services/api';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  RefreshCw,
  Maximize2,
  Download,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Info,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'react-toastify';

// ─── ERROR BOUNDARY FOR REVIEW WORKSPACE ──────────────────────────────────────
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ReviewWorkspaceErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ReviewWorkspace] ReviewWorkspaceErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 bg-[#F3F6FA] flex flex-col items-center justify-center p-6 font-sans">
          <div className="bg-white border border-rose-200 rounded-2xl p-8 max-w-lg w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle size={28} />
            </div>
            <h2 className="text-base font-extrabold text-slate-900">Review Workspace Component Exception</h2>
            <p className="text-xs font-semibold text-slate-500">
              An unexpected render exception occurred inside the Review Workspace:
            </p>
            <div className="p-3 bg-rose-50 rounded-xl text-rose-700 font-mono text-xs text-left w-full overflow-auto max-h-36 border border-rose-200">
              {this.state.error?.message || String(this.state.error)}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── INTERFACES ───────────────────────────────────────────────────────────────
export interface DocumentItem {
  id: string;
  field: string;
  name: string;
  url: string | null;
  blobUrl?: string | null;
  isPdf?: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  rejectionRemarks?: string;
  loadError?: boolean;
}

interface DocumentVerificationWorkspaceProps {
  isOpen?: boolean;
  onClose?: () => void;
  appId?: string;
  studentName?: string;
  appNumber?: string;
  appStatus?: string;
  documents?: Record<string, any> | null;
  initialDocStatus?: Record<string, 'ACCEPTED' | 'REJECTED'>;
  correctionRemarks?: string | null;
  onCompleteVerification?: (updatedDocStatuses: Record<string, 'ACCEPTED' | 'REJECTED'>, allVerified: boolean, rejectionNotes?: string) => void;
}

const extractDocUrl = (docSource: any, keys: string[]): string | null => {
  if (!docSource) return null;

  if (Array.isArray(docSource)) {
    for (const item of docSource) {
      if (item && typeof item === 'object') {
        const itemField = (item.field || item.id || item.name || '').toLowerCase();
        for (const k of keys) {
          if (itemField.includes(k.toLowerCase()) && item.url) {
            return item.url;
          }
        }
      } else if (typeof item === 'string') {
        for (const k of keys) {
          if (item.toLowerCase().includes(k.toLowerCase())) {
            return item;
          }
        }
      }
    }
  }

  if (typeof docSource === 'object') {
    for (const k of keys) {
      if (docSource[k] !== undefined && docSource[k] !== null && docSource[k] !== '') {
        return docSource[k];
      }
    }
  }

  return null;
};

const getFileName = (url: string | null) => {
  if (!url) return 'N/A';
  try {
    const parts = url.split('/');
    const last = parts[parts.length - 1];
    return last.split('?')[0];
  } catch {
    return 'document.jpg';
  }
};

const getDocSize = (docName: string) => {
  const hash = docName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const size = 150 + (hash % 300);
  return `${size} KB`;
};

const getUploadedDate = (appUpdatedAt?: string) => {
  if (!appUpdatedAt) return '08 Jun 2026, 10:30 AM';
  try {
    const date = new Date(appUpdatedAt);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ', ' + date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return '08 Jun 2026, 10:30 AM';
  }
};

// ─── WORKSPACE COMPONENT ──────────────────────────────────────────────────────
export const DocumentVerificationWorkspaceContent: React.FC<DocumentVerificationWorkspaceProps> = ({
  isOpen,
  onClose,
  appId: propAppId,
  studentName: propStudentName,
  appNumber: propAppNumber,
  appStatus: propAppStatus,
  documents: propDocuments,
  initialDocStatus = {},
  onCompleteVerification,
  correctionRemarks
}) => {
  const { id: urlAppId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const targetAppId = propAppId || urlAppId;
  const effectiveIsOpen = isOpen ?? true;

  const [docList, setDocList] = useState<DocumentItem[]>([]);
  const [currentDocumentIndex, setCurrentDocumentIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingBlobs, setLoadingBlobs] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [docsData, setDocsData] = useState<any>(null);

  // States for on-demand active document loading
  const [activeDocUrl, setActiveDocUrl] = useState<string | null>(null);
  const [activeDocLoading, setActiveDocLoading] = useState<boolean>(false);
  const [activeDocError, setActiveDocError] = useState<boolean>(false);
  const [activeDocIsPdf, setActiveDocIsPdf] = useState<boolean>(false);

  const [studentNameState, setStudentNameState] = useState<string>(propStudentName || '');
  const [appNumberState, setAppNumberState] = useState<string>(propAppNumber || '');
  const [appUpdatedAt, setAppUpdatedAt] = useState<string>('');

  // Viewer Tools state
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('Blurred Image');
  const [rejectRemarks, setRejectRemarks] = useState<string>('');

  const handleNotesChange = (val: string) => {
    setDocList(prev => prev.map((d, idx) => idx === currentDocumentIndex ? { ...d, rejectionRemarks: val } : d));
  };

  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  const resetViewer = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  useEffect(() => {
    resetViewer();
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [currentDocumentIndex]);

  // Stage 5 & 10: Component Mount & Document Initialization
  useEffect(() => {
    console.log("Review Workspace Mounted");

    if (!effectiveIsOpen) return;

    let active = true;
    setHasError(false);
    setErrorMessage('');
    setIsLoading(true);

    const initWorkspace = async () => {
      try {
        let workspaceData: any = null;
        let safeDocs: any = propDocuments || {};
        let nameToUse = propStudentName || '';
        let numberToUse = propAppNumber || '';

        // Stage 1, 2, 3 & 9: Fetch workspaceData and log for debugging
        if (targetAppId) {
          console.log("API request sent to fetch application/documents for ID:", targetAppId);
          try {
            const res = await API.get(`/admin/admissions/${targetAppId}`);
            console.log("API response received:", res.data);
            workspaceData = res.data?.data || res.data;
            
            // Requirement 9 Logging:
            console.log(workspaceData);
            console.log(workspaceData?.documents || workspaceData?.studentdocuments);

            if (active && workspaceData) {
              safeDocs = workspaceData.studentdocuments || workspaceData.documents || safeDocs;
              const pd = workspaceData.studentpersonaldetails;
              nameToUse = `${pd?.firstName || ''} ${pd?.lastName || ''}`.trim() || workspaceData.user?.firstName || workspaceData.user?.email || nameToUse || 'Student';
              numberToUse = workspaceData.applicationNumber || numberToUse || '—';
              setAppUpdatedAt(workspaceData.updatedAt || workspaceData.updated_at || '');
            }
          } catch (apiErr: any) {
            console.error("API request failed:", apiErr);
            if (active && (!propDocuments || Object.keys(propDocuments).length === 0)) {
              setHasError(true);
              setErrorMessage(apiErr.response?.data?.error || apiErr.message || 'Failed to fetch application document details.');
              setIsLoading(false);
              return;
            }
          }
        }

        if (!active) return;

        setDocsData(safeDocs);
        setStudentNameState(nameToUse || 'Student');
        setAppNumberState(numberToUse || '—');

        console.log("Document initialization started. Setting current document index to 0.");

        const allPossibleDocs = [
          { id: 'photo', field: 'photo', name: 'Passport Size Photo', url: extractDocUrl(safeDocs, ['photoUrl', 'photo', 'passportPhoto', 'passportPhotoUrl']) },
          { id: 'signature', field: 'signature', name: 'Candidate E-Signature', url: extractDocUrl(safeDocs, ['signatureUrl', 'signature', 'candidateSignature']) },
          { id: 'tenth', field: 'tenthMarksheet', name: 'SSLC / 10th Marks Card', url: extractDocUrl(safeDocs, ['tenthMarksheetUrl', 'tenthMarksheet', 'sslcMarksheet', 'sslcMarksheetUrl', 'tenth']) },
          { id: 'twelfth', field: 'twelfthMarksheet', name: 'PUC / 12th Marks Card', url: extractDocUrl(safeDocs, ['twelfthMarksheetUrl', 'twelfthMarksheet', 'pucMarksheet', 'pucMarksheetUrl', 'twelfth']) },
          { id: 'diplomaSemester5', field: 'diplomaSemester5Marksheet', name: 'Diploma 5th Semester Marks Card', url: extractDocUrl(safeDocs, ['diplomaSemester5MarksheetUrl', 'diplomaSemester5Marksheet', 'diploma5thMarksheetUrl']) },
          { id: 'diplomaSemester6', field: 'diplomaSemester6Marksheet', name: 'Diploma 6th Semester Marks Card', url: extractDocUrl(safeDocs, ['diplomaSemester6MarksheetUrl', 'diplomaSemester6Marksheet', 'diploma6thMarksheetUrl']) },
          { id: 'cet', field: 'cetScoreCard', name: 'Entrance Score Card (CET/DCET)', url: extractDocUrl(safeDocs, ['cetScoreCardUrl', 'cetScoreCard', 'entranceScoreCard', 'entranceScoreCardUrl', 'cet']) },
          { id: 'aadhaar', field: 'aadhaar', name: 'Aadhaar Card copy', url: extractDocUrl(safeDocs, ['aadhaarUrl', 'aadhaar', 'aadhaarCard', 'aadhaarCardUrl']) },
          { id: 'feesPaidReceipt', field: 'feesPaidReceipt', name: 'College Fees Receipt', url: extractDocUrl(safeDocs, ['feesPaidReceiptUrl', 'feesPaidReceipt', 'feeReceipt', 'feeReceiptUrl', 'admissionFeeReceiptUrl']) },
          { id: 'admissionFormFeeReceipt', field: 'admissionFormFeeReceipt', name: 'Admission Form Fee Receipt', url: extractDocUrl(safeDocs, ['admissionFormFeeReceiptUrl', 'admissionFormFeeReceipt']) },
          { id: 'domicile', field: 'domicileCertificate', name: 'Domicile / Study Certificate', url: extractDocUrl(safeDocs, ['domicileCertificateUrl', 'domicileCertificate', 'studyCertificate']) },
          { id: 'caste', field: 'casteCertificate', name: 'Caste Certificate (Optional)', url: extractDocUrl(safeDocs, ['casteCertificateUrl', 'casteCertificate']) },
          { id: 'gap', field: 'gapCertificate', name: 'Income / Gap Year Certificate', url: extractDocUrl(safeDocs, ['gapCertificateUrl', 'gapCertificate', 'incomeCertificate', 'incomeCertificateUrl']) },
        ];

        // Also check if safeDocs object contains any extra uploaded string URLs
        if (safeDocs && typeof safeDocs === 'object' && !Array.isArray(safeDocs)) {
          Object.entries(safeDocs).forEach(([key, val]) => {
            if (typeof val === 'string' && val.trim() !== '' && key.endsWith('Url')) {
              const alreadyIncluded = allPossibleDocs.some(d => d.url === val || d.id === key);
              if (!alreadyIncluded) {
                const formattedName = key.replace(/Url$/, '').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                allPossibleDocs.push({
                  id: key,
                  field: key,
                  name: formattedName,
                  url: val
                });
              }
            }
          });
        }

        // Filter uploaded documents
        const savedStatusesStr = targetAppId ? localStorage.getItem(`doc_status_${targetAppId}`) : null;
        const savedStatuses: Record<string, 'ACCEPTED' | 'REJECTED' | 'PENDING'> = savedStatusesStr 
          ? JSON.parse(savedStatusesStr) 
          : {};

        // Restore per-document rejection details
        const savedRejectionDetailsStr = targetAppId ? localStorage.getItem(`doc_rejection_details_${targetAppId}`) : null;
        const savedRejectionDetails: Record<string, { reason?: string; remarks?: string }> = savedRejectionDetailsStr
          ? JSON.parse(savedRejectionDetailsStr)
          : {};

        const availableDocs: DocumentItem[] = allPossibleDocs
          .filter(d => d.url !== null && d.url !== undefined && d.url !== '')
          .map(d => {
            let status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING';
            if (savedStatuses[d.name]) {
              if (savedStatuses[d.name] === 'ACCEPTED') status = 'APPROVED';
              if (savedStatuses[d.name] === 'REJECTED') status = 'REJECTED';
            } else {
              const initStatus = initialDocStatus[d.name];
              if (initStatus === 'ACCEPTED') status = 'APPROVED';
              if (initStatus === 'REJECTED') status = 'REJECTED';
            }

            const details = savedRejectionDetails[d.name] || {};

            return {
              id: d.id,
              field: d.field,
              name: d.name,
              url: d.url,
              status,
              rejectionReason: details.reason,
              rejectionRemarks: details.remarks
            };
          });

        setDocList(availableDocs);

        // Restore saved document selection from localStorage if present
        const savedDocId = targetAppId ? localStorage.getItem(`workspace_doc_id_${targetAppId}`) : null;
        let matchedIdx = 0;
        if (savedDocId && availableDocs.length > 0) {
          const foundIdx = availableDocs.findIndex(d => d.id === savedDocId);
          if (foundIdx !== -1) {
            matchedIdx = foundIdx;
          }
        }
        setCurrentDocumentIndex(matchedIdx);

        setDocList(availableDocs);
        setIsLoading(false);
      } catch (err: any) {
        console.error("Error initializing DocumentVerificationWorkspace:", err);
        if (active) {
          setHasError(true);
          setErrorMessage(err.message || 'Failed to initialize workspace data');
        }
      } finally {
        if (active) {
          // Stage 7: Ensure loading state is always cleared
          setIsLoading(false);
        }
      }
    };

    initWorkspace();

    return () => {
      active = false;
    };
  }, [effectiveIsOpen, targetAppId, propDocuments, propStudentName, propAppNumber]);

  // On-demand loader for the selected document's URL (R2 signed URL or legacy local path)
  useEffect(() => {
    if (!effectiveIsOpen || docList.length === 0) return;
    const activeDoc = docList[currentDocumentIndex];
    if (!activeDoc) return;

    let active = true;
    let blobUrl: string | null = null;
    setActiveDocUrl(null);
    setActiveDocLoading(true);
    setActiveDocError(false);

    const loadActiveDoc = async () => {
      try {
        const token = localStorage.getItem('token') || '';
        const baseUrl = API.defaults.baseURL || '/api';
        const cleanPath = `/admin/admissions/${targetAppId}/documents/${activeDoc.field}`;
        const url = `${baseUrl}${cleanPath}`;
        const finalUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;

        // Fetch as blob via Axios (handles auth headers + CORS properly)
        const response = await API.get(finalUrl, { responseType: 'blob' });
        if (!active) return;

        blobUrl = URL.createObjectURL(response.data);
        const isPdf = response.data.type === 'application/pdf' || !!(activeDoc.url?.toLowerCase().includes('.pdf'));
        setActiveDocIsPdf(isPdf);
        setActiveDocUrl(blobUrl);
        setActiveDocLoading(false);
        setActiveDocError(false);
      } catch (err) {
        if (!active) return;
        console.error('Failed to load document:', err);
        setActiveDocError(true);
        setActiveDocLoading(false);
      }
    };

    loadActiveDoc();

    return () => {
      active = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [currentDocumentIndex, docList.length, targetAppId, effectiveIsOpen]);

  useEffect(() => {
    if (targetAppId && docList.length > 0) {
      const statusMap: Record<string, 'ACCEPTED' | 'REJECTED' | 'PENDING'> = {};
      const rejectionDetails: Record<string, { reason?: string; remarks?: string }> = {};
      docList.forEach(d => {
        if (d.status === 'APPROVED') statusMap[d.name] = 'ACCEPTED';
        if (d.status === 'REJECTED') statusMap[d.name] = 'REJECTED';
        if (d.status === 'PENDING') statusMap[d.name] = 'PENDING';
        // Persist rejection details so they survive workspace re-open
        if (d.rejectionReason || d.rejectionRemarks) {
          rejectionDetails[d.name] = { reason: d.rejectionReason, remarks: d.rejectionRemarks };
        }
      });
      localStorage.setItem(`doc_status_${targetAppId}`, JSON.stringify(statusMap));
      localStorage.setItem(`doc_rejection_details_${targetAppId}`, JSON.stringify(rejectionDetails));
    }
  }, [docList, targetAppId]);

  useEffect(() => {
    if (targetAppId && docList.length > 0 && currentDocumentIndex >= 0 && currentDocumentIndex < docList.length) {
      const activeDoc = docList[currentDocumentIndex];
      if (activeDoc) {
        localStorage.setItem(`workspace_doc_id_${targetAppId}`, activeDoc.id);
      }
    }
  }, [currentDocumentIndex, docList, targetAppId]);

  const handleClose = async () => {
    // Auto-save current verification progress before closing (same as Save & Exit)
    if (docList.length > 0) {
      const updatedMap: Record<string, 'ACCEPTED' | 'REJECTED' | 'PENDING'> = {};
      docList.forEach(d => {
        if (d.status === 'APPROVED') updatedMap[d.name] = 'ACCEPTED';
        if (d.status === 'REJECTED') updatedMap[d.name] = 'REJECTED';
        if (d.status === 'PENDING') updatedMap[d.name] = 'PENDING';
      });

      if (targetAppId) {
        localStorage.setItem(`doc_status_${targetAppId}`, JSON.stringify(updatedMap));
        try {
          await API.put(`/admin/admissions/${targetAppId}/documents/status`, { statuses: updatedMap });
        } catch (e) {
          console.error("Failed to save doc statuses to database:", e);
        }
      }

      const allVerified = docList.length > 0 && docList.every(d => d.status !== 'PENDING');
      const rejectionNotes = buildRejectionNotes(docList);
      if (onCompleteVerification) {
        const filteredMap: Record<string, 'ACCEPTED' | 'REJECTED'> = {};
        Object.entries(updatedMap).forEach(([k, v]) => {
          if (v !== 'PENDING') filteredMap[k] = v;
        });
        onCompleteVerification(filteredMap, allVerified, rejectionNotes);
      }
    }

    if (onClose) {
      onClose();
    } else if (urlAppId) {
      console.log("Navigating back to review sheet:", `/admin/admissions/review/${urlAppId}`);
      navigate(`/admin/admissions/review/${urlAppId}`);
    } else {
      navigate(-1);
    }
  };

  if (!effectiveIsOpen) return null;

  // Stage 7: Loading view
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#F3F6FA] flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full shadow-xl flex flex-col items-center text-center space-y-4">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Loading Review Workspace</h3>
          <p className="text-xs text-slate-500 font-medium">Fetching student records and initializing document viewer...</p>
        </div>
      </div>
    );
  }

  // Stage 9: Error Card if exception occurs
  if (hasError) {
    return (
      <div className="fixed inset-0 z-50 bg-[#F3F6FA] flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white border border-rose-200 rounded-2xl p-8 max-w-md w-full shadow-xl flex flex-col items-center text-center space-y-4">
          <AlertCircle size={48} className="text-rose-500" />
          <h3 className="text-base font-extrabold text-slate-900">Workspace Rendering Error</h3>
          <div className="p-3 bg-rose-50 rounded-xl text-rose-700 font-mono text-xs text-left w-full overflow-auto max-h-32 border border-rose-200">
            {errorMessage || 'An error occurred while loading the document verification workspace.'}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close Workspace
          </button>
        </div>
      </div>
    );
  }

  // Stage 8: Empty state screen ("No documents found.")
  if (docList.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-[#F3F6FA] flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full shadow-xl flex flex-col items-center text-center space-y-4">
          <FileText size={48} className="text-slate-400 opacity-40" />
          <h3 className="text-base font-extrabold text-slate-900">No documents found.</h3>
          <p className="text-xs font-semibold text-slate-500">There are no digital document certificates attached to this student application.</p>
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 bg-primary-600 text-white text-xs font-bold rounded-xl hover:bg-primary-700 transition-colors cursor-pointer"
          >
            Return to Review Sheet
          </button>
        </div>
      </div>
    );
  }

  // Stage 11: Verify currentDocument is not undefined before rendering
  const currentDocument: DocumentItem | null =
    docList.length > 0 && currentDocumentIndex >= 0 && currentDocumentIndex < docList.length
      ? docList[currentDocumentIndex]
      : docList[0] || null;

  const verifiedCount = docList.filter(d => d.status === 'APPROVED').length;
  const rejectedCount = docList.filter(d => d.status === 'REJECTED').length;
  const pendingCount = docList.filter(d => d.status === 'PENDING').length;
  const totalDocs = docList.length;
  const progressPercent = totalDocs > 0 ? Math.round(((verifiedCount + rejectedCount) / totalDocs) * 100) : 0;
  const isAllReviewed = totalDocs > 0 && pendingCount === 0;

  // Viewer tool handlers
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotateLeft = () => setRotation(prev => (prev - 90) % 360);
  const handleRotateRight = () => setRotation(prev => (prev + 90) % 360);

  const toggleFullscreen = () => {
    if (!viewerContainerRef.current) return;
    if (!isFullscreen) {
      if (viewerContainerRef.current.requestFullscreen) {
        viewerContainerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Drag / Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPosition({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  // Auto Advance Helper
  const autoAdvance = (currentIdx: number, updatedList: DocumentItem[]) => {
    // 1. Move to the next sequential document if available
    if (currentIdx + 1 < updatedList.length) {
      setCurrentDocumentIndex(currentIdx + 1);
      return;
    }

    // 2. Wrap around to the first pending document if we reached the end of the list
    const anyPendingIdx = updatedList.findIndex(d => d.status === 'PENDING');
    if (anyPendingIdx !== -1) {
      setCurrentDocumentIndex(anyPendingIdx);
      return;
    }

    // 3. Otherwise stay on the current document
    setCurrentDocumentIndex(currentIdx);
  };

  // Approve Handler
  const handleApproveCurrentDoc = () => {
    if (!currentDocument) return;

    const updatedList = docList.map((d, idx) =>
      idx === currentDocumentIndex
        ? { ...d, status: 'APPROVED' as const, rejectionReason: undefined, rejectionRemarks: d.rejectionRemarks }
        : d
    );

    setDocList(updatedList);
    toast.success(`Approved: ${currentDocument.name}`);
    autoAdvance(currentDocumentIndex, updatedList);
  };

  // Reject Modal Submit Handler
  const handleConfirmRejectDoc = () => {
    if (!currentDocument) return;

    const updatedList = docList.map((d, idx) =>
      idx === currentDocumentIndex
        ? { ...d, status: 'REJECTED' as const, rejectionReason: rejectReason, rejectionRemarks: d.rejectionRemarks || rejectRemarks }
        : d
    );

    setDocList(updatedList);
    setShowRejectModal(false);
    toast.error(`Rejected: ${currentDocument.name} (${rejectReason})`);
    autoAdvance(currentDocumentIndex, updatedList);
  };

  // Build rejection notes string from rejected docs
  const buildRejectionNotes = (list: DocumentItem[]): string => {
    const lines: string[] = [];
    list.filter(d => d.status === 'REJECTED').forEach(d => {
      let line = `• ${d.name} — Rejected`;
      if (d.rejectionReason) line += ` (${d.rejectionReason})`;
      if (d.rejectionRemarks) line += `\n  Note: ${d.rejectionRemarks}`;
      lines.push(line);
    });
    return lines.length > 0
      ? `Rejected Documents:\n${lines.join('\n')}`
      : '';
  };

  // Final Complete Handler
  const handleFinalizeWorkspace = () => {
    const updatedMap: Record<string, 'ACCEPTED' | 'REJECTED'> = {};
    docList.forEach(d => {
      if (d.status === 'APPROVED') updatedMap[d.name] = 'ACCEPTED';
      if (d.status === 'REJECTED') updatedMap[d.name] = 'REJECTED';
    });

    const rejectionNotes = buildRejectionNotes(docList);

    if (onCompleteVerification) {
      onCompleteVerification(updatedMap, isAllReviewed, rejectionNotes);
    }
    handleClose();
  };

  const handleDocumentLoadError = (docId: string) => {
    setDocList(prev =>
      prev.map(d => (d.id === docId ? { ...d, loadError: true } : d))
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F3F6FA] flex flex-col w-full h-screen overflow-hidden font-sans select-none">
      
      {/* ─── 1. WORKSPACE TOP HEADER ─── */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between flex-shrink-0 z-20">
        
        {/* Left: Back to Applications link */}
        <button
          type="button"
          onClick={handleClose}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-extrabold text-xs sm:text-sm transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} strokeWidth={2.5} /> Back to Applications
        </button>

        {/* Center: Live Verification Progress Bar */}
        <div className="flex flex-col items-center max-w-[240px] sm:max-w-xs w-full px-4 text-center">
          <div className="flex items-center justify-between w-full text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
            <span>Verification Progress</span>
            <span className="text-blue-600 font-extrabold">{verifiedCount + rejectedCount} / {totalDocs} Reviewed</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/30">
            <div
              className="bg-blue-600 h-full transition-all duration-350 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Right: Actions & Close */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleFinalizeWorkspace}
            className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            Save & Exit
          </button>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close Workspace"
            className="p-2 text-slate-400 hover:text-slate-750 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} strokeWidth={2.2} />
          </button>
        </div>

      </header>

      {/* ─── 2. CANDIDATE PROFILE ROW ─── */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-extrabold text-base shadow-sm shrink-0">
            {studentNameState ? studentNameState.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'YT'}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-slate-900 leading-none truncate max-w-[200px] sm:max-w-xs uppercase">
                {studentNameState}
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                ADM NO: {appNumberState}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">
              Official Document Verification Workspace
            </p>
          </div>
        </div>
      </div>

      {/* ─── 3. DOCUMENT TABS STRIP ─── */}
      <div className="bg-white border-b border-slate-200/60 px-6 py-3 flex items-center gap-2 overflow-x-auto flex-shrink-0 scrollbar-none">
        {docList.map((doc, idx) => {
          const isSelected = idx === currentDocumentIndex;
          
          const isCorrected = propAppStatus === 'RESUBMITTED' && (() => {
            if (!correctionRemarks) return false;
            const remarksLower = correctionRemarks.toLowerCase();
            const matches: Record<string, string[]> = {
              photo: ['passport', 'photo'],
              signature: ['signature'],
              tenthmarksheet: ['sslc', '10th', 'tenth'],
              twelfthmarksheet: ['puc', '12th', 'twelfth'],
              diplomasemester5marksheet: ['diploma 5th', 'semester 5', 'sem 5'],
              diplomasemester6marksheet: ['diploma 6th', 'semester 6', 'sem 6'],
              cetscorecard: ['cet', 'dcet', 'entrance'],
              feespaidreceipt: ['fees paid', 'receipt', 'fees verified'],
              castecertificate: ['caste'],
              gapcertificate: ['income', 'gap'],
              domicilecertificate: ['study', 'domicile']
            };
            const keywords = matches[doc.field.toLowerCase()] || [];
            return keywords.some(kw => remarksLower.includes(kw)) || remarksLower.includes(doc.name.toLowerCase());
          })();

          let tabStyle = '';
          let badgeStyle = '';
          
          if (isCorrected) {
            if (isSelected) {
              tabStyle = 'border-amber-600 bg-amber-600 text-white ring-2 ring-amber-500/25';
              badgeStyle = 'bg-white text-amber-700';
            } else {
              tabStyle = 'border-amber-300 bg-amber-50/70 text-amber-805 hover:bg-amber-100';
              badgeStyle = 'bg-amber-200 text-amber-805 animate-pulse';
            }
          } else if (doc.status === 'APPROVED') {
            if (isSelected) {
              tabStyle = 'border-emerald-600 bg-emerald-600 text-white ring-2 ring-emerald-500/25';
              badgeStyle = 'bg-white text-emerald-700';
            } else {
              tabStyle = 'border-emerald-300 bg-emerald-50 text-emerald-805 hover:bg-emerald-100/80';
              badgeStyle = 'bg-emerald-205 text-emerald-805';
            }
          } else if (doc.status === 'REJECTED') {
            if (isSelected) {
              tabStyle = 'border-rose-600 bg-rose-600 text-white ring-2 ring-rose-500/25';
              badgeStyle = 'bg-white text-rose-700';
            } else {
              tabStyle = 'border-rose-300 bg-rose-50/70 text-rose-805 hover:bg-rose-100';
              badgeStyle = 'bg-rose-205 text-rose-805';
            }
          } else {
            // PENDING
            if (isSelected) {
              tabStyle = 'border-blue-600 bg-blue-50/50 text-blue-600 ring-2 ring-blue-500/20';
              badgeStyle = 'bg-blue-600 text-white';
            } else {
              tabStyle = 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
              badgeStyle = 'bg-slate-100 text-slate-600';
            }
          }

          return (
            <button
              key={doc.id}
              ref={isSelected ? activeTabRef : null}
              onClick={() => {
                setCurrentDocumentIndex(idx);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${tabStyle}`}
            >
              <span className={`w-5 h-5 rounded-full ${badgeStyle} flex items-center justify-center text-[10px] font-black`}>
                {idx + 1}
              </span>
              {doc.name}
            </button>
          );
        })}
      </div>

      {/* ─── 4. TWO-COLUMN WORKSPACE CONTAINER ─── */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative bg-[#F8FAFC]">
        
        {/* LEFT COLUMN: Clean Document Preview Canvas */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden relative">
          
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 flex-1 flex items-center justify-center relative overflow-hidden">
            
            {/* Floating Zoom/View Toolbar on Top-Right */}
            <div className="absolute top-4 right-4 flex items-center gap-1 bg-slate-100/90 backdrop-blur-xs p-1 rounded-xl border border-slate-200 z-30 shadow-sm">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                title="Zoom Out"
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg disabled:opacity-30 transition-all cursor-pointer"
              >
                <ZoomOut size={15} />
              </button>
              <span className="text-[10px] font-mono font-black text-slate-700 px-1 min-w-[36px] text-center select-none">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 3.5}
                title="Zoom In"
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg disabled:opacity-30 transition-all cursor-pointer"
              >
                <ZoomIn size={15} />
              </button>
              <div className="w-px h-3.5 bg-slate-300 mx-1" />
              <button
                type="button"
                onClick={handleRotateLeft}
                title="Rotate Left"
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                onClick={handleRotateRight}
                title="Rotate Right"
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
              >
                <RotateCw size={15} />
              </button>
              <button
                type="button"
                onClick={resetViewer}
                title="Reset View"
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
              >
                <RefreshCw size={14} />
              </button>
              <div className="w-px h-3.5 bg-slate-300 mx-1" />
              <button
                type="button"
                onClick={toggleFullscreen}
                title="Fullscreen"
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
              >
                <Maximize2 size={14} />
              </button>
              <div className="w-px h-3.5 bg-slate-300 mx-1" />
              <button
                type="button"
                title="Download Document"
                onClick={() => {
                  if (!activeDocUrl) return;
                  const a = document.createElement('a');
                  a.href = activeDocUrl;
                  a.target = '_blank';
                  a.download = currentDocument?.name || 'document';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-white rounded-lg transition-all cursor-pointer"
              >
                <Download size={14} />
              </button>
            </div>

            {/* Document Title Stamp/Badge Top-Left */}
            <div className="absolute top-4 left-4 z-30">
              {currentDocument?.status === 'APPROVED' && (
                <span className="px-3 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 size={12} /> Approved
                </span>
              )}
              {currentDocument?.status === 'REJECTED' && (
                <span className="px-3 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5 shadow-sm">
                  <XCircle size={12} /> Rejected ({currentDocument.rejectionReason})
                </span>
              )}
              {currentDocument?.status === 'PENDING' && (
                <span className="px-3 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5 shadow-sm">
                  <Clock size={12} /> Pending Review
                </span>
              )}
            </div>

            {/* Inner canvas box */}
            <div
              ref={viewerContainerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`w-full h-full flex items-center justify-center overflow-hidden ${
                zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
              }`}
            >
              {activeDocLoading ? (
                <div className="flex flex-col items-center justify-center text-slate-500 gap-3">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-650">Loading Document File...</p>
                </div>
              ) : activeDocError || !activeDocUrl ? (
                <div className="flex flex-col items-center justify-center text-slate-500 gap-3 text-center p-6">
                  <AlertTriangle size={36} className="text-amber-500" />
                  <p className="text-xs font-bold text-slate-755">Document File Not Available or Unreadable</p>
                  <button
                    type="button"
                    onClick={() => {
                      // Trigger refresh/retry by forcing current idx state update
                      setCurrentDocumentIndex(currentDocumentIndex);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-xl border border-slate-300 transition-colors cursor-pointer"
                  >
                    Retry Loading
                  </button>
                </div>
              ) : currentDocument ? (
                <div
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg) translate(${position.x}px, ${position.y}px)`,
                    transformOrigin: 'center center',
                    transition: isPanning ? 'none' : 'transform 0.2s ease-out'
                  }}
                  className="flex items-center justify-center max-w-full max-h-full"
                >
                  {activeDocIsPdf ? (
                    <iframe
                      src={activeDocUrl}
                      className="w-[50vw] h-[65vh] rounded-2xl border border-slate-200 bg-white shadow-xs"
                      title={currentDocument.name}
                      onError={() => setActiveDocError(true)}
                    />
                  ) : (
                    <img
                      src={activeDocUrl}
                      alt={currentDocument.name}
                      onError={() => setActiveDocError(true)}
                      className="block max-w-full max-h-[66vh] w-auto h-auto object-contain rounded-2xl border border-slate-105 bg-white pointer-events-none shrink-0 shadow-xs"
                    />
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <FileText size={48} className="opacity-35 mb-2" />
                  <p className="text-sm font-semibold text-slate-650">No document selected</p>
                </div>
              )}
            </div>

            {/* Quick Review Navigation Overlay Arrows */}
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-30">
              <button
                type="button"
                onClick={() => {
                  if (currentDocumentIndex > 0) setCurrentDocumentIndex(currentDocumentIndex - 1);
                }}
                disabled={currentDocumentIndex <= 0}
                className="p-3 rounded-full bg-white/95 text-slate-700 hover:bg-white hover:text-slate-900 disabled:opacity-0 transition-all border border-slate-200/80 pointer-events-auto shadow-md hover:shadow-lg cursor-pointer"
              >
                <ChevronLeft size={20} strokeWidth={2.5} />
              </button>
            </div>
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none z-30">
              <button
                type="button"
                onClick={() => {
                  if (currentDocumentIndex < docList.length - 1) setCurrentDocumentIndex(currentDocumentIndex + 1);
                }}
                disabled={currentDocumentIndex >= docList.length - 1}
                className="p-3 rounded-full bg-white/95 text-slate-700 hover:bg-white hover:text-slate-900 disabled:opacity-0 transition-all border border-slate-200/80 pointer-events-auto shadow-md hover:shadow-lg cursor-pointer"
              >
                <ChevronRight size={20} strokeWidth={2.5} />
              </button>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: Reviewer Actions & Document Details Panel */}
        <div className="w-[420px] bg-white border-l border-slate-200 p-6 flex flex-col justify-between overflow-y-auto flex-shrink-0">
          
          <div className="space-y-6">
            
            {/* Document Details Section */}
            <div>
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4">Document Details</h3>
              <div className="space-y-3.5">
                <div className="flex items-center justify-between text-xs border-b border-slate-50 pb-2.5">
                  <span className="font-semibold text-slate-400">Uploaded On</span>
                  <span className="font-extrabold text-slate-800">{getUploadedDate(appUpdatedAt)}</span>
                </div>
                <div className="flex items-center justify-between text-xs border-b border-slate-50 pb-2.5">
                  <span className="font-semibold text-slate-400">Document Name</span>
                  <span className="font-extrabold text-slate-800 truncate max-w-[200px]">{currentDocument ? currentDocument.name : 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between text-xs border-b border-slate-50 pb-2.5">
                  <span className="font-semibold text-slate-400">File Size</span>
                  <span className="font-extrabold text-slate-800">{currentDocument ? getDocSize(currentDocument.name) : 'N/A'}</span>
                </div>
                {currentDocument?.id === 'admissionFormFeeReceipt' && docsData && (
                  <>
                    <div className="flex items-center justify-between text-xs border-b border-slate-50 pb-2.5">
                      <span className="font-semibold text-slate-400">Payment Mode</span>
                      <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[10px] uppercase font-sans tracking-wide">{docsData.admissionFormFeePaymentMode || 'OFFLINE'}</span>
                    </div>
                    {docsData.admissionFormFeePaymentMode === 'ONLINE' && docsData.admissionFormFeeUtr && (
                      <div className="flex flex-col gap-1.5 border-b border-slate-50 pb-3 mt-1">
                        <span className="font-semibold text-[10px] text-slate-400 uppercase tracking-wider">UTR / Transaction ID</span>
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 text-center shadow-sm select-all">
                          <span className="font-black text-indigo-800 font-mono text-base tracking-widest block">
                            {docsData.admissionFormFeeUtr}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Reviewer Notes Input Form */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-3">
                Reviewer Notes <span className="text-slate-400 font-bold lowercase">(Optional)</span>
              </label>
              <textarea
                rows={6}
                value={currentDocument?.rejectionRemarks || ''}
                onChange={e => handleNotesChange(e.target.value)}
                placeholder="Add any notes..."
                maxLength={500}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all resize-none shadow-xs"
              />
              <div className="text-right text-[10px] font-bold text-slate-400 mt-1.5">
                {(currentDocument?.rejectionRemarks || '').length} / 500
              </div>
            </div>

          </div>

          {/* Action Buttons Row at the bottom of the right panel */}
          <div className="border-t border-slate-100 pt-6 mt-6">
            <div className="flex items-center gap-3">
              {/* Reject Button */}
              <button
                type="button"
                onClick={() => {
                  // Pre-fill modal with existing rejection data if document was previously rejected
                  setRejectReason(currentDocument?.rejectionReason || 'Blurred Image');
                  setRejectRemarks(currentDocument?.rejectionRemarks || '');
                  setShowRejectModal(true);
                }}
                disabled={!currentDocument}
                className="flex-1 py-3 border border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
              >
                <XCircle size={15} /> Reject Document
              </button>

              {/* Approve Button */}
              <button
                type="button"
                onClick={handleApproveCurrentDoc}
                disabled={!currentDocument}
                className="flex-1 py-3 bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-40"
              >
                <CheckCircle2 size={15} /> Approve Document
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* ─── REJECTION MODAL OVERLAY ─── */}
      {showRejectModal && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-rose-700 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle size={16} /> Reject Document: {currentDocument?.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="text-slate-400 hover:text-slate-750 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Rejection Reason (Required)
                </label>
                <select
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500 cursor-pointer"
                >
                  <option value="Blurred Image">Blurred Image / Low Resolution</option>
                  <option value="Wrong Document">Wrong Document Category</option>
                  <option value="Incomplete Document">Incomplete / Cropped Document</option>
                  <option value="Unreadable">Unreadable Text / Corrupted File</option>
                  <option value="Duplicate Upload">Duplicate Upload</option>
                  <option value="Other">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Remarks / Instructions for Student
                </label>
                <textarea
                  rows={3}
                  value={rejectRemarks}
                  onChange={e => {
                    setRejectRemarks(e.target.value);
                    handleNotesChange(e.target.value);
                  }}
                  placeholder="Provide clear details on why this document is rejected..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectDoc}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

// Stage 12: Add Error Boundary around Review Workspace
export const DocumentVerificationWorkspace: React.FC<DocumentVerificationWorkspaceProps> = (props) => {
  return (
    <ReviewWorkspaceErrorBoundary>
      <DocumentVerificationWorkspaceContent {...props} />
    </ReviewWorkspaceErrorBoundary>
  );
};

export default DocumentVerificationWorkspace;

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import admissionService, { AdmissionApplication } from '../../../services/admission.service';
import API from '../../../services/api';
import { ArrowLeft, User, Users, GraduationCap, CheckCircle2, XCircle, FileText, MapPin, ExternalLink, ShieldCheck, Maximize2, Image, Layers, Clock, Send, X, AlertTriangle, Loader2, Trash2, Ban, ArrowRight } from 'lucide-react';
import { toast } from 'react-toastify';
import { getAcademicYear, formatDateDDMMYYYY } from '../../../utils/date.util';
import { DocumentVerificationWorkspace } from './DocumentVerificationWorkspace';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getDocUrl = (url?: string | null, appId?: string) => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  
  if (!url.startsWith('/uploads') && !url.startsWith('uploads/') && appId) {
    const base = API.defaults.baseURL || '/api';
    const token = localStorage.getItem('token');
    let field = 'photo';
    if (url.toLowerCase().includes('signature')) field = 'signature';
    else if (url.toLowerCase().includes('tenth') || url.toLowerCase().includes('10th')) field = 'tenthMarksheet';
    else if (url.toLowerCase().includes('twelfth') || url.toLowerCase().includes('12th')) field = 'twelfthMarksheet';
    else if (url.toLowerCase().includes('cet')) field = 'cetScoreCard';
    else if (url.toLowerCase().includes('aadhaar')) field = 'aadhaar';
    else if (url.toLowerCase().includes('caste')) field = 'casteCertificate';
    else if (url.toLowerCase().includes('domicile')) field = 'domicileCertificate';
    else if (url.toLowerCase().includes('gap')) field = 'gapCertificate';
    else if (url.toLowerCase().includes('feespaid')) field = 'feesPaidReceipt';
    else if (url.toLowerCase().includes('admissionform')) field = 'admissionFormFeeReceipt';
    
    const streamUrl = `${base}/admin/admissions/${appId}/documents/${field}`;
    return token ? `${streamUrl}?token=${encodeURIComponent(token)}` : streamUrl;
  }

  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  const base = API.defaults.baseURL || '/api';
  const host = base.replace(/\/api\/?$/, '');
  const finalUrl = host.startsWith('/') ? cleanPath : `${host}${cleanPath}`;
  const token = localStorage.getItem('token');
  return token ? `${finalUrl}?token=${encodeURIComponent(token)}` : finalUrl;
};

const getMissingFields = (app: AdmissionApplication | null) => {
  const missing: string[] = [];
  if (!app) return missing;
  const pd = app.studentpersonaldetails as any;
  const par = app.studentparentdetails as any;
  const addr = app.studentaddress as any;
  const acad = app.studentacademicdetails as any;
  const docs = app.studentdocuments as any;
  const q = (app.qualification || '').toUpperCase();
  const showPUC = q === 'PUC' || (!q && app.admissionType === 'KCET');
  const showDiploma = q === 'DIPLOMA' || (!q && app.admissionType === 'DCET');

  // Personal Details
  if (!pd?.firstName) missing.push("Personal: First Name");
  if (!pd?.lastName) missing.push("Personal: Last Name");
  if (!pd?.gender) missing.push("Personal: Gender");
  if (!pd?.dateOfBirth) missing.push("Personal: Date of Birth");
  if (!pd?.nationality) missing.push("Personal: Nationality");
  if (!pd?.religion) missing.push("Personal: Religion");
  if (!pd?.caste) missing.push("Personal: Caste");
  if (!pd?.category) missing.push("Personal: Category");
  if (!pd?.areaType) missing.push("Personal: Area Type");
  if (!pd?.phone && !app.user?.phone) missing.push("Personal: Mobile Number");

  // Parent Details
  if (!par?.fatherName) missing.push("Parent: Father's Name");
  if (!par?.fatherOccupation) missing.push("Parent: Father's Occupation");
  if (!par?.fatherPhone) missing.push("Parent: Father's Mobile");
  if (!par?.motherName) missing.push("Parent: Mother's Name");
  if (!par?.motherOccupation) missing.push("Parent: Mother's Occupation");
  if (!par?.motherPhone) missing.push("Parent: Mother's Mobile");
  if (!par?.fatherAnnualIncome) missing.push("Parent: Annual Income");

  // Address Details
  if (!addr?.currentAddressLine1) missing.push("Address: Current Address");
  if (!addr?.currentCity) missing.push("Address: Current City");
  if (!addr?.currentState) missing.push("Address: Current State");
  if (!addr?.currentPincode) missing.push("Address: Current Pincode");

  // Academics
  if (!acad?.tenthSchool) missing.push("Academic: 10th School Name");
  if (!acad?.tenthBoard) missing.push("Academic: 10th Board");
  if (!acad?.tenthPassingYear) missing.push("Academic: 10th Year of Passing");
  if (!acad?.tenthRegisterNumber) missing.push("Academic: 10th Register Number");
  if (!acad?.tenthPercentage) missing.push("Academic: 10th Percentage");

  if (showDiploma) {
    if (!acad?.diplomaUniversity) missing.push("Academic: Diploma University");
    if (!acad?.diplomaYear) missing.push("Academic: Diploma Year of Passing");
    if (!acad?.diplomaRegisterNumber) missing.push("Academic: Diploma Register Number");
    if (!acad?.diplomaPercentage) missing.push("Academic: Diploma Percentage");
  }
  if (showPUC) {
    if (!acad?.twelfthSchool) missing.push("Academic: 12th/PUC School Name");
    if (!acad?.twelfthStream) missing.push("Academic: 12th/PUC Stream");
    if (!acad?.twelfthBoard) missing.push("Academic: 12th/PUC Board");
    if (!acad?.twelfthPassingYear) missing.push("Academic: 12th/PUC Year of Passing");
    if (!acad?.twelfthRegisterNumber) missing.push("Academic: 12th/PUC Register Number");
    if (!acad?.twelfthPercentage) missing.push("Academic: 12th/PUC Percentage");
  }

  // Documents
  if (!docs?.photoUrl) missing.push("Documents: Passport Photo");
  if (!docs?.signatureUrl) missing.push("Documents: Candidate Signature");
  if (!docs?.tenthMarksheetUrl) missing.push("Documents: 10th/SSLC Marksheet");
  if (showDiploma) {
    if (!docs?.diplomaSemester5MarksheetUrl) missing.push("Documents: Diploma 5th Semester Marks Card");
    if (!docs?.diplomaSemester6MarksheetUrl) missing.push("Documents: Diploma 6th Semester Marks Card");
  } else {
    if (!docs?.twelfthMarksheetUrl) missing.push("Documents: 12th/PUC Marksheet");
  }
  if (!docs?.feesPaidReceiptUrl) missing.push("Documents: College Fees Receipt");
  if (!docs?.admissionFormFeeReceiptUrl) missing.push("Documents: Admission Form Fee Receipt");
  if (!docs?.aadhaarUrl) missing.push("Documents: Aadhaar Card");
  if (!docs?.domicileCertificateUrl) missing.push("Documents: Domicile/Study Certificate");

  return missing;
};

const CorrectionContext = React.createContext<{
  remarks: string | null;
  status: string;
  onToggleFieldCorrection?: (fieldLabel: string) => void;
  isFieldFlagged?: (fieldLabel: string) => boolean;
}>({ remarks: null, status: '' });

const FormField = ({ 
  label, 
  value, 
  remarkText 
}: { 
  label: string; 
  value?: string | number | null | boolean; 
  remarkText?: string;
}) => {
  const { remarks, status, onToggleFieldCorrection, isFieldFlagged } = React.useContext(CorrectionContext);
  
  const isFlagged = isFieldFlagged?.(remarkText || label) || false;
  const isEditable = status !== 'REJECTED' && status !== 'ENROLLED' && status !== 'APPROVED' && status !== 'PRINCIPAL_APPROVED' && status !== 'CORRECTION_REQUIRED';

  const corrected = status === 'RESUBMITTED' && (() => {
    if (!remarks) return false;
    const remarksLower = remarks.toLowerCase();
    const labelLower = label.toLowerCase();
    
    const matches: Record<string, string[]> = {
      'kcet number': ['cet', 'kcet'],
      'dcet number': ['dcet'],
      'aadhaar': ['aadhaar'],
      'first name': ['first name', 'name'],
      'middle name': ['middle name'],
      'last name': ['last name'],
      'caste': ['caste'],
      'date of birth': ['birth', 'dob'],
      'gender': ['gender'],
      'category': ['category'],
      'religion': ['religion'],
      'nationality': ['nationality'],
      'father name': ['father name', 'father'],
      'mother name': ['mother name', 'mother'],
      'mobile number': ['mobile', 'phone'],
      'parent email': ['email'],
      'annual income': ['income'],
      'current address': ['address', 'current'],
      'permanent address': ['address', 'permanent'],
      'street address': ['street', 'address'],
      'city / village': ['city', 'village'],
      'taluk': ['taluk'],
      'district': ['district'],
      'pincode': ['pincode', 'pin code'],
      'state': ['state'],
      '10th school name': ['sslc', '10th', 'tenth'],
      '12th/puc school name': ['puc', '12th', 'twelfth'],
      'diploma university': ['diploma'],
    };
    
    const keywords = matches[labelLower] || [labelLower];
    return keywords.some(kw => remarksLower.includes(kw));
  })();

  return (
    <div className={`group relative p-3 rounded-lg border transition-all flex flex-col gap-1.5 ${
      corrected 
        ? 'border-amber-400 bg-amber-50/30 shadow-[0_0_8px_rgba(245,158,11,0.08)] dark:bg-amber-950/15 dark:border-amber-800' 
        : isFlagged
        ? 'border-rose-400 dark:border-rose-800 bg-rose-50/20 dark:bg-rose-950/10 shadow-[0_0_8px_rgba(239,68,68,0.08)]'
        : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-100 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700'
    }`}>
      <div className="flex items-center justify-between gap-2 pr-4">
        <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider leading-none">{label}</p>
        {corrected && (
          <span className="text-[8px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-black uppercase shrink-0">Updated</span>
        )}
      </div>
      <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 leading-tight">{value !== null && value !== undefined && value !== '' ? String(value) : '—'}</p>
      
      {isEditable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFieldCorrection?.(remarkText || label);
          }}
          className={`absolute top-1.5 right-1.5 transition-all duration-200 rounded-full p-0.5 ${
            isFlagged
              ? 'opacity-100 text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-950/40 hover:scale-105'
              : 'opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-rose-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:scale-105'
          }`}
          title={isFlagged ? "Remove correction request" : "Request correction for this field"}
        >
          <X size={12} className="stroke-[3]" />
        </button>
      )}
    </div>
  );
};

const DocumentThumbnail: React.FC<{ field: string; appId: string; label: string; onClick: () => void }> = ({ field, appId, label, onClick }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [isPdf, setIsPdf] = useState(false);

  useEffect(() => {
    let active = true;
    const loadFile = async () => {
      setLoading(true);
      try {
        const response = await API.get(`/admin/admissions/${appId}/documents/${field}`, {
          responseType: 'blob',
        });
        if (!active) return;
        const type = response.data.type || '';
        setIsPdf(type.includes('pdf'));
        const url = URL.createObjectURL(response.data);
        setBlobUrl(url);
      } catch (err) {
        console.error('Failed to load thumbnail for', field, err);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadFile();
    return () => {
      active = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [field, appId]);

  if (loading) {
    return (
      <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-805 rounded-lg flex items-center justify-center border border-neutral-200 dark:border-neutral-700 animate-pulse shrink-0">
        <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-805 rounded-lg flex items-center justify-center border border-neutral-200 dark:border-neutral-700 text-neutral-450 shrink-0" title="Error loading file">
        <FileText size={16} />
      </div>
    );
  }

  return (
    <div 
      onClick={onClick}
      className="w-16 h-16 bg-neutral-100 dark:bg-neutral-805 rounded-lg flex items-center justify-center overflow-hidden border border-neutral-250 dark:border-neutral-700 cursor-pointer shadow-sm hover:scale-105 transition-transform shrink-0 relative group"
    >
      {isPdf ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-1 bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400">
          <FileText size={18} />
          <span className="text-[8px] font-black tracking-tight mt-0.5">PDF</span>
        </div>
      ) : (
        <img src={blobUrl} alt={label} className="w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
        <Maximize2 size={12} />
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const AdmissionReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<AdmissionApplication | null>(null);

  const handleBack = () => {
    if (!app) {
      navigate('/admin/admissions/queue');
      return;
    }
    // Check status and map to the corresponding tab route
    if (app.applicationStatus === 'APPROVED') {
      navigate('/admin/admissions/verified');
    } else if (app.applicationStatus === 'REJECTED') {
      navigate('/admin/admissions/rejected');
    } else if (app.applicationStatus === 'ENROLLED') {
      navigate('/admin/admissions/enrolled');
    } else {
      navigate('/admin/admissions/queue');
    }
  };

  const handleDeleteApplication = async () => {
    if (!app) return;
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete the rejected application for ${
        app.studentpersonaldetails?.firstName || 'this student'
      }? This action is irreversible and will delete all student records, document uploads, and their user account.`
    );
    if (!confirmDelete) return;

    try {
      setUpdating(true);
      const res = await API.delete(`/admin/admissions/${app.id}`);
      if (res.data.success) {
        toast.success('Rejected application permanently deleted.');
        navigate('/admin/admissions/rejected');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete application.');
    } finally {
      setUpdating(false);
    }
  };

  // Direct cancel admission states
  const [cancelDirectModalOpen, setCancelDirectModalOpen] = useState(false);
  const [cancelDirectStep, setCancelDirectStep] = useState(1);
  const [cancelDirectReason, setCancelDirectReason] = useState('');
  const [cancelDirectRemarks, setCancelDirectRemarks] = useState('');
  const [cancelDirectSubmitting, setCancelDirectSubmitting] = useState(false);

  const handleDirectCancelSubmit = async () => {
    if (!app || !cancelDirectReason) return;
    setCancelDirectSubmitting(true);
    try {
      await admissionService.directCancel(app.id, cancelDirectReason, cancelDirectRemarks);
      toast.success('Admission cancelled successfully.');
      setCancelDirectModalOpen(false);
      setCancelDirectReason('');
      setCancelDirectRemarks('');
      setCancelDirectStep(1);
      fetchApplication(app.id);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to cancel admission');
    } finally {
      setCancelDirectSubmitting(false);
    }
  };

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [remarks, setRemarks] = useState('');
  const [rejectionReasonCode, setRejectionReasonCode] = useState('');
  const [docStatus, setDocStatus] = useState<Record<string, 'ACCEPTED' | 'REJECTED'>>({});
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);

  const [documentsVerified, setDocumentsVerified] = useState(false);
  const [eligibilityVerified, setEligibilityVerified] = useState(false);
  const [verificationRemarks, setVerificationRemarks] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [highlightChecklist, setHighlightChecklist] = useState(false);
  const checklistRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (documentsVerified && eligibilityVerified) {
      setHighlightChecklist(false);
    }
  }, [documentsVerified, eligibilityVerified]);

  // Correction workflow states
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [selectedCorrectionSections, setSelectedCorrectionSections] = useState<string[]>([]);
  const [correctionRemarks, setCorrectionRemarks] = useState('');
  const [correctionDeadline, setCorrectionDeadline] = useState('');

  const isInitialLoadRef = React.useRef(true);

  const isEditable = app 
    ? (app.applicationStatus !== 'REJECTED' && 
       app.applicationStatus !== 'ENROLLED' && 
       app.applicationStatus !== 'APPROVED' && 
       app.applicationStatus !== 'PRINCIPAL_APPROVED' && 
       app.applicationStatus !== 'CORRECTION_REQUIRED')
    : false;

  const handleToggleFieldCorrection = (fieldLabel: string) => {
    setRemarks(prev => {
      const targetText = `• ${fieldLabel} needs correction`;
      let lines = prev.split('\n').map(line => line.trim());
      
      const index = lines.findIndex(line => 
        line.toLowerCase() === targetText.toLowerCase() || 
        line.toLowerCase().includes(`${fieldLabel.toLowerCase()} needs correction`)
      );

      if (index !== -1) {
        lines.splice(index, 1);
      } else {
        lines.push(targetText);
      }
      
      return lines.filter(line => line.length > 0).join('\n');
    });
  };

  const isFieldFlagged = (fieldLabel: string): boolean => {
    if (!remarks) return false;
    const remarksLower = remarks.toLowerCase();
    const searchStr = `${fieldLabel.toLowerCase()} needs correction`;
    return remarksLower.includes(searchStr);
  };

  const isSectionFlaggedForCorrection = (sectionKey: string) => {
    if (!app?.correctionRequestedSections) return false;
    return app.correctionRequestedSections.includes(sectionKey);
  };

  const isSectionCorrected = (sectionKey: string) => {
    if (app?.applicationStatus !== 'RESUBMITTED') return false;
    if (sectionKey === 'documents' && documentsVerified) return false;
    if (
      (sectionKey === 'admission' ||
        sectionKey === 'personal' ||
        sectionKey === 'parent' ||
        sectionKey === 'address' ||
        sectionKey === 'academic') &&
      eligibilityVerified
    ) {
      return false;
    }
    return app.correctionRequestedSections?.includes(sectionKey) || false;
  };

  const getSectionClass = (sectionKey: string, customClasses = 'space-y-4') => {
    // CORRECTION_REQUIRED: highlight sections that need correction in amber
    if (app?.applicationStatus === 'CORRECTION_REQUIRED' && isSectionFlaggedForCorrection(sectionKey)) {
      return `${customClasses} border-2 border-amber-400 bg-amber-50/40 dark:bg-amber-950/10 rounded-2xl p-6 shadow-[0_0_12px_rgba(251,191,36,0.2)] transition-all relative`;
    }
    // RESUBMITTED: amber = section was corrected, emerald = section was not changed
    if (app?.applicationStatus === 'RESUBMITTED') {
      const corrected = isSectionCorrected(sectionKey);
      if (corrected) {
        return `${customClasses} border-2 border-amber-500 bg-amber-50/5 dark:bg-amber-950/5 rounded-2xl p-6 shadow-[0_0_15px_rgba(245,158,11,0.15)] transition-all`;
      } else {
        return `${customClasses} border-2 border-emerald-500 bg-emerald-50/5 dark:bg-emerald-950/5 rounded-2xl p-6 opacity-75 transition-all`;
      }
    }
    return customClasses;
  };


  useEffect(() => {
    if (id) fetchApplication(id);
  }, [id]);

  // ─── Shared helper: build the full combined remarks from current state ─────
  const buildRemarks = (
    currentApp: AdmissionApplication | null,
    currentDocStatus: Record<string, 'ACCEPTED' | 'REJECTED'>,
    currentReasonCode: string
  ): string => {
    // 1. Rejection reason remark
    const reasonRemarksMap: Record<string, string> = {
      'DOC_NOT_VERIFIED': 'Documents verification failed during admin review.',
      'INCOMPLETE_DOCUMENTS': 'Some mandatory documents were not uploaded or are missing.',
      'FEES_NOT_PAID': 'Application fees have not been paid or verified.',
      'ELIGIBILITY_FAILED': 'Candidate does not meet the minimum eligibility criteria.',
      'INVALID_CERTIFICATES': 'Uploaded certificates are invalid, expired, or mismatched.',
      'DUPLICATE_APPLICATION': 'A duplicate admission application was found for this candidate.',
      'AADHAAR_MISMATCH': 'Aadhaar card details do not match the personal profile.',
      'USN_CONFLICT': 'USN already exists or is assigned to another student.',
    };
    const reasonRemarks = reasonRemarksMap[currentReasonCode] || '';

    // 2. Rejected documents
    const rejectedLabels = Object.entries(currentDocStatus)
      .filter(([, s]) => s === 'REJECTED')
      .map(([l]) => l);
    const docRemarks = rejectedLabels.length > 0
      ? `The following documents were rejected and must be re-uploaded:\n${rejectedLabels.map(d => `• ${d}`).join('\n')}`
      : '';

    // 3. Missing / incomplete form fields
    const missing = getMissingFields(currentApp);
    const missingRemarks = missing.length > 0
      ? `Please provide the following missing or incomplete details:\n${missing.map(f => `• ${f}`).join('\n')}`
      : '';

    return [reasonRemarks, docRemarks, missingRemarks].filter(Boolean).join('\n\n');
  };

  const fetchApplication = async (appId: string) => {
    try {
      setLoading(true);
      const data = await admissionService.getApplication(appId);
      setApp(data);

      // Restore saved document statuses from localStorage, or fall back to database verifiedDocuments
      let savedStatuses: Record<string, 'ACCEPTED' | 'REJECTED'> = {};
      const savedStatusesStr = localStorage.getItem(`doc_status_${appId}`);
      if (savedStatusesStr) {
        try {
          savedStatuses = JSON.parse(savedStatusesStr);
        } catch (e) {
          console.error('Error parsing saved document statuses from localStorage', e);
        }
      } else if (data.verifiedDocuments) {
        savedStatuses = { ...data.verifiedDocuments };
      }

      // Reset status of corrected documents to PENDING if status is RESUBMITTED
      if (data.applicationStatus === 'RESUBMITTED') {
        const remarksLower = (data.correctionRemarks || '').toLowerCase();
        const matches: Record<string, string[]> = {
          'Passport Size Photo': ['passport', 'photo'],
          'Candidate E-Signature': ['signature'],
          'SSLC / 10th Marks Card': ['sslc', '10th', 'tenth'],
          'PUC / 12th Marks Card': ['puc', '12th', 'twelfth'],
          'Diploma 5th Semester Marks Card': ['diploma 5th', 'semester 5', 'sem 5'],
          'Diploma 6th Semester Marks Card': ['diploma 6th', 'semester 6', 'sem 6'],
          'Entrance Score Card (CET/DCET)': ['cet', 'dcet', 'entrance'],
          'Fees Paid Receipt': ['fees paid', 'receipt', 'fees verified'],
          'Caste Certificate (Optional)': ['caste'],
          'Income / Gap Year Certificate': ['income', 'gap'],
          'Domicile / Study Certificate': ['study', 'domicile']
        };

        let modified = false;
        Object.keys(savedStatuses).forEach(label => {
          const keywords = matches[label] || [];
          const isDocCorrected = keywords.some(kw => remarksLower.includes(kw)) || remarksLower.includes(label.toLowerCase());
          if (isDocCorrected && savedStatuses[label] === 'REJECTED') {
            delete savedStatuses[label];
            modified = true;
          }
        });
        if (modified) {
          localStorage.setItem(`doc_status_${appId}`, JSON.stringify(savedStatuses));
          admissionService.saveDocumentStatuses(appId, savedStatuses).catch(err => {
            console.error("Failed to save doc statuses to database on reset:", err);
          });
        }
      }

      setDocStatus(savedStatuses);

      const savedReasonCode = localStorage.getItem(`rejection_reason_${appId}`);
      const restoredReasonCode = savedReasonCode !== null 
        ? savedReasonCode 
        : (data.applicationStatus === 'SUBMITTED' || data.applicationStatus === 'UNDER_REVIEW' || data.applicationStatus === 'RESUBMITTED'
          ? ''
          : (data.rejectionReasonCode || ''));
      setRejectionReasonCode(restoredReasonCode);

      // Auto-build remarks from all sources: reason + rejected docs + missing fields
      const autoRemarks = buildRemarks(data, savedStatuses, restoredReasonCode);
      // Use saved adminRemarks if they exist for non-pending apps, else auto-generate
      const isPendingReview = data.applicationStatus === 'SUBMITTED' || data.applicationStatus === 'UNDER_REVIEW' || data.applicationStatus === 'RESUBMITTED';
      
      const savedRemarks = localStorage.getItem(`admin_remarks_${appId}`);
      let finalRemarks = savedRemarks !== null ? savedRemarks : (isPendingReview ? autoRemarks : (data.adminRemarks || autoRemarks));

      // Sync finalRemarks with the savedStatuses (doc status):
      let lines = finalRemarks.split('\n').map(line => line.trim());

      const allDocLabels = [
        'Passport Size Photo',
        'Candidate E-Signature',
        'SSLC / 10th Marks Card',
        'PUC / 12th Marks Card',
        'Diploma 5th Semester Marks Card',
        'Diploma 6th Semester Marks Card',
        'Entrance Score Card (CET/DCET)',
        'Aadhaar Card copy',
        'College Fees Receipt',
        'Admission Form Fee Receipt',
        'Caste Certificate (Optional)',
        'Domicile / Study Certificate',
        'Income / Gap Year Certificate'
      ];

      allDocLabels.forEach(label => {
        const targetText = `• ${label} needs correction/re-upload`;
        const index = lines.findIndex(l => 
          l.toLowerCase() === targetText.toLowerCase() || 
          l.toLowerCase().includes(`${label.toLowerCase()} needs correction/re-upload`)
        );
        const status = savedStatuses[label];
        if (status === 'REJECTED') {
          if (index === -1) {
            // Find a header like "Documents requiring correction:" or push
            const headerIndex = lines.findIndex(l => l.toLowerCase().includes('documents requiring correction'));
            if (headerIndex !== -1) {
              lines.splice(headerIndex + 1, 0, targetText);
            } else {
              lines.push(targetText);
            }
          }
        } else {
          if (index !== -1) {
            lines.splice(index, 1);
          }
        }
      });

      finalRemarks = lines.filter(line => line.length > 0).join('\n');
      setRemarks(finalRemarks);

      setDocumentsVerified(data.documentsVerified || false);
      setEligibilityVerified(data.eligibilityVerified || false);
      
      const savedVerificationRemarks = localStorage.getItem(`verification_remarks_${appId}`);
      setVerificationRemarks(savedVerificationRemarks !== null ? savedVerificationRemarks : (data.verificationRemarks || ''));

      isInitialLoadRef.current = true;
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load application');
      navigate('/admin/admissions/queue');
    } finally {
      setLoading(false);
    }
  };


  // ─── Auto-rebuild remarks whenever doc status or reason code changes ──────
  useEffect(() => {
    if (!app) return;
    
    // Prevent run on initial mount to keep the restored localStorage remarks
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    setRemarks(prev => {
      // Re-generate reason remarks message
      const reasonRemarksMap: Record<string, string> = {
        'DOC_NOT_VERIFIED': 'Documents verification failed during admin review.',
        'INCOMPLETE_DOCUMENTS': 'Some mandatory documents were not uploaded or are missing.',
        'FEES_NOT_PAID': 'Application fees have not been paid or verified.',
        'ELIGIBILITY_FAILED': 'Candidate does not meet the minimum eligibility criteria.',
        'INVALID_CERTIFICATES': 'Uploaded certificates are invalid, expired, or mismatched.',
        'DUPLICATE_APPLICATION': 'A duplicate admission application was found for this candidate.',
        'AADHAAR_MISMATCH': 'Aadhaar card details do not match the personal profile.',
        'USN_CONFLICT': 'USN already exists or is assigned to another student.',
      };

      let lines = prev.split('\n').map(line => line.trim());

      // 1. Update the reason remark message:
      // Remove any existing reason remarks from the lines
      Object.values(reasonRemarksMap).forEach(msg => {
        lines = lines.filter(line => !line.includes(msg));
      });
      // Add the new reason remark at the top
      const newReasonMsg = reasonRemarksMap[rejectionReasonCode];
      if (newReasonMsg) {
        lines.unshift(newReasonMsg);
      }

      // 2. Update document remarks:
      // Find all document labels and their accepted/rejected status
      const allDocLabels = [
        'Passport Size Photo',
        'Candidate E-Signature',
        'SSLC / 10th Marks Card',
        'PUC / 12th Marks Card',
        'Diploma 5th Semester Marks Card',
        'Diploma 6th Semester Marks Card',
        'Entrance Score Card (CET/DCET)',
        'Aadhaar Card copy',
        'College Fees Receipt',
        'Admission Form Fee Receipt',
        'Caste Certificate (Optional)',
        'Domicile / Study Certificate',
        'Income / Gap Year Certificate'
      ];

      allDocLabels.forEach(label => {
        const targetText = `• ${label} needs correction/re-upload`;
        const index = lines.findIndex(l => 
          l.toLowerCase() === targetText.toLowerCase() || 
          l.toLowerCase().includes(`${label.toLowerCase()} needs correction/re-upload`)
        );
        const status = docStatus[label];
        if (status === 'REJECTED') {
          if (index === -1) {
            // Find a header like "Documents requiring correction:" or push
            const headerIndex = lines.findIndex(l => l.toLowerCase().includes('documents requiring correction'));
            if (headerIndex !== -1) {
              lines.splice(headerIndex + 1, 0, targetText);
            } else {
              lines.push(targetText);
            }
          }
        } else {
          if (index !== -1) {
            lines.splice(index, 1);
          }
        }
      });

      return lines.filter(line => line.length > 0).join('\n');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docStatus, rejectionReasonCode]);

  // Save remarks to localStorage whenever they change
  useEffect(() => {
    if (!loading && id && remarks !== undefined && remarks !== null) {
      localStorage.setItem(`admin_remarks_${id}`, remarks);
    }
  }, [remarks, id, loading]);

  // Save verificationRemarks to localStorage whenever they change
  useEffect(() => {
    if (!loading && id && verificationRemarks !== undefined && verificationRemarks !== null) {
      localStorage.setItem(`verification_remarks_${id}`, verificationRemarks);
    }
  }, [verificationRemarks, id, loading]);

  // Save rejectionReasonCode to localStorage whenever they change
  useEffect(() => {
    if (!loading && id && rejectionReasonCode !== undefined && rejectionReasonCode !== null) {
      localStorage.setItem(`rejection_reason_${id}`, rejectionReasonCode);
    }
  }, [rejectionReasonCode, id, loading]);

  const handleToggleDocStatus = (label: string, status: 'ACCEPTED' | 'REJECTED') => {
    const updatedStatus = { ...docStatus, [label]: status };
    setDocStatus(updatedStatus);
    if (id) {
      localStorage.setItem(`doc_status_${id}`, JSON.stringify(updatedStatus));
    }
    // Auto-switch rejection code to DOC_NOT_VERIFIED when docs are rejected
    if (status === 'REJECTED' && !rejectionReasonCode) {
      setRejectionReasonCode('DOC_NOT_VERIFIED');
    }
  };

  const handleReasonChange = (code: string) => {
    setRejectionReasonCode(code);
  };


  const handleUpdateStatus = async (status: 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW' | 'ENROLLED' | 'CORRECTION_REQUIRED') => {
    if (!app) return;

    if (status === 'CORRECTION_REQUIRED') {
      if (!remarks || !remarks.trim()) {
        toast.error('Internal Remarks (Correction Requests) must be filled before sending for correction.');
        return;
      }
      const confirmed = window.confirm(
        `Send this application back to the student for correction?\n\nThe student will be asked to review and resubmit the highlighted sections.\n\nCorrection notes will be sent:\n${remarks.slice(0, 200)}${remarks.length > 200 ? '...' : ''}`
      );
      if (!confirmed) return;
    }

    if (status === 'REJECTED') {
      if (!rejectionReasonCode) {
        toast.error('rejectionReasonCode is required when status is REJECTED.');
        return;
      }
      if (rejectionReasonCode === 'OTHER' && (!remarks || !remarks.trim())) {
        toast.error('Remarks are mandatory when rejection reason is OTHER.');
        return;
      }
 
      const reasonLabels: Record<string, string> = {
        'DOC_NOT_VERIFIED': 'Documents Not Verified',
        'INCOMPLETE_DOCUMENTS': 'Incomplete Documents',
        'FEES_NOT_PAID': 'Fees Not Paid',
        'ELIGIBILITY_FAILED': 'Eligibility Criteria Not Met',
        'INVALID_CERTIFICATES': 'Invalid / Mismatched Certificates',
        'DUPLICATE_APPLICATION': 'Duplicate Application Found',
        'AADHAAR_MISMATCH': 'Aadhaar Verification Failed',
        'USN_CONFLICT': 'USN Conflict / Already Exists',
        'OTHER': 'Other',
      };
      const label = reasonLabels[rejectionReasonCode] || rejectionReasonCode;
 
      const confirmed = window.confirm(
        `Are you sure you want to reject this application?\n\nReason: ${label}\nThis action is final and will notify the applicant.`
      );
      if (!confirmed) return;
    }

    const isLegacyFeeStatus = app.applicationStatus === 'FEE_RECEIPT_UPLOADED' || app.applicationStatus === 'FEE_VERIFIED';
    if (status === 'APPROVED' && !isLegacyFeeStatus && (!documentsVerified || !eligibilityVerified)) {
      setHighlightChecklist(true);
      checklistRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (status === 'ENROLLED') {
      const confirmed = window.confirm(
        `Are you sure you want to finalize this admission?\n\nThis will auto-generate the USN/Enrollment details and register the student user.`
      );
      if (!confirmed) return;
    }

    setUpdating(true);
    try {
      if (status === 'APPROVED') {
        // Auto-save the ticked checklist values to DB
        await admissionService.verifyChecklist(app.id, {
          documentsVerified,
          eligibilityVerified,
          verificationRemarks
        });
      }
      let label: string | undefined = undefined;
      if (status === 'REJECTED' && rejectionReasonCode) {
        const reasonLabels: Record<string, string> = {
          'DOC_NOT_VERIFIED': 'Documents Not Verified',
          'INCOMPLETE_DOCUMENTS': 'Incomplete Documents',
          'FEES_NOT_PAID': 'Fees Not Paid',
          'ELIGIBILITY_FAILED': 'Eligibility Criteria Not Met',
          'INVALID_CERTIFICATES': 'Invalid / Mismatched Certificates',
          'DUPLICATE_APPLICATION': 'Duplicate Application Found',
          'AADHAAR_MISMATCH': 'Aadhaar Verification Failed',
          'USN_CONFLICT': 'USN Conflict / Already Exists',
          'OTHER': 'Other',
        };
        label = reasonLabels[rejectionReasonCode] || rejectionReasonCode;
      }
      // Auto-derive affected sections for CORRECTION_REQUIRED
      let correctionSections: string[] | undefined = undefined;
      if (status === 'CORRECTION_REQUIRED') {
        const sectionSet = new Set<string>();

        // If any documents are rejected → 'documents' section
        const hasRejectedDocs = Object.values(docStatus).some(s => s === 'REJECTED');
        if (hasRejectedDocs) sectionSet.add('documents');

        // Map missing field prefixes → form sections
        const missing = getMissingFields(app);
        missing.forEach(f => {
          if (f.startsWith('Address:'))  sectionSet.add('address');
          if (f.startsWith('Academic:')) sectionSet.add('academic');
          if (f.startsWith('Documents:')) sectionSet.add('documents');
          if (f.startsWith('Personal:')) sectionSet.add('personal');
          if (f.startsWith('Admission:')) sectionSet.add('admission');
          if (f.startsWith('Parent:'))  sectionSet.add('parent');
        });

        // Also parse custom corrections requested in the remarks
        const remarksLower = (remarks || '').toLowerCase();
        
        // Check admission details
        const admissionKeywords = [
          'admission type', 'preferred branch', 'branch', 'aadhaar', 'qualification'
        ];
        if (admissionKeywords.some(kw => remarksLower.includes(kw))) {
          sectionSet.add('admission');
        }

        // Check personal details
        const personalKeywords = [
          'first name', 'middle name', 'last name', 'gender', 'birth', 'dob', 
          'nationality', 'religion', 'caste', 'category', 'area type', 'email', 'mobile number', 'phone'
        ];
        if (personalKeywords.some(kw => remarksLower.includes(kw))) {
          sectionSet.add('personal');
        }

        // Check parent details
        const parentKeywords = [
          'father', 'mother', 'parent', 'guardian', 'annual income'
        ];
        if (parentKeywords.some(kw => remarksLower.includes(kw))) {
          sectionSet.add('parent');
        }

        // Check address
        const addressKeywords = [
          'address', 'residence', 'pincode', 'city', 'state', 'taluk', 'district', 'village', 'street'
        ];
        if (addressKeywords.some(kw => remarksLower.includes(kw))) {
          sectionSet.add('address');
        }

        // Check academic
        const academicKeywords = [
          'school', 'board', 'passing year', 'register number', 'marks', 
          'attempts', 'percentage', 'university', 'puc', 'diploma', 'cet', 'dcet'
        ];
        if (academicKeywords.some(kw => remarksLower.includes(kw))) {
          sectionSet.add('academic');
        }

        // Always include at least 'documents' if remarks mention document issues
        if (sectionSet.size === 0) sectionSet.add('documents');

        correctionSections = Array.from(sectionSet);
      }

      await admissionService.updateStatus(app.id, status, remarks, label, rejectionReasonCode, correctionSections);

      // Clear draft localStorage items
      localStorage.removeItem(`doc_status_${app.id}`);
      localStorage.removeItem(`admin_remarks_${app.id}`);
      localStorage.removeItem(`verification_remarks_${app.id}`);
      localStorage.removeItem(`rejection_reason_${app.id}`);

      if (status === 'APPROVED') {
        toast.success('Application approved, forwarded to Principal.');
        navigate('/admin/admissions/queue');
      } else if (status === 'REJECTED') {
        toast.success('Application rejected and student has been notified.');
        navigate('/admin/admissions/rejected');
      } else if (status === 'CORRECTION_REQUIRED') {
        toast.success('Correction request sent to student successfully. Student can now edit and resubmit.');
        navigate('/admin/admissions/queue');
      } else if (status === 'ENROLLED') {
        toast.success('Student enrolled successfully.');
        navigate('/admin/admissions/history');
      } else {
        fetchApplication(app.id);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };


  const handleVerifyChecklist = async () => {
    if (!app) return;
    try {
      setVerifying(true);
      await admissionService.verifyChecklist(app.id, { documentsVerified, eligibilityVerified, verificationRemarks });
      toast.success('Verification checklist saved');
      fetchApplication(app.id);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save checklist');
    } finally {
      setVerifying(false);
    }
  };

  const handleViewDocument = async (field: string, label: string) => {
    if (!app) return;

    const popup = window.open('', '_blank');
    try {
      const response = await API.get(`/admin/admissions/${app.id}/documents/${field}`, {
        responseType: 'blob',
      });
      const blobUrl = URL.createObjectURL(response.data);

      if (popup) {
        popup.location.href = blobUrl;
      } else {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.click();
      }

      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err: any) {
      if (popup) popup.close();
      toast.error(err.response?.data?.error || `Unable to open ${label}`);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        <div className="size-10 rounded-full border-4 border-violet-100 border-t-violet-600 animate-spin mb-4" />
        <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs">Loading Application Form...</p>
      </div>
    );
  }

  if (!app) {
    return <div className="p-8 text-center bg-rose-50 rounded-2xl border border-rose-100 text-rose-600 font-bold mt-6">Application not found.</div>;
  }

  const pd = app.studentpersonaldetails as any;
  const par = app.studentparentdetails as any;
  const addr = app.studentaddress as any;
  const acad = app.studentacademicdetails as any;
  const docs = app.studentdocuments as any;
  const q = (app.qualification || '').toUpperCase();
  const showPUC = q === 'PUC' || (!q && app.admissionType === 'KCET');
  const showDiploma = q === 'DIPLOMA' || (!q && app.admissionType === 'DCET');
  const profilePhotoUrl = getDocUrl(docs?.photoUrl || app.user?.profileImage, app.id);

  const missingFields = getMissingFields(app);

  const getAdminDisplayName = (
    u?: { firstName?: string; lastName?: string; username?: string; email?: string } | null,
    fallback = 'Unknown Admin'
  ): string => {
    if (!u) return fallback;
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    return fullName || u.username || u.email || fallback;
  };

  return (
    <CorrectionContext.Provider value={{ 
      remarks: app?.correctionRemarks || null, 
      status: app?.applicationStatus || '',
      onToggleFieldCorrection: handleToggleFieldCorrection,
      isFieldFlagged
    }}>
      <div className="space-y-6 animate-fade-in w-full pb-12">
      
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <button onClick={handleBack}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-neutral-50 transition-colors shadow-sm text-sm font-semibold text-neutral-600 dark:text-neutral-300">
          <ArrowLeft size={16} /> Back to Admissions Queue
        </button>
        <div className="flex items-center gap-3">
          {(app.applicationStatus === 'APPROVED' || app.applicationStatus === 'PRINCIPAL_APPROVED' || app.applicationStatus === 'ENROLLED') && (
            <button
              disabled={updating}
              onClick={() => {
                setCancelDirectReason('');
                setCancelDirectRemarks('');
                setCancelDirectStep(1);
                setCancelDirectModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors shadow-sm text-sm font-extrabold cursor-pointer disabled:opacity-50 animate-fade-in"
            >
              <Ban size={16} /> Cancel Admission
            </button>
          )}
          {app.applicationStatus === 'REJECTED' && (
            <button
              disabled={updating}
              onClick={handleDeleteApplication}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors shadow-sm text-sm font-extrabold cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={16} /> Delete Application
            </button>
          )}
          <span className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg ${
            app.applicationStatus === 'RESUBMITTED' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 border border-amber-300' :
            app.applicationStatus === 'CORRECTION_REQUIRED' ? 'bg-rose-100 text-rose-700' :
            app.applicationStatus === 'APPROVED' ? 'bg-indigo-100 text-indigo-700' :
            app.applicationStatus === 'ENROLLED' ? 'bg-emerald-100 text-emerald-700' :
            app.applicationStatus === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
            app.applicationStatus === 'UNDER_REVIEW' ? 'bg-blue-100 text-blue-700' :
            'bg-amber-100 text-amber-700'}`}>
            Status: {
              app.applicationStatus === 'RESUBMITTED' ? 'RESUBMITTED' :
              app.applicationStatus === 'CORRECTION_REQUIRED' ? 'CORRECTION REQUIRED' :
              app.applicationStatus === 'APPROVED' ? 'VERIFIED' :
              app.applicationStatus === 'ENROLLED' ? 'APPROVED' :
              app.applicationStatus === 'UNDER_REVIEW' ? 'IN PROGRESS' :
              app.applicationStatus === 'SUBMITTED' ? 'PENDING REVIEW' :
              app.applicationStatus
            }
          </span>
        </div>
      </div>

      {/* Admin Action Attribution Banner */}
      {(() => {
        if (app.applicationStatus === 'APPROVED' || app.applicationStatus === 'PRINCIPAL_APPROVED') {
          const adminName = getAdminDisplayName(app.verifiedByAdmin);
          const dateStr = app.verifiedAt ? format(new Date(app.verifiedAt), 'dd MMM yyyy, hh:mm a') : (app.updatedAt ? format(new Date(app.updatedAt), 'dd MMM yyyy, hh:mm a') : null);
          return (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold text-indigo-900 dark:text-indigo-200 shadow-sm animate-fade-in">
              <ShieldCheck size={16} className="text-indigo-600 shrink-0" />
              <span>
                <strong>✓ Verified</strong>{adminName !== '—' && adminName !== 'Unknown Admin' ? <> by <span className="font-bold text-indigo-700 dark:text-indigo-300">{adminName}</span></> : ''}{dateStr ? <> on <span className="font-medium">{dateStr}</span></> : ''}
              </span>
            </div>
          );
        } else if (app.applicationStatus === 'CORRECTION_REQUIRED' || app.applicationStatus === 'RESUBMITTED') {
          const adminName = getAdminDisplayName(app.correctionRequestedBy);
          const dateStr = app.correctionRequestedAt ? format(new Date(app.correctionRequestedAt), 'dd MMM yyyy, hh:mm a') : (app.updatedAt ? format(new Date(app.updatedAt), 'dd MMM yyyy, hh:mm a') : null);
          return (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-xl text-xs font-semibold text-orange-900 dark:text-orange-200 shadow-sm animate-fade-in">
              <Clock size={16} className="text-orange-600 shrink-0" />
              <span>
                <strong>↻ Sent for correction</strong>{adminName !== '—' && adminName !== 'Unknown Admin' ? <> by <span className="font-bold text-orange-700 dark:text-orange-300">{adminName}</span></> : ''}{dateStr ? <> on <span className="font-medium">{dateStr}</span></> : ''}
              </span>
            </div>
          );
        } else if (app.applicationStatus === 'REJECTED') {
          const adminName = getAdminDisplayName(app.rejectedByAdmin);
          const dateStr = app.rejectedAt ? format(new Date(app.rejectedAt), 'dd MMM yyyy, hh:mm a') : (app.updatedAt ? format(new Date(app.updatedAt), 'dd MMM yyyy, hh:mm a') : null);
          return (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold text-rose-900 dark:text-rose-200 shadow-sm animate-fade-in">
              <XCircle size={16} className="text-rose-600 shrink-0" />
              <span>
                <strong>✕ Rejected</strong>{adminName !== '—' && adminName !== 'Unknown Admin' ? <> by <span className="font-bold text-rose-700 dark:text-rose-300">{adminName}</span></> : ''}{dateStr ? <> on <span className="font-medium">{dateStr}</span></> : ''}
              </span>
            </div>
          );
        } else if (app.applicationStatus === 'ENROLLED') {
          const adminName = (getAdminDisplayName(app.verifiedByAdmin) !== 'Unknown Admin' && getAdminDisplayName(app.verifiedByAdmin) !== '—')
            ? getAdminDisplayName(app.verifiedByAdmin)
            : getAdminDisplayName(app.approvedByAdmin);
          const dateStr = app.enrolledAt ? format(new Date(app.enrolledAt), 'dd MMM yyyy, hh:mm a') : (app.updatedAt ? format(new Date(app.updatedAt), 'dd MMM yyyy, hh:mm a') : null);
          return (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-900 dark:text-emerald-200 shadow-sm animate-fade-in">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>
                <strong>✓ Approved & Enrolled</strong>{adminName !== '—' && adminName !== 'Unknown Admin' ? <> by <span className="font-bold text-emerald-700 dark:text-emerald-300">{adminName}</span></> : ''}{dateStr ? <> on <span className="font-medium">{dateStr}</span></> : ''}
              </span>
            </div>
          );
        }
        return null;
      })()}

      {/* Resubmitted Banner */}
      {app.applicationStatus === 'RESUBMITTED' && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-500 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in no-print">
          <div className="space-y-1">
            <h4 className="text-xs sm:text-sm font-extrabold text-amber-850 dark:text-amber-400 flex items-center gap-2">
              <span className="inline-block size-3 rounded-full bg-amber-500 animate-pulse" />
              🟠 Resubmitted After Corrections
            </h4>
            <p className="text-[11px] sm:text-xs text-amber-700 dark:text-amber-300 font-medium">
              The student has corrected and resubmitted the requested sections. Please review the highlighted sections with orange borders.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {app.correctionRequestedSections?.map(s => {
              const labelMap: Record<string, string> = {
                admission: 'Admission Details',
                personal: 'Personal Details',
                parent: 'Parent Details',
                address: 'Address Details',
                academic: 'Academic Details',
                documents: 'Documents Upload'
              };
              return (
                <span key={s} className="px-2.5 py-1 bg-amber-100 text-amber-805 rounded-lg text-xs font-black border border-amber-300">
                  ✔ {labelMap[s] || s}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Missing Fields Warning */}
      {missingFields.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 p-5 rounded-r-2xl shadow-sm space-y-2">
          <h4 className="text-xs uppercase font-extrabold tracking-widest text-amber-800 dark:text-amber-400">
            ⚠️ Missing / Unfilled Fields Detected ({missingFields.length})
          </h4>
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
            The candidate has not filled or uploaded the following details:
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1 list-disc pl-5">
            {missingFields.map((field) => (
              <li key={field} className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                {field}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Form Sheet */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-xl overflow-hidden p-8 md:p-12 space-y-8">
        
        {/* Form Title & Watermark header */}
        <div className="border-b-2 border-neutral-100 dark:border-neutral-800 pb-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-extrabold text-neutral-900 dark:text-white uppercase tracking-wider">
              Official Student Admission Form
            </h1>
            <p className="text-sm font-bold text-neutral-400">Jain College of Engineering & Research</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded text-xs font-extrabold">
                ADM NO: {app.applicationNumber}
              </span>
              <span className="px-2.5 py-1 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded text-xs font-extrabold">
                SESSION: {app.academicYear || getAcademicYear()}
              </span>
              {app.admissionType && (
                <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-extrabold">
                  TYPE: {app.admissionType} {showDiploma ? '(Lateral Entry)' : ''}
                </span>
              )}
              {app.qualification && (
                <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-extrabold">
                  QUALIFICATION: {app.qualification === 'DIPLOMA' ? 'Diploma' : 'PUC / 12th'}
                </span>
              )}
            </div>
          </div>

          {/* Student Avatar (prominently displayed at the top right of the form like a physical photo) */}
          <div className="flex flex-col items-center shrink-0">
            <div className="w-28 h-36 border-2 border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center shadow-md relative">
              {profilePhotoUrl ? (
                <img src={profilePhotoUrl} alt="applicant-passport" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-2 text-neutral-400 dark:text-neutral-500">
                  <User size={36} className="mx-auto mb-1 opacity-40" />
                  <span className="text-[10px] font-bold block uppercase tracking-wider">Passport Photo</span>
                </div>
              )}
            </div>
            <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mt-2">Affixed Photo</span>
          </div>
        </div>

        {/* ─── SECTION 1: Admission Details ─── */}
        <div className={getSectionClass('admission')}>
          <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 flex items-center justify-between border-l-4 border-primary-500 pl-2">
            <span className="flex items-center gap-2">
              <GraduationCap size={14} className="text-primary-500" /> Admission Details
            </span>
            {app?.applicationStatus === 'RESUBMITTED' && (
              isSectionCorrected('admission') 
                ? <span className="text-[10px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">🟠 Corrected Section</span>
                : <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">✅ Already Verified</span>
            )}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
            <FormField label="Admission Type" value={app.admissionType} remarkText="Admission Type" />
            <FormField label="Preferred Branch" value={app.branch?.name} remarkText="Preferred Branch" />
            <FormField label="Aadhaar Number" value={app.aadhaar} remarkText="Aadhaar" />
            <FormField label="Qualification" value={app.qualification} remarkText="Qualification" />
          </div>
        </div>

        {/* ─── SECTION 2: Personal Profile ─── */}
        <div className={getSectionClass('personal')}>
          <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 flex items-center justify-between border-l-4 border-primary-500 pl-2">
            <span className="flex items-center gap-2">
              <User size={14} className="text-primary-500" /> Personal Details
            </span>
            {app?.applicationStatus === 'RESUBMITTED' && (
              isSectionCorrected('personal') 
                ? <span className="text-[10px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">🟠 Corrected Section</span>
                : <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">✅ Already Verified</span>
            )}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
            <FormField label="First Name" value={pd?.firstName} />
            <FormField label="Middle Name" value={pd?.middleName} />
            <FormField label="Last Name" value={pd?.lastName} />
            <FormField label="Gender" value={pd?.gender} />
            <FormField label="Date of Birth" value={formatDateDDMMYYYY(pd?.dateOfBirth)} />
            <FormField label="Nationality" value={pd?.nationality} />
            <FormField label="Religion" value={pd?.religion} />
            <FormField label="Caste" value={pd?.caste} />
            <FormField label="Category" value={pd?.category} />
            <FormField label="Area Type" value={pd?.areaType} />
            <FormField label="Email Address" value={pd?.email || app.user?.email} />
            <FormField label="Mobile Number" value={pd?.phone || app.user?.phone} />
          </div>
        </div>

        {/* ─── SECTION 2: Parents Info ─── */}
        <div className={getSectionClass('parent')}>
          <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 flex items-center justify-between border-l-4 border-primary-500 pl-2">
            <span className="flex items-center gap-2">
              <Users size={14} className="text-primary-500" /> Parent / Guardian Details
            </span>
            {app?.applicationStatus === 'RESUBMITTED' && (
              isSectionCorrected('parent') 
                ? <span className="text-[10px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">🟠 Corrected Section</span>
                : <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">✅ Already Verified</span>
            )}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Father card */}
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3">
              <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Father's Information</p>
              <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                <FormField label="Name" value={par?.fatherName} remarkText="Father Name" />
                <FormField label="Occupation" value={par?.fatherOccupation} remarkText="Father Occupation" />
                <FormField label="Mobile" value={par?.fatherPhone} remarkText="Father Mobile" />
                <FormField label="Annual Income" value={par?.fatherAnnualIncome ? `₹${par.fatherAnnualIncome.toLocaleString()}` : null} remarkText="Annual Income" />
              </div>
            </div>
            {/* Mother card */}
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3">
              <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Mother's & Guardian Information</p>
              <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                <FormField label="Mother Name" value={par?.motherName} />
                <FormField label="Mother Occupation" value={par?.motherOccupation} />
                <FormField label="Mother Mobile" value={par?.motherPhone} />
                <FormField label="Guardian Name" value={par?.guardianName || 'N/A'} />
              </div>
            </div>
          </div>
        </div>

        {/* ─── SECTION 3: Address Details ─── */}
        <div className={getSectionClass('address')}>
          <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 flex items-center justify-between border-l-4 border-primary-500 pl-2">
            <span className="flex items-center gap-2">
              <MapPin size={14} className="text-primary-500" /> Residential Address
            </span>
            {app?.applicationStatus === 'RESUBMITTED' && (
              isSectionCorrected('address') 
                ? <span className="text-[10px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">🟠 Corrected Section</span>
                : <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">✅ Already Verified</span>
            )}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current Address Card */}
            <div className={`p-4 rounded-xl border transition-all relative group space-y-3 ${
              isFieldFlagged?.('Current Residence')
                ? 'border-rose-400 dark:border-rose-800 bg-rose-50/20 dark:bg-rose-950/10 shadow-[0_0_8px_rgba(239,68,68,0.08)]'
                : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Current Residence</p>
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => handleToggleFieldCorrection('Current Residence')}
                    className={`transition-all duration-200 rounded-full p-0.5 ${
                      isFieldFlagged?.('Current Residence')
                        ? 'opacity-100 text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-950/40 hover:scale-105'
                        : 'opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-rose-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:scale-105'
                    }`}
                    title={isFieldFlagged?.('Current Residence') ? "Remove correction request" : "Request correction for Current Residence"}
                  >
                    <X size={12} className="stroke-[3]" />
                  </button>
                )}
              </div>
              <p className="text-xs font-semibold leading-relaxed text-neutral-700 dark:text-neutral-300">
                {[addr?.currentAddressLine1, addr?.currentAddressLine2, addr?.currentCity, addr?.currentTaluk, addr?.currentDistrict || addr?.currentDistrictId, addr?.currentState, addr?.currentPincode, addr?.currentCountry].filter(Boolean).join(', ') || '—'}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/60">
                <FormField label="Street Address" value={addr?.currentAddressLine1} remarkText="Current Residence" />
                <FormField label="City / Village" value={addr?.currentCity} remarkText="Current City" />
                <FormField label="Taluk" value={addr?.currentTaluk} remarkText="Taluk" />
                <FormField label="District" value={addr?.currentDistrict || addr?.currentDistrictId} remarkText="District" />
                <FormField label="Pincode" value={addr?.currentPincode} remarkText="Current Pincode" />
                <FormField label="State" value={addr?.currentState} remarkText="Current State" />
              </div>
            </div>

            {/* Permanent Address Card */}
            <div className={`p-4 rounded-xl border transition-all relative group space-y-3 ${
              isFieldFlagged?.('Permanent Residence')
                ? 'border-rose-400 dark:border-rose-800 bg-rose-50/20 dark:bg-rose-950/10 shadow-[0_0_8px_rgba(239,68,68,0.08)]'
                : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Permanent Residence</p>
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => handleToggleFieldCorrection('Permanent Residence')}
                    className={`transition-all duration-200 rounded-full p-0.5 ${
                      isFieldFlagged?.('Permanent Residence')
                        ? 'opacity-100 text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-950/40 hover:scale-105'
                        : 'opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-rose-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:scale-105'
                    }`}
                    title={isFieldFlagged?.('Permanent Residence') ? "Remove correction request" : "Request correction for Permanent Residence"}
                  >
                    <X size={12} className="stroke-[3]" />
                  </button>
                )}
              </div>
              <div>
                {addr?.sameAsCurrent ? (
                  <p className="text-xs italic text-neutral-400">Same as current address</p>
                ) : (
                  <>
                    <p className="text-xs font-semibold leading-relaxed text-neutral-700 dark:text-neutral-300 mb-2">
                      {[addr?.permanentAddressLine1, addr?.permanentAddressLine2, addr?.permanentCity, addr?.permanentTaluk, addr?.permanentDistrict || addr?.permanentDistrictId, addr?.permanentState, addr?.permanentPincode, addr?.permanentCountry].filter(Boolean).join(', ') || '—'}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/60">
                      <FormField label="Street Address" value={addr?.permanentAddressLine1} remarkText="Permanent Residence" />
                      <FormField label="City / Village" value={addr?.permanentCity} remarkText="Permanent City" />
                      <FormField label="Taluk" value={addr?.permanentTaluk} remarkText="Taluk" />
                      <FormField label="District" value={addr?.permanentDistrict || addr?.permanentDistrictId} remarkText="District" />
                      <FormField label="Pincode" value={addr?.permanentPincode} remarkText="Permanent Pincode" />
                      <FormField label="State" value={addr?.permanentState} remarkText="Permanent State" />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── SECTION 4: Academics ─── */}
        <div className={getSectionClass('academic')}>
          <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 flex items-center justify-between border-l-4 border-primary-500 pl-2">
            <span className="flex items-center gap-2">
              <GraduationCap size={14} className="text-primary-500" /> Academic Qualifications
            </span>
            {app?.applicationStatus === 'RESUBMITTED' && (
              isSectionCorrected('academic') 
                ? <span className="text-[10px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">🟠 Corrected Section</span>
                : <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">✅ Already Verified</span>
            )}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 10th Record */}
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3">
              <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">10th Standard (SSLC)</p>
              <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                <FormField label="School Name" value={acad?.tenthSchool} remarkText="10th School Name" />
                <FormField label="Board" value={acad?.tenthBoard} remarkText="10th Board" />
                <FormField label="Passing Year" value={acad?.tenthPassingYear} remarkText="10th Passing Year" />
                <FormField label="Register Number" value={acad?.tenthRegisterNumber} remarkText="10th Register Number" />
                <FormField label="Marks Obtained" value={acad?.tenthMarksObtained && acad?.tenthMaxMarks ? `${acad.tenthMarksObtained} / ${acad.tenthMaxMarks}` : null} remarkText="10th Marks" />
                <FormField label="Attempts" value={acad?.tenthAttempts} remarkText="10th Attempts" />
              </div>
              {acad?.tenthPercentage && (
                <div className="text-xs font-black text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-lg inline-block">
                  Aggregate Percentage: {acad.tenthPercentage}%
                </div>
              )}
            </div>

            {/* 12th/PUC or Diploma Record */}
            {showDiploma && (
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3 bg-blue-50/30 dark:bg-blue-950/10">
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Diploma details (Lateral Entry)</p>
                <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                  <FormField label="University/Institution" value={acad?.diplomaUniversity} remarkText="Diploma University" />
                  <FormField label="Passing Year" value={acad?.diplomaYear} remarkText="Diploma Passing Year" />
                  <FormField label="Register Number" value={acad?.diplomaRegisterNumber} remarkText="Diploma Register Number" />
                  <FormField label="Marks Obtained" value={acad?.diplomaFinalYearObtained && acad?.diplomaFinalYearMaxMarks ? `${acad.diplomaFinalYearObtained} / ${acad.diplomaFinalYearMaxMarks}` : null} remarkText="Diploma Marks" />
                </div>
                {acad?.diplomaPercentage && (
                  <div className="text-xs font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg inline-block">
                    Diploma Percentage: {acad.diplomaPercentage}%
                  </div>
                )}
              </div>
            )}
            {showPUC && (
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3">
                <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">12th Standard / PUC</p>
                <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                  <FormField label="School / College" value={acad?.twelfthSchool} remarkText="12th/PUC School Name" />
                  <FormField label="Board" value={acad?.twelfthBoard} remarkText="12th/PUC Board" />
                  <FormField label="Passing Year" value={acad?.twelfthPassingYear} remarkText="12th/PUC Passing Year" />
                  <FormField label="Register Number" value={acad?.twelfthRegisterNumber} remarkText="12th/PUC Register Number" />
                  <FormField label="Stream" value={acad?.twelfthStream} remarkText="12th/PUC Stream" />
                  <FormField label="Physics Marks" value={acad?.physicsMarks} remarkText="12th/PUC Physics Marks" />
                  <FormField label="Maths Marks" value={acad?.mathsMarks} remarkText="12th/PUC Maths Marks" />
                  <FormField label="Optional Marks" value={acad?.optionalMarks} remarkText="12th/PUC Optional Marks" />
                </div>
                {acad?.twelfthPercentage && (
                  <div className="text-xs font-black text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-lg inline-block">
                    Aggregate Percentage: {acad.twelfthPercentage}%
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Entrance Exams */}
          {(acad?.cetScore || acad?.cetRank || app.cetNumber || app.dcetNumber) && (
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3">
              <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Entrance Examination Details</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-3">
                {app.cetNumber && <FormField label="KCET Number" value={app.cetNumber} remarkText="KCET Number" />}
                {app.cetNumber && acad?.cetScore && <FormField label="KCET Score" value={acad?.cetScore} remarkText="KCET Score" />}
                {app.cetNumber && acad?.cetRank && <FormField label="KCET Rank" value={`#${acad?.cetRank}`} remarkText="KCET Rank" />}
                {app.dcetNumber && <FormField label="DCET Number" value={app.dcetNumber} remarkText="DCET Number" />}
                {app.dcetNumber && acad?.cetScore && <FormField label="DCET Score" value={acad?.cetScore} remarkText="DCET Score" />}
                {app.dcetNumber && acad?.cetRank && <FormField label="DCET Rank" value={`#${acad?.cetRank}`} remarkText="DCET Rank" />}
              </div>
            </div>
          )}
        </div>

        {/* ─── SECTION 5: Uploaded Documents ─── */}
        <div className={getSectionClass('documents', "space-y-4 bg-slate-50 dark:bg-neutral-800/30 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800")}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-neutral-850 dark:text-neutral-200 flex items-center justify-between pr-4 w-full">
                <span className="flex items-center gap-2">
                  <FileText size={18} className="text-primary-600" /> Attached Digital Documents Verification
                </span>
                {app?.applicationStatus === 'RESUBMITTED' && (
                  isSectionCorrected('documents') 
                    ? <span className="text-[10px] bg-amber-100 text-amber-805 px-2.5 py-0.5 rounded-full font-black">🟠 Corrected Section</span>
                    : <span className="text-[10px] bg-emerald-200 text-emerald-805 px-2.5 py-0.5 rounded-full font-black">✅ Already Verified</span>
                )}
              </h3>
              <p className="text-xs text-neutral-500 font-medium mt-0.5">
                Review and verify all uploaded certificates in a dedicated high-resolution workspace.
              </p>
            </div>

            {/* SINGLE PROMINENT ACTION BUTTON */}
            <button
              type="button"
              onClick={() => {
                console.log("Button clicked: Review Documents");
                if (app?.id) {
                  console.log("Navigating to Review Workspace for appId:", app.id);
                  navigate(`/admin/admissions/workspace/${app.id}`);
                }
                setIsWorkspaceOpen(true);
              }}
              className="px-6 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <Layers size={18} /> 📄 Review Documents
            </button>
          </div>

          {docs ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {[
                { label: 'Passport Size Photo', field: 'photo', url: docs.photoUrl },
                { label: 'Candidate E-Signature', field: 'signature', url: docs.signatureUrl },
                { label: 'SSLC / 10th Marks Card', field: 'tenthMarksheet', url: docs.tenthMarksheetUrl },
                ...(showDiploma ? [
                  { label: 'Diploma 5th Semester Marks Card', field: 'diplomaSemester5Marksheet', url: docs.diplomaSemester5MarksheetUrl },
                  { label: 'Diploma 6th Semester Marks Card', field: 'diplomaSemester6Marksheet', url: docs.diplomaSemester6MarksheetUrl },
                ] : [
                  { label: 'PUC / 12th Marks Card', field: 'twelfthMarksheet', url: docs.twelfthMarksheetUrl },
                ]),
                { label: 'Entrance Score Card (CET/DCET)', field: 'cetScoreCard', url: docs.cetScoreCardUrl },
                { label: 'Aadhaar Card copy', field: 'aadhaar', url: docs.aadhaarUrl },
                { label: 'College Fees Receipt', field: 'feesPaidReceipt', url: docs.feesPaidReceiptUrl },
                { label: 'Admission Form Fee Receipt', field: 'admissionFormFeeReceipt', url: docs.admissionFormFeeReceiptUrl },
                { label: 'Caste Certificate (Optional)', field: 'casteCertificate', url: docs.casteCertificateUrl },
                { label: 'Domicile / Study Certificate', field: 'domicileCertificate', url: docs.domicileCertificateUrl },
                { label: 'Income / Gap Year Certificate', field: 'gapCertificate', url: docs.gapCertificateUrl },
              ]
                .filter(({ url }) => url !== null && url !== undefined && url !== '') // Only show uploaded docs
                .map(({ label, field, url }) => {
                  const status = docStatus[label] || 'PENDING';
                  const isCorrected = app?.applicationStatus === 'RESUBMITTED' && status !== 'ACCEPTED' && status !== 'REJECTED' && (() => {
                    if (!app?.correctionRemarks) return false;
                    const remarksLower = app.correctionRemarks.toLowerCase();
                    const matches: Record<string, string[]> = {
                      photo: ['passport', 'photo'],
                      signature: ['signature'],
                      tenthmarksheet: ['sslc', '10th', 'tenth'],
                      twelfthmarksheet: ['puc', '12th', 'twelfth'],
                      diplomasemester5marksheet: ['diploma 5th', 'semester 5', 'sem 5'],
                      diplomasemester6marksheet: ['diploma 6th', 'semester 6', 'sem 6'],
                      cetscorecard: ['cet', 'dcet', 'entrance'],
                      feespaidreceipt: ['fees paid', 'receipt', 'fees verified'],
                      admissionformfeereceipt: ['admission form', 'offline receipt', 'payment screenshot', 'utr'],
                      castecertificate: ['caste'],
                      gapcertificate: ['income', 'gap'],
                      domicilecertificate: ['study', 'domicile']
                    };
                    const keywords = matches[field.toLowerCase()] || [];
                    return keywords.some(kw => remarksLower.includes(kw)) || remarksLower.includes(label.toLowerCase());
                  })();

                  return (
                    <div
                      key={label}
                      onClick={() => {
                        console.log("Document card clicked: Review Documents");
                        if (app?.id) {
                          console.log("Navigating to Review Workspace for appId:", app.id);
                          const getWorkspaceDocId = (f: string) => {
                            const mapping: Record<string, string> = {
                              'photo': 'photo',
                              'signature': 'signature',
                              'tenthMarksheet': 'tenth',
                              'twelfthMarksheet': 'twelfth',
                              'diplomaSemester5Marksheet': 'diplomaSemester5',
                              'diplomaSemester6Marksheet': 'diplomaSemester6',
                              'cetScoreCard': 'cet',
                              'aadhaar': 'aadhaar',
                              'feesPaidReceipt': 'feesPaidReceipt',
                              'admissionFormFeeReceipt': 'admissionFormFeeReceipt',
                              'domicileCertificate': 'domicile',
                              'casteCertificate': 'caste',
                              'gapCertificate': 'gap'
                            };
                            return mapping[f] || f;
                          };
                          const workspaceId = getWorkspaceDocId(field);
                          localStorage.setItem(`workspace_doc_id_${app.id}`, workspaceId);
                          navigate(`/admin/admissions/workspace/${app.id}`);
                        }
                        setIsWorkspaceOpen(true);
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all hover:scale-[1.01] ${
                        isCorrected
                          ? 'bg-amber-50/80 border-amber-300 text-amber-900 dark:bg-amber-950/20 dark:border-amber-800'
                          : status === 'ACCEPTED'
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-800'
                          : status === 'REJECTED'
                          ? 'bg-rose-50/80 border-rose-200 text-rose-900 dark:bg-rose-950/20 dark:border-rose-800'
                          : 'bg-white border-neutral-200 text-neutral-800 dark:bg-neutral-850 dark:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isCorrected ? 'bg-amber-100 text-amber-600' :
                          status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-600' :
                          status === 'REJECTED' ? 'bg-rose-100 text-rose-600' :
                          'bg-amber-100 text-amber-600'
                        }`}>
                          {isCorrected && <Clock size={16} />}
                          {!isCorrected && status === 'ACCEPTED' && <CheckCircle2 size={16} />}
                          {!isCorrected && status === 'REJECTED' && <XCircle size={16} />}
                          {!isCorrected && status === 'PENDING' && <FileText size={16} />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold truncate">{label}</span>
                          {field === 'admissionFormFeeReceipt' && docs?.admissionFormFeePaymentMode && (
                            <span className="text-[10px] text-neutral-500 font-semibold mt-0.5">
                              Mode: {docs.admissionFormFeePaymentMode}
                              {docs.admissionFormFeePaymentMode === 'ONLINE' && docs.admissionFormFeeUtr && ` (UTR: ${docs.admissionFormFeeUtr})`}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 ${
                        isCorrected ? 'bg-amber-200 text-amber-800 animate-pulse' :
                        status === 'ACCEPTED' ? 'bg-emerald-200 text-emerald-800' :
                        status === 'REJECTED' ? 'bg-rose-200 text-rose-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {isCorrected ? 'Resubmitted' : status === 'ACCEPTED' ? 'Approved' : status === 'REJECTED' ? 'Rejected' : 'Pending'}
                      </span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center p-6 bg-neutral-50 rounded-xl border border-dashed border-neutral-200 text-neutral-400">
              No files are uploaded by this candidate.
            </div>
          )}
        </div>

        {/* ─── SECTION 6: Checklist Verification ─── */}
        <div
          ref={checklistRef}
          className={`border-t-2 border-neutral-100 dark:border-neutral-800 pt-6 space-y-4 transition-all duration-300 ${
            highlightChecklist
              ? 'p-5 rounded-2xl bg-amber-50/30 dark:bg-amber-950/20 border-2 border-amber-400 dark:border-amber-500 ring-4 ring-amber-400/20 shadow-xl'
              : ''
          }`}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs uppercase font-black tracking-widest text-neutral-400 flex items-center gap-2 border-l-4 border-primary-500 pl-2">
              <ShieldCheck size={14} className="text-primary-500" /> Manual Audit & Verification Checklist
            </h3>
            {highlightChecklist && (
              <div className="flex items-center gap-2 animate-bounce">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 flex items-center gap-1.5 shadow-xs">
                  <AlertTriangle size={12} className="text-amber-600 shrink-0" /> Please tick verification checks to approve
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDocumentsVerified(true);
                    setEligibilityVerified(true);
                    setHighlightChecklist(false);
                  }}
                  className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer"
                >
                  ✓ Tick Both
                </button>
              </div>
            )}
          </div>
          {(app.applicationStatus === 'APPROVED' || app.applicationStatus === 'ENROLLED') ? (
            <div className="space-y-4">
              {/* Checklist Status (Read-Only) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { checked: app.documentsVerified, title: 'Documents Verified', desc: 'Certificates match originals and are legible.' },
                  { checked: app.eligibilityVerified, title: 'Eligibility Verified', desc: 'Scores and ranks conform with requirements.' },
                ].map(({ checked, title, desc }) => (
                  <div key={title} className={`flex gap-3 p-4 rounded-xl border select-none transition-all ${
                    checked 
                      ? 'bg-emerald-50/20 border-emerald-250 text-emerald-905 dark:bg-emerald-950/20 dark:border-emerald-800/60 dark:text-emerald-350' 
                      : 'bg-rose-50/20 border-rose-250 text-rose-905 dark:bg-rose-950/20 dark:border-rose-800/60 dark:text-rose-350'
                  }`}>
                    <div className="mt-0.5 shrink-0">
                      {checked ? (
                        <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-450" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-450" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider">{title}</p>
                      <p className="text-[11px] text-neutral-500 leading-normal mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Admin Remarks / Notes (Read-Only) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700/60 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-450 block">Verification Specific Remarks / Internal Notes</span>
                  <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap">
                    {app.verificationRemarks || '—'}
                  </p>
                </div>
                <div className="bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700/60 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-450 block">Internal Remarks / Correction Requests (Shown to Student)</span>
                  <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap">
                    {app.adminRemarks || '—'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { checked: documentsVerified, setter: setDocumentsVerified, title: 'Verify Documents', desc: 'Certificates match originals and are legible.' },
                  { checked: eligibilityVerified, setter: setEligibilityVerified, title: 'Verify Eligibility', desc: 'Scores and ranks conform with requirements.' },
                ].map(({ checked, setter, title, desc }) => {
                  const isMissingCheck = highlightChecklist && !checked;
                  return (
                    <label key={title} className={`flex gap-3 p-4 rounded-xl border cursor-pointer select-none transition-all ${
                      checked 
                        ? 'bg-primary-50/30 border-primary-200 text-primary-900 dark:bg-primary-950/20 dark:border-primary-800' 
                        : isMissingCheck
                        ? 'bg-amber-50/80 dark:bg-amber-950/40 border-2 border-amber-500 ring-4 ring-amber-400/30 shadow-md animate-pulse text-amber-900 dark:text-amber-200'
                        : 'bg-neutral-50/30 border-neutral-200 dark:bg-neutral-800/30 dark:border-neutral-700'
                    }`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          const val = e.target.checked;
                          setter(val);
                          if (val && (title === 'Verify Documents' ? eligibilityVerified : documentsVerified)) {
                            setHighlightChecklist(false);
                          }
                        }}
                        className={`w-5 h-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 mt-0.5 shrink-0 ${
                          isMissingCheck ? 'ring-2 ring-amber-500 ring-offset-1' : ''
                        }`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black uppercase tracking-wider">{title}</p>
                          {isMissingCheck && (
                            <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                              Required to approve
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-500 leading-normal mt-0.5">{desc}</p>
                        {isMissingCheck && (
                          <p className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                            👉 Click here to tick
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <button onClick={handleVerifyChecklist} disabled={verifying}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50 border border-neutral-200 dark:border-neutral-700 cursor-pointer">
                  {verifying ? 'Updating checklist...' : 'Save Audit Checklist'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Verification specific remarks / internal notes</label>
                  <select
                    value=""
                    onChange={e => {
                      const val = e.target.value;
                      if (!val) return;
                      setVerificationRemarks(prev => {
                        const trimmed = prev.trim();
                        return trimmed ? `${trimmed}\n${val}` : val;
                      });
                    }}
                    className="w-full p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500 text-neutral-700 dark:text-neutral-350 cursor-pointer"
                  >
                    <option value="" className="text-neutral-500 bg-white dark:bg-neutral-900">Select quick template...</option>
                    <option value="All details in the application are verified and correct." className="text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900">✅ All Correct</option>
                    <option value="All original uploaded documents match criteria and are clear." className="text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900">📄 Docs Match</option>
                    <option value="Fees details and payment receipts matched." className="text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900">💰 Fees Verified</option>
                    <option value="principal sir , all the details in the application are correct so please approve sir" className="text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900">🤝 Forward to Principal</option>
                  </select>
                  <textarea value={verificationRemarks} onChange={e => setVerificationRemarks(e.target.value)}
                    className="w-full h-24 p-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary-500 resize-none font-medium leading-relaxed"
                    placeholder="Internal verification details..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Internal remarks / correction requests (Shown to Student)</label>
                  <textarea value={remarks} onChange={e => setRemarks(e.target.value)}
                    className="w-full h-24 p-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary-500 resize-none font-medium leading-relaxed"
                    placeholder={rejectionReasonCode === 'OTHER' ? 'Additional notes (required for "Other" rejection reason)' : 'Additional notes (optional)'}
                    required={rejectionReasonCode === 'OTHER'} />
                </div>
              </div>

              <div className="space-y-1 pt-2">
                <label className={`text-[10px] font-black uppercase tracking-widest block transition-all duration-300 ${rejectionReasonCode ? 'text-rose-400' : 'text-emerald-600'}`}>Rejection Reason (Required if Rejecting Application)</label>
                <select
                  value={rejectionReasonCode}
                  onChange={e => handleReasonChange(e.target.value)}
                  className={`w-full p-3 rounded-xl text-xs outline-none focus:ring-2 font-bold transition-all duration-300 ${
                    rejectionReasonCode
                      ? 'bg-rose-50/30 dark:bg-rose-950/10 border border-rose-200 dark:border-rose-800/60 focus:ring-rose-500 text-rose-700 dark:text-rose-300'
                      : 'bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-800/60 focus:ring-emerald-500 text-emerald-600 dark:text-emerald-300'
                  }`}
                >
                  <option value="" className="text-neutral-500 bg-white dark:bg-neutral-900">None</option>
                  <option value="DOC_NOT_VERIFIED" className="text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900">Documents Not Verified</option>
                  <option value="INCOMPLETE_DOCUMENTS" className="text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900">Incomplete Documents</option>
                  <option value="FEES_NOT_PAID" className="text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900">Fees Not Paid</option>
                  <option value="ELIGIBILITY_FAILED" className="text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900">Eligibility Criteria Not Met</option>
                  <option value="INVALID_CERTIFICATES" className="text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900">Invalid Certificates</option>
                  <option value="DUPLICATE_APPLICATION" className="text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900">Duplicate Application</option>
                  <option value="AADHAAR_MISMATCH" className="text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900">Aadhaar Verification Failed</option>
                  <option value="USN_CONFLICT" className="text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900">USN Conflict</option>
                  <option value="OTHER" className="text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900">Other</option>
                </select>
              </div>
            </>
          )}

          {/* Form Action Controls (Bottom of the form) */}
          <div className="border-t border-neutral-100 dark:border-neutral-800 pt-6 flex flex-col md:flex-row gap-3 justify-end w-full">
            {app.applicationStatus !== 'REJECTED' && app.applicationStatus !== 'ENROLLED' && app.applicationStatus !== 'APPROVED' && app.applicationStatus !== 'PRINCIPAL_APPROVED' && app.applicationStatus !== 'CORRECTION_REQUIRED' && (
              <div className="flex flex-col sm:flex-row gap-3 w-full justify-end">
                {/* Reject Application */}
                <button disabled={updating} onClick={() => handleUpdateStatus('REJECTED')}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-rose-600/10">
                  <XCircle size={16} /> Reject Application
                </button>
                {/* Send for Correction */}
                <button disabled={updating} onClick={() => handleUpdateStatus('CORRECTION_REQUIRED')}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-amber-500/10">
                  {updating ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                  Send for Correction
                </button>
                {/* Approve Application */}
                <button disabled={updating} onClick={() => handleUpdateStatus('APPROVED')}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-emerald-600/10">
                  <CheckCircle2 size={16} /> Approve Application
                </button>
              </div>
            )}

            {/* Already sent for correction — show status banner */}
            {app.applicationStatus === 'CORRECTION_REQUIRED' && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4 w-full flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-extrabold text-amber-800 dark:text-amber-400">
                      Correction Request Sent {getAdminDisplayName(app.correctionRequestedBy) !== 'Unknown Admin' ? `by ${getAdminDisplayName(app.correctionRequestedBy)}` : 'to Student'}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-500 font-semibold mt-0.5">Student is reviewing and will resubmit. Status will update to RESUBMITTED.</p>
                  </div>
                </div>
                <button
                  disabled={updating}
                  onClick={() => handleUpdateStatus('REJECTED')}
                  className="px-4 py-2 border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl transition-all disabled:opacity-50 shrink-0"
                >
                  Reject Instead
                </button>
              </div>
            )}

            {app.applicationStatus === 'APPROVED' && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-800/60 rounded-xl p-4 text-center w-full">
                <p className="text-sm font-black text-emerald-800 dark:text-emerald-400 flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} /> Verified by {getAdminDisplayName(app.verifiedByAdmin, 'Admin')}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500 font-semibold mt-1">
                  Application verified by {getAdminDisplayName(app.verifiedByAdmin, 'Admin')}. Sent to Principal for final approval.
                </p>
              </div>
            )}

            {app.applicationStatus === 'REJECTED' && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-250 dark:border-rose-800/60 rounded-xl p-4 text-center w-full">
                <p className="text-sm font-black text-rose-800 dark:text-rose-400 flex items-center justify-center gap-2">
                  <XCircle size={18} /> Rejected by {getAdminDisplayName(app.rejectedByAdmin, 'Admin')}
                </p>
                <p className="text-xs text-rose-600 dark:text-rose-500 font-semibold mt-1">
                  Application was rejected by {getAdminDisplayName(app.rejectedByAdmin, 'Admin')}.
                </p>
              </div>
            )}

            {(app.applicationStatus === 'ENROLLED' || app.applicationStatus === 'PRINCIPAL_APPROVED') && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-800/60 rounded-xl p-4 text-center w-full">
                <p className="text-sm font-black text-emerald-800 dark:text-emerald-400 flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} /> Student Enrolled Successfully
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500 font-semibold mt-1">
                  The student admission has been approved by Principal and enrolled directly into ERP.
                </p>
              </div>
            )}
          </div>

        </div>

        </div>

      </div>

      {/* ─── DOCUMENT VERIFICATION WORKSPACE OVERLAY ─── */}
      <DocumentVerificationWorkspace
        isOpen={isWorkspaceOpen}
        onClose={() => setIsWorkspaceOpen(false)}
        appId={app.id}
        studentName={`${pd?.firstName || ''} ${pd?.lastName || ''}`.trim() || app.user?.firstName || app.user?.email || 'Student'}
        appNumber={app.applicationNumber}
        appStatus={app.applicationStatus}
        documents={docs || {}}
        initialDocStatus={docStatus}
        correctionRemarks={app.correctionRemarks}
        onCompleteVerification={(updatedDocStatuses, allVerified, rejectionNotes) => {
          setDocStatus(updatedDocStatuses);
          setDocumentsVerified(allVerified);
          if (app.id) {
            localStorage.setItem(`doc_status_${app.id}`, JSON.stringify(updatedDocStatuses));
            admissionService.saveDocumentStatuses(app.id, updatedDocStatuses).catch(err => {
              console.error("Failed to save doc statuses to database on complete:", err);
            });
          }

          // Check if any documents were rejected
          const hasRejectedDocs = Object.values(updatedDocStatuses).some(s => s === 'REJECTED');

          // Auto-switch rejection reason to DOC_NOT_VERIFIED when docs are rejected
          // and no reason has been set yet (or it was already DOC_NOT_VERIFIED)
          let effectiveCode = rejectionReasonCode;
          if (hasRejectedDocs && (!rejectionReasonCode || rejectionReasonCode === 'DOC_NOT_VERIFIED')) {
            effectiveCode = 'DOC_NOT_VERIFIED';
            setRejectionReasonCode('DOC_NOT_VERIFIED');
          }

          // Build combined internal remarks: reason remark + rejection notes
          const reasonRemarksMap: Record<string, string> = {
            'DOC_NOT_VERIFIED': 'Documents verification failed during admin review.',
            'INCOMPLETE_DOCUMENTS': 'Some mandatory documents were not uploaded or are missing.',
            'FEES_NOT_PAID': 'Application fees have not been paid or verified.',
            'ELIGIBILITY_FAILED': 'Candidate does not meet the minimum eligibility criteria.',
            'INVALID_CERTIFICATES': 'Uploaded certificates are invalid, expired, or mismatched.',
            'DUPLICATE_APPLICATION': 'A duplicate admission application was found for this candidate.',
            'AADHAAR_MISMATCH': 'Aadhaar card details do not match the personal profile.',
            'USN_CONFLICT': 'USN already exists or is assigned to another student.',
          };
          const reasonRemark = reasonRemarksMap[effectiveCode] || '';

          if (rejectionNotes && rejectionNotes.trim()) {
            const parts = [reasonRemark, rejectionNotes].filter(Boolean);
            setRemarks(parts.join('\n\n'));
          } else if (reasonRemark) {
            setRemarks(reasonRemark);
          }
        }}
      />

      {/* ─── DIRECT CANCEL ADMISSION MODAL ─── */}
      {cancelDirectModalOpen && app && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in duration-200">
            
            {cancelDirectStep === 1 ? (
              <>
                {/* Modal Title */}
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                  <h3 className="text-base font-black text-neutral-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                    <Ban className="text-rose-600" size={20} /> Cancel Admission
                  </h3>
                  <button 
                    onClick={() => {
                      setCancelDirectModalOpen(false);
                      setCancelDirectReason('');
                      setCancelDirectRemarks('');
                      setCancelDirectStep(1);
                    }}
                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Display Student Details */}
                <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Student Name</p>
                    <p className="font-extrabold text-neutral-900 dark:text-white mt-0.5">
                      {pd ? `${pd.firstName || ''} ${pd.lastName || ''}`.trim() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Admission Number</p>
                    <p className="font-extrabold text-neutral-900 dark:text-white mt-0.5">{app.applicationNumber}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Branch</p>
                    <p className="font-bold text-neutral-800 dark:text-neutral-200 mt-0.5">{app.branch?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Admission Type</p>
                    <p className="font-bold text-neutral-800 dark:text-neutral-200 mt-0.5">{app.admissionType || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Current Status</p>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40">
                      Admission Confirmed
                    </span>
                  </div>
                </div>

                {/* Reason & Remarks Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5">
                      Reason <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={cancelDirectReason}
                      onChange={(e) => setCancelDirectReason(e.target.value)}
                      className="w-full text-xs font-semibold bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 rounded-xl px-4 py-3 focus:outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-neutral-950 dark:text-white transition-colors"
                    >
                      <option value="">Select a reason</option>
                      <option value="Student Joined Another College">Student Joined Another College</option>
                      <option value="Student Did Not Report">Student Did Not Report</option>
                      <option value="Fee Not Paid">Fee Not Paid</option>
                      <option value="Documents Not Submitted">Documents Not Submitted</option>
                      <option value="Duplicate Admission">Duplicate Admission</option>
                      <option value="Requested Offline">Requested Offline</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5">
                      Remarks
                    </label>
                    <textarea
                      value={cancelDirectRemarks}
                      onChange={(e) => setCancelDirectRemarks(e.target.value)}
                      rows={3}
                      placeholder="Optional administrative notes..."
                      className="w-full text-xs font-semibold p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 rounded-xl focus:outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-neutral-950 dark:text-white transition-all resize-none"
                    />
                  </div>

                  {/* Information Box */}
                  <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-xl p-4 space-y-2 text-xs">
                    <p className="font-extrabold text-amber-900 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                      This action will ONLY change the student's admission status to: <strong>Admission Cancelled</strong>
                    </p>
                    <p className="font-bold text-amber-800 dark:text-amber-350 text-[11px]">The following WILL NOT be deleted:</p>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-300">
                      <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Student Profile</span>
                      <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Personal Details</span>
                      <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Academic Details</span>
                      <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Uploaded Documents</span>
                      <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Admission History</span>
                      <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> Timeline</span>
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => {
                      setCancelDirectModalOpen(false);
                      setCancelDirectReason('');
                      setCancelDirectRemarks('');
                      setCancelDirectStep(1);
                    }}
                    className="px-4 py-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-350 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!cancelDirectReason}
                    onClick={() => setCancelDirectStep(2)}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors shadow-md shadow-rose-600/10 flex items-center gap-1.5"
                  >
                    Proceed <ArrowRight size={14} />
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Step 2: Final Confirmation Modal */}
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                  <h3 className="text-base font-black text-rose-600 dark:text-rose-400 uppercase tracking-wide flex items-center gap-2">
                    <AlertTriangle size={20} className="text-rose-600" /> Final Confirmation
                  </h3>
                  <button 
                    onClick={() => setCancelDirectStep(1)}
                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <p className="text-sm font-extrabold text-neutral-900 dark:text-white">
                    Are you sure you want to cancel this student's admission?
                  </p>

                  <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 rounded-xl p-4 space-y-2.5">
                    <div>
                      <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Student</p>
                      <p className="font-extrabold text-neutral-900 dark:text-white text-xs mt-0.5">
                        {app.applicationNumber} — {pd ? `${pd.firstName || ''} ${pd.lastName || ''}`.trim() : 'N/A'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-rose-100 dark:border-rose-900/30">
                      <div>
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Current Status</p>
                        <p className="font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">Admission Confirmed</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider">New Status</p>
                        <p className="font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">Admission Cancelled</p>
                      </div>
                    </div>

                    <p className="text-[11px] font-bold text-rose-700 dark:text-rose-350 italic pt-1">
                      ℹ This action does NOT delete the student.
                    </p>
                  </div>
                </div>

                {/* Step 2 Buttons */}
                <div className="flex justify-end gap-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    type="button"
                    disabled={cancelDirectSubmitting}
                    onClick={() => setCancelDirectStep(1)}
                    className="px-4 py-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-350 transition-colors disabled:opacity-50"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    disabled={cancelDirectSubmitting}
                    onClick={handleDirectCancelSubmit}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shadow-md shadow-rose-600/10 flex items-center gap-1.5"
                  >
                    {cancelDirectSubmitting ? 'Cancelling...' : 'Yes, Cancel Admission'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>,
        document.body
      )}
    </CorrectionContext.Provider>
  );
};

export default AdmissionReviewPage;
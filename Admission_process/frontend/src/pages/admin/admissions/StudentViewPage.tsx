import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import admissionService, { AdmissionApplication } from '../../../services/admission.service';
import API, { getBaseHostURL } from '../../../services/api';
import { 
  ArrowLeft, User, BookOpen, Phone, MapPin, GraduationCap, Award, 
  FileText, ShieldCheck, Clock, Ban, Download, Eye, Loader2, 
  CheckCircle2, X, RefreshCw 
} from 'lucide-react';
import { toast } from 'react-toastify';
import { getAcademicYear, formatDateDDMMYYYY } from '../../../utils/date.util';

const STATUS_COLOR_MAP: Record<string, string> = {
  DRAFT: 'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700',
  SUBMITTED: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900/50',
  UNDER_REVIEW: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/50',
  CORRECTION_REQUIRED: 'bg-orange-100 text-orange-850 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30',
  APPROVED: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-900/50',
  PRINCIPAL_APPROVED: 'bg-violet-100 text-violet-850 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-900/50',
  ENROLLED: 'bg-emerald-100 text-emerald-850 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-450 dark:border-emerald-900/50',
  REJECTED: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-900/50',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50',
  CANCELLATION_REQUESTED: 'bg-pink-100 text-pink-850 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-900/50',
};

const STATUS_LABEL_MAP: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Pending Review',
  UNDER_REVIEW: 'In Progress',
  CORRECTION_REQUIRED: 'Correction Required',
  APPROVED: 'Verified',
  PRINCIPAL_APPROVED: 'Principal Approved',
  ENROLLED: 'Admission Confirmed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  CANCELLATION_REQUESTED: 'Cancellation Pending',
};

const FormField = ({ 
  label, 
  value, 
  isEdit, 
  type = 'text', 
  onChange, 
  options 
}: { 
  label: string; 
  value?: any; 
  isEdit?: boolean; 
  type?: 'text' | 'select' | 'date' | 'number' | 'checkbox';
  onChange?: (val: any) => void;
  options?: { label: string; value: string }[];
}) => {
  if (isEdit && onChange) {
    return (
      <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 rounded-lg transition-all flex flex-col gap-1.5">
        <label className="text-[10px] font-bold text-violet-500 uppercase tracking-wider leading-none">{label}</label>
        {type === 'select' && options ? (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="text-xs font-bold text-neutral-850 dark:text-neutral-200 bg-transparent border-none focus:ring-0 p-0 leading-tight w-full"
          >
            <option value="" disabled>Select {label}</option>
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : type === 'checkbox' ? (
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-neutral-300 text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer mt-1"
          />
        ) : (
          <input
            type={type}
            value={value !== null && value !== undefined ? value : ''}
            onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
            className="text-xs font-bold text-neutral-855 dark:text-neutral-200 bg-transparent border-none focus:ring-0 p-0 leading-tight w-full focus:outline-none"
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800/80 rounded-lg transition-all flex flex-col gap-1.5">
      <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider leading-none">{label}</p>
      <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate leading-tight">
        {type === 'checkbox' ? (value ? 'Yes' : 'No') : (value !== null && value !== undefined && value !== '' ? String(value) : '—')}
      </p>
    </div>
  );
};

const DocumentSquareCard: React.FC<{ 
  field: string; 
  studentId: string; 
  label: string; 
  isEdit?: boolean;
  onUpload?: (file: File) => void;
  onRemove?: () => void;
  uploading?: boolean;
  hasUrl?: boolean;
  docUrl?: string | null;
}> = ({ field, studentId, label, isEdit, onUpload, onRemove, uploading, hasUrl, docUrl }) => {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPdf, setIsPdf] = useState(false);

  useEffect(() => {
    if (!hasUrl) {
      setLoading(false);
      setImgUrl(null);
      return;
    }
    let active = true;
    let blobUrl: string | null = null;
    const fetchDoc = async () => {
      try {
        const token = localStorage.getItem('token') || '';
        const base = API.defaults.baseURL || '/api';
        const cleanPath = `/admin/admissions/${studentId}/documents/${field}`;
        const url = `${base}${cleanPath}`;
        const finalUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;

        const response = await API.get(finalUrl, { responseType: 'blob' });
        if (!active) return;

        blobUrl = URL.createObjectURL(response.data);
        const isPdfFile = response.data.type === 'application/pdf' || !!(docUrl?.toLowerCase().includes('.pdf'));
        setIsPdf(isPdfFile);
        setImgUrl(blobUrl);
        setLoading(false);
        setError(false);
      } catch {
        if (!active) return;
        setError(true);
        setLoading(false);
      }
    };

    fetchDoc();
    return () => {
      active = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [field, studentId, hasUrl, docUrl]);

  const handleDownload = () => {
    if (!imgUrl) return;
    const link = document.createElement('a');
    link.href = imgUrl;
    link.target = '_blank';
    link.download = `${label.replace(/\s+/g, '_')}${isPdf ? '.pdf' : '.jpg'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-850 bg-neutral-50 dark:bg-neutral-900 group shadow-sm flex flex-col transition-all duration-300 hover:shadow-md hover:border-violet-300 dark:hover:border-violet-800">
      {/* Edge-to-edge Preview Box */}
      <div className="w-full h-full relative flex items-center justify-center overflow-hidden bg-neutral-100 dark:bg-neutral-955">
        {loading || uploading ? (
          <div className="flex flex-col items-center gap-2 text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
            <span className="text-[10px] font-black uppercase tracking-wider">{uploading ? 'Uploading...' : 'Loading...'}</span>
          </div>
        ) : error || !hasUrl || !imgUrl ? (
          <div className="flex flex-col items-center gap-2 text-neutral-450 p-4 text-center">
            <FileText size={24} className="opacity-40" />
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">No Document</span>
          </div>
        ) : isPdf ? (
          <div className="flex flex-col items-center justify-center p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 w-full h-full">
            <FileText size={40} className="drop-shadow-sm" />
            <span className="text-[10px] font-black tracking-wider uppercase mt-2 bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 rounded">PDF Document</span>
          </div>
        ) : (
          <img 
            src={imgUrl} 
            alt={label} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
          />
        )}
      </div>

      {/* Bottom overlay with Document Name and actions */}
      <div className="absolute inset-x-0 bottom-0 bg-black/30 dark:bg-black/40 backdrop-blur-md border-t border-white/10 py-3 px-3 flex flex-col gap-2">
        <div className="min-w-0">
          <p className="text-xs font-black text-white truncate leading-tight" title={label}>
            {label}
          </p>
          <span className="text-[9px] font-bold uppercase text-emerald-400 tracking-wider">
            {hasUrl ? 'Uploaded' : 'Pending'}
          </span>
        </div>
        
        {/* Actions row */}
        <div className="flex items-center gap-2">
          {isEdit ? (
            <>
              <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-extrabold transition-all border border-violet-500 shadow-sm cursor-pointer text-center select-none">
                <span>{hasUrl ? 'Replace' : 'Upload'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onUpload) onUpload(file);
                  }}
                />
              </label>
              {hasUrl && onRemove && (
                <button
                  onClick={onRemove}
                  className="py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-extrabold transition-all border border-rose-500 shadow-sm text-center"
                  title="Delete Document"
                >
                  Delete
                </button>
              )}
            </>
          ) : (
            <>
              {hasUrl && imgUrl && (
                <>
                  <a
                    href={imgUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-extrabold transition-all border border-white/10 select-none text-center"
                    title="View Document"
                  >
                    <Eye size={12} />
                    <span>View</span>
                  </a>
                  <button
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-extrabold transition-all border border-violet-500 shadow-sm select-none text-center"
                    title="Download Document"
                  >
                    <Download size={12} />
                    <span>Download</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const StudentViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { search } = useLocation();
  const queryParams = new URLSearchParams(search);
  const [isEditMode, setIsEditMode] = useState(queryParams.get('edit') === 'true');
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const [student, setStudent] = useState<AdmissionApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'timeline'>('details');

  // Cancel Admission States
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelStep, setCancelStep] = useState(1);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    setIsEditMode(queryParams.get('edit') === 'true');
  }, [search]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const list = await admissionService.getBranches();
        setBranches(list);
      } catch (err) {
        console.error('Failed to load branches:', err);
      }
    };
    fetchBranches();
  }, []);

  const handleFieldChange = (section: string, field: string, val: any) => {
    setEditData((prev: any) => {
      if (!prev) return prev;
      if (section === 'root') {
        return { ...prev, [field]: val };
      }
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: val
        }
      };
    });
  };

  const handleSaveEdits = async () => {
    if (!id) return;
    try {
      setSaving(true);
      await API.put(`/admin/admissions/${id}`, editData);
      toast.success('Student details updated successfully!');
      setIsEditMode(false);
      navigate(window.location.pathname, { replace: true });
      fetchStudentDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadDocument = async (field: string, file: File) => {
    if (!id) return;
    try {
      setUploadingField(field);
      const formData = new FormData();
      formData.append(field, file);
      await API.post(`/admin/admissions/${id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Document uploaded successfully!');
      fetchStudentDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to upload document.');
    } finally {
      setUploadingField(null);
    }
  };

  const handleRemoveDocument = async (field: string) => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      setUploadingField(field);
      await API.delete(`/admin/admissions/${id}/documents/${field}`);
      toast.success('Document removed successfully!');
      fetchStudentDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to remove document.');
    } finally {
      setUploadingField(null);
    }
  };

  const fetchStudentDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await admissionService.getApplication(id);
      setStudent(data);
    } catch (e) {
      toast.error('Failed to load student details');
      navigate('/admin/students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentDetails();
  }, [id]);

  useEffect(() => {
    if (student) {
      setEditData({
        admissionType: student.admissionType || '',
        branchId: student.branch?.id || '',
        academicYear: student.academicYear || '',
        aadhaar: student.aadhaar || '',
        cetNumber: student.cetNumber || '',
        dcetNumber: student.dcetNumber || '',
        user: {
          firstName: student.user?.firstName || '',
          lastName: student.user?.lastName || '',
          email: student.user?.email || '',
          phone: student.user?.phone || '',
        },
        studentpersonaldetails: {
          firstName: student.studentpersonaldetails?.firstName || '',
          middleName: student.studentpersonaldetails?.middleName || '',
          lastName: student.studentpersonaldetails?.lastName || '',
          gender: student.studentpersonaldetails?.gender || '',
          dateOfBirth: student.studentpersonaldetails?.dateOfBirth || '',
          nationality: student.studentpersonaldetails?.nationality || '',
          religion: student.studentpersonaldetails?.religion || '',
          caste: student.studentpersonaldetails?.caste || '',
          category: student.studentpersonaldetails?.category || '',
          areaType: student.studentpersonaldetails?.areaType || '',
          studiedInKarnataka: student.studentpersonaldetails?.studiedInKarnataka ?? false,
        },
        studentparentdetails: {
          fatherName: student.studentparentdetails?.fatherName || '',
          fatherOccupation: student.studentparentdetails?.fatherOccupation || '',
          fatherPhone: student.studentparentdetails?.fatherPhone || '',
          fatherEmail: student.studentparentdetails?.fatherEmail || '',
          motherName: student.studentparentdetails?.motherName || '',
          motherOccupation: student.studentparentdetails?.motherOccupation || '',
          motherPhone: student.studentparentdetails?.motherPhone || '',
          fatherAnnualIncome: student.studentparentdetails?.fatherAnnualIncome || 0,
        },
        studentaddress: {
          currentAddressLine1: student.studentaddress?.currentAddressLine1 || '',
          currentCity: student.studentaddress?.currentCity || '',
          currentState: student.studentaddress?.currentState || '',
          currentPincode: student.studentaddress?.currentPincode || '',
          permanentAddressLine1: student.studentaddress?.permanentAddressLine1 || '',
          permanentCity: student.studentaddress?.permanentCity || '',
          permanentState: student.studentaddress?.permanentState || '',
          permanentPincode: student.studentaddress?.permanentPincode || '',
        },
        studentacademicdetails: {
          tenthSchool: student.studentacademicdetails?.tenthSchool || '',
          tenthBoard: student.studentacademicdetails?.tenthBoard || '',
          tenthPassingYear: student.studentacademicdetails?.tenthPassingYear || '',
          tenthRegisterNumber: student.studentacademicdetails?.tenthRegisterNumber || '',
          tenthMarksObtained: student.studentacademicdetails?.tenthMarksObtained || '',
          tenthMaxMarks: student.studentacademicdetails?.tenthMaxMarks || '',
          tenthPercentage: student.studentacademicdetails?.tenthPercentage || '',
          tenthAttempts: student.studentacademicdetails?.tenthAttempts || 1,
          twelfthSchool: student.studentacademicdetails?.twelfthSchool || '',
          twelfthBoard: student.studentacademicdetails?.twelfthBoard || '',
          twelfthPassingYear: student.studentacademicdetails?.twelfthPassingYear || '',
          twelfthRegisterNumber: student.studentacademicdetails?.twelfthRegisterNumber || '',
          twelfthStream: student.studentacademicdetails?.twelfthStream || '',
          twelfthAttempts: student.studentacademicdetails?.twelfthAttempts || 1,
          physicsMarks: student.studentacademicdetails?.physicsMarks || '',
          mathsMarks: student.studentacademicdetails?.mathsMarks || '',
          chemistryMarks: student.studentacademicdetails?.chemistryMarks || '',
          diplomaUniversity: student.studentacademicdetails?.diplomaUniversity || '',
          diplomaYear: student.studentacademicdetails?.diplomaYear || '',
          diplomaRegisterNumber: student.studentacademicdetails?.diplomaRegisterNumber || '',
          diplomaFinalYearMaxMarks: student.studentacademicdetails?.diplomaFinalYearMaxMarks || '',
          diplomaFinalYearObtained: student.studentacademicdetails?.diplomaFinalYearObtained || '',
          diplomaPercentage: student.studentacademicdetails?.diplomaPercentage || '',
          cetScore: student.studentacademicdetails?.cetScore || '',
          cetRank: student.studentacademicdetails?.cetRank || '',
          cetYear: student.studentacademicdetails?.cetYear || '',
        }
      });
    }
  }, [student]);

  const handleDownloadPDF = async () => {
    if (!id) return;
    try {
      const { downloadAdmissionPDF } = await import('../../admission/src/utils/pdfGenerator');
      await downloadAdmissionPDF(API, toast, id);
    } catch (err) {
      toast.error('Failed to download admission PDF');
    }
  };

  const [zipLoading, setZipLoading] = useState(false);
  const handleDownloadZip = async () => {
    if (!id) return;
    setZipLoading(true);
    const toastId = toast.loading('Generating documents ZIP…');
    try {
      const response = await API.get(`/admin/admissions/${id}/documents/zip`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const studentName = student?.user 
        ? `${student.user.firstName || ''} ${student.user.lastName || ''}`.trim()
        : 'student';
      const appNum = student?.applicationNumber || `TEMP-${id}`;
      
      link.setAttribute('download', `${studentName.replace(/[^a-zA-Z0-9]/g, '_')}_${appNum}_docs.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.dismiss(toastId);
      toast.success('ZIP downloaded successfully!');
    } catch (err) {
      console.error(err);
      toast.dismiss(toastId);
      toast.error('Failed to generate ZIP archive.');
    } finally {
      setZipLoading(false);
    }
  };

  const handleOpenCancelModal = () => {
    setCancelStep(1);
    setCancelReason('');
    setCancelRemarks('');
    setCancelModalOpen(true);
  };

  const handleCancelAdmission = async () => {
    if (!id || !cancelReason) return;
    setCancelLoading(true);
    try {
      await admissionService.directCancel(id, cancelReason, cancelRemarks);
      toast.success('Admission cancelled successfully');
      setCancelModalOpen(false);
      fetchStudentDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to cancel admission');
    } finally {
      setCancelLoading(false);
    }
  };

  const getPhotoUrl = (photoPath: string | null | undefined) => {
    if (!photoPath) return '';
    if (photoPath.startsWith('http') || photoPath.startsWith('data:')) return photoPath;
    
    const base = API.defaults.baseURL || '/api';
    const isAdmin = window.location.pathname.startsWith('/admin');
    const rolePath = isAdmin ? 'admin' : 'principal';
    const url = `${base}/${rolePath}/admissions/${id}/documents/photo`;
    
    const token = localStorage.getItem('token');
    return token ? `${url}?token=${encodeURIComponent(token)}` : url;
  };

  const getTimelineBadge = (label: string, dateStr?: string | Date | null, actorName?: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return (
      <div className="flex gap-4 items-start relative pb-6 text-xs last:pb-0">
        <div className="mt-1 flex items-center justify-center size-5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 border-2 border-white dark:border-neutral-900 shrink-0 z-10">
          <CheckCircle2 size={10} />
        </div>
        <div className="space-y-0.5">
          <p className="font-extrabold text-neutral-800 dark:text-neutral-200">
            {label}{actorName ? <span className="text-violet-600 dark:text-violet-400 font-semibold ml-1.5">by {actorName}</span> : ''}
          </p>
          <p className="font-semibold text-neutral-400 dark:text-neutral-500">
            {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at{' '}
            {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-10 h-10 text-violet-600 animate-spin" />
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest animate-pulse">Loading Student Profile...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <p className="text-sm font-bold text-neutral-500 uppercase">Student not found</p>
        <button 
          onClick={() => navigate('/admin/students')}
          className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold shadow-md"
        >
          Go Back
        </button>
      </div>
    );
  }

  const isAdmin = window.location.pathname.startsWith('/admin');
  const backPath = isAdmin ? '/admin/students' : '/principal/students';

  const pd = student.studentpersonaldetails as any;
  const par = student.studentparentdetails as any;
  const addr = student.studentaddress as any;
  const acad = student.studentacademicdetails as any;
  const docs = student.studentdocuments as any;
  const q = (student.qualification || '').toUpperCase();
  const showPUC = q === 'PUC' || (!q && student.admissionType === 'KCET');
  const showDiploma = q === 'DIPLOMA' || (!q && student.admissionType === 'DCET');

  return (
    <div className="space-y-6 animate-fade-in w-full pb-12">
      
      {/* Back Button & Action Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button 
          onClick={() => navigate(backPath)} 
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-neutral-850 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Back to Student Management
        </button>
        
        <div className="flex items-center gap-3">
          {isEditMode ? (
            <>
              <button 
                type="button"
                onClick={handleSaveEdits}
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-md disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button 
                type="button"
                onClick={() => {
                  setIsEditMode(false);
                  navigate(window.location.pathname, { replace: true });
                  fetchStudentDetails();
                }}
                className="px-4 py-2 bg-neutral-500 hover:bg-neutral-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-md"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {isAdmin && (
                <button 
                  type="button"
                  onClick={() => {
                    setIsEditMode(true);
                    navigate(`${window.location.pathname}?edit=true`, { replace: true });
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-md"
                >
                  Edit Profile
                </button>
              )}
              {isAdmin && (student.applicationStatus === 'APPROVED' || student.applicationStatus === 'PRINCIPAL_APPROVED' || student.applicationStatus === 'ENROLLED') && (
                <button 
                  type="button"
                  onClick={handleOpenCancelModal}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <Ban size={14} /> Cancel Admission
                </button>
              )}
              <button 
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-md"
              >
                <Download size={14} /> Download PDF
              </button>
              <button 
                onClick={handleDownloadZip}
                disabled={zipLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-md cursor-pointer disabled:cursor-not-allowed"
              >
                {zipLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download ZIP
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Student Info Header Card */}
      <div className="bg-white/40 dark:bg-neutral-900/40 backdrop-blur-md border border-neutral-200/50 dark:border-neutral-800/50 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <div className="w-36 h-48 border-2 border-neutral-250 dark:border-neutral-750 rounded-2xl overflow-hidden bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center shrink-0 shadow-sm relative">
            {docs?.photoUrl || student.user?.profileImage ? (
              <img src={getPhotoUrl(docs?.photoUrl || student.user?.profileImage || '')} alt="photo" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-2 text-neutral-400 dark:text-neutral-500">
                <User size={32} className="mx-auto opacity-45" />
                <span className="text-[10px] font-bold block uppercase tracking-wider mt-1">Photo</span>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl md:text-2xl font-black text-neutral-900 dark:text-white uppercase tracking-wide">
                {isEditMode && editData
                  ? editData.studentpersonaldetails
                    ? `${editData.studentpersonaldetails.firstName} ${editData.studentpersonaldetails.middleName ? editData.studentpersonaldetails.middleName + ' ' : ''}${editData.studentpersonaldetails.lastName}`.replace(/\s+/g, ' ').trim()
                    : `${editData.user?.firstName || ''} ${editData.user?.lastName || ''}`.trim()
                  : pd
                    ? `${pd.firstName} ${pd.middleName ? pd.middleName + ' ' : ''}${pd.lastName}`.replace(/\s+/g, ' ').trim()
                    : student.user 
                      ? `${student.user.firstName || ''} ${student.user.lastName || ''}`.trim() 
                      : 'Student Profile'}
              </h3>
              <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${STATUS_COLOR_MAP[student.applicationStatus] || STATUS_COLOR_MAP.DRAFT}`}>
                {STATUS_LABEL_MAP[student.applicationStatus] || student.applicationStatus}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-bold text-neutral-500 mt-4">
              <span>App No: <strong className="text-neutral-700 dark:text-neutral-300">{student.applicationNumber || '—'}</strong></span>
              {(() => {
                const assignedUsn = student.usn || student.user?.student?.usn || (student.user?.student?.enrollmentNumber && !student.user.student.enrollmentNumber.startsWith('JCER-') ? student.user.student.enrollmentNumber : null);
                if (!assignedUsn) return null;
                return (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span>USN: <strong className="text-neutral-700 dark:text-neutral-300 font-mono">{assignedUsn}</strong></span>
                  </>
                );
              })()}
              <span className="hidden sm:inline">•</span>
              <span>Branch: <strong className="text-neutral-700 dark:text-neutral-300">{student.branch?.name || 'N/A'}</strong></span>
              <span className="hidden sm:inline">•</span>
              <span>Semester: <strong className="text-neutral-700 dark:text-neutral-300">{student.user?.student?.semester ? `Sem ${student.user.student.semester}` : (student.entrySemester ? `Sem ${student.entrySemester}` : '—')}</strong></span>
              <span className="hidden sm:inline">•</span>
              <span>Academic Year: <strong className="text-neutral-700 dark:text-neutral-300">{student.academicYear || '—'}</strong></span>
              <span className="hidden sm:inline">•</span>
              <span>Type: <strong className="text-neutral-700 dark:text-neutral-300">{student.admissionType || 'N/A'}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Selector slider */}
      <div className="flex justify-center border-b border-neutral-200/60 dark:border-neutral-800 pb-3">
        <div className="flex items-center glass-bar p-1 rounded-full gap-1">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-6 py-2 rounded-full text-xs font-bold transition-all duration-300 ${
              activeTab === 'details'
                ? 'nav-pill-active shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            All Details
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-6 py-2 rounded-full text-xs font-bold transition-all duration-300 ${
              activeTab === 'documents'
                ? 'nav-pill-active shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            Documents
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-6 py-2 rounded-full text-xs font-bold transition-all duration-300 ${
              activeTab === 'timeline'
                ? 'nav-pill-active shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            Timeline & Remarks
          </button>
        </div>
      </div>

      {/* Sheet Container mimicking AdmissionReviewPage.tsx form sheet */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-xl p-8 md:p-12 space-y-8">
        
        {/* Tab 1: All Details */}
        {activeTab === 'details' && (
          <div className="space-y-8">
            
            {/* Personal Profile Section */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                <User size={14} className="text-violet-500" /> Personal Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                <FormField label="First Name" value={isEditMode ? editData?.studentpersonaldetails?.firstName : pd?.firstName} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentpersonaldetails', 'firstName', val)} />
                <FormField label="Middle Name" value={isEditMode ? editData?.studentpersonaldetails?.middleName : pd?.middleName} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentpersonaldetails', 'middleName', val)} />
                <FormField label="Last Name" value={isEditMode ? editData?.studentpersonaldetails?.lastName : pd?.lastName} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentpersonaldetails', 'lastName', val)} />
                <FormField label="Gender" value={isEditMode ? editData?.studentpersonaldetails?.gender : pd?.gender} isEdit={isEditMode} type="select" options={[{ label: 'Male', value: 'MALE' }, { label: 'Female', value: 'FEMALE' }, { label: 'Other', value: 'OTHER' }]} onChange={(val) => handleFieldChange('studentpersonaldetails', 'gender', val)} />
                <FormField label="Date of Birth" value={isEditMode ? editData?.studentpersonaldetails?.dateOfBirth : formatDateDDMMYYYY(pd?.dateOfBirth)} isEdit={isEditMode} type="date" onChange={(val) => handleFieldChange('studentpersonaldetails', 'dateOfBirth', val)} />
                <FormField label="Nationality" value={isEditMode ? editData?.studentpersonaldetails?.nationality : pd?.nationality} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentpersonaldetails', 'nationality', val)} />
                <FormField label="Religion" value={isEditMode ? editData?.studentpersonaldetails?.religion : pd?.religion} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentpersonaldetails', 'religion', val)} />
                <FormField label="Caste" value={isEditMode ? editData?.studentpersonaldetails?.caste : pd?.caste} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentpersonaldetails', 'caste', val)} />
                <FormField label="Category" value={isEditMode ? editData?.studentpersonaldetails?.category : pd?.category} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentpersonaldetails', 'category', val)} />
                <FormField label="Area Type" value={isEditMode ? editData?.studentpersonaldetails?.areaType : pd?.areaType} isEdit={isEditMode} type="select" options={[{ label: 'Urban', value: 'URBAN' }, { label: 'Rural', value: 'RURAL' }]} onChange={(val) => handleFieldChange('studentpersonaldetails', 'areaType', val)} />
                <FormField label="Studied In Karnataka" value={isEditMode ? editData?.studentpersonaldetails?.studiedInKarnataka : pd?.studiedInKarnataka} isEdit={isEditMode} type="checkbox" onChange={(val) => handleFieldChange('studentpersonaldetails', 'studiedInKarnataka', val)} />
                <FormField label="Aadhaar Number" value={isEditMode ? editData?.aadhaar : student.aadhaar} isEdit={isEditMode} onChange={(val) => handleFieldChange('root', 'aadhaar', val)} />
              </div>
            </div>

            <hr className="border-neutral-100 dark:border-neutral-800" />

            {/* Parents Info Section */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                <BookOpen size={14} className="text-violet-500" /> Parent / Guardian Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                <FormField label="Father's Name" value={isEditMode ? editData?.studentparentdetails?.fatherName : par?.fatherName} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentparentdetails', 'fatherName', val)} />
                <FormField label="Father's Occupation" value={isEditMode ? editData?.studentparentdetails?.fatherOccupation : par?.fatherOccupation} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentparentdetails', 'fatherOccupation', val)} />
                <FormField label="Father's Phone" value={isEditMode ? editData?.studentparentdetails?.fatherPhone : par?.fatherPhone} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentparentdetails', 'fatherPhone', val)} />
                <FormField label="Father's Email" value={isEditMode ? editData?.studentparentdetails?.fatherEmail : par?.fatherEmail} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentparentdetails', 'fatherEmail', val)} />
                <FormField label="Mother's Name" value={isEditMode ? editData?.studentparentdetails?.motherName : par?.motherName} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentparentdetails', 'motherName', val)} />
                <FormField label="Mother's Occupation" value={isEditMode ? editData?.studentparentdetails?.motherOccupation : par?.motherOccupation} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentparentdetails', 'motherOccupation', val)} />
                <FormField label="Mother's Phone" value={isEditMode ? editData?.studentparentdetails?.motherPhone : par?.motherPhone} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentparentdetails', 'motherPhone', val)} />
                <FormField label="Annual Family Income" value={isEditMode ? editData?.studentparentdetails?.fatherAnnualIncome : par?.fatherAnnualIncome} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentparentdetails', 'fatherAnnualIncome', val)} />
              </div>
            </div>

            <hr className="border-neutral-100 dark:border-neutral-800" />

            {/* Contact Information Section */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                <Phone size={14} className="text-violet-500" /> Contact Information
              </h3>
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <FormField label="Candidate Email" value={isEditMode ? editData?.user?.email : student.user?.email} isEdit={isEditMode} onChange={(val) => handleFieldChange('user', 'email', val)} />
                <FormField label="Candidate Mobile" value={isEditMode ? editData?.user?.phone : student.user?.phone} isEdit={isEditMode} onChange={(val) => handleFieldChange('user', 'phone', val)} />
              </div>
            </div>

            <hr className="border-neutral-100 dark:border-neutral-800" />

            {/* Address Details Section */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                <MapPin size={14} className="text-violet-500" /> Address Details
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3 bg-neutral-50/20 dark:bg-neutral-800/10">
                  <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest">Current Residence</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <FormField label="Address Line" value={isEditMode ? editData?.studentaddress?.currentAddressLine1 : addr?.currentAddressLine1} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentaddress', 'currentAddressLine1', val)} />
                    </div>
                    <FormField label="City" value={isEditMode ? editData?.studentaddress?.currentCity : addr?.currentCity} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentaddress', 'currentCity', val)} />
                    <FormField label="State" value={isEditMode ? editData?.studentaddress?.currentState : addr?.currentState} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentaddress', 'currentState', val)} />
                    <FormField label="Pincode" value={isEditMode ? editData?.studentaddress?.currentPincode : addr?.currentPincode} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentaddress', 'currentPincode', val)} />
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3 bg-neutral-50/20 dark:bg-neutral-800/10">
                  <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest">Permanent Residence</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <FormField label="Address Line" value={isEditMode ? editData?.studentaddress?.permanentAddressLine1 : addr?.permanentAddressLine1} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentaddress', 'permanentAddressLine1', val)} />
                    </div>
                    <FormField label="City" value={isEditMode ? editData?.studentaddress?.permanentCity : addr?.permanentCity} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentaddress', 'permanentCity', val)} />
                    <FormField label="State" value={isEditMode ? editData?.studentaddress?.permanentState : addr?.permanentState} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentaddress', 'permanentState', val)} />
                    <FormField label="Pincode" value={isEditMode ? editData?.studentaddress?.permanentPincode : addr?.permanentPincode} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentaddress', 'permanentPincode', val)} />
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-neutral-100 dark:border-neutral-800" />

            {/* Academic Qualifications Section */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                <GraduationCap size={14} className="text-violet-500" /> Academic Qualifications
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 10th Record */}
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">10th Standard (SSLC)</p>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                    <FormField label="School Name" value={isEditMode ? editData?.studentacademicdetails?.tenthSchool : acad?.tenthSchool} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentacademicdetails', 'tenthSchool', val)} />
                    <FormField label="Board" value={isEditMode ? editData?.studentacademicdetails?.tenthBoard : acad?.tenthBoard} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentacademicdetails', 'tenthBoard', val)} />
                    <FormField label="Passing Year" value={isEditMode ? editData?.studentacademicdetails?.tenthPassingYear : acad?.tenthPassingYear} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'tenthPassingYear', val)} />
                    <FormField label="Register Number" value={isEditMode ? editData?.studentacademicdetails?.tenthRegisterNumber : acad?.tenthRegisterNumber} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentacademicdetails', 'tenthRegisterNumber', val)} />
                    <FormField label="Max Marks" value={isEditMode ? editData?.studentacademicdetails?.tenthMaxMarks : acad?.tenthMaxMarks} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'tenthMaxMarks', val)} />
                    <FormField label="Obtained Marks" value={isEditMode ? editData?.studentacademicdetails?.tenthMarksObtained : acad?.tenthMarksObtained} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'tenthMarksObtained', val)} />
                    <FormField label="Percentage" value={isEditMode ? editData?.studentacademicdetails?.tenthPercentage : acad?.tenthPercentage} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'tenthPercentage', val)} />
                    <FormField label="Attempts" value={isEditMode ? editData?.studentacademicdetails?.tenthAttempts : acad?.tenthAttempts} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'tenthAttempts', val)} />
                  </div>
                  {acad?.tenthPercentage && (
                    <div className="text-xs font-black text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-3 py-1.5 rounded-lg inline-block mt-2">
                      Aggregate Percentage: {acad.tenthPercentage}%
                    </div>
                  )}
                </div>

                {/* 12th/PUC or Diploma Record */}
                {showDiploma && (
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3 bg-violet-50/10 dark:bg-violet-950/10">
                    <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest">Diploma details (Lateral Entry)</p>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                      <FormField label="University/Institution" value={isEditMode ? editData?.studentacademicdetails?.diplomaUniversity : acad?.diplomaUniversity} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentacademicdetails', 'diplomaUniversity', val)} />
                      <FormField label="Passing Year" value={isEditMode ? editData?.studentacademicdetails?.diplomaYear : acad?.diplomaYear} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'diplomaYear', val)} />
                      <FormField label="Register Number" value={isEditMode ? editData?.studentacademicdetails?.diplomaRegisterNumber : acad?.diplomaRegisterNumber} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentacademicdetails', 'diplomaRegisterNumber', val)} />
                      <FormField label="Max Marks" value={isEditMode ? editData?.studentacademicdetails?.diplomaFinalYearMaxMarks : acad?.diplomaFinalYearMaxMarks} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'diplomaFinalYearMaxMarks', val)} />
                      <FormField label="Obtained Marks" value={isEditMode ? editData?.studentacademicdetails?.diplomaFinalYearObtained : acad?.diplomaFinalYearObtained} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'diplomaFinalYearObtained', val)} />
                      <FormField label="Percentage" value={isEditMode ? editData?.studentacademicdetails?.diplomaPercentage : acad?.diplomaPercentage} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'diplomaPercentage', val)} />
                    </div>
                    {!isEditMode && acad?.diplomaPercentage && (
                      <div className="text-xs font-black text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-3 py-1.5 rounded-lg inline-block mt-2">
                        Diploma Percentage: {acad.diplomaPercentage}%
                      </div>
                    )}
                  </div>
                )}
                {showPUC && (
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3">
                    <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">12th Standard / PUC</p>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                      <FormField label="School / College" value={isEditMode ? editData?.studentacademicdetails?.twelfthSchool : acad?.twelfthSchool} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentacademicdetails', 'twelfthSchool', val)} />
                      <FormField label="Board" value={isEditMode ? editData?.studentacademicdetails?.twelfthBoard : acad?.twelfthBoard} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentacademicdetails', 'twelfthBoard', val)} />
                      <FormField label="Passing Year" value={isEditMode ? editData?.studentacademicdetails?.twelfthPassingYear : acad?.twelfthPassingYear} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'twelfthPassingYear', val)} />
                      <FormField label="Register Number" value={isEditMode ? editData?.studentacademicdetails?.twelfthRegisterNumber : acad?.twelfthRegisterNumber} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentacademicdetails', 'twelfthRegisterNumber', val)} />
                      <FormField label="Stream" value={isEditMode ? editData?.studentacademicdetails?.twelfthStream : acad?.twelfthStream} isEdit={isEditMode} onChange={(val) => handleFieldChange('studentacademicdetails', 'twelfthStream', val)} />
                      <FormField label="Percentage" value={isEditMode ? editData?.studentacademicdetails?.twelfthPercentage : acad?.twelfthPercentage} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'twelfthPercentage', val)} />
                      <FormField label="Attempts" value={isEditMode ? editData?.studentacademicdetails?.twelfthAttempts : acad?.twelfthAttempts} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'twelfthAttempts', val)} />
                    </div>
                    <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-3 gap-2">
                      <FormField label="Physics" value={isEditMode ? editData?.studentacademicdetails?.physicsMarks : acad?.physicsMarks} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'physicsMarks', val)} />
                      <FormField label="Maths" value={isEditMode ? editData?.studentacademicdetails?.mathsMarks : acad?.mathsMarks} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'mathsMarks', val)} />
                      <FormField label="Chemistry" value={isEditMode ? editData?.studentacademicdetails?.chemistryMarks : acad?.chemistryMarks} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'chemistryMarks', val)} />
                    </div>
                    {!isEditMode && acad?.twelfthPercentage && (
                      <div className="text-xs font-black text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-3 py-1.5 rounded-lg inline-block mt-2">
                        Aggregate Percentage: {acad.twelfthPercentage}%
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Entrance Exam Details */}
              {(isEditMode || student.cetNumber || student.dcetNumber) && (
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3 mt-4 bg-slate-50/40 dark:bg-neutral-800/20">
                  <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Entrance Examination Details</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Render KCET Details if KCET/COMEDK student, or Management PUC student, or if cetNumber exists */}
                    {(student.cetNumber || student.admissionType === 'KCET' || student.admissionType === 'COMEDK' || (student.admissionType === 'MANAGEMENT' && q === 'PUC')) && (
                      <>
                        <FormField label="KCET Number" value={isEditMode ? editData?.cetNumber : student.cetNumber} isEdit={isEditMode} onChange={(val) => handleFieldChange('root', 'cetNumber', val)} />
                        {(isEditMode || acad?.cetScore) && <FormField label="KCET Score" value={isEditMode ? editData?.studentacademicdetails?.cetScore : acad?.cetScore} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'cetScore', val)} />}
                        {(isEditMode || acad?.cetRank) && <FormField label="KCET Rank" value={isEditMode ? editData?.studentacademicdetails?.cetRank : (acad?.cetRank ? `#${acad.cetRank}` : '')} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'cetRank', val)} />}
                      </>
                    )}
                    {/* Render DCET Details if DCET student, or Management Diploma student, or if dcetNumber exists */}
                    {(student.dcetNumber || student.admissionType === 'DCET' || (student.admissionType === 'MANAGEMENT' && q === 'DIPLOMA')) && (
                      <>
                        <FormField label="DCET Number" value={isEditMode ? editData?.dcetNumber : student.dcetNumber} isEdit={isEditMode} onChange={(val) => handleFieldChange('root', 'dcetNumber', val)} />
                        {(isEditMode || acad?.cetScore) && <FormField label="DCET Score" value={isEditMode ? editData?.studentacademicdetails?.cetScore : acad?.cetScore} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'cetScore', val)} />}
                        {(isEditMode || acad?.cetRank) && <FormField label="DCET Rank" value={isEditMode ? editData?.studentacademicdetails?.cetRank : (acad?.cetRank ? `#${acad.dcetRank}` : '')} isEdit={isEditMode} type="number" onChange={(val) => handleFieldChange('studentacademicdetails', 'cetRank', val)} />}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <hr className="border-neutral-100 dark:border-neutral-800" />

            {/* Admission Details Section */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-black tracking-widest text-neutral-450 border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                <Award size={14} className="text-violet-500" /> Admission Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                {isEditMode ? (
                  <FormField 
                    label="Allocated Branch" 
                    value={editData?.branchId} 
                    isEdit={isEditMode} 
                    type="select" 
                    options={branches.map(b => ({ label: `${b.name} (${b.code})`, value: b.id }))} 
                    onChange={(val) => handleFieldChange('root', 'branchId', val)} 
                  />
                ) : (
                  <FormField label="Allocated Branch" value={student.branch?.name} />
                )}
                {!isEditMode && <FormField label="Branch Code" value={student.branch?.code} />}
                <FormField 
                  label="Admission Type" 
                  value={isEditMode ? editData?.admissionType : student.admissionType} 
                  isEdit={isEditMode} 
                  type="select" 
                  options={[{ label: 'KCET', value: 'KCET' }, { label: 'DCET', value: 'DCET' }, { label: 'COMEDK', value: 'COMEDK' }, { label: 'MANAGEMENT', value: 'MANAGEMENT' }]} 
                  onChange={(val) => handleFieldChange('root', 'admissionType', val)} 
                />
                <FormField 
                  label="Academic Year" 
                  value={isEditMode ? editData?.academicYear : (student.academicYear || getAcademicYear())} 
                  isEdit={isEditMode} 
                  onChange={(val) => handleFieldChange('root', 'academicYear', val)} 
                />
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Uploaded Documents */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-wider text-neutral-955 dark:text-white border-l-4 border-violet-500 pl-2 flex items-center gap-2">
              <FileText size={16} className="text-violet-500" /> Attached Digital Documents
            </h4>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { label: 'Passport Size Photo', field: 'photo', url: docs?.photoUrl },
                { label: 'Candidate E-Signature', field: 'signature', url: docs?.signatureUrl },
                { label: 'SSLC / 10th Marks Card', field: 'tenthMarksheet', url: docs?.tenthMarksheetUrl },
                ...(showDiploma ? [
                  { label: 'Diploma 5th Semester Marks Card', field: 'diplomaSemester5Marksheet', url: docs?.diplomaSemester5MarksheetUrl },
                  { label: 'Diploma 6th Semester Marks Card', field: 'diplomaSemester6Marksheet', url: docs?.diplomaSemester6MarksheetUrl },
                ] : [
                  { label: 'PUC / 12th Marks Card', field: 'twelfthMarksheet', url: docs?.twelfthMarksheetUrl },
                ]),
                { label: 'Entrance Score Card (CET/DCET)', field: 'cetScoreCard', url: docs?.cetScoreCardUrl },
                { label: 'Aadhaar Card copy', field: 'aadhaar', url: docs?.aadhaarUrl },
                { label: 'College Fees Receipt', field: 'feesPaidReceipt', url: docs?.feesPaidReceiptUrl },
                { label: 'Admission Form Fee Receipt', field: 'admissionFormFeeReceipt', url: docs?.admissionFormFeeReceiptUrl },
                { label: 'Caste Certificate (Optional)', field: 'casteCertificate', url: docs?.casteCertificateUrl },
                { label: 'Domicile / Study Certificate', field: 'domicileCertificate', url: docs?.domicileCertificateUrl },
                { label: 'Income / Gap Year Certificate', field: 'gapCertificate', url: docs?.gapCertificateUrl },
              ]
                .filter(({ url }) => isEditMode || (url !== null && url !== undefined && url !== ''))
                .map((doc) => (
                  <DocumentSquareCard
                    key={doc.field}
                    field={doc.field}
                    studentId={student.id}
                    label={doc.label}
                    isEdit={isEditMode}
                    hasUrl={!!doc.url}
                    docUrl={doc.url}
                    uploading={uploadingField === doc.field}
                    onUpload={(file) => handleUploadDocument(doc.field, file)}
                    onRemove={() => handleRemoveDocument(doc.field)}
                  />
                ))}
            </div>
            {docs && (docs.admissionFormFeePaymentMode || docs.admissionFormFeeUtr) && (
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/20 dark:bg-neutral-850/10 space-y-3 mt-5">
                <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest">Admission Form Fee payment Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] text-neutral-400 font-bold uppercase">Payment Mode</p>
                    <p className="text-xs font-bold text-neutral-800 dark:text-neutral-250 mt-0.5">{docs.admissionFormFeePaymentMode || '—'}</p>
                  </div>
                  {docs.admissionFormFeePaymentMode === 'ONLINE' && (
                    <div>
                      <p className="text-[9px] text-neutral-400 font-bold uppercase">UTR / Transaction ID</p>
                      <p className="text-xs font-bold text-neutral-800 dark:text-neutral-250 mt-0.5">{docs.admissionFormFeeUtr || '—'}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Timeline & Remarks */}
        {activeTab === 'timeline' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Verification Status Card */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-955 dark:text-white border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                <ShieldCheck size={16} className="text-violet-500" /> Verification Status
              </h4>
              
              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800/80 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={16} className={student.documentsVerified ? "text-emerald-500" : "text-neutral-300"} />
                    <span className="font-bold">Documents Verified</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${student.documentsVerified ? "bg-emerald-150 text-emerald-850 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-neutral-100 text-neutral-450 dark:bg-neutral-800 dark:text-neutral-400"}`}>
                    {student.documentsVerified ? "Verified" : "Pending"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800/80 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={16} className={student.feesVerified ? "text-emerald-500" : "text-neutral-300"} />
                    <span className="font-bold">Fees Payment Verified</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${student.feesVerified ? "bg-emerald-150 text-emerald-850 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-neutral-100 text-neutral-450 dark:bg-neutral-800 dark:text-neutral-400"}`}>
                    {student.feesVerified ? "Verified" : "Pending"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800/80 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={16} className={student.eligibilityVerified ? "text-emerald-500" : "text-neutral-300"} />
                    <span className="font-bold">Eligibility Criteria Verified</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${student.eligibilityVerified ? "bg-emerald-150 text-emerald-850 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-neutral-100 text-neutral-450 dark:bg-neutral-800 dark:text-neutral-400"}`}>
                    {student.eligibilityVerified ? "Verified" : "Pending"}
                  </span>
                </div>
              </div>
            </div>

            {/* Administrative Remarks */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-955 dark:text-white border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                <FileText size={16} className="text-violet-500" /> Administrative Remarks
              </h4>
              
              <div className="space-y-4 text-xs">
                <div>
                  <p className="text-[9px] font-black uppercase text-violet-500 tracking-wider">Officer Remarks</p>
                  {student.adminRemarks ? (
                    <div className="p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800/80 rounded-xl mt-1.5 font-semibold text-neutral-700 dark:text-neutral-300">
                      {student.adminRemarks}
                    </div>
                  ) : (
                    <p className="italic text-neutral-400 mt-1">No remarks recorded by office.</p>
                  )}
                </div>

                <div>
                  <p className="text-[9px] font-black uppercase text-violet-500 tracking-wider">Principal Remarks</p>
                  {student.approvalRemarks ? (
                    <div className="p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800/80 rounded-xl mt-1.5 font-semibold text-neutral-700 dark:text-neutral-300">
                      {student.approvalRemarks}
                    </div>
                  ) : (
                    <p className="italic text-neutral-400 mt-1">No remarks recorded by Principal.</p>
                  )}
                </div>

                {student.rejectionReason && (
                  <div>
                    <p className="text-[9px] font-black uppercase text-rose-500 tracking-wider">Rejection Reason</p>
                    <div className="p-3 bg-rose-50/20 dark:bg-rose-950/15 border border-rose-205 dark:border-rose-900 rounded-xl mt-1.5 font-semibold text-rose-700 dark:text-rose-400">
                      {student.rejectionReason}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Application Timeline Card */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-955 dark:text-white border-l-4 border-violet-500 pl-2 flex items-center gap-2">
                <Clock size={16} className="text-violet-500" /> Application Timeline
              </h4>
              
              <div className="space-y-0.5 pl-1.5 border-l-2 border-neutral-200 dark:border-neutral-850">
                {getTimelineBadge('Application Created', student.createdAt)}
                {getTimelineBadge('Submitted Under Review', student.submittedAt)}
                {getTimelineBadge('Correction Requested', student.correctionRequestedAt, student.correctionRequestedBy ? `${student.correctionRequestedBy.firstName || ''} ${student.correctionRequestedBy.lastName || ''}`.trim() || student.correctionRequestedBy.username || student.correctionRequestedBy.email : null)}
                {getTimelineBadge('Verified / Approved by Officer', student.verifiedAt, student.verifiedByAdmin ? `${student.verifiedByAdmin.firstName || ''} ${student.verifiedByAdmin.lastName || ''}`.trim() || student.verifiedByAdmin.username || student.verifiedByAdmin.email : null)}
                {getTimelineBadge('Admission Finalized (Enrolled)', student.applicationStatus === 'ENROLLED' ? (student.enrolledAt || student.updatedAt) : null, (student as any).principalReviewer ? `${(student as any).principalReviewer.firstName || ''} ${(student as any).principalReviewer.lastName || ''}`.trim() || (student as any).principalReviewer.username || (student as any).principalReviewer.email : 'Dr. S.V. Gorbal')}
                {getTimelineBadge('Application Rejected', student.rejectedAt, student.rejectedByAdmin ? `${student.rejectedByAdmin.firstName || ''} ${student.rejectedByAdmin.lastName || ''}`.trim() || student.rejectedByAdmin.username || student.rejectedByAdmin.email : null)}
              </div>
            </div>

            {/* Cancellation Details Section (Renders Full Width below if applicable) */}
            {(student.applicationStatus === 'CANCELLED' || student.applicationStatus === 'CANCELLATION_REQUESTED') && (
              <div className="bg-rose-50/30 dark:bg-rose-950/10 border border-rose-200/60 dark:border-rose-900/40 rounded-3xl p-6 space-y-4 shadow-sm text-neutral-900 dark:text-white lg:col-span-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-455 border-l-4 border-rose-500 pl-2 flex items-center gap-2">
                  <Ban size={16} className="text-rose-500" /> Cancellation Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Cancellation Status</p>
                    <p className="font-bold text-rose-700 dark:text-rose-300 mt-0.5">
                      {student.applicationStatus === 'CANCELLED' ? 'Admission Cancelled' : 'Cancellation Requested'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Cancellation Reason</p>
                    <p className="font-bold text-neutral-850 dark:text-neutral-200 mt-0.5">{student.cancellationReason || 'N/A'}</p>
                  </div>
                  {student.cancellationRequestedAt && (
                    <div>
                      <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Requested Date</p>
                      <p className="font-bold text-neutral-800 dark:text-neutral-200 mt-0.5">
                        {new Date(student.cancellationRequestedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}
                  {student.cancellationApprovedAt && (
                    <div>
                      <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Cancelled Date</p>
                      <p className="font-bold text-neutral-800 dark:text-neutral-200 mt-0.5">
                        {new Date(student.cancellationApprovedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}
                </div>
                {student.cancellationRemarks && (
                  <div className="text-xs pt-2">
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Student Cancellation Remarks</p>
                    <div className="p-3.5 bg-white dark:bg-neutral-950 border border-rose-100 dark:border-rose-900 rounded-xl mt-1.5 font-semibold text-neutral-700 dark:text-neutral-300 italic">
                      "{student.cancellationRemarks}"
                    </div>
                  </div>
                )}
                {student.cancellationAdminRemarks && (
                  <div className="text-xs pt-2">
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Admin Remarks</p>
                    <div className="p-3.5 bg-white dark:bg-neutral-950 border border-rose-100 dark:border-rose-900 rounded-xl mt-1.5 font-semibold text-neutral-700 dark:text-neutral-300 italic">
                      "{student.cancellationAdminRemarks}"
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>

      {/* Direct Cancel Admission Modal */}
      {cancelModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in duration-200">
            
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="text-base font-black text-neutral-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                <Ban className="text-rose-650" size={20} /> Cancel Admission
              </h3>
              <button 
                onClick={() => setCancelModalOpen(false)}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400"
              >
                <X size={18} />
              </button>
            </div>

            {cancelStep === 1 ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-amber-50/30 dark:bg-amber-950/15 border border-amber-250/30 rounded-xl text-xs font-semibold text-amber-800 dark:text-amber-400 space-y-1">
                  <p className="font-extrabold uppercase text-[10px] tracking-wider text-amber-600 dark:text-amber-455">⚠️ High Risk Operation</p>
                  <p>You are about to cancel the finalized admission of student <strong>{student.user ? `${student.user.firstName} ${student.user.lastName}` : ''}</strong>.</p>
                  <p>This will release their allocated USN and revoke student portal access.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-450">Select Reason for Cancellation</label>
                  <select 
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="">-- Choose Reason --</option>
                    <option value="Voluntary Withdrawal by Student">Voluntary Withdrawal by Student</option>
                    <option value="Duplicate Admission / Seat Surrender">Duplicate Admission / Seat Surrender</option>
                    <option value="Failed to meet academic eligibility">Failed to meet academic eligibility</option>
                    <option value="Disciplinary Action">Disciplinary Action</option>
                    <option value="Fake / Tampered Documentation">Fake / Tampered Documentation</option>
                    <option value="Other / Not Specified">Other / Not Specified</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-450">Remarks / Description</label>
                  <textarea 
                    rows={3}
                    value={cancelRemarks}
                    onChange={(e) => setCancelRemarks(e.target.value)}
                    placeholder="Enter additional remarks or cancel notes..."
                    className="w-full bg-neutral-50 dark:bg-neutral-855 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <button 
                  disabled={!cancelReason}
                  onClick={() => setCancelStep(2)}
                  className="w-full py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 disabled:opacity-50 transition-opacity font-bold text-xs uppercase tracking-wider rounded-xl shadow-md"
                >
                  Proceed to Confirmation
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                <p>Please type <strong className="text-neutral-900 dark:text-white uppercase tracking-wider">CONFIRM CANCEL</strong> below to execute this action.</p>
                <input 
                  type="text" 
                  placeholder="CONFIRM CANCEL"
                  id="confirm_cancel_field"
                  className="w-full bg-neutral-50 dark:bg-neutral-850 border border-rose-350 dark:border-rose-900/50 rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-wider outline-none text-rose-600 focus:ring-2 focus:ring-rose-500"
                />
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCancelStep(1)}
                    className="flex-1 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-500 hover:bg-neutral-50"
                  >
                    Go Back
                  </button>
                  <button 
                    disabled={cancelLoading}
                    onClick={async () => {
                      const inputVal = (document.getElementById('confirm_cancel_field') as HTMLInputElement)?.value;
                      if (inputVal === 'CONFIRM CANCEL') {
                        await handleCancelAdmission();
                      } else {
                        toast.error('Confirmation string does not match');
                      }
                    }}
                    className="flex-1 py-2.5 bg-rose-600 text-white hover:bg-rose-700 rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2"
                  >
                    {cancelLoading && <Loader2 size={12} className="animate-spin" />} Confirm Cancellation
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

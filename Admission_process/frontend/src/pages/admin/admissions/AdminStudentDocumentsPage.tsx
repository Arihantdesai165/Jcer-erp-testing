import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../../../services/api';
import { 
  ArrowLeft, Download, Eye, CheckCircle2, Loader2, User, AlertTriangle, X, Layers
} from 'lucide-react';
import { toast } from 'react-toastify';

export const AdminStudentDocumentsPage: React.FC = () => {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const [docData, setDocData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [zipLoading, setZipLoading] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<{ label: string; url: string; isPdf: boolean } | null>(null);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const res = await API.get(`/admin/students/${applicationId}/documents`);
      if (res.data?.success) {
        setDocData(res.data.data);
      } else {
        toast.error('Failed to load application details.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load student documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (applicationId) {
      fetchDetails();
    }
  }, [applicationId]);

  const handleDownloadZip = async () => {
    if (!applicationId) return;
    setZipLoading(true);
    const toastId = toast.loading('Generating documents ZIP…');
    try {
      const targetAppId = docData?.applicationId || applicationId;
      const response = await API.get(`/admin/admissions/${targetAppId}/documents/zip`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const studentName = docData?.studentName || 'student';
      const appNum = docData?.applicationNumber || `TEMP-${applicationId}`;
      
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

  const formatDocUrl = (rawUrl: string) => {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('data:')) {
      return rawUrl;
    }
    const base = API.defaults.baseURL || '/api';
    const cleanPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    return `${base.replace(/\/api\/?$/, '')}${cleanPath}`;
  };

  const handleAction = (label: string, actionType: 'view' | 'download', rawUrl: string, isPdfFile: boolean) => {
    const fullUrl = formatDocUrl(rawUrl);

    if (actionType === 'view') {
      setViewingDoc({ label, url: fullUrl, isPdf: isPdfFile });
    } else {
      const link = document.createElement('a');
      link.href = fullUrl;
      link.setAttribute('download', `${label.replace(/\s+/g, '_')}${isPdfFile ? '.pdf' : '.jpg'}`);
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`${label} download started.`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-neutral-500 dark:text-neutral-400 font-medium">Loading documents workspace...</p>
        </div>
      </div>
    );
  }

  if (!docData) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
        <h2 className="text-2xl font-black text-neutral-900 dark:text-white uppercase tracking-wider mb-2">Documents Not Found</h2>
        <p className="text-neutral-500 dark:text-neutral-400 mb-6">We could not locate the student document package for ID: {applicationId}</p>
        <button 
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-neutral-950 hover:bg-neutral-800 text-white rounded-2xl font-bold flex items-center gap-2 mx-auto transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    );
  }

  const { studentName, usn, applicationNumber, branch, academicYear, applicationStatus, documents, provisionalDocuments } = docData;

  // ─── DEDICATED FULL-PAGE DOCUMENT VIEWER VIEW ──────────────────────────────
  if (viewingDoc) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto min-h-screen bg-neutral-50 dark:bg-neutral-950 animate-fade-in space-y-6">
        {/* Dedicated Viewer Header Bar with Exit Buttons */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/80 rounded-3xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setViewingDoc(null)}
              className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-2xl text-xs font-black transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
              title="Exit Document Viewer"
            >
              <ArrowLeft size={16} /> Exit Viewer
            </button>
            <div>
              <h2 className="text-lg md:text-xl font-black text-neutral-900 dark:text-white uppercase tracking-wide">
                {viewingDoc.label}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-bold mt-0.5">
                Student: <span className="text-neutral-900 dark:text-white font-black">{studentName}</span> ({usn || applicationNumber})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button 
              onClick={() => handleAction(viewingDoc.label, 'download', viewingDoc.url, viewingDoc.isPdf)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-indigo-600/10 cursor-pointer"
            >
              <Download size={14} /> Download Document
            </button>

            <button 
              onClick={() => setViewingDoc(null)}
              className="px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <X size={14} /> Exit
            </button>
          </div>
        </div>

        {/* Main Full-Page Viewer Canvas */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/80 rounded-3xl p-4 sm:p-8 shadow-sm flex flex-col items-center justify-center min-h-[75vh] relative overflow-hidden">
          {viewingDoc.isPdf ? (
            <iframe 
              src={viewingDoc.url} 
              className="w-full h-[75vh] md:h-[80vh] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white"
              title={`${viewingDoc.label} Preview`}
            />
          ) : (
            <div className="w-full flex flex-col items-center justify-center space-y-4">
              <img 
                src={viewingDoc.url} 
                alt={viewingDoc.label}
                className="max-w-full max-h-[72vh] md:max-h-[78vh] rounded-2xl border border-neutral-200 dark:border-neutral-800 object-contain bg-neutral-50 dark:bg-neutral-950 shadow-lg"
              />
            </div>
          )}
        </div>

        {/* Dedicated Viewer Bottom Exit Navigation */}
        <div className="flex items-center justify-between pt-2">
          <button 
            onClick={() => setViewingDoc(null)}
            className="px-5 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowLeft size={16} /> Exit Viewer & Return to Document Center
          </button>
        </div>
      </div>
    );
  }

  // ─── STANDARD DOCUMENT LIST VIEW ───────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/80 hover:bg-neutral-50 rounded-2xl transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} className="text-neutral-700 dark:text-neutral-300" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-wider">Student Documents</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Verify, preview, and download individual or packaged documents.</p>
          </div>
        </div>

        <button 
          onClick={handleDownloadZip}
          disabled={zipLoading}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 shadow-md shadow-indigo-600/10 cursor-pointer disabled:cursor-not-allowed"
        >
          {zipLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Download All (ZIP)
        </button>
      </div>

      {/* Info Overview Card */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/50 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <User size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-neutral-900 dark:text-white uppercase tracking-wide">{studentName}</h2>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-1.5 text-xs text-neutral-500 dark:text-neutral-400 font-bold">
              <span>USN: <span className="text-emerald-600 font-black">{usn}</span></span>
              <span className="hidden sm:inline opacity-30">•</span>
              <span>Application No: <span className="text-indigo-600 font-black">{applicationNumber}</span></span>
              <span className="hidden sm:inline opacity-30">•</span>
              <span>Branch: <span>{branch}</span></span>
              <span className="hidden sm:inline opacity-30">•</span>
              <span>Academic Year: <span>{academicYear}</span></span>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          <span className="text-xs font-black uppercase tracking-wider text-neutral-500">Status:</span>
          <span className="px-3.5 py-1.5 bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 border border-violet-200 dark:border-violet-900/50 rounded-xl text-xs font-black uppercase tracking-widest">
            {applicationStatus}
          </span>
        </div>
      </div>

      {/* Core Admission Documents Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/80 rounded-3xl overflow-hidden shadow-sm mb-8">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider">Core Admission Documents</h3>
          <span className="text-xs text-neutral-400 font-bold">{documents?.length || 0} File(s) Uploaded</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase font-extrabold border-b border-neutral-800">
              <tr className="bg-[#111111] dark:bg-neutral-950 border-b border-neutral-800 text-[10px] font-black uppercase tracking-widest text-white">
                <th className="py-4.5 px-6 text-white">Document Type</th>
                <th className="py-4.5 px-6 text-white">Storage Path</th>
                <th className="py-4.5 px-6 text-center text-white">Status</th>
                <th className="py-4.5 px-6 text-right text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {documents && documents.length > 0 ? (
                documents.map((doc: any) => (
                  <tr key={doc.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/40 transition-colors">
                    <td className="py-4.5 px-6 font-bold text-xs text-neutral-800 dark:text-neutral-200">
                      {doc.name}
                    </td>
                    <td className="py-4.5 px-6 font-mono text-[10px] text-neutral-400 dark:text-neutral-500 max-w-xs truncate">
                      {doc.r2Key ? doc.r2Key.substring(doc.r2Key.lastIndexOf('/') + 1) : '—'}
                    </td>
                    <td className="py-4.5 px-6 text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-450 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-900/30">
                        <CheckCircle2 size={10} /> Uploaded
                      </span>
                    </td>
                    <td className="py-4.5 px-6 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleAction(doc.name, 'view', doc.previewUrl, doc.isPdf)}
                          className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all cursor-pointer border border-transparent hover:border-indigo-100/50"
                          title="Preview Document"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleAction(doc.name, 'download', doc.downloadUrl, doc.isPdf)}
                          className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all cursor-pointer border border-transparent hover:border-indigo-100/50"
                          title="Download Document"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-neutral-400 font-bold italic">
                    No core admission documents uploaded for this student.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provisional Admission Documents Section */}
      {provisionalDocuments && provisionalDocuments.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/80 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <h3 className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <Layers size={16} /> Provisional Admission Semester Documents
            </h3>
            <span className="text-xs text-neutral-400 font-bold">{provisionalDocuments.length} File(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#111111] dark:bg-neutral-950 text-white uppercase font-extrabold border-b border-neutral-800">
                <tr className="bg-[#111111] dark:bg-neutral-950 border-b border-neutral-800 text-[10px] font-black uppercase tracking-widest text-white">
                  <th className="py-4.5 px-6 text-white">Document</th>
                  <th className="py-4.5 px-6 text-white">Original File</th>
                  <th className="py-4.5 px-6 text-center text-white">Status</th>
                  <th className="py-4.5 px-6 text-right text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {provisionalDocuments.map((doc: any) => (
                  <tr key={doc.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/40 transition-colors">
                    <td className="py-4.5 px-6 font-bold text-xs text-neutral-800 dark:text-neutral-200">
                      {doc.name}
                    </td>
                    <td className="py-4.5 px-6 font-mono text-[10px] text-neutral-400 dark:text-neutral-500 max-w-xs truncate">
                      {doc.originalFileName || 'document'}
                    </td>
                    <td className="py-4.5 px-6 text-center">
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md border uppercase tracking-wider ${
                        doc.verificationStatus === 'VERIFIED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                        doc.verificationStatus === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                        'bg-amber-50 text-amber-600 border-amber-200'
                      }`}>
                        {doc.verificationStatus || 'SUBMITTED'}
                      </span>
                    </td>
                    <td className="py-4.5 px-6 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleAction(doc.name, 'view', doc.previewUrl, doc.isPdf)}
                          className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all cursor-pointer border border-transparent hover:border-indigo-100/50"
                          title="Preview Document"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleAction(doc.name, 'download', doc.downloadUrl, doc.isPdf)}
                          className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all cursor-pointer border border-transparent hover:border-indigo-100/50"
                          title="Download Document"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStudentDocumentsPage;

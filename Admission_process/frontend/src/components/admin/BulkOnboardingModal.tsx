import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Users, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react';
import API from '../../services/api';

interface BulkOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * BulkOnboardingModal — allows admin to upload a CSV and bulk-create student accounts.
 */
export const BulkOnboardingModal: React.FC<BulkOnboardingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) {
      setFile(picked);
      setResult(null);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await API.post('/admin/users/bulk-onboard', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setResult(res.data.data ?? { created: 0, skipped: 0, errors: [] });
        onSuccess?.();
      } else {
        setError(res.data.message || 'Upload failed.');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'An error occurred during upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setError('');
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-violet-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Bulk Student Onboarding</h2>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Template Download */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Download CSV Template</p>
              <p className="text-xs text-slate-400 mt-0.5">Use this template for proper column formatting.</p>
            </div>
            <a
              href="/templates/student_bulk_template.csv"
              download
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 rounded-lg transition-colors"
            >
              <Download size={13} />
              Template
            </a>
          </div>

          {/* File Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">
              Upload CSV File
            </label>
            <label className="flex flex-col items-center justify-center gap-2 w-full h-28 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-violet-400 transition-colors bg-slate-50 dark:bg-slate-800/50">
              <Upload size={22} className="text-slate-400" />
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {file ? file.name : 'Click to select a .csv file'}
              </span>
              <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          {/* Result */}
          {result && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={15} className="text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Upload Complete</p>
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                {result.created} created · {result.skipped} skipped
                {result.errors.length > 0 && ` · ${result.errors.length} errors`}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-700">
              <AlertCircle size={15} className="text-rose-500 flex-shrink-0" />
              <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {uploading && <Loader2 size={14} className="animate-spin" />}
            {uploading ? 'Uploading…' : 'Upload & Create'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BulkOnboardingModal;

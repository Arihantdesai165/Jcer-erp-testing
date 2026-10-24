import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Mail, ShieldCheck, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';
import emailChangeService from '../../services/emailChange.service';
import OtpInputBox from '../common/OtpInputBox';

interface UpdateEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string;
  onSuccess: (newEmail: string) => void;
}

export const UpdateEmailModal: React.FC<UpdateEmailModalProps> = ({
  isOpen,
  onClose,
  currentEmail,
  onSuccess,
}) => {
  const [step, setStep] = useState<'ENTER_EMAIL' | 'VERIFY_OTP'>('ENTER_EMAIL');
  const [newEmail, setNewEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset modal state on open/close
  useEffect(() => {
    if (isOpen) {
      setStep('ENTER_EMAIL');
      setNewEmail('');
      setOtpDigits(['', '', '', '', '', '']);
      setLoading(false);
      setErrorMessage(null);
      setCooldown(0);
    }
  }, [isOpen]);

  // Cooldown countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!isOpen) return null;

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const normalized = newEmail.trim().toLowerCase();
    if (!normalized) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (normalized === currentEmail.trim().toLowerCase()) {
      setErrorMessage('New email address must be different from your current email.');
      return;
    }

    setLoading(true);
    try {
      const res = await emailChangeService.requestEmailChange(normalized);
      if (res.success) {
        toast.success(res.message || 'Verification OTP sent to the new email address.');
        setStep('VERIFY_OTP');
        setCooldown(45);
        setOtpDigits(['', '', '', '', '', '']);
      } else {
        setErrorMessage(res.error || 'Failed to send OTP.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Unable to update email right now. Please try again.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || loading) return;
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await emailChangeService.requestEmailChange(newEmail.trim().toLowerCase());
      if (res.success) {
        toast.success('Fresh verification OTP sent to your new email address.');
        setCooldown(45);
        setOtpDigits(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      } else {
        setErrorMessage(res.error || 'Failed to resend OTP.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Unable to resend OTP. Please try again.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otpDigits];
    newOtp[index] = value.slice(-1);
    setOtpDigits(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) {
      const digits = pasted.split('');
      setOtpDigits(digits);
      otpInputRefs.current[5]?.focus();
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await emailChangeService.verifyEmailChange(fullOtp);
      if (res.success && res.email) {
        toast.success('🎉 Email address updated successfully!');
        onSuccess(res.email);
        onClose();
      } else {
        setErrorMessage(res.error || 'Invalid verification code. Please try again.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Unable to update email right now. Please try again.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div 
        className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-neutral-900 dark:text-white text-base">
                {step === 'ENTER_EMAIL' ? 'Update Email Address' : 'Verify New Email'}
              </h3>
              <p className="text-[11px] font-semibold text-neutral-400">
                {step === 'ENTER_EMAIL' ? 'Step 1 of 2 — Request OTP' : 'Step 2 of 2 — Security Verification'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="flex items-start space-x-2.5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl text-xs text-rose-700 dark:text-rose-300 font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {step === 'ENTER_EMAIL' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-neutral-500 uppercase tracking-wider block">
                  Current Email Address
                </label>
                <input
                  type="text"
                  readOnly
                  value={currentEmail}
                  className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/80 rounded-xl text-xs font-bold text-neutral-500 dark:text-neutral-400 cursor-not-allowed select-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider block">
                  New Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="enter new email address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all disabled:opacity-50"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !newEmail.trim()}
                  className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-md disabled:opacity-50 transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending OTP...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Send Verification OTP</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-3.5 text-center">
                <p className="text-xs text-neutral-600 dark:text-neutral-300 font-semibold">
                  OTP sent to:
                </p>
                <p className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {newEmail.trim().toLowerCase()}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-extrabold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider block text-center">
                  Enter verification code
                </label>

                <OtpInputBox
                  value={otpDigits.join('')}
                  onChange={(val) => setOtpDigits(Array.from({ length: 6 }, (_, i) => val[i] || ''))}
                  onEnterSubmit={() => handleVerifyOtp()}
                  disabled={loading}
                />
              </div>

              <div className="pt-2 space-y-3">
                <button
                  type="submit"
                  disabled={loading || otpDigits.join('').length !== 6}
                  className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-md disabled:opacity-50 transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify & Update Email</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs pt-1 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('ENTER_EMAIL');
                      setErrorMessage(null);
                    }}
                    disabled={loading}
                    className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white font-bold transition-colors cursor-pointer"
                  >
                    ← Change Email
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading || cooldown > 0}
                    className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-extrabold disabled:opacity-50 transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>
                      {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default UpdateEmailModal;

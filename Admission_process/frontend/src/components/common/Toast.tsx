import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const isSuccess = type === 'success';

  const content = (
    <div className="fixed top-5 right-5 z-[9999999] pointer-events-auto animate-slide-in">
      <div
        className={`flex items-center space-x-3 px-5 py-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 ${
          isSuccess
            ? 'bg-emerald-950/95 text-emerald-200 border-emerald-500/40 shadow-emerald-950/50'
            : 'bg-rose-950/95 text-rose-200 border-rose-500/40 shadow-rose-950/50'
        }`}
      >
        <span className="text-xl shrink-0">{isSuccess ? '✅' : '❌'}</span>
        <div className="text-sm font-semibold tracking-wide">{message}</div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors duration-150 pl-2 focus:outline-none cursor-pointer"
        >
          ✕
        </button>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }

  return content;
};

export default Toast;

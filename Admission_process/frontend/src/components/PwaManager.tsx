/// <reference types="vite-plugin-pwa/react" />
import React, { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, RefreshCw, X } from 'lucide-react';
import pwaManager from '../utils/pwaManager';

const PwaManager: React.FC = () => {
    // ─── PWA Update Lifecycle ───
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisterError(error) {
            console.error('PWA service worker registration error:', error);
        }
    });

    useEffect(() => {
        pwaManager.registerServiceWorkerUpdater(updateServiceWorker);
    }, [updateServiceWorker]);

    // ─── Custom PWA Install Banner ───
    const [canInstallBanner, setCanInstallBanner] = useState(pwaManager.canInstallApp());

    useEffect(() => {
        const unsubscribe = pwaManager.onPwaStateChange(() => {
            setCanInstallBanner(pwaManager.canInstallApp());
        });
        return () => unsubscribe();
    }, []);

    const handleInstallClick = async () => {
        await pwaManager.installApp();
    };

    const handleVersionRefreshClick = async () => {
        await pwaManager.refreshApp();
    };

    return (
        <div className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:right-6 md:w-96 z-[9999] flex flex-col gap-3 font-sans">
            
            {/* 1. App Update Banner */}
            {needRefresh && (
                <div className="bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-800 p-4 md:p-5 flex flex-col gap-3.5 animate-slide-in backdrop-blur-md bg-opacity-95">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3">
                            <div className="size-10 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                                <RefreshCw className="size-5 animate-spin" />
                            </div>
                            <div className="space-y-0.5">
                                <h4 className="text-sm font-bold tracking-tight">New version available</h4>
                                <p className="text-[11px] text-slate-400 leading-normal">JCER ERP has been updated. Refresh now to experience the latest features.</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setNeedRefresh(false)}
                            className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-800 rounded transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button 
                            onClick={() => setNeedRefresh(false)}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                        >
                            Later
                        </button>
                        <button 
                            onClick={handleVersionRefreshClick}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            <RefreshCw size={13} />
                            Refresh App
                        </button>
                    </div>
                </div>
            )}

            {/* 3. Custom Install Prompt Banner */}
            {canInstallBanner && (
                <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl shadow-deep border border-slate-200 dark:border-slate-800 p-5 flex flex-col gap-4 animate-slide-in">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3">
                            <div className="size-11 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-800 shadow-sm bg-slate-50 dark:bg-slate-950">
                                <img src="/logo.png" alt="JCER Logo" className="size-9 object-contain" />
                            </div>
                            <div className="space-y-0.5">
                                <h4 className="text-sm font-extrabold tracking-tight">Install JCER ERP</h4>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">Add JCER ERP to your home screen for quick access to your dashboard, attendance, and academic records.</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setCanInstallBanner(false)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button 
                            onClick={() => setCanInstallBanner(false)}
                            className="px-3.5 py-2 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                            Later
                        </button>
                        <button 
                            onClick={handleInstallClick}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            <Download size={14} />
                            Install App
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PwaManager;

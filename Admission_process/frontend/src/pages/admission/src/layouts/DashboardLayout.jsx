import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    Users,
    FileText,
    LogOut,
    HelpCircle,
    Download,
    RefreshCw,
} from 'lucide-react';
import AdmissionHeader from '../components/AdmissionHeader';
import usePwa from '../../../../hooks/usePwa';
import PwaConfirmationModal from '../../../../components/common/PwaConfirmationModal';
import GlobalFooter from '../../../../components/common/GlobalFooter';

const DashboardLayout = () => {
    const { user, logout } = useAuth();
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [headerHeight, setHeaderHeight] = useState(72);
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
    const headerRef = useRef(null);

    const { canInstall, handleInstall, triggerRefresh, confirmRefresh, showRefreshModal, setShowRefreshModal } = usePwa();

    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

    useEffect(() => {
        const updateHeaderHeight = () => {
            if (headerRef.current) {
                setHeaderHeight(headerRef.current.offsetHeight);
            }
            setIsMobile(window.innerWidth < 1024);
        };

        updateHeaderHeight();
        window.addEventListener('resize', updateHeaderHeight);

        let observer;
        if (headerRef.current && typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(updateHeaderHeight);
            observer.observe(headerRef.current);
        }

        return () => {
            window.removeEventListener('resize', updateHeaderHeight);
            if (observer) observer.disconnect();
        };
    }, []);

    const getNavItems = () => {
        if (user?.role === 'STUDENT') {
            return [
                { name: 'Dashboard', path: '/admission/dashboard', icon: LayoutDashboard },
                { name: 'Admission Form', path: '/admission/application', icon: FileText },
            ];
        } else {
            return [
                { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
                { name: 'Student Directory', path: '/admin/students', icon: Users },
            ];
        }
    };

    const navItems = getNavItems();

    return (
        <div className="admission-portal-theme h-screen w-full bg-[#f3f4f6] flex flex-col overflow-hidden">
            {/* Sticky Fixed Header - Always visible at z-50 */}
            <AdmissionHeader headerRef={headerRef} toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />

            {/* Layout Wrapper Below Header */}
            <div className="flex-1 flex min-w-0 overflow-hidden relative">
                {/* Mobile Sidebar Backdrop Overlay - Opens below header */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-xs"
                        style={{ top: `${headerHeight}px` }}
                        onClick={toggleSidebar}
                    />
                )}

                {/* Mobile Drawer & Desktop Sidebar - Starts cleanly below header on mobile */}
                <aside 
                    className={`
                        fixed lg:static bottom-0 left-0 z-40
                        w-[260px] bg-white border-r border-slate-200
                        transform transition-transform duration-300 ease-in-out
                        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                        flex flex-col flex-shrink-0 lg:h-full overflow-y-auto shadow-lg lg:shadow-none
                    `}
                    style={{
                        top: isMobile ? `${headerHeight}px` : undefined,
                        height: isMobile ? `calc(100vh - ${headerHeight}px)` : undefined,
                    }}
                >
                    <div className="py-3.5 px-6 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
                        <span className="font-bold text-xs text-slate-700 tracking-wider uppercase block">Navigation Menu</span>
                    </div>

                    <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.path}
                                className={({ isActive }) => `
                                    flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                                    ${isActive
                                        ? 'bg-primary-50 text-primary-700 font-semibold'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                `}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <item.icon size={18} className="text-current shrink-0" />
                                <span className="truncate">{item.name}</span>
                            </NavLink>
                        ))}

                        <div className="pt-5 pb-1 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                            System
                        </div>

                        <NavLink
                            to="/admission/support"
                            className={({ isActive }) => `
                                flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                                ${isActive ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                            `}
                            onClick={() => setSidebarOpen(false)}
                        >
                            <HelpCircle size={18} className="text-current shrink-0" />
                            <span className="truncate">Support</span>
                        </NavLink>

                        <button
                            onClick={() => { setSidebarOpen(false); handleInstall(); }}
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                        >
                            <Download size={18} className="shrink-0 text-primary-600" />
                            <span className="truncate">Install App</span>
                        </button>

                        <button
                            onClick={() => { setSidebarOpen(false); triggerRefresh(); }}
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                        >
                            <RefreshCw size={18} className="shrink-0 text-primary-600" />
                            <span className="truncate">Refresh App</span>
                        </button>

                        <button
                            onClick={logout}
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                            <LogOut size={18} className="shrink-0 text-current" />
                            <span className="truncate">Logout</span>
                        </button>
                    </nav>

                    <div className="p-3 mt-auto mb-4 mx-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2.5 flex-shrink-0">
                        <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm shrink-0">
                            {user?.name?.[0]?.toUpperCase() || 'S'}
                        </div>
                        <div className="flex-grow min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{user?.name || "Student User"}</p>
                            <p className="text-xs text-slate-500 truncate">ID: {user?.id?.substring(0,8) || `ADM-${new Date().getFullYear()}`}</p>
                        </div>
                    </div>
                </aside>

                <PwaConfirmationModal
                    isOpen={showRefreshModal}
                    onClose={() => setShowRefreshModal(false)}
                    onConfirm={confirmRefresh}
                />

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#f3f4f6] relative z-10 p-4 sm:p-6 lg:p-8">
                    <div 
                        className="fixed inset-y-0 right-0 left-0 lg:left-[260px] pointer-events-none flex items-center justify-center z-0 overflow-hidden"
                        aria-hidden="true"
                    >
                        <img 
                            src="/emaillogo.png" 
                            alt="" 
                            className="w-[620px] h-[620px] max-w-[70vw] max-h-[70vh] object-contain opacity-[0.045] select-none" 
                        />
                    </div>
                    <div className="max-w-[1200px] mx-auto w-full animate-fade-in flex-1 relative z-10">
                        <Outlet />
                    </div>
                    <GlobalFooter className="mt-auto relative z-20" />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;

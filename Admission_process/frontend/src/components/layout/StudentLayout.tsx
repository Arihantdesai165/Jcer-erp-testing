import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/authSlice';
import { RootState } from '../../store';
import { GlobalFooter } from '../common/GlobalFooter';
import {
  LayoutDashboard,
  CalendarCheck,
  Award,
  User,
  LogOut,
  Building2,
  Menu,
  X,
  ChevronDown,
  WifiOff,
  Download,
  RefreshCw,
  Share,
} from 'lucide-react';
import usePwa from '../../hooks/usePwa';
import PwaConfirmationModal from '../common/PwaConfirmationModal';
import { useAcademicYear } from '../../context/AcademicYearContext';
import AcademicYearSelector from '../common/AcademicYearSelector';
import { ProfileAvatar } from '../common/ProfileAvatar';

interface MenuItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

export const StudentLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Online / Offline state detection
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // iOS detection for Safari Add to Home Screen guidance
  const isIos =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream;
  const [showIosInstallModal, setShowIosInstallModal] = useState(false);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.dataset.portal = 'student';
    return () => {
      delete document.body.dataset.portal;
    };
  }, []);

  const {
    canInstall,
    isInstalled,
    handleInstall,
    showRefreshModal,
    setShowRefreshModal,
    triggerRefresh,
    confirmRefresh,
  } = usePwa();

  const handleInstallAppClick = async () => {
    setProfileMenuOpen(false);
    if (canInstall) {
      await handleInstall();
    } else if (isIos && !isInstalled) {
      setShowIosInstallModal(true);
    } else {
      await handleInstall();
    }
  };

  const handleLogout = () => {
    setProfileMenuOpen(false);
    dispatch(logout());
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const studentName = user?.name || 'Student';
  const usn = (user as any)?.usn || (user as any)?.username || user?.id || 'STUDENT';
  const deptCode = user?.department?.code || 'CSE';
  const { academicYear } = useAcademicYear();

  // Navigation menu items: Dashboard, Attendance, and Marks
  const menuItems: MenuItem[] = [
    { name: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
    { name: 'Attendance', path: '/student/attendance', icon: CalendarCheck },
    { name: 'Marks', path: '/student/marks', icon: Award },
  ];

  // Top header quick pill navigation tabs (Matching desktop)
  const subNavTabs = [
    { name: 'Dashboard', path: '/student/dashboard' },
    { name: 'Attendance', path: '/student/attendance' },
    { name: 'Marks', path: '/student/marks' },
  ];

  const getActiveNavPath = (currentPath: string): string => {
    if (currentPath === '/student' || currentPath === '/student/overview' || currentPath.startsWith('/student/dashboard')) {
      return '/student/dashboard';
    }
    if (currentPath.startsWith('/student/attendance')) return '/student/attendance';
    if (currentPath.startsWith('/student/marks')) return '/student/marks';
    if (currentPath.startsWith('/student/profile')) return '/student/profile';
    return '/student/dashboard';
  };

  const activeNavPath = getActiveNavPath(location.pathname);

  const getPageTitle = () => {
    switch (activeNavPath) {
      case '/student/profile':
        return 'Student Profile';
      case '/student/attendance':
        return 'Attendance Tracker';
      case '/student/marks':
        return 'Marks & CIE Results';
      case '/student/dashboard':
      default:
        return 'Student Dashboard';
    }
  };

  const getPageSubtitle = () => {
    switch (activeNavPath) {
      case '/student/profile':
        return 'Official enrollment and personal profile details';
      case '/student/attendance':
        return 'Dynamic session attendance and subject percentages';
      case '/student/marks':
        return 'Approved and published Continuous Internal Evaluation (CIE) results';
      case '/student/dashboard':
      default:
        return 'Academic overview, subject status & performance';
    }
  };

  return (
    <div
      data-portal="student"
      className="portal-table-center min-h-screen max-w-full overflow-x-hidden flex flex-col text-neutral-900 dark:text-neutral-100 transition-colors duration-300 font-sans"
    >
      {/* ── OFFLINE STATUS BANNER ── */}
      {!isOnline && (
        <aside
          role="status"
          aria-live="polite"
          className="sticky top-0 z-[60] bg-amber-600 dark:bg-amber-700 text-white text-xs font-semibold px-4 py-2 text-center flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>You are offline. Reconnect to view the latest attendance and academic information.</span>
        </aside>
      )}

      {/* ── MOBILE BACKDROP FOR OPTIONAL DRAWER ── */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-neutral-950/50 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* ── FLOATING SIDEBAR (DESKTOP) ── */}
      <aside
        className={`fixed left-6 top-6 bottom-6 w-[280px] min-w-[280px] max-w-[280px] flex-shrink-0 flex flex-col justify-between py-6 px-4 rounded-[32px] glass-bar z-50 transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-[320px] lg:translate-x-0'
        }`}
      >
        {/* Top: Logo + Nav */}
        <div className="flex flex-col w-full min-h-0">
          <div className="flex items-center justify-between px-1.5 mb-5">
            <Link to="/student/dashboard" className="flex items-center space-x-2.5 hover:opacity-95 transition-all">
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-neutral-100 dark:border-neutral-800 shadow-sm">
                <img
                  src="/logo.png"
                  alt="JCER Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-[15px] tracking-wider uppercase text-neutral-900 dark:text-white leading-none">
                  JCER ERP
                </span>
                <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Student Portal
                </span>
              </div>
            </Link>

            {/* Mobile close button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col space-y-3 overflow-y-auto max-h-[calc(100vh-270px)] pr-1 select-none custom-scrollbar">
            <div className="flex flex-col space-y-0.5">
              <span className="px-3.5 text-[9px] font-black tracking-widest text-neutral-400 dark:text-neutral-500 uppercase mb-1">
                ACADEMICS & RESULTS
              </span>
              <div className="flex flex-col space-y-0.5">
                {menuItems.map((item) => {
                  const isActive = item.path === activeNavPath;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      className={`w-full h-[38px] px-3.5 rounded-xl flex items-center justify-between transition-all duration-150 relative group border ${
                        isActive
                          ? 'bg-gradient-to-r from-[#070e22] via-[#0c1a40] to-[#0f245c] text-white font-bold shadow-md shadow-[#070e22]/25 border-[#1e3a8a]/50'
                          : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:bg-gradient-to-r hover:from-[#070e22] hover:via-[#0c1a40] hover:to-[#0f245c] hover:!text-white hover:border-[#1e3a8a]/40 hover:shadow-sm'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3.5px] h-4.5 bg-cyan-400 rounded-r shadow-xs shadow-cyan-400/50" />
                      )}
                      <div className="flex items-center space-x-3 min-w-0">
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 transition-colors duration-150 ${
                            isActive
                              ? 'text-cyan-300'
                              : 'text-neutral-400 group-hover:!text-cyan-300'
                          }`}
                          strokeWidth={isActive ? 2.5 : 2}
                        />
                        <span
                          className={`text-[11px] font-semibold transition-colors duration-150 truncate ${
                            isActive
                              ? 'text-white font-bold'
                              : 'text-neutral-700 dark:text-neutral-300 group-hover:!text-white'
                          }`}
                        >
                          {item.name}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>

        {/* Bottom Footer matching HOD/Faculty style */}
        <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/40 flex flex-col gap-2.5 w-full">
          <div className="rounded-xl p-2.5 border text-[10px] space-y-1 bg-neutral-50/50 dark:bg-neutral-800/25 border-neutral-200/50 dark:border-neutral-800/55">
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-medium">Role</span>
              <span className="font-extrabold text-neutral-800 dark:text-neutral-200">STUDENT</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-medium">Department</span>
              <span className="font-extrabold text-neutral-800 dark:text-neutral-200">
                {deptCode}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-medium">Semester</span>
              <span className="font-extrabold text-neutral-800 dark:text-neutral-200">
                Sem {(user as any)?.semester || 1}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-medium">Academic Year</span>
              <span className="font-extrabold text-neutral-800 dark:text-neutral-200">{academicYear || '2026-27'}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 text-[10px] font-bold hover:underline px-1 py-0.5 shrink-0 text-rose-600 dark:text-rose-400"
          >
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 px-3 sm:px-4 md:px-6 lg:pl-[320px] lg:pr-6 pb-24 lg:pb-10 pt-3 sm:pt-6">

        {/* ── 1. COMPACT MOBILE HEADER (< lg) ── */}
        <header className="flex lg:hidden items-center justify-between py-2 mb-4 z-30 gap-2 border-b border-neutral-200/60 dark:border-neutral-800/60 pb-3">
          {/* Logo & Compact Title */}
          <Link to="/student/dashboard" className="flex items-center gap-2.5 min-w-0 flex-shrink">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-neutral-200 dark:border-neutral-800 shadow-xs">
              <img
                src="/logo.png"
                alt="JCER Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-black text-sm tracking-wide text-neutral-900 dark:text-white leading-tight truncate">
                JCER ERP
              </span>
              <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 truncate">
                Dept: {deptCode} • Sem {(user as any)?.semester || 1}
              </span>
            </div>
          </Link>

          {/* Right Mobile Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Compact Academic Year Selector */}
            <AcademicYearSelector compact={true} />

            {/* Profile Avatar & Dropdown Trigger */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                aria-label="Student profile menu"
                aria-expanded={profileMenuOpen}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs cursor-pointer select-none"
              >
                <ProfileAvatar
                  imageUrl={user?.profileImage}
                  name={studentName}
                  size="xs"
                  className="w-7 h-7 rounded-full"
                />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-neutral-900 shadow-xl border border-neutral-200/80 dark:border-neutral-800 p-2 z-50 animate-in fade-in duration-150">
                  <div className="px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800">
                    <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">{studentName}</p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate font-mono">{usn}</p>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300">
                        {deptCode} Dept
                      </span>
                      <span className="text-[9px] font-bold text-neutral-400">
                        Sem {(user as any)?.semester || 1}
                      </span>
                      {academicYear && (
                        <span className="text-[9px] font-bold text-neutral-400">
                          AY: {academicYear}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/student/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <User className="w-3.5 h-3.5 text-neutral-500" />
                      <span>My Profile</span>
                    </Link>

                    {/* Unobtrusive Install App Option */}
                    {(!isInstalled || canInstall || isIos) && (
                      <button
                        onClick={handleInstallAppClick}
                        className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors text-left cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Install App (PWA)</span>
                      </button>
                    )}

                    {/* Refresh Cache / SW App Update */}
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        triggerRefresh();
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Sync & Reset App</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-neutral-100 dark:border-neutral-800">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── 2. DESKTOP HEADER (lg:) ── */}
        <header className="hidden lg:flex flex-row items-center justify-between py-4 mb-6 z-30 gap-6">
          {/* Page Title */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex-shrink-0">
              <h1 className="text-xl md:text-2xl lg:text-[26px] font-bold tracking-tight text-neutral-900 dark:text-white whitespace-nowrap leading-tight">
                {getPageTitle()}
              </h1>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium whitespace-nowrap">
                {getPageSubtitle()}
              </p>
            </div>
          </div>

          {/* Sub-Nav Pill Navigation Bar */}
          <div className="flex items-center bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md p-1 rounded-full border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex-shrink-0">
            {subNavTabs.map((tab) => {
              const isActive = activeNavPath === tab.path;
              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 select-none ${
                    isActive
                      ? 'bg-[#18181b] dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {tab.name}
                </Link>
              );
            })}
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Department Context Badge */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 text-xs font-bold shadow-xs">
              <Building2 className="w-3.5 h-3.5 text-neutral-500" />
              <span>Dept: <strong>{deptCode}</strong></span>
            </div>

            {/* Authoritative Global Academic Year Selector */}
            <AcademicYearSelector />

            {/* Profile Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className="flex items-center space-x-2 header-dark-btn h-9 pl-1.5 pr-3 py-1 rounded-full shadow-sm cursor-pointer hover:scale-[1.02] transition-all select-none"
              >
                <ProfileAvatar
                  imageUrl={user?.profileImage}
                  name={studentName}
                  size="xs"
                  className="w-6 h-6 rounded-full shadow-xs"
                />
                <span className="text-xs font-semibold pr-0.5 block max-w-[120px] truncate">
                  {studentName.split(' ')[0]}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 opacity-80 block transition-transform duration-200 ${profileMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-neutral-900 shadow-xl border border-neutral-200/80 dark:border-neutral-800 p-2 z-50 animate-in fade-in duration-150">
                  <div className="px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800">
                    <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">{studentName}</p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate font-mono">{usn}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300">
                        {deptCode} Dept
                      </span>
                      <span className="text-[9px] font-bold text-neutral-400">
                        Sem {(user as any)?.semester || 1}
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/student/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <User className="w-3.5 h-3.5 text-neutral-500" />
                      <span>My Profile</span>
                    </Link>

                    {/* Unobtrusive Install App Option */}
                    {(!isInstalled || canInstall || isIos) && (
                      <button
                        onClick={handleInstallAppClick}
                        className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors text-left cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Install App (PWA)</span>
                      </button>
                    )}

                    {/* Refresh Cache / SW App Update */}
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        triggerRefresh();
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Sync & Reset App</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-neutral-100 dark:border-neutral-800">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── DYNAMIC PAGE CONTENT ── */}
        <main className="flex-1 min-w-0 flex flex-col relative">
          <div
            className="fixed inset-y-0 right-0 left-0 lg:left-[320px] pointer-events-none flex items-center justify-center z-0 overflow-hidden"
            aria-hidden="true"
          >
            <img
              src="/emaillogo.png"
              alt=""
              className="w-[620px] h-[620px] max-w-[70vw] max-h-[70vh] object-contain opacity-[0.045] dark:opacity-[0.025] select-none"
            />
          </div>
          <div className="relative z-10 flex-1 flex flex-col">
            <Outlet />
          </div>
        </main>

        <GlobalFooter className="mt-auto relative z-20" />
      </div>

      {/* ── MOBILE FIXED BOTTOM NAVIGATION BAR (< lg) ── */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-lg border-t border-neutral-200/80 dark:border-neutral-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]"
      >
        <div className="grid grid-cols-3 gap-1 max-w-md mx-auto">
          {menuItems.map((item) => {
            const isActive = item.path === activeNavPath;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all duration-200 select-none min-h-[48px] relative ${
                  isActive
                    ? 'text-indigo-600 dark:text-cyan-400 font-bold'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 font-medium'
                }`}
              >
                {isActive && (
                  <span className="absolute inset-0 bg-indigo-50/80 dark:bg-cyan-950/30 rounded-2xl -z-10" />
                )}
                <Icon
                  className={`w-5 h-5 mb-1 transition-transform duration-200 ${
                    isActive ? 'scale-110' : ''
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className="text-[11px] leading-none tracking-tight">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── iOS SAFARI INSTALL INSTRUCTIONS MODAL ── */}
      {showIosInstallModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 relative shadow-2xl">
            <button
              onClick={() => setShowIosInstallModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 hover:text-neutral-800 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-neutral-900 dark:text-white">Install JCER ERP</h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">iOS Safari Instructions</p>
              </div>
            </div>
            <div className="space-y-3 text-xs text-neutral-700 dark:text-neutral-300">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-800">
                <span className="font-black text-indigo-600 dark:text-indigo-400">1</span>
                <p>Tap the <strong>Share</strong> button <Share className="inline w-3.5 h-3.5 -mt-0.5" /> in Safari's bottom toolbar.</p>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-800">
                <span className="font-black text-indigo-600 dark:text-indigo-400">2</span>
                <p>Scroll down and select <strong>"Add to Home Screen"</strong>.</p>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-800">
                <span className="font-black text-indigo-600 dark:text-indigo-400">3</span>
                <p>Tap <strong>"Add"</strong> in the top right corner to install.</p>
              </div>
            </div>
            <button
              onClick={() => setShowIosInstallModal(false)}
              className="w-full mt-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ── PWA REFRESH MODAL ── */}
      <PwaConfirmationModal
        isOpen={showRefreshModal}
        onClose={() => setShowRefreshModal(false)}
        onConfirm={confirmRefresh}
      />
    </div>
  );
};

export default StudentLayout;

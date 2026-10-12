import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/authSlice';
import API from '../../services/api';
import { RootState } from '../../store';
import { GlobalFooter } from '../common/GlobalFooter';
import {
  LayoutDashboard,
  Calendar,
  Building2,
  Layers,
  Grid,
  BookOpen,
  UserCheck,
  UserPlus,
  Users,
  ShieldCheck,
  ClipboardList,
  History,
  LogOut,
  Sun,
  Moon,
  ChevronDown,
  User,
  Shield,
  FileCheck2,
  Archive,
  Cloud,
} from 'lucide-react';
import deanService from '../../services/dean.service';
import usePwa from '../../hooks/usePwa';
import useDeanNotificationCount from '../../hooks/useDeanNotificationCount';
import PwaConfirmationModal from '../common/PwaConfirmationModal';
import { ProfileAvatar } from '../common/ProfileAvatar';

interface MenuItem {
  name: string;
  path: string;
  icon: React.ElementType;
  badge?: number;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export const DeanLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  const [academicYear, setAcademicYear] = useState<string>('2026-27');
  const { count: pendingAuthCount, refreshCount } = useDeanNotificationCount({ pollingIntervalMs: 10000 });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [isDark, setIsDark] = useState(false);

  const refreshDeanMetadata = () => {
    deanService.getDashboardData()
      .then((data) => {
        if (data.academicYear) setAcademicYear(data.academicYear);
      })
      .catch((err) => console.warn('Could not load Dean dashboard metadata:', err));
    refreshCount();
  };

  useEffect(() => {
    refreshDeanMetadata();
  }, [location.pathname]);

  useEffect(() => {
    document.body.dataset.portal = 'dean';
    return () => {
      delete document.body.dataset.portal;
    };
  }, []);

  useEffect(() => {
    const handleYearChanged = (e: any) => {
      if (e?.detail?.year) {
        setAcademicYear(e.detail.year);
      }
      refreshDeanMetadata();
    };

    window.addEventListener('academic-year-changed', handleYearChanged);
    return () => {
      window.removeEventListener('academic-year-changed', handleYearChanged);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { canInstall, handleInstall, triggerRefresh, confirmRefresh, showRefreshModal, setShowRefreshModal } = usePwa();

  const handleLogout = () => {
    dispatch(logout());
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const menuGroups: MenuGroup[] = [
    {
      title: 'OVERVIEW',
      items: [
        { name: 'Dashboard', path: '/dean/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'ACADEMIC STRUCTURE',
      items: [
        { name: 'Departments', path: '/dean/academic/departments', icon: Building2 },
      ],
    },
    {
      title: 'HOD MANAGEMENT',
      items: [
        { name: 'HOD List', path: '/dean/hods', icon: Users },
        { name: 'Create HOD', path: '/dean/hods/create', icon: UserPlus },
        { name: 'HOD Assignments', path: '/dean/hods/assignments', icon: UserCheck },
        { name: 'HOD History', path: '/dean/hods/history', icon: History },
      ],
    },
    {
      title: 'FACULTY MANAGEMENT',
      items: [
        { name: 'Faculty List', path: '/dean/faculty', icon: Users },
        { name: 'Create Faculty', path: '/dean/faculty/create', icon: UserPlus },
        { name: 'Archived Faculty', path: '/dean/faculty/archived', icon: Archive },
        { name: 'Faculty Assignments', path: '/dean/faculty/assignments', icon: FileCheck2 },
      ],
    },
    {
      title: 'ACCOUNT & SETTINGS',
      items: [
        { name: 'My Profile', path: '/dean/profile', icon: User },
        { name: 'Google Drive Backup', path: '/dean/settings/google-drive', icon: Cloud },
      ],
    },
  ];

  const pageTitles: Record<string, string> = {
    '/dean/dashboard': 'Dean Academics Overview',
    '/dean/profile': 'Dean Profile & Security Settings',
    '/dean/settings/google-drive': 'Google Drive Attendance Backup',
    '/dean/academic/departments': 'Departments Directory',
    '/dean/hods': 'HOD Directory & Management',
    '/dean/hods/create': 'Register New HOD',
    '/dean/hods/assignments': 'Assign HOD to Department',
    '/dean/hods/history': 'HOD Assignment History',
    '/dean/faculty': 'Faculty Directory',
    '/dean/faculty/create': 'Create Faculty',
    '/dean/faculty/bulk-import': 'Bulk Faculty Import',
    '/dean/faculty/archived': 'Archived Faculty Directory',
    '/dean/faculty/assignments': 'Academic Faculty Assignments',
  };

  const getPageTitle = () => {
    if (location.pathname.startsWith('/dean/academic/departments/')) {
      return 'Department Academic Details';
    }
    if (location.pathname.startsWith('/dean/faculty/authorizations/')) {
      return 'Review Faculty Authorization';
    }
    if (location.pathname.startsWith('/dean/hods/') && location.pathname !== '/dean/hods/create' && location.pathname !== '/dean/hods/assignments' && location.pathname !== '/dean/hods/history') {
      return 'HOD Profile & History';
    }
    if (location.pathname.includes('/archive')) {
      return 'Archive Faculty Confirmation';
    }
    if (location.pathname.includes('/regenerate-password')) {
      return 'Regenerate Faculty Password';
    }
    if (location.pathname.startsWith('/dean/faculty/') && !['create', 'bulk-import', 'archived', 'authorizations', 'assignments'].some(segment => location.pathname.startsWith(`/dean/faculty/${segment}`))) {
      return 'Faculty Profile & Academic Record';
    }
    return pageTitles[location.pathname] || 'Dean Academics Portal';
  };

  return (
    <div
      data-portal="dean"
      className="portal-table-center min-h-screen max-w-full overflow-x-hidden flex text-neutral-900 dark:text-neutral-100 transition-colors duration-300 font-sans pb-6 pr-6"
    >

      {/* ── FLOATING SIDEBAR ── */}
      <aside className="fixed left-6 top-6 bottom-6 w-[280px] min-w-[280px] max-w-[280px] flex-shrink-0 flex flex-col justify-between py-6 px-4 rounded-[32px] glass-bar z-40">
        
        {/* Top: Logo + Navigation */}
        <div className="flex flex-col w-full">
          <Link to="/dean/dashboard" className="flex items-center space-x-2.5 px-1.5 mb-5 hover:opacity-95 transition-all">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-neutral-100 dark:border-neutral-850 shadow-sm">
              <img
                src="/emaillogo.png"
                alt="JCER Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-[15px] tracking-wider uppercase text-neutral-900 dark:text-white leading-none">JCER ERP</span>
              <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">Dean Academics</span>
            </div>
          </Link>

          {/* Grouped Navigation */}
          {(() => {
            const allNavPaths = menuGroups.flatMap((g) => g.items.map((i) => i.path));
            const getActiveNavPath = (currentPath: string): string => {
              if (allNavPaths.includes(currentPath)) {
                return currentPath;
              }
              const matchingPaths = allNavPaths.filter(
                (p) => p !== '/dean/dashboard' && currentPath.startsWith(p + '/')
              );
              if (matchingPaths.length > 0) {
                matchingPaths.sort((a, b) => b.length - a.length);
                return matchingPaths[0];
              }
              if (currentPath === '/dean' || currentPath.startsWith('/dean/dashboard')) {
                return '/dean/dashboard';
              }
              return currentPath;
            };
            const activeNavPath = getActiveNavPath(location.pathname);

            return (
              <nav className="flex flex-col space-y-3.5 overflow-y-auto max-h-[calc(100vh-270px)] pr-1 select-none custom-scrollbar">
                {menuGroups.map((group) => (
                  <div key={group.title} className="flex flex-col space-y-0.5">
                    <span className="px-3.5 text-[9px] font-black tracking-widest text-neutral-400 dark:text-neutral-500 uppercase mb-1">
                      {group.title}
                    </span>
                    <div className="flex flex-col space-y-0.5">
                      {group.items.map((item) => {
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
                            {item.badge !== undefined && item.badge > 0 && (
                              <span
                                aria-label={`${item.badge} pending faculty authorization request${item.badge > 1 ? 's' : ''}`}
                                title={`${item.badge} pending faculty authorization request${item.badge > 1 ? 's' : ''}`}
                                className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-xs shadow-rose-600/30 ring-2 ring-white dark:ring-neutral-900 leading-none flex-shrink-0 ml-auto"
                              >
                                {item.badge > 99 ? '99+' : item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            );
          })()}
        </div>

        {/* Bottom User Info & Logout */}
        <div className="pt-3 border-t border-neutral-105 dark:border-neutral-800/40 flex flex-col gap-2.5 w-full">
          <div className="rounded-xl p-2.5 border text-[10px] space-y-1 bg-neutral-50/50 dark:bg-neutral-800/25 border-neutral-200/50 dark:border-neutral-800/55">
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-medium">Role</span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400">Dean Academics</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-medium">Academic Year</span>
              <span className="font-bold text-neutral-800 dark:text-neutral-200">{academicYear}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all border border-rose-200/40 dark:border-rose-900/40"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 ml-[304px] pl-2 flex flex-col min-h-screen">
        
        {/* Top Header */}
        <header className="sticky top-6 z-30 h-16 rounded-2xl glass-header mb-6 flex items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            {/* Academic Year Pill */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-800 dark:text-cyan-300 text-xs font-bold shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
              <span>AY: {academicYear}</span>
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center space-x-2.5 p-1.5 pr-3 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all border border-neutral-200/60 dark:border-neutral-700/60"
              >
                <ProfileAvatar
                  imageUrl={user?.profileImage}
                  name={user?.name || `${user?.firstName || 'Dr. K.B.'} ${user?.lastName || 'Manwade'}`}
                  size="xs"
                  className="w-7 h-7 rounded-full shadow-xs"
                />

                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold leading-tight text-neutral-900 dark:text-white">
                    {user?.name || `${user?.firstName || 'Dr. K.B.'} ${user?.lastName || 'Manwade'}`}
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">
                    {user?.email || 'dean@college.com'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-neutral-900 shadow-xl border border-neutral-200/80 dark:border-neutral-800 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800">
                    <p className="text-xs font-bold text-neutral-900 dark:text-white">{user?.name || 'Dr. K.B. Manwade'}</p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">{user?.email || 'dean@college.com'}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      to="/dean/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:text-blue-700 dark:hover:text-cyan-400 transition-colors"
                    >
                      <User className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                      <span>My Profile</span>
                    </Link>
                  </div>
                  <div className="pt-1 border-t border-neutral-100 dark:border-neutral-800">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 pb-10 flex flex-col relative">
          <div 
            className="fixed inset-y-0 right-0 left-0 lg:left-[304px] pointer-events-none flex items-center justify-center z-0 overflow-hidden"
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

      <PwaConfirmationModal
        isOpen={showRefreshModal}
        onClose={() => setShowRefreshModal(false)}
        onConfirm={confirmRefresh}
      />
    </div>
  );
};

export default DeanLayout;

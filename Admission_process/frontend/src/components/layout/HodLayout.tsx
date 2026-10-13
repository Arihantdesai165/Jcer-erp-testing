import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/authSlice';
import { RootState } from '../../store';
import { GlobalFooter } from '../common/GlobalFooter';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  BookOpen,
  ClipboardList,
  Layers,
  CalendarCheck,
  AlertTriangle,
  Award,
  TrendingUp,
  BarChart3,
  FileText,
  Settings,
  User,
  LogOut,
  Building2,
  Search,
  Bell,
  ChevronDown,
  Clock,
  Menu,
  X,
  GraduationCap,
  CheckCircle2,
  Lock,
  UserCheck,
  Send,
} from 'lucide-react';
import hodService, { HodDashboardData } from '../../services/hod.service';
import usePwa from '../../hooks/usePwa';
import PwaConfirmationModal from '../common/PwaConfirmationModal';
import AcademicYearSelector from '../common/AcademicYearSelector';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { ProfileAvatar } from '../common/ProfileAvatar';
import WorkspaceSwitcher from './WorkspaceSwitcher';

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

export const HodLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  const [dashboardMeta, setDashboardMeta] = useState<HodDashboardData | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const fetchMetadata = () => {
    hodService.getDashboardData()
      .then((data) => {
        if (data) setDashboardMeta(data);
      })
      .catch((err) => console.warn('Could not load HOD metadata:', err));
  };

  useEffect(() => {
    fetchMetadata();

    const handleYearChanged = () => {
      fetchMetadata();
    };
    window.addEventListener('academic-year-changed', handleYearChanged);
    return () => {
      window.removeEventListener('academic-year-changed', handleYearChanged);
    };
  }, []);

  useEffect(() => {
    document.body.dataset.portal = 'hod';
    return () => {
      delete document.body.dataset.portal;
    };
  }, []);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const { showRefreshModal, setShowRefreshModal, confirmRefresh } = usePwa();

  const handleLogout = () => {
    setProfileMenuOpen(false);
    dispatch(logout());
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Recent';
    const seconds = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const deptName = dashboardMeta?.department?.name || user?.department?.name || 'Computer Science & Engineering';
  const deptCode = dashboardMeta?.department?.code || user?.department?.code || 'CSE';
  const { academicYear: globalAY } = useAcademicYear();
  const academicYear = globalAY || dashboardMeta?.academicYear || '2026-27';
  const hodName = dashboardMeta?.hod?.name || user?.name || 'Head of Department';

  const isSemHandling =
    dashboardMeta?.department?.type === 'SEMESTER_HANDLING' ||
    user?.department?.type === 'SEMESTER_HANDLING' ||
    deptCode === 'AS';

  const pendingActions = dashboardMeta?.stats?.pendingFacultyActions || 0;
  const defaultersCount = dashboardMeta?.stats?.attendanceDefaulters || 0;
  const pendingAuthorizations = dashboardMeta?.pendingAuthorizationsList || [];
  const unreadCount = pendingActions > 0 ? pendingActions : pendingAuthorizations.length;

  // HOD Sidebar Menu Structure matching Admin Dashboard visual hierarchy
  const standardMenuGroups: MenuGroup[] = [
    {
      title: 'DASHBOARD',
      items: [
        { name: 'Dashboard', path: '/hod/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'STUDENT MANAGEMENT',
      items: [
        { name: 'Students', path: '/hod/students', icon: Users },
        { name: 'Semester Breakdown', path: '/hod/students/semesters', icon: GraduationCap },
        { name: 'Section Allocation', path: '/hod/students/sections', icon: Layers },
      ],
    },
    {
      title: 'FACULTY MANAGEMENT',
      items: [
        { name: 'Faculty List', path: '/hod/faculty', icon: Users },
        { name: 'Teaching Allocation', path: '/hod/faculty/assignments', icon: ClipboardList },
      ],
    },
    {
      title: 'ACADEMIC MANAGEMENT',
      items: [
        { name: 'Subjects', path: '/hod/subjects', icon: BookOpen },
        { name: 'Academic Structure', path: '/hod/academics', icon: Award },
      ],
    },
    {
      title: 'ATTENDANCE & MARKS',
      items: [
        { name: 'Attendance', path: '/hod/attendance', icon: CalendarCheck },
        { name: 'Attendance Defaulters', path: '/hod/attendance/defaulters', icon: AlertTriangle, badge: defaultersCount > 0 ? defaultersCount : undefined },
        { name: 'Publish Attendance & Marks', path: '/hod/publish', icon: Send },
        { name: 'Marks / IA', path: '/hod/academics/performance', icon: TrendingUp },
        { name: 'Bit-Wise Marks', path: '/hod/academics/bitwise', icon: BarChart3 },
      ],
    },
    {
      title: 'REPORTS',
      items: [
        { name: 'Academic Reports', path: '/hod/reports', icon: FileText },
      ],
    },
    {
      title: 'SETTINGS',
      items: [
        { name: 'My Profile & Settings', path: '/hod/settings', icon: Settings },
      ],
    },
  ];

  // Applied Science Specific Menu Structure
  const appliedScienceMenuGroups: MenuGroup[] = [
    {
      title: 'DASHBOARD',
      items: [
        { name: 'Dashboard', path: '/hod/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'STUDENT MANAGEMENT',
      items: [
        { name: 'Students', path: '/hod/students', icon: Users },
        { name: 'Semester Breakdown', path: '/hod/students/semesters', icon: GraduationCap },
        { name: 'Section Allocation', path: '/hod/students/sections', icon: Layers },
      ],
    },
    {
      title: 'FACULTY MANAGEMENT',
      items: [
        { name: 'Faculty List', path: '/hod/faculty', icon: Users },
        { name: 'Teaching Allocation', path: '/hod/faculty/assignments', icon: ClipboardList },
      ],
    },
    {
      title: 'ACADEMIC MANAGEMENT',
      items: [
        { name: 'Subjects', path: '/hod/subjects', icon: BookOpen },
        { name: 'Attendance', path: '/hod/attendance', icon: CalendarCheck },
        { name: 'Publish Attendance & Marks', path: '/hod/publish', icon: Send },
        { name: 'Analytics', path: '/hod/academics', icon: BarChart3 },
      ],
    },
    {
      title: 'SETTINGS',
      items: [
        { name: 'My Profile & Settings', path: '/hod/settings', icon: Settings },
      ],
    },
  ];

  const menuGroups = isSemHandling ? appliedScienceMenuGroups : standardMenuGroups;

  const subNavTabs = [
    { name: 'Dashboard', path: '/hod/dashboard' },
    { name: 'Students', path: '/hod/students' },
    { name: 'Faculty', path: '/hod/faculty' },
  ];

  const pageTitles: Record<string, string> = {
    '/hod/dashboard': isSemHandling ? 'Applied Science Dashboard' : 'HOD Dashboard',
    '/hod/students': 'Student Management',
    '/hod/students/semesters': 'Semester Student Breakdown',
    '/hod/students/sections': 'Section Allocation',
    '/hod/faculty': 'Faculty Management',
    '/hod/faculty/assignments': 'Teaching Allocation',
    '/hod/subjects': 'Department Subjects Directory',
    '/hod/attendance': 'Department Attendance Overview',
    '/hod/attendance/defaulters': 'Attendance Defaulters List',
    '/hod/publish': 'Publish Student Attendance & Marks',
    '/hod/release': 'Publish Student Attendance & Marks',
    '/hod/academics': 'Academic Performance Overview',
    '/hod/academics/bitwise': 'Bit-Wise Component Analysis',
    '/hod/academics/performance': 'Student Academic Performance',
    '/hod/reports': 'Department Reports Generator',
    '/hod/settings': 'Department Settings',
    '/hod/profile': 'My Profile',
  };

  const getPageTitle = () => {
    if (location.pathname.startsWith('/hod/students/semesters/')) {
      const sem = location.pathname.split('/').pop();
      return `Semester ${sem} Cohort`;
    }
    if (location.pathname.startsWith('/hod/students/sections/') && location.pathname.endsWith('/allocate')) {
      return 'Allocate Students';
    }
    if (location.pathname.startsWith('/hod/students/sections/')) {
      return 'Section Student Details';
    }
    if (location.pathname.startsWith('/hod/students/') && !['/hod/students/semesters', '/hod/students/sections'].includes(location.pathname)) {
      return 'Student Academic Details';
    }
    if (location.pathname.startsWith('/hod/faculty/') && !['/hod/faculty/create', '/hod/faculty/assignments'].includes(location.pathname)) {
      return 'Faculty Member Profile & Permissions';
    }
    return pageTitles[location.pathname] || 'HOD Portal';
  };

  const getPageSubtitle = () => {
    if (isSemHandling) {
      return 'Academic Control • Applied Science (Sem 1 & 2)';
    }
    return `Academic Control • ${deptCode}`;
  };

  return (
    <div
      data-portal="hod"
      className="portal-table-center min-h-screen max-w-full overflow-x-hidden flex text-neutral-900 dark:text-neutral-100 transition-colors duration-300 font-sans pb-6 pr-6"
    >

      {/* ── MOBILE BACKDROP ── */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-neutral-950/50 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* ── FLOATING SIDEBAR (ADMIN STYLE) ── */}
      <aside
        className={`fixed left-6 top-6 bottom-6 w-[280px] min-w-[280px] max-w-[280px] flex-shrink-0 flex flex-col justify-between py-6 px-4 rounded-[32px] glass-bar z-50 transition-transform duration-300 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-[320px] lg:translate-x-0'
        }`}
      >
        {/* Top: Logo + Nav */}
        <div className="flex flex-col w-full min-h-0">
          <div className="flex items-center justify-between px-1.5 mb-5">
            <Link to="/hod/dashboard" className="flex items-center space-x-2.5 hover:opacity-95 transition-all">
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
                  Head of Department
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

          {/* Grouped Navigation matching Admin Dashboard style */}
          {(() => {
            const allNavPaths = menuGroups.flatMap((g) => g.items.map((i) => i.path));
            const getActiveNavPath = (currentPath: string): string => {
              if (allNavPaths.includes(currentPath)) {
                return currentPath;
              }
              const matchingPaths = allNavPaths.filter(
                (p) => p !== '/hod/dashboard' && currentPath.startsWith(p + '/')
              );
              if (matchingPaths.length > 0) {
                matchingPaths.sort((a, b) => b.length - a.length);
                return matchingPaths[0];
              }
              if (currentPath === '/hod' || currentPath.startsWith('/hod/dashboard')) {
                return '/hod/dashboard';
              }
              return currentPath;
            };
            const activeNavPath = getActiveNavPath(location.pathname);

            return (
              <nav className="flex flex-col space-y-3 overflow-y-auto max-h-[calc(100vh-270px)] pr-1 select-none custom-scrollbar">
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
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-500 text-white leading-none scale-90 ml-1.5 shrink-0">
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

        {/* Bottom Footer matching Admin style */}
        <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/40 flex flex-col gap-2.5 w-full">
          <div className="rounded-xl p-2.5 border text-[10px] space-y-1 bg-neutral-50/50 dark:bg-neutral-800/25 border-neutral-200/50 dark:border-neutral-800/55">
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-medium">Role</span>
              <span className="font-extrabold text-neutral-800 dark:text-neutral-200">HEAD OF DEPARTMENT</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-medium">Department</span>
              <span className="font-extrabold text-neutral-800 dark:text-neutral-200">
                {deptCode}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-medium">Academic Year</span>
              <span className="font-extrabold text-neutral-800 dark:text-neutral-200">{academicYear}</span>
            </div>
          </div>

          {/* Database-Driven Workspace Switcher */}
          <WorkspaceSwitcher currentWorkspace="hod" />

          <Link
            to="/hod/faculty"
            className="flex items-center space-x-2 text-[10px] font-bold hover:underline px-1 py-0.5 shrink-0 text-[#0c1a40] dark:text-blue-400"
          >
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              {pendingActions > 0 ? `${pendingActions} Pending Faculty Action${pendingActions > 1 ? 's' : ''}` : 'No Pending Actions'}
            </span>
          </Link>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 pt-6 flex flex-col min-h-screen min-w-0 pl-6 lg:pl-[320px]">

        {/* ── TOP HEADER (ADMIN STYLE) ── */}
        <header className="flex flex-row items-center justify-between py-2 sm:py-4 mb-6 z-30 gap-6">

          {/* Page Title & Mobile Trigger */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex-shrink-0">
              <h1 className="text-xl md:text-2xl lg:text-[26px] font-bold tracking-tight text-neutral-900 dark:text-white whitespace-nowrap leading-tight">
                {getPageTitle()}
              </h1>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium whitespace-nowrap">
                {getPageSubtitle()}
              </p>
            </div>
          </div>

          {/* Sub-Nav Pill Bar (matching Admin screenshot 2: 3 core quick tabs) */}
          <div className="hidden lg:flex items-center glass-bar p-1 rounded-full flex-shrink-0">
            {subNavTabs.map((tab) => {
              const isActive = location.pathname === tab.path;
              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 ${
                    isActive
                      ? 'admin-nav-pill-active shadow-sm text-white'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
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
            <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 text-xs font-bold shadow-xs">
              <Building2 className="w-3.5 h-3.5 text-neutral-500" />
              <span>Dept: <strong>{deptCode}</strong></span>
            </div>

            {/* Global Academic Year Selector */}
            <AcademicYearSelector />

            {/* Quick Search Button */}
            <button
              onClick={() => navigate('/hod/students')}
              title="Search students"
              className="w-9 h-9 rounded-full flex items-center justify-center header-dark-btn shadow-sm hover:scale-[1.05] active:scale-[0.95] cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Notifications Bell Dropdown */}
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setNotificationsOpen((prev) => !prev)}
                title="Notifications"
                className="w-9 h-9 rounded-full flex items-center justify-center header-dark-btn shadow-sm hover:scale-[1.05] active:scale-[0.95] relative cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 px-1 py-0.5 rounded-full bg-rose-500 text-white font-extrabold text-[8px] leading-none shrink-0 min-w-3.5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="notifications-dropdown absolute right-0 mt-2 w-80 sm:w-96 border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-2xl py-2 shadow-xl z-50 animate-fade-in">
                  <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800/40 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-800 dark:text-neutral-200">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-extrabold">
                        {unreadCount} pending
                      </span>
                    )}
                  </div>

                  <div className="max-h-[360px] overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/40 scrollbar-thin">
                    {pendingAuthorizations.length === 0 ? (
                      <div className="py-8 text-center text-xs text-neutral-400 flex flex-col items-center justify-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        <span className="font-semibold text-neutral-700 dark:text-neutral-300">All caught up!</span>
                        <span className="text-[11px] text-neutral-400">No pending faculty authorizations or alerts.</span>
                      </div>
                    ) : (
                      pendingAuthorizations.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setNotificationsOpen(false);
                            navigate('/hod/faculty');
                          }}
                          className="p-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer flex gap-3 transition-colors select-none text-left"
                        >
                          <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <p className="text-xs font-extrabold text-neutral-850 dark:text-neutral-100 truncate">
                              {item.facultyName} (Sem {item.semester} • {item.section})
                            </p>
                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium">
                              {item.subjectName} — Dispatched to <strong className="text-neutral-700 dark:text-neutral-200">{item.authority}</strong> for authorization.
                            </p>
                          </div>
                          <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-bold shrink-0 self-start mt-0.5 font-mono">
                            {formatTimeAgo(item.createdAt)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800/40 text-center shrink-0">
                    <button
                      onClick={() => {
                        setNotificationsOpen(false);
                        navigate('/hod/faculty');
                      }}
                      className="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 transition-colors uppercase tracking-wider"
                    >
                      View All Faculty Authorizations
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Pill Dropdown (matching Admin style) */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className="flex items-center space-x-2 header-dark-btn h-9 pl-1.5 pr-3 py-1 rounded-full shadow-sm cursor-pointer hover:scale-[1.02] transition-all select-none"
              >
                <ProfileAvatar
                  imageUrl={user?.profileImage}
                  name={hodName}
                  size="xs"
                  className="w-6 h-6 rounded-full shadow-xs"
                />
                <span className="text-xs font-semibold pr-0.5 hidden md:block">
                  {hodName.split(' ')[0]}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 opacity-80 hidden md:block transition-transform duration-200 ${profileMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-neutral-900 shadow-xl border border-neutral-200/80 dark:border-neutral-800 p-2 z-50 animate-in fade-in duration-150">
                  <div className="px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800">
                    <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">{hodName}</p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">{user?.email || 'hod@jcer.edu'}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300">
                        {deptCode} Dept
                      </span>
                      <span className="text-[9px] font-bold text-neutral-400">
                        AY {academicYear}
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/hod/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <User className="w-3.5 h-3.5 text-neutral-500" />
                      <span>My Profile</span>
                    </Link>
                    <Link
                      to="/hod/settings"
                      onClick={() => setProfileMenuOpen(false)}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Department Settings</span>
                    </Link>
                  </div>

                  <div className="pt-1 border-t border-neutral-100 dark:border-neutral-800">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors text-left"
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
        <main className="flex-1 pb-10 min-w-0 flex flex-col relative">
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

      <PwaConfirmationModal
        isOpen={showRefreshModal}
        onClose={() => setShowRefreshModal(false)}
        onConfirm={confirmRefresh}
      />
    </div>
  );
};

export default HodLayout;
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
  GraduationCap,
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
  }, [location.pathname]);

  useEffect(() => {
    document.body.dataset.portal = 'student';
    return () => {
      delete document.body.dataset.portal;
    };
  }, []);

  const { showRefreshModal, setShowRefreshModal, confirmRefresh } = usePwa();

  const handleLogout = () => {
    setProfileMenuOpen(false);
    dispatch(logout());
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const studentName = user?.name || 'Student';
  const usn = (user as any)?.usn || (user as any)?.username || user?.id || 'STUDENT';
  const deptName = user?.department?.name || 'Academic Department';
  const deptCode = user?.department?.code || 'JCER';
  const { academicYear } = useAcademicYear();

  // Navigation menu items for Student
  const menuItems: MenuItem[] = [
    { name: 'Overview', path: '/student/dashboard', icon: LayoutDashboard },
    { name: 'Attendance', path: '/student/attendance', icon: CalendarCheck },
    { name: 'Marks / CIE Results', path: '/student/marks', icon: Award },
    { name: 'Profile', path: '/student/profile', icon: User },
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
      default:
        return 'Student Dashboard';
    }
  };

  const getPageSubtitle = () => {
    switch (activeNavPath) {
      case '/student/profile':
        return 'Official read-only admission and enrollment details';
      case '/student/attendance':
        return 'Dynamic session attendance and subject percentages';
      case '/student/marks':
        return 'Approved and published Continuous Internal Evaluation (CIE) results';
      default:
        return 'Welcome to your academic portal overview';
    }
  };

  return (
    <div
      data-portal="student"
      className="portal-table-center min-h-screen max-w-full overflow-x-hidden flex text-neutral-900 dark:text-neutral-100 transition-colors duration-300 font-sans pb-6 pr-6 bg-slate-50 dark:bg-neutral-950"
    >
      {/* ── MOBILE BACKDROP ── */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-neutral-950/50 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* ── FLOATING SIDEBAR ── */}
      <aside
        className={`fixed left-6 top-6 bottom-6 w-[280px] min-w-[280px] max-w-[280px] flex-shrink-0 flex flex-col justify-between py-6 px-4 rounded-[32px] glass-bar z-50 transition-transform duration-300 lg:translate-x-0 ${
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
                            isActive ? 'text-cyan-400' : 'text-neutral-500 dark:text-neutral-400 group-hover:text-cyan-300'
                          }`}
                        />
                        <span className="text-[12px] truncate">{item.name}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>

        {/* Bottom Student Profile Summary in Sidebar */}
        <div className="pt-3 border-t border-neutral-200/60 dark:border-neutral-800/60 mt-auto">
          <div className="p-2.5 rounded-2xl bg-neutral-50/80 dark:bg-neutral-900/80 border border-neutral-200/50 dark:border-neutral-800/50 flex items-center gap-3">
            <ProfileAvatar
              name={studentName}
              size="md"
              className="border-2 border-white dark:border-neutral-800 shadow-xs flex-shrink-0"
            />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                {studentName}
              </span>
              <span className="text-[10px] font-mono font-semibold text-neutral-500 dark:text-neutral-400 truncate">
                {usn}
              </span>
              <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 truncate">
                {deptCode}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-[312px] pl-0 transition-all duration-300">
        {/* Floating Top Header Bar */}
        <header className="sticky top-6 z-30 mx-4 lg:mx-0 mb-6 rounded-2xl glass-bar px-5 py-3.5 flex items-center justify-between shadow-xs">
          {/* Left: Mobile hamburger & Page Title */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-black text-neutral-900 dark:text-white tracking-tight leading-tight">
                {getPageTitle()}
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 hidden sm:block">
                {getPageSubtitle()}
              </p>
            </div>
          </div>

          {/* Right: Academic Year + Profile Menu */}
          <div className="flex items-center space-x-3">
            <AcademicYearSelector />

            {/* Profile Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center space-x-2.5 p-1.5 pl-2.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
              >
                <div className="flex flex-col text-right hidden md:block">
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 leading-none">
                    {studentName}
                  </span>
                  <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {usn}
                  </span>
                </div>
                <ProfileAvatar name={studentName} size="sm" />
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </button>

              {/* Profile Dropdown Menu */}
              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-neutral-900 shadow-xl border border-neutral-200 dark:border-neutral-800 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-neutral-100 dark:border-neutral-800">
                    <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">{studentName}</p>
                    <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 truncate">{usn}</p>
                    <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{deptName}</p>
                  </div>
                  <Link
                    to="/student/profile"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center space-x-2.5 px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                  >
                    <User className="w-4 h-4 text-neutral-400" />
                    <span>View Profile</span>
                  </Link>
                  <Link
                    to="/admission/dashboard"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center space-x-2.5 px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                  >
                    <GraduationCap className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span>Admission Portal</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Nested Page Content */}
        <main className="flex-1 px-4 lg:px-0">
          <Outlet />
        </main>

        {/* Global Footer */}
        <GlobalFooter className="mt-12 mx-4 lg:mx-0" />
      </div>

      <PwaConfirmationModal
        isOpen={showRefreshModal}
        onClose={() => setShowRefreshModal(false)}
        onConfirm={confirmRefresh}
      />
    </div>
  );
};

export default StudentLayout;

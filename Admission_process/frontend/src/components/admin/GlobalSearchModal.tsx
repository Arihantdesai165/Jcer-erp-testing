import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  FileText,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  CheckCircle,
  XCircle,
  History,
  Users,
  BarChart3,
  PieChart,
  Download,
  RotateCw,
  HelpCircle,
  X,
  User,
  CornerDownLeft,
  Loader2,
  Clock
} from 'lucide-react';
import admissionService, { AdmissionApplication } from '../../services/admission.service';

interface SearchItem {
  id: string;
  type: 'NAVIGATION' | 'ACTION';
  title: string;
  description: string;
  keywords: string[];
  route?: string;
  actionEvent?: string;
  iconName: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigationItems: SearchItem[] = [
  {
    id: 'nav-dashboard',
    type: 'NAVIGATION',
    title: 'Dashboard',
    description: 'View ERP overview, admissions stats, and configurations',
    keywords: ['home', 'overview', 'jcer', 'main', 'dashboard', 'control'],
    route: '/admin',
    iconName: 'LayoutDashboard'
  },
  {
    id: 'nav-queue',
    type: 'NAVIGATION',
    title: 'Application Queue',
    description: 'Review and verify submitted student applications',
    keywords: ['queue', 'applications', 'submitted', 'review', 'list', 'verification'],
    route: '/admin/admissions/queue',
    iconName: 'FileText'
  },
  {
    id: 'nav-resubmitted',
    type: 'NAVIGATION',
    title: 'Resubmitted Queue',
    description: 'Verify corrected student applications',
    keywords: ['resubmitted', 'corrections', 'verify', 'update', 'queue', 'checks'],
    route: '/admin/admissions/resubmitted',
    iconName: 'RefreshCw'
  },
  {
    id: 'nav-corrections',
    type: 'NAVIGATION',
    title: 'Corrections Requested',
    description: 'List applications awaiting student edits/corrections',
    keywords: ['corrections', 'pending student', 'requested', 'deadline', 'hold'],
    route: '/admin/admissions/corrections',
    iconName: 'AlertTriangle'
  },
  {
    id: 'nav-verified',
    type: 'NAVIGATION',
    title: 'Verified Applications',
    description: 'View applications with verified documents ready for approval',
    keywords: ['verified', 'documents checked', 'ready for approval', 'approved queue'],
    route: '/admin/admissions/verified',
    iconName: 'ShieldCheck'
  },
  {
    id: 'nav-approved',
    type: 'NAVIGATION',
    title: 'Approved Admissions',
    description: 'Applications approved and waiting for ERP enrollment',
    keywords: ['approved', 'completed', 'waiting enrollment', 'final list'],
    route: '/admin/admissions/approved',
    iconName: 'CheckCircle'
  },
  {
    id: 'nav-cancellations',
    type: 'NAVIGATION',
    title: 'Cancellation Queue',
    description: 'Process student admission cancellation and refund requests',
    keywords: ['cancellation', 'refund', 'withdraw', 'remove', 'cancel'],
    route: '/admin/admissions/cancellations',
    iconName: 'XCircle'
  },
  {
    id: 'nav-history',
    type: 'NAVIGATION',
    title: 'Admissions History',
    description: 'Archive of all processed and past applications',
    keywords: ['history', 'archive', 'past years', 'logs', 'database'],
    route: '/admin/admissions/history',
    iconName: 'History'
  },
  {
    id: 'nav-students',
    type: 'NAVIGATION',
    title: 'Student Management',
    description: 'Manage active student records, USNs, and branches',
    keywords: ['students', 'enrolled', 'usn', 'branches', 'list', 'edit profiles'],
    route: '/admin/students',
    iconName: 'Users'
  },
  {
    id: 'nav-reports',
    type: 'NAVIGATION',
    title: 'Reports & Auditing',
    description: 'Generate reports and download verification audit logs',
    keywords: ['reports', 'summary', 'audit', 'excel', 'export', 'charts'],
    route: '/admin/reports',
    iconName: 'BarChart3'
  },
  {
    id: 'nav-analytics',
    type: 'NAVIGATION',
    title: 'Admissions Analytics',
    description: 'View branch-wise intake charts and statistics',
    keywords: ['analytics', 'statistics', 'charts', 'graphs', 'intake', 'metrics'],
    route: '/admin/analytics',
    iconName: 'PieChart'
  }
];

const actionItems: SearchItem[] = [
  {
    id: 'act-export-students',
    type: 'ACTION',
    title: 'Export Students Data',
    description: 'Download active student records as CSV spreadsheet',
    keywords: ['export', 'csv', 'download', 'students', 'excel', 'sheet'],
    route: '/admin/student-export',
    actionEvent: 'trigger-student-export',
    iconName: 'Download'
  },
  {
    id: 'act-refresh',
    type: 'ACTION',
    title: 'Refresh Current View',
    description: 'Reload the active page metrics and list details from server',
    keywords: ['refresh', 'reload', 'sync', 'update', 'latest', 'fetch'],
    actionEvent: 'refresh-data',
    iconName: 'RotateCw'
  },
  {
    id: 'act-support',
    type: 'ACTION',
    title: 'Contact Admissions Support',
    description: 'Access nodal office details and guidelines',
    keywords: ['support', 'help', 'contact', 'admin help', 'nodal office', 'helpdesk'],
    route: '/admission/support',
    iconName: 'HelpCircle'
  }
];

const IconComponent = ({ name, className, size = 16 }: { name: string; className?: string; size?: number }) => {
  const cn = className || "text-neutral-500 dark:text-neutral-400";
  switch (name) {
    case 'LayoutDashboard': return <LayoutDashboard className={cn} size={size} />;
    case 'FileText': return <FileText className={cn} size={size} />;
    case 'RefreshCw': return <RefreshCw className={cn} size={size} />;
    case 'AlertTriangle': return <AlertTriangle className={cn} size={size} />;
    case 'ShieldCheck': return <ShieldCheck className={cn} size={size} />;
    case 'CheckCircle': return <CheckCircle className={cn} size={size} />;
    case 'XCircle': return <XCircle className={cn} size={size} />;
    case 'History': return <History className={cn} size={size} />;
    case 'Users': return <Users className={cn} size={size} />;
    case 'BarChart3': return <BarChart3 className={cn} size={size} />;
    case 'PieChart': return <PieChart className={cn} size={size} />;
    case 'Download': return <Download className={cn} size={size} />;
    case 'RotateCw': return <RotateCw className={cn} size={size} />;
    case 'HelpCircle': return <HelpCircle className={cn} size={size} />;
    case 'User': return <User className={cn} size={size} />;
    case 'Clock': return <Clock className={cn} size={size} />;
    default: return <Search className={cn} size={size} />;
  }
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'SUBMITTED':
      return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40';
    case 'UNDER_REVIEW':
      return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40';
    case 'CORRECTION_REQUIRED':
      return 'bg-amber-50 dark:bg-amber-950/40 text-amber-655 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40';
    case 'RESUBMITTED':
      return 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40';
    case 'APPROVED':
    case 'PRINCIPAL_APPROVED':
      return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40';
    case 'ENROLLED':
      return 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40';
    case 'REJECTED':
    case 'CANCELLED':
      return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40';
    default:
      return 'bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700';
  }
};

const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [studentResults, setStudentResults] = useState<AdmissionApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setDebouncedQuery('');
      setStudentResults([]);
      setError(null);
      setLoading(false);
      setActiveIndex(0);
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Debounce query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 280);
    return () => clearTimeout(handler);
  }, [query]);

  // Query Backend
  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setStudentResults([]);
      return;
    }

    const controller = new AbortController();
    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await admissionService.listApplications({
          search: debouncedQuery,
          limit: 10
        });
        if (!controller.signal.aborted) {
          setStudentResults(res.applications || []);
        }
      } catch (err: any) {
        if (!controller.signal.aborted) {
          console.error('Command search API error:', err);
          setError('Unable to search students. Check your connection.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchResults();
    return () => controller.abort();
  }, [debouncedQuery]);

  // Local matching items
  const getFilteredLocal = () => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      // Return default recent / quick access
      return {
        nav: navigationItems.slice(0, 4),
        actions: actionItems.slice(0, 2)
      };
    }

    const matchFilter = (item: SearchItem) => {
      return (
        item.title.toLowerCase().includes(trimmed) ||
        item.description.toLowerCase().includes(trimmed) ||
        item.keywords.some(k => k.includes(trimmed))
      );
    };

    return {
      nav: navigationItems.filter(matchFilter),
      actions: actionItems.filter(matchFilter)
    };
  };

  const { nav: matchedNav, actions: matchedActions } = getFilteredLocal();

  // Combine items to a single list for simple keyboard active index navigation
  const flatItems: (SearchItem | AdmissionApplication)[] = [
    ...matchedNav,
    ...matchedActions,
    ...studentResults
  ];

  // Boundaries check
  useEffect(() => {
    if (flatItems.length === 0) {
      setActiveIndex(0);
    } else if (activeIndex >= flatItems.length) {
      setActiveIndex(flatItems.length - 1);
    }
  }, [flatItems, activeIndex]);

  // Scroll active item into view
  useEffect(() => {
    const activeEl = resultsContainerRef.current?.querySelector('[aria-selected="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleSelect = (item: SearchItem | AdmissionApplication) => {
    onClose();
    if ('type' in item) {
      if (item.type === 'ACTION') {
        if (item.actionEvent === 'refresh-data') {
          window.location.reload();
          return;
        }
        if (item.actionEvent === 'trigger-student-export') {
          window.dispatchEvent(new CustomEvent('trigger-student-export'));
        }
      }
      if (item.route) {
        navigate(item.route);
      }
    } else {
      navigate(`/admin/admissions/review/${item.id}`);
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (flatItems.length ? (prev + 1) % flatItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (flatItems.length ? (prev - 1 + flatItems.length) % flatItems.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatItems[activeIndex]) {
          handleSelect(flatItems[activeIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatItems, activeIndex]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-start justify-center pt-[12vh] px-4 md:px-0"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="w-full max-w-2xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/80 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[75vh] animate-in fade-in-0 zoom-in-98 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Box */}
        <div className="flex items-center gap-3 px-4 border-b border-neutral-100 dark:border-neutral-800/60 h-14 shrink-0">
          <Search className="text-neutral-400 dark:text-neutral-500" size={18} />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-0 outline-none text-neutral-850 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 text-sm font-medium py-3"
            placeholder="Search students, applications, pages or actions..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results-list"
          />
          {query ? (
            <button 
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 dark:text-neutral-500 transition-colors"
            >
              <X size={14} />
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 border border-neutral-200 dark:border-neutral-800 rounded-md text-[9px] font-bold text-neutral-400 dark:text-neutral-500 bg-neutral-50 dark:bg-neutral-950/40 select-none">
              <span>CTRL</span>
              <span>K</span>
            </div>
          )}
        </div>

        {/* Results Body */}
        <div 
          id="search-results-list"
          ref={resultsContainerRef}
          className="flex-1 overflow-y-auto p-2 space-y-4 max-h-[420px] scrollbar-thin dark:scrollbar-thumb-neutral-800"
          role="listbox"
        >
          {/* SKELETON LOADING STATE */}
          {loading && studentResults.length === 0 && (
            <div className="space-y-3 px-2 py-3 animate-pulse">
              <div className="h-3 w-32 bg-neutral-100 dark:bg-neutral-800 rounded mb-2"></div>
              <div className="flex gap-3 items-center">
                <div className="size-8 rounded-lg bg-neutral-150 dark:bg-neutral-800"></div>
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-neutral-150 dark:bg-neutral-800 rounded w-2/5"></div>
                  <div className="h-3 bg-neutral-150 dark:bg-neutral-800 rounded w-3/5"></div>
                </div>
              </div>
              <div className="flex gap-3 items-center pt-2">
                <div className="size-8 rounded-lg bg-neutral-150 dark:bg-neutral-800"></div>
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-neutral-150 dark:bg-neutral-800 rounded w-1/3"></div>
                  <div className="h-3 bg-neutral-150 dark:bg-neutral-800 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          )}

          {/* BACKEND ERROR STATE */}
          {error && (
            <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
              <AlertTriangle className="text-rose-500 mb-2" size={24} />
              <p className="text-sm font-bold text-neutral-800 dark:text-neutral-250">Unable to search students</p>
              <p className="text-xs text-neutral-500 mt-1">{error}</p>
            </div>
          )}

          {/* EMPTY RESULTS STATE */}
          {!loading && flatItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <Search className="text-neutral-300 dark:text-neutral-700 mb-3" size={32} />
              <p className="text-sm font-black text-neutral-800 dark:text-neutral-200">No results found</p>
              <p className="text-xs text-neutral-500 mt-1.5 max-w-sm leading-relaxed">
                Try searching for a student, application number, USN, page or action.
              </p>
            </div>
          )}

          {/* RESULTS CATEGORIES */}
          {flatItems.length > 0 && (
            <>
              {/* Category: Navigation */}
              {matchedNav.length > 0 && (
                <div className="space-y-0.5">
                  <div className="px-3 text-[10px] font-black uppercase tracking-wider text-neutral-450 dark:text-neutral-500 mt-1.5 mb-1.5">
                    {query ? 'Navigation Match' : 'Recent / Quick Access'}
                  </div>
                  {matchedNav.map((item, idx) => {
                    const globalIdx = idx;
                    const isActive = activeIndex === globalIdx;
                    return (
                      <div
                        key={item.id}
                        aria-selected={isActive}
                        role="option"
                        className={`
                          flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all select-none
                          ${isActive 
                            ? 'bg-neutral-50 dark:bg-neutral-950/65 text-primary-900 dark:text-primary-100 border-l-4 border-primary-600 pl-2 shadow-sm' 
                            : 'text-neutral-700 dark:text-neutral-300 pl-3 hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20'}
                        `}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                        onClick={() => handleSelect(item)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1.5 rounded-lg ${isActive ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-600' : 'bg-neutral-50 dark:bg-neutral-950/30'}`}>
                            <IconComponent name={item.iconName} size={15} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold leading-tight">{item.title}</p>
                            <p className="text-[10px] text-neutral-500 leading-normal mt-0.5 truncate max-w-lg">{item.description}</p>
                          </div>
                        </div>
                        {isActive && (
                          <CornerDownLeft size={10} className="text-neutral-400 animate-pulse" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Category: Actions */}
              {matchedActions.length > 0 && (
                <div className="space-y-0.5 pt-2">
                  <div className="px-3 text-[10px] font-black uppercase tracking-wider text-neutral-450 dark:text-neutral-500 mt-1.5 mb-1.5">
                    {query ? 'Actions' : 'Popular Actions'}
                  </div>
                  {matchedActions.map((item, idx) => {
                    const globalIdx = matchedNav.length + idx;
                    const isActive = activeIndex === globalIdx;
                    return (
                      <div
                        key={item.id}
                        aria-selected={isActive}
                        role="option"
                        className={`
                          flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all select-none
                          ${isActive 
                            ? 'bg-neutral-50 dark:bg-neutral-950/65 text-primary-900 dark:text-primary-100 border-l-4 border-primary-600 pl-2 shadow-sm' 
                            : 'text-neutral-700 dark:text-neutral-300 pl-3 hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20'}
                        `}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                        onClick={() => handleSelect(item)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1.5 rounded-lg ${isActive ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-600' : 'bg-neutral-50 dark:bg-neutral-950/30'}`}>
                            <IconComponent name={item.iconName} size={15} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold leading-tight">{item.title}</p>
                            <p className="text-[10px] text-neutral-500 leading-normal mt-0.5 truncate max-w-lg">{item.description}</p>
                          </div>
                        </div>
                        {isActive && (
                          <CornerDownLeft size={10} className="text-neutral-400 animate-pulse" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Category: Students & Applications */}
              {studentResults.length > 0 && (
                <div className="space-y-0.5 pt-2">
                  <div className="px-3 text-[10px] font-black uppercase tracking-wider text-neutral-450 dark:text-neutral-500 mt-1.5 mb-1.5">
                    Admissions & Students
                  </div>
                  {studentResults.map((item, idx) => {
                    const globalIdx = matchedNav.length + matchedActions.length + idx;
                    const isActive = activeIndex === globalIdx;
                    
                    const name = item.studentpersonaldetails?.firstName 
                      ? [item.studentpersonaldetails.firstName, item.studentpersonaldetails.middleName, item.studentpersonaldetails.lastName].filter(Boolean).join(' ')
                      : [item.user?.firstName, item.user?.lastName].filter(Boolean).join(' ') || 'Candidate';
                    
                    const email = item.studentpersonaldetails?.email || item.user?.email || 'N/A';
                    const usn = item.user?.student?.enrollmentNumber || null;
                    const appNo = item.applicationNumber;
                    const branch = item.branch?.name || item.admissionType || 'N/A';

                    return (
                      <div
                        key={item.id}
                        aria-selected={isActive}
                        role="option"
                        className={`
                          flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer transition-all select-none
                          ${isActive 
                            ? 'bg-neutral-50 dark:bg-neutral-950/65 border-l-4 border-primary-600 pl-2 shadow-sm' 
                            : 'pl-3 hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20'}
                        `}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                        onClick={() => handleSelect(item)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-xl shrink-0 flex items-center justify-center ${isActive ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-600' : 'bg-neutral-50 dark:bg-neutral-950/30 text-neutral-400'}`}>
                            <User size={16} />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <p className={`text-xs font-bold leading-tight ${isActive ? 'text-primary-900 dark:text-primary-100' : 'text-neutral-800 dark:text-neutral-200'}`}>
                              {name}
                            </p>
                            <p className="text-[10px] text-neutral-500 font-medium leading-none truncate max-w-sm">
                              {email} {usn ? `• USN: ${usn}` : ''}
                            </p>
                            <div className="flex items-center gap-2 pt-0.5">
                              <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase font-mono tracking-wider">
                                {appNo}
                              </span>
                              <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500">
                                • {branch}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeClass(item.applicationStatus)}`}>
                            {item.applicationStatus.replace('_', ' ')}
                          </span>
                          {isActive && (
                            <CornerDownLeft size={10} className="text-neutral-400 animate-pulse" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 dark:bg-neutral-950/20 border-t border-neutral-100 dark:border-neutral-800/40 text-[9px] text-neutral-400 dark:text-neutral-500 shrink-0 font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-0.5">
              <span className="px-1.5 py-0.5 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 font-bold">↑↓</span> Navigate
            </span>
            <span className="flex items-center gap-0.5">
              <span className="px-1.5 py-0.5 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 font-bold">↵</span> Open
            </span>
            <span className="flex items-center gap-0.5">
              <span className="px-1.5 py-0.5 border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 font-bold">Esc</span> Close
            </span>
          </div>
          <div className="font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-widest font-mono">
            JCER ERP Command
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GlobalSearchModal;

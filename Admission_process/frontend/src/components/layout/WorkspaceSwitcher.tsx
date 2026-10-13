import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useAcademicYear } from '../../context/AcademicYearContext';
import authService from '../../services/auth.service';
import {
  ArrowLeftRight,
  ChevronDown,
  Building2,
  GraduationCap,
  Check,
} from 'lucide-react';

export type WorkspaceType = 'hod' | 'faculty' | 'dean' | 'principal';

interface WorkspaceOption {
  id: WorkspaceType;
  name: string;
  path: string;
  icon: React.ElementType;
  colorClass: string;
  badge?: string;
}

interface WorkspaceSwitcherProps {
  currentWorkspace: WorkspaceType;
}

interface WorkspaceItem {
  type: string;
  label: string;
  route: string;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ currentWorkspace }) => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { academicYear } = useAcademicYear();

  const [isOpen, setIsOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Authoritative Database Capabilities Query
  useEffect(() => {
    let isMounted = true;
    const fetchCapabilities = async () => {
      if (user?.role === 'STUDENT' || user?.role === 'PARENT') {
        if (isMounted) setWorkspaces([]);
        return;
      }

      try {
        setLoading(true);
        const res = await authService.getUserWorkspaces();
        if (isMounted && res?.workspaces) {
          setWorkspaces(res.workspaces.filter((w: WorkspaceItem) => ['HOD', 'FACULTY', 'DEAN', 'PRINCIPAL'].includes(w.type.toUpperCase())));
        }
      } catch (err) {
        console.warn('Failed to load user workspaces capability:', err);
        // Fallback strictly based on verified user claims
        if (isMounted) {
          const list: WorkspaceItem[] = [];
          if (user?.role === 'HOD' || user?.isHod) {
            list.push({ type: 'HOD', label: 'Head of Department', route: '/hod/dashboard' });
          }
          if (user?.role === 'DEAN') {
            list.push({ type: 'DEAN', label: 'Dean Academics', route: '/dean/dashboard' });
          }
          if (user?.role === 'PRINCIPAL') {
            list.push({ type: 'PRINCIPAL', label: 'Principal Portal', route: '/principal/dashboard' });
          }
          if (user?.role === 'TEACHER' || user?.role === 'FACULTY' || user?.isFaculty || user?.role === 'HOD' || user?.role === 'DEAN' || user?.role === 'PRINCIPAL') {
            list.push({ type: 'FACULTY', label: 'Faculty Dashboard', route: '/faculty/dashboard' });
          }
          setWorkspaces(list);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCapabilities();

    const handleYearChange = () => fetchCapabilities();
    window.addEventListener('academic-year-changed', handleYearChange);
    return () => {
      isMounted = false;
      window.removeEventListener('academic-year-changed', handleYearChange);
    };
  }, [academicYear, user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getWorkspaceDetails = (ws: WorkspaceItem): WorkspaceOption => {
    const t = ws.type.toUpperCase();
    if (t === 'HOD') {
      return {
        id: 'hod',
        name: 'Head of Department',
        path: ws.route || '/hod/dashboard',
        icon: Building2,
        colorClass: 'text-cyan-500 dark:text-cyan-400',
      };
    }
    if (t === 'DEAN') {
      return {
        id: 'dean',
        name: 'Dean Academics',
        path: ws.route || '/dean/dashboard',
        icon: Building2,
        colorClass: 'text-blue-500 dark:text-blue-400',
      };
    }
    if (t === 'PRINCIPAL') {
      return {
        id: 'principal',
        name: 'Principal Portal',
        path: ws.route || '/principal/dashboard',
        icon: Building2,
        colorClass: 'text-purple-500 dark:text-purple-400',
      };
    }
    return {
      id: 'faculty',
      name: 'Faculty Dashboard',
      path: ws.route || '/faculty/dashboard',
      icon: GraduationCap,
      colorClass: 'text-indigo-500 dark:text-indigo-400',
    };
  };

  const availableWorkspaces = workspaces
    .filter((w) => ['HOD', 'FACULTY', 'DEAN', 'PRINCIPAL'].includes(w.type.toUpperCase()))
    .map(getWorkspaceDetails);

  if (availableWorkspaces.length === 0) {
    return null;
  }

  const handleSelectWorkspace = (workspace: WorkspaceOption) => {
    setIsOpen(false);
    if (workspace.id !== currentWorkspace) {
      navigate(workspace.path);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Switcher Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Switch Role / Workspace"
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 border select-none ${
          isOpen
            ? 'bg-neutral-900 text-white border-neutral-700 shadow-md ring-2 ring-indigo-500/30'
            : 'bg-white dark:bg-neutral-900/80 text-neutral-700 dark:text-neutral-200 border-neutral-200/80 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-xs'
        }`}
      >
        <div className="flex items-center space-x-2 min-w-0">
          <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
          <span className="truncate">Switch Workspace</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {/* Expanded Popup Menu (Pops UP above button) */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 p-1.5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="px-2.5 py-1.5 mb-1 border-b border-neutral-100 dark:border-neutral-800/60">
            <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Available Workspaces
            </span>
          </div>

          <div className="flex flex-col space-y-1">
            {availableWorkspaces.map((ws) => {
              const isSelected = ws.id === currentWorkspace;
              const Icon = ws.icon;
              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => handleSelectWorkspace(ws)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 text-left ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 border border-indigo-200/60 dark:border-indigo-800/50'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${ws.colorClass}`} />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate leading-tight">{ws.name}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 ml-1.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceSwitcher;

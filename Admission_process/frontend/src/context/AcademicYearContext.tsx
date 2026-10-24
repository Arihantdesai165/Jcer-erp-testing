import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import API from '../services/api';

export interface AcademicYearOption {
  id: string;
  year: string;
  isCurrent?: boolean;
  status?: string;
  isOperational?: boolean;
  startDate?: string | Date;
  endDate?: string | Date;
}

interface AcademicYearContextType {
  /** The currently selected viewing academic year */
  academicYear: string;
  /** The institutional global active academic year confirmed by backend */
  activeAcademicYear: string;
  /** Whether the user is viewing a historical academic year */
  isHistoricalViewing: boolean;
  selectedAcademicYear?: AcademicYearOption;
  /** Changes the user's viewing academic year */
  setAcademicYear: (year: string) => void;
  /** Resets viewing context back to the authoritative global active year */
  resetToActiveYear: () => void;
  /** All available operational academic year records */
  academicYears: AcademicYearOption[];
  loading: boolean;
  /** Refetches authoritative active year and available years from server */
  refreshAcademicYears: () => Promise<void>;
}

const STORAGE_VIEWING_KEY = 'jcer_viewing_academic_year';
const STORAGE_ACTIVE_KEY = 'jcer_global_active_academic_year';
const STORAGE_PINNED_HISTORICAL_KEY = 'jcer_is_historical_pinned';
const DEFAULT_YEAR = '2026-27';

const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined);

export const AcademicYearProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeAcademicYear, setActiveAcademicYearState] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_ACTIVE_KEY);
    return stored && stored !== '2025-26' ? stored : DEFAULT_YEAR;
  });

  const [academicYear, setAcademicYearState] = useState<string>(() => {
    const storedViewing = localStorage.getItem(STORAGE_VIEWING_KEY);
    if (storedViewing && storedViewing !== '2025-26') return storedViewing;
    const storedActive = localStorage.getItem(STORAGE_ACTIVE_KEY);
    if (storedActive && storedActive !== '2025-26') return storedActive;
    return DEFAULT_YEAR;
  });

  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([
    { id: 'ay-2027-28', year: '2027-28', isCurrent: true, status: 'ACTIVE', isOperational: true },
    { id: 'ay-2026-27', year: '2026-27', isCurrent: false, status: 'ARCHIVED', isOperational: true },
  ]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAcademicYears = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get('/system/academic-years');
      if (res.data?.success && res.data?.data) {
        const { currentYear, activeAcademicYear: returnedActive, years } = res.data.data;
        const authoritativeActive = returnedActive || currentYear || DEFAULT_YEAR;

        if (Array.isArray(years) && years.length > 0) {
          const operationalYears = years.filter((y: AcademicYearOption) => y.year !== '2025-26' && y.isOperational !== false);
          setAcademicYears(operationalYears);
        }

        const safeActive = authoritativeActive === '2025-26' ? DEFAULT_YEAR : authoritativeActive;
        setActiveAcademicYearState(safeActive);
        localStorage.setItem(STORAGE_ACTIVE_KEY, safeActive);

        // Check if user has explicitly pinned a historical viewing session
        const isPinned = localStorage.getItem(STORAGE_PINNED_HISTORICAL_KEY) === 'true';
        const currentViewing = localStorage.getItem(STORAGE_VIEWING_KEY);

        if (!isPinned || !currentViewing || currentViewing === '2025-26') {
          // Default context smoothly updates to new global active year
          setAcademicYearState(safeActive);
          localStorage.setItem(STORAGE_VIEWING_KEY, safeActive);
          localStorage.removeItem(STORAGE_PINNED_HISTORICAL_KEY);
        } else {
          // If the pinned year happens to now be the active year, unpin
          if (currentViewing === safeActive) {
            localStorage.removeItem(STORAGE_PINNED_HISTORICAL_KEY);
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch academic years list from server, using fallback list:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAcademicYears();
  }, [fetchAcademicYears]);

  // Periodic check & window focus sync (30s) so cross-role synchronization happens automatically
  useEffect(() => {
    const handleFocus = () => {
      fetchAcademicYears();
    };
    window.addEventListener('focus', handleFocus);

    const interval = setInterval(() => {
      fetchAcademicYears();
    }, 30000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [fetchAcademicYears]);

  // Sync across tabs and custom events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_VIEWING_KEY && e.newValue && e.newValue !== academicYear) {
        setAcademicYearState(e.newValue);
      }
      if (e.key === STORAGE_ACTIVE_KEY && e.newValue && e.newValue !== activeAcademicYear) {
        setActiveAcademicYearState(e.newValue);
      }
    };

    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ academicYear: string; year?: string }>;
      const nextYear = customEvent.detail?.academicYear || customEvent.detail?.year;
      if (nextYear && nextYear !== academicYear) {
        setAcademicYearState(nextYear);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('academic-year-changed', handleCustomChange);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('academic-year-changed', handleCustomChange);
    };
  }, [academicYear, activeAcademicYear]);

  const setAcademicYear = useCallback((newYear: string) => {
    if (!newYear) return;
    setAcademicYearState(newYear);
    localStorage.setItem(STORAGE_VIEWING_KEY, newYear);

    // If selecting a year different from the active year, flag as manually pinned historical
    if (newYear !== activeAcademicYear) {
      localStorage.setItem(STORAGE_PINNED_HISTORICAL_KEY, 'true');
    } else {
      localStorage.removeItem(STORAGE_PINNED_HISTORICAL_KEY);
    }

    // Dispatch custom event for all page queries across portals to re-trigger
    window.dispatchEvent(new CustomEvent('academic-year-changed', {
      detail: { academicYear: newYear, year: newYear }
    }));
  }, [activeAcademicYear]);

  const resetToActiveYear = useCallback(() => {
    setAcademicYearState(activeAcademicYear);
    localStorage.setItem(STORAGE_VIEWING_KEY, activeAcademicYear);
    localStorage.removeItem(STORAGE_PINNED_HISTORICAL_KEY);
    window.dispatchEvent(new CustomEvent('academic-year-changed', {
      detail: { academicYear: activeAcademicYear, year: activeAcademicYear }
    }));
  }, [activeAcademicYear]);

  const selectedAcademicYear = academicYears.find((y) => y.year === academicYear);
  const isHistoricalViewing = academicYear !== activeAcademicYear;

  return (
    <AcademicYearContext.Provider
      value={{
        academicYear,
        activeAcademicYear,
        isHistoricalViewing,
        selectedAcademicYear,
        setAcademicYear,
        resetToActiveYear,
        academicYears,
        loading,
        refreshAcademicYears: fetchAcademicYears,
      }}
    >
      {children}
    </AcademicYearContext.Provider>
  );
};

export const useAcademicYear = (): AcademicYearContextType => {
  const context = useContext(AcademicYearContext);
  if (!context) {
    throw new Error('useAcademicYear must be used within an AcademicYearProvider');
  }
  return context;
};

export default AcademicYearContext;

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check, History, RotateCcw } from 'lucide-react';
import { useAcademicYear } from '../../context/AcademicYearContext';

interface AcademicYearSelectorProps {
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
}

export const AcademicYearSelector: React.FC<AcademicYearSelectorProps> = ({
  className = '',
  showIcon = true,
  compact = false,
}) => {
  const {
    academicYear,
    activeAcademicYear,
    isHistoricalViewing,
    setAcademicYear,
    resetToActiveYear,
    academicYears,
    loading
  } = useAcademicYear();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (year: string) => {
    setAcademicYear(year);
    setIsOpen(false);
  };

  const handleResetToActive = () => {
    resetToActiveYear();
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={
          isHistoricalViewing
            ? `Viewing Historical Session: ${academicYear} (Institutional Active: ${activeAcademicYear})`
            : `Active Academic Year: ${academicYear}`
        }
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all select-none shadow-xs font-bold text-xs cursor-pointer ${
          isOpen
            ? 'bg-neutral-900 text-white border-neutral-950 dark:bg-white dark:text-neutral-900 ring-2 ring-blue-500/20'
            : isHistoricalViewing
            ? 'border-amber-300 dark:border-amber-700/80 bg-amber-50/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100/90'
            : 'border-neutral-200/90 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:border-neutral-300'
        }`}
      >
        {showIcon && (
          isHistoricalViewing ? (
            <History className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          ) : (
            <Calendar
              className={`w-3.5 h-3.5 shrink-0 ${
                isOpen ? 'text-blue-400 dark:text-blue-600' : 'text-neutral-500 dark:text-neutral-400'
              }`}
            />
          )
        )}
        <span className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
          AY:
        </span>
        <span className="font-extrabold font-mono tracking-tight text-xs">
          {academicYear}
        </span>

        {isHistoricalViewing && !compact && (
          <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-200/70 text-amber-900 dark:bg-amber-900/60 dark:text-amber-300 uppercase tracking-wider">
            History
          </span>
        )}

        <ChevronDown
          className={`w-3.5 h-3.5 ml-0.5 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-white dark:text-neutral-900' : 'text-neutral-400'
          }`}
        />
      </button>

      {/* Material Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3.5 py-2.5 border-b border-neutral-100 dark:border-neutral-800/60">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500 block">
              Academic Session
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                Active Institutional:
              </span>
              <span className="text-[11px] font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {activeAcademicYear}
              </span>
            </div>
          </div>

          <div className="py-1 max-h-56 overflow-y-auto">
            {academicYears.map((ay) => {
              const isSelected = ay.year === academicYear;
              const isGloballyActive = ay.year === activeAcademicYear;

              return (
                <button
                  key={ay.id || ay.year}
                  type="button"
                  onClick={() => handleSelect(ay.year)}
                  className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 font-extrabold'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{ay.year}</span>
                    {isGloballyActive && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Active
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                </button>
              );
            })}
          </div>

          {isHistoricalViewing && (
            <div className="p-1.5 border-t border-neutral-100 dark:border-neutral-800/60">
              <button
                type="button"
                onClick={handleResetToActive}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Return to Active ({activeAcademicYear})</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AcademicYearSelector;

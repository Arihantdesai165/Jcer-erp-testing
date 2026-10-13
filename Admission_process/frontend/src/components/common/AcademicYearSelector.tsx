import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check, Sparkles } from 'lucide-react';
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
  const { academicYear, setAcademicYear, academicYears, loading } = useAcademicYear();
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

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={`Current Global Academic Year: ${academicYear}`}
        className={`flex items-center gap-1 sm:gap-1.5 ${compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} rounded-full border transition-all select-none shadow-xs font-bold cursor-pointer ${
          isOpen
            ? 'bg-neutral-900 text-white border-neutral-950 dark:bg-white dark:text-neutral-900 ring-2 ring-blue-500/20'
            : 'border-neutral-200/90 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:border-neutral-300'
        }`}
      >
        {showIcon && !compact && (
          <Calendar
            className={`w-3.5 h-3.5 shrink-0 ${
              isOpen ? 'text-blue-400 dark:text-blue-600' : 'text-neutral-500 dark:text-neutral-400'
            }`}
          />
        )}
        <span className="text-[10px] sm:text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
          AY:
        </span>
        <span className="font-extrabold font-mono tracking-tight text-[11px] sm:text-xs">
          {academicYear}
        </span>
        <ChevronDown
          className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ml-0.5 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-white dark:text-neutral-900' : 'text-neutral-400'
          }`}
        />
      </button>

      {/* Material Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800/60">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500 block">
              Academic Session
            </span>
            <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 block mt-0.5">
              Global Working Context
            </span>
          </div>

          <div className="py-1 max-h-56 overflow-y-auto">
            {academicYears.map((ay) => {
              const isSelected = ay.year === academicYear;
              return (
                <button
                  key={ay.id || ay.year}
                  type="button"
                  onClick={() => handleSelect(ay.year)}
                  className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 font-extrabold'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{ay.year}</span>
                    {ay.isCurrent && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Current
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicYearSelector;

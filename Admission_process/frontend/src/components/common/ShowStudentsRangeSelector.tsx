import React from 'react';
import { Users } from 'lucide-react';

export interface ShowStudentsRangeSelectorProps {
  value: number;
  onChange: (limit: number) => void;
  options?: number[];
  className?: string;
  id?: string;
}

export const ShowStudentsRangeSelector: React.FC<ShowStudentsRangeSelectorProps> = ({
  value,
  onChange,
  options = [10, 50, 100, 500],
  className = '',
  id = 'show-students-range-select',
}) => {
  return (
    <div className={`shrink-0 flex items-center gap-2.5 self-end md:self-auto pl-0 md:pl-3 md:border-l border-neutral-200 dark:border-neutral-700 ${className}`}>
      <div className="flex items-center gap-2.5 px-3 py-1.5 bg-blue-50/90 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl shadow-xs transition-all hover:border-blue-300">
        <label
          htmlFor={id}
          className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
        >
          <Users size={14} className="text-blue-600 dark:text-blue-400" />
          <span>SHOW STUDENTS</span>
        </label>
        <div className="relative">
          <select
            id={id}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="bg-white dark:bg-neutral-900 border border-blue-300 dark:border-blue-700 rounded-lg pl-3 pr-7 py-1 text-xs font-black text-blue-950 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs appearance-none font-mono"
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                1–{opt}
              </option>
            ))}
          </select>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-blue-600 dark:text-blue-400 text-[10px] font-bold">
            ▼
          </span>
        </div>
      </div>
    </div>
  );
};

export default ShowStudentsRangeSelector;

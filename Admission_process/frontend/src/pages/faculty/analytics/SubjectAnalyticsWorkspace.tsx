import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  CalendarCheck,
  Award,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import facultyService, {
  AnalyticsSubjectItem,
  AttendanceAnalyticsResult,
  MarksAnalyticsResult,
} from '../../../services/faculty.service';
import AttendanceAnalyticsTab from './AttendanceAnalyticsTab';
import MarksAnalyticsTab from './MarksAnalyticsTab';

interface SubjectAnalyticsWorkspaceProps {
  subject: AnalyticsSubjectItem;
  semester: number;
  academicYear?: string;
  onNavigateToSemesters: () => void;
  onNavigateToSubjects: () => void;
}

export const SubjectAnalyticsWorkspace: React.FC<SubjectAnalyticsWorkspaceProps> = ({
  subject,
  semester,
  academicYear,
  onNavigateToSemesters,
  onNavigateToSubjects,
}) => {
  // Navigation tabs: 'ATTENDANCE' | 'MARKS'
  const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'MARKS'>('ATTENDANCE');

  // Selected section: 'ALL' or specific section (e.g. 'Section D')
  const [selectedSection, setSelectedSection] = useState<string>('ALL');

  // Attendance specific filters
  const [dateRange, setDateRange] = useState<string>('ALL');

  // Marks specific filters
  const [assessmentType, setAssessmentType] = useState<'CIE1' | 'CIE2' | 'SEE'>('CIE1');

  // Data states
  const [attendanceData, setAttendanceData] = useState<AttendanceAnalyticsResult | null>(null);
  const [marksData, setMarksData] = useState<MarksAnalyticsResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load Attendance Data
  const loadAttendanceAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await facultyService.getAnalyticsAttendance({
        subjectId: subject.subjectId,
        semester,
        section: selectedSection,
        academicYear,
        dateRange,
      });
      setAttendanceData(res);
    } catch (err: any) {
      console.error('Failed to load attendance analytics:', err);
      setError(err?.response?.data?.error || err?.message || 'Failed to load attendance analytics');
    } finally {
      setLoading(false);
    }
  }, [subject.subjectId, semester, selectedSection, academicYear, dateRange]);

  // Load Marks Data
  const loadMarksAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await facultyService.getAnalyticsMarks({
        subjectId: subject.subjectId,
        semester,
        section: selectedSection,
        academicYear,
        assessmentType,
      });
      setMarksData(res);
    } catch (err: any) {
      console.error('Failed to load marks analytics:', err);
      setError(err?.response?.data?.error || err?.message || 'Failed to load marks analytics');
    } finally {
      setLoading(false);
    }
  }, [subject.subjectId, semester, selectedSection, academicYear, assessmentType]);

  // Fetch based on active tab
  useEffect(() => {
    if (activeTab === 'ATTENDANCE') {
      loadAttendanceAnalytics();
    } else {
      loadMarksAnalytics();
    }
  }, [activeTab, loadAttendanceAnalytics, loadMarksAnalytics]);

  const refreshCurrentView = () => {
    if (activeTab === 'ATTENDANCE') loadAttendanceAnalytics();
    else loadMarksAnalytics();
  };

  return (
    <div className="space-y-5">
      {/* ── Breadcrumb & Top Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold flex-wrap">
          <button
            onClick={onNavigateToSemesters}
            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            Analytics
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          <button
            onClick={onNavigateToSubjects}
            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            Semester {semester}
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          <span className="font-bold text-neutral-900 dark:text-white">
            {subject.subjectName} ({subject.subjectCode})
          </span>
        </div>

        {/* Back and Refresh Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onNavigateToSubjects}
            className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <button
            onClick={refreshCurrentView}
            disabled={loading}
            className="p-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 text-neutral-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Subject Info Banner + Section Selector + Primary Tabs ───────────────── */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 sm:p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/70 dark:border-neutral-700">
                {subject.subjectCode}
              </span>
              <span className="text-xs font-semibold text-neutral-400">
                Semester {semester} • AY {academicYear || '2026-27'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
              {subject.subjectName}
            </h1>
          </div>

          {/* Section Selector */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl w-fit">
            {subject.sections.length > 1 && (
              <button
                onClick={() => setSelectedSection('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedSection === 'ALL'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                All Sections ({subject.sections.length})
              </button>
            )}
            {subject.sections.map((sec) => (
              <button
                key={sec}
                onClick={() => setSelectedSection(sec)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedSection === sec
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
        </div>

        {/* Primary Segmented Tabs Switch */}
        <div className="flex items-center gap-2 border-t border-neutral-100 dark:border-neutral-800 pt-4">
          <button
            onClick={() => setActiveTab('ATTENDANCE')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ATTENDANCE'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                : 'bg-neutral-50 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Attendance Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('MARKS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'MARKS'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                : 'bg-neutral-50 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Academic Marks Analytics</span>
          </button>
        </div>
      </div>

      {/* ── Content View ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-neutral-400 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500 mb-2" />
          <p className="text-xs font-semibold">
            Computing live {activeTab === 'ATTENDANCE' ? 'attendance' : 'academic marks'} analytics...
          </p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-red-200 dark:border-red-900/40 shadow-xs space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={refreshCurrentView}
            className="px-4 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors cursor-pointer"
          >
            Retry Request
          </button>
        </div>
      ) : activeTab === 'ATTENDANCE' && attendanceData ? (
        <AttendanceAnalyticsTab
          data={attendanceData}
          dateRange={dateRange}
          onDateRangeChange={(range) => setDateRange(range)}
        />
      ) : activeTab === 'MARKS' && marksData ? (
        <MarksAnalyticsTab
          data={marksData}
          selectedAssessmentType={assessmentType}
          onAssessmentTypeChange={(type) => setAssessmentType(type)}
        />
      ) : (
        <div className="p-12 text-center text-neutral-400 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800">
          No analytics data available for this selection.
        </div>
      )}
    </div>
  );
};

export default SubjectAnalyticsWorkspace;

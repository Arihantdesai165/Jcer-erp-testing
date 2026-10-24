import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
} from 'lucide-react';
import facultyService, {
  AnalyticsSemesterItem,
  AnalyticsSubjectItem,
} from '../../services/faculty.service';
import { useAcademicYear } from '../../context/AcademicYearContext';
import SemesterSelectorView from './analytics/SemesterSelectorView';
import SubjectSelectorView from './analytics/SubjectSelectorView';
import SubjectAnalyticsWorkspace from './analytics/SubjectAnalyticsWorkspace';

type AnalyticsStep = 'SEMESTERS' | 'SUBJECTS' | 'WORKSPACE';

export const FacultyAnalyticsPage: React.FC = () => {
  const { academicYear } = useAcademicYear();

  // Navigation state machine
  const [currentStep, setCurrentStep] = useState<AnalyticsStep>('SEMESTERS');
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<AnalyticsSubjectItem | null>(null);

  // Data states
  const [semesters, setSemesters] = useState<AnalyticsSemesterItem[]>([]);
  const [subjects, setSubjects] = useState<AnalyticsSubjectItem[]>([]);
  const [loadingSemesters, setLoadingSemesters] = useState<boolean>(true);
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(false);

  // Total assigned courses count across all assigned semesters
  const totalCoursesCount = semesters.reduce((acc, s) => acc + s.assignedSubjectsCount, 0);

  // Step 1: Load Semesters
  const loadSemesters = useCallback(async () => {
    try {
      setLoadingSemesters(true);
      const res = await facultyService.getAnalyticsSemesters(academicYear);
      setSemesters(res || []);
    } catch (err) {
      console.error('Failed to load faculty analytics semesters:', err);
      setSemesters([]);
    } finally {
      setLoadingSemesters(false);
    }
  }, [academicYear]);

  // Step 2: Load Subjects for selected semester
  const loadSubjects = useCallback(
    async (semesterNum: number) => {
      try {
        setLoadingSubjects(true);
        const res = await facultyService.getAnalyticsSubjects(semesterNum, academicYear);
        setSubjects(res || []);
      } catch (err) {
        console.error('Failed to load faculty analytics subjects:', err);
        setSubjects([]);
      } finally {
        setLoadingSubjects(false);
      }
    },
    [academicYear]
  );

  // Reload semesters when academicYear changes
  useEffect(() => {
    loadSemesters();
    // Reset to semesters view when academic year changes to prevent invalid state
    setCurrentStep('SEMESTERS');
    setSelectedSemester(null);
    setSelectedSubject(null);
  }, [loadSemesters]);

  // Handle semester selection -> Move to Step 2
  const handleSelectSemester = (semNum: number) => {
    setSelectedSemester(semNum);
    loadSubjects(semNum);
    setCurrentStep('SUBJECTS');
  };

  // Handle subject selection -> Move to Step 3
  const handleSelectSubject = (subj: AnalyticsSubjectItem) => {
    setSelectedSubject(subj);
    setCurrentStep('WORKSPACE');
  };

  // Back to Semesters (from Step 2 or 3)
  const handleBackToSemesters = () => {
    setCurrentStep('SEMESTERS');
    setSelectedSemester(null);
    setSelectedSubject(null);
  };

  // Back to Subjects (from Step 3)
  const handleBackToSubjects = () => {
    setCurrentStep('SUBJECTS');
    setSelectedSubject(null);
  };

  const handleGlobalRefresh = () => {
    if (currentStep === 'SEMESTERS') {
      loadSemesters();
    } else if (currentStep === 'SUBJECTS' && selectedSemester !== null) {
      loadSubjects(selectedSemester);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header Banner ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-neutral-900 text-white rounded-2xl px-6 py-3.5 shadow-sm border border-neutral-800">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">
              Academic Analytics Engine
            </span>
            <div className="text-3xl font-black mt-0.5">
              {totalCoursesCount}{' '}
              <span className="text-sm font-semibold text-neutral-400">assigned courses</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {currentStep !== 'WORKSPACE' && (
            <button
              onClick={handleGlobalRefresh}
              disabled={loadingSemesters || loadingSubjects}
              className="px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs sm:text-sm font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw
                className={`w-4 h-4 text-neutral-500 ${
                  loadingSemesters || loadingSubjects ? 'animate-spin' : ''
                }`}
              />
              <span>Refresh</span>
            </button>
          )}

          <div className="px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs sm:text-sm font-bold text-neutral-700 dark:text-neutral-300 shadow-xs flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <span>AY {academicYear || '2026-27'} Active Term</span>
          </div>
        </div>
      </div>

      {/* ── Step Views ───────────────────────────────────────────────────────────── */}
      {currentStep === 'SEMESTERS' && (
        <SemesterSelectorView
          semesters={semesters}
          loading={loadingSemesters}
          onSelectSemester={handleSelectSemester}
        />
      )}

      {currentStep === 'SUBJECTS' && selectedSemester !== null && (
        <SubjectSelectorView
          semester={selectedSemester}
          subjects={subjects}
          loading={loadingSubjects}
          onBack={handleBackToSemesters}
          onSelectSubject={handleSelectSubject}
        />
      )}

      {currentStep === 'WORKSPACE' && selectedSubject !== null && selectedSemester !== null && (
        <SubjectAnalyticsWorkspace
          subject={selectedSubject}
          semester={selectedSemester}
          academicYear={academicYear}
          onNavigateToSemesters={handleBackToSemesters}
          onNavigateToSubjects={handleBackToSubjects}
        />
      )}
    </div>
  );
};

export default FacultyAnalyticsPage;

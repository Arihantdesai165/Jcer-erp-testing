import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import studentService, { StudentOverviewData } from '../../services/student.service';
import { ProfileAvatar } from '../../components/common/ProfileAvatar';
import {
  CalendarCheck,
  Award,
  BookOpen,
  GraduationCap,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  RefreshCw,
} from 'lucide-react';

export const StudentOverviewPage: React.FC = () => {
  const [data, setData] = useState<StudentOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await studentService.getOverview();
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load academic overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-44 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl animate-pulse" />
          <div className="h-32 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl animate-pulse" />
          <div className="h-32 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl animate-pulse" />
        </div>
        <div className="h-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 text-center space-y-4 max-w-lg mx-auto mt-12 shadow-sm">
        <div className="size-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="font-extrabold text-neutral-900 dark:text-white text-base">Unable to Load Overview</h3>
        <p className="text-xs text-neutral-500">{error || 'Student academic profile could not be retrieved.'}</p>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const { student, attendanceSummary, publishedMarksSummary, recentAcademicUpdates } = data;
  const overallAtt = attendanceSummary?.overallPercentage ?? 0;
  const isAttShortage = overallAtt < 75;

  return (
    <div className="space-y-6">
      {/* ── ADMISSION APPLICATION ACTIVE BANNER ── */}
      {data.isAdmissionApplicant && (
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-orange-500/10 border-2 border-amber-500/40 dark:border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="size-11 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="font-black text-neutral-900 dark:text-white text-base">
                    Admission Application Active
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[11px] font-extrabold uppercase tracking-wider">
                    Status: {data.admissionStatus || 'In Progress'}
                  </span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-2xl font-medium">
                  Your student identity is registered in the JCER ERP System. Academic attendance tracking and Continuous Internal Evaluations (CIE) will activate automatically once semester classes commence. You can track and complete your application stages directly on the Admission Portal.
                </p>
              </div>
            </div>

            <Link
              to={data.admissionDashboardUrl || '/admission/dashboard'}
              className="self-start sm:self-center inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex-shrink-0"
            >
              <span>Go to Admission Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* ── TOP HERO PROFILE CARD ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#070e22] via-[#0c1a40] to-[#1e3a8a] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-950">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <ProfileAvatar
              name={student.name}
              size="lg"
              className="border-4 border-white/20 shadow-2xl flex-shrink-0"
            />
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">{student.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 text-[11px] font-mono font-bold">
                  {student.usn}
                </span>
              </div>
              <p className="text-xs text-indigo-200/90 font-medium">
                {student.department?.name || 'Department'} • {student.program || 'Engineering'}
              </p>
              <div className="flex items-center gap-3 pt-1 text-[11px] text-indigo-300 font-semibold flex-wrap">
                <span className="inline-flex items-center gap-1 bg-white/10 px-2.5 py-0.5 rounded-md">
                  <GraduationCap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Semester {student.semester}</span>
                </span>
                {student.section && (
                  <span className="inline-flex items-center gap-1 bg-white/10 px-2.5 py-0.5 rounded-md">
                    <span>Section: {student.section}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 bg-white/10 px-2.5 py-0.5 rounded-md">
                  <span>AY: {student.academicYear}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Profile Link */}
          <Link
            to="/student/profile"
            className="self-start md:self-center flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 backdrop-blur-xs transition-all shadow-sm"
          >
            <span>View Full Profile</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ── KEY ACADEMIC KPI STATS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Attendance Percentage Card */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              Overall Attendance
            </span>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-black ${isAttShortage ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {overallAtt.toFixed(1)}%
              </span>
              <span className="text-xs text-neutral-400">
                ({attendanceSummary.attendedClasses}/{attendanceSummary.totalClasses} classes)
              </span>
            </div>
            <p className="text-[11px] text-neutral-500">
              {isAttShortage ? '⚠️ Below standard 75% threshold' : '✅ Attendance criteria satisfied'}
            </p>
          </div>
          <div className={`size-12 rounded-2xl flex items-center justify-center ${isAttShortage ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600'}`}>
            <CalendarCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Published CIE Marks Card */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              Published CIEs
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {publishedMarksSummary.totalAssessmentsPublished}
              </span>
              <span className="text-xs text-neutral-400">assessments released</span>
            </div>
            <p className="text-[11px] text-neutral-500">Approved by Department HOD</p>
          </div>
          <div className="size-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Enrolled Subjects Card */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              Current Subjects
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-neutral-900 dark:text-white">
                {attendanceSummary.subjects.length}
              </span>
              <span className="text-xs text-neutral-400">tracked courses</span>
            </div>
            <p className="text-[11px] text-neutral-500">Semester {student.semester} curriculum</p>
          </div>
          <div className="size-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ── TWO-COLUMN GRID: ATTENDANCE SUMMARY & PUBLISHED RESULTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Subject-wise Attendance Quick Breakdown */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
                <CalendarCheck className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-neutral-900 dark:text-white text-sm">Subject Attendance</h3>
            </div>
            <Link
              to="/student/attendance"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>Full Details</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {attendanceSummary.subjects.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              No attendance sessions recorded yet for this semester.
            </div>
          ) : (
            <div className="space-y-3">
              {attendanceSummary.subjects.slice(0, 5).map((subj) => {
                const isShortage = subj.percentage < 75;
                return (
                  <div
                    key={subj.subjectId}
                    className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between"
                  >
                    <div className="space-y-0.5 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-neutral-900 dark:text-white">
                          {subj.subjectCode}
                        </span>
                        <span className="text-xs text-neutral-500 truncate max-w-[180px] sm:max-w-[220px]">
                          {subj.subjectName}
                        </span>
                      </div>
                      <span className="text-[11px] text-neutral-400">
                        Attended: {subj.attendedSessions} / {subj.totalSessions} sessions
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${isShortage ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'}`}>
                        {subj.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Published CIE Results Quick Summary */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-neutral-900 dark:text-white text-sm">Published CIE Results</h3>
            </div>
            <Link
              to="/student/marks"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>View All Marks</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {publishedMarksSummary.assessments.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400 space-y-2">
              <Clock className="w-6 h-6 mx-auto text-neutral-300 dark:text-neutral-600" />
              <p>CIE assessments are currently in progress or awaiting official HOD publication.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {publishedMarksSummary.assessments.slice(0, 5).map((assessment) => (
                <div
                  key={assessment.id}
                  className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between"
                >
                  <div className="space-y-0.5 min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-neutral-900 dark:text-white">
                        {assessment.assessmentName}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-500">
                        • {assessment.subjectCode}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 truncate max-w-[200px]">
                      {assessment.subjectName}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                      {assessment.marksObtained !== null ? assessment.marksObtained : '—'} / {assessment.maximumMarks}
                    </span>
                    {assessment.percentage !== null && (
                      <span className="block text-[10px] text-neutral-400">
                        ({assessment.percentage.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RECENT ACADEMIC ACTIVITY TIMELINE ── */}
      {recentAcademicUpdates.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-neutral-500" />
            <h3 className="font-extrabold text-neutral-900 dark:text-white text-sm">Recent Academic Updates</h3>
          </div>
          <div className="space-y-2.5">
            {recentAcademicUpdates.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850/60 text-xs text-neutral-600 dark:text-neutral-300"
              >
                <div className="flex items-center gap-2.5">
                  <span className="size-2 rounded-full bg-indigo-500" />
                  <span className="font-bold text-neutral-900 dark:text-white">{item.title}</span>
                  <span className="text-neutral-400">• {item.details}</span>
                </div>
                <span className="text-[11px] text-neutral-400">
                  {new Date(item.timestamp).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentOverviewPage;

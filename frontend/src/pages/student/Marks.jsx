import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { studentApi } from '../../api/student.api';
import { getSemestersUpToYear } from '../../utils/semester';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { SGPACGPACard } from '../../components/marks/SGPACGPACard';
import useAuthStore from '../../store/authStore';
import { TrendingUp } from 'lucide-react';

const StudentMarks = () => {
  const { user } = useAuthStore();
  // Default to student's current semester so SGPA loads immediately
  const [semester, setSemester] = useState(String(user?.semester || ''));

  const { data: marksRaw, isLoading: lm } = useQuery({
    queryKey: ['student-marks', semester],
    queryFn: () => studentApi.getMarks(semester ? { semester } : {}),
  });

  const { data: sgpaRaw, isLoading: ls } = useQuery({
    queryKey: ['student-sgpa', user?.year, semester],
    queryFn: () => studentApi.getSGPA({ year: user?.year, semester }),
    enabled: !!user?.year && !!semester,
  });

  const { data: cgpaRaw, isLoading: lc } = useQuery({
    queryKey: ['student-cgpa'],
    queryFn: studentApi.getCGPA,
  });

  // Normalise API response — handles both { data: {...} } and direct object
  const sgpaData = sgpaRaw?.data ?? sgpaRaw;
  const cgpaData = cgpaRaw?.data ?? cgpaRaw;
  const marks = marksRaw?.data ?? marksRaw ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Marks" description="Your academic performance across all subjects" />

  

      {/* ── Semester filter ── */}
      <div className="flex gap-3 items-center">
        <label className="text-sm font-medium text-gray-700">Semester</label>
        <select
          className="input w-44"
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
        >
          <option value="">All Semesters</option>
          {getSemestersUpToYear(user?.year).map((s) => (
            <option key={s} value={s}>Semester {s}</option>
          ))}
        </select>
        {semester && (
          <button
            className="text-xs text-gray-400 hover:text-gray-600 underline"
            onClick={() => setSemester('')}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Marks breakdown ── */}
      {lm ? (
        <LoadingSpinner />
      ) : !marks || marks.length === 0 ? (
        <EmptyState
          title="No marks recorded yet"
          description="Marks will appear here once your faculty has entered and locked them."
        />
      ) : (
        <div className="space-y-4">
          {marks.map((subject) => {
            // Calculate subject total
            const totalObtained = subject.components.reduce((sum, c) => sum + (c.total_marks ?? 0), 0);
            const totalMax = subject.components.reduce((sum, c) => sum + (c.max_marks ?? 0), 0);
            const subjectPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : null;

            return (
              <div key={subject.subject_code} className="card overflow-hidden">
                {/* Subject header */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{subject.subject_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {subject.subject_code} · Semester {subject.semester}
                    </p>
                  </div>
                  {subjectPct !== null && (
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-bold ${subjectPct >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                        {totalObtained} / {totalMax}
                      </p>
                      <p className="text-xs text-gray-400">{subjectPct}% overall</p>
                    </div>
                  )}
                </div>

                {/* Components table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Component</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Obtained</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Max</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Progress</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">%</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {subject.components.map((c, i) => {
                        const pct = c.max_marks > 0
                          ? parseFloat(((c.total_marks / c.max_marks) * 100).toFixed(1))
                          : null;
                        const pass = pct !== null && pct >= 40;
                        const barColor = pct === null ? '#d1d5db' : pct >= 75 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#ef4444';

                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-5 py-3 font-medium text-gray-800">
                              {c.component_name || `Component ${i + 1}`}
                            </td>
                            <td className="px-5 py-3 font-semibold text-gray-900">{c.total_marks ?? '—'}</td>
                            <td className="px-5 py-3 text-gray-500">{c.max_marks}</td>
                            <td className="px-5 py-3">
                              <div className="w-28 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${Math.min(pct ?? 0, 100)}%`, backgroundColor: barColor }}
                                />
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              {pct !== null ? (
                                <span className={`text-xs font-semibold ${pct >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                                  {pct}%
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-5 py-3">
                              {c.total_marks === null || c.total_marks === undefined ? (
                                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Pending</span>
                              ) : c.locked ? (
                                <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">Locked</span>
                              ) : (
                                <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Draft</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Sub-field breakdown */}
                {subject.components.some((c) => c.sub_field_entries?.length > 0) && (
                  <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
                    <p className="text-xs text-gray-500 font-medium mb-2">Sub-field breakdown</p>
                    <div className="flex gap-2 flex-wrap">
                      {subject.components.map((c, i) =>
                        c.sub_field_entries?.map((sf, j) => (
                          <span
                            key={`${i}-${j}`}
                            className="text-xs text-gray-600 bg-white border border-gray-200 rounded px-2 py-1"
                          >
                            {sf.sub_field_id}: <span className="font-medium">{sf.marks_obtained}</span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentMarks;
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { coordinatorApi } from '../../api/coordinator.api';
import { getSemestersForYear } from '../../utils/semester';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../hooks/useToast';

const CoordinatorSubjectMarks = () => {
  const qc    = useQueryClient();
  const toast = useToast();

  const [filters, setFilters] = useState({
    subject_id:        '',
    semester:          '',
    exam_component_id: '',
  });
  const [marksInput, setMarksInput] = useState({});

  // ── My subjects ──
  const { data: subjectsData = [] } = useQuery({
    queryKey: ['coordinator-my-subjects'],
    queryFn:  coordinatorApi.getMySubjects,
  });

  const selectedSubject = subjectsData.find((s) => s._id === filters.subject_id);
  const branchId = selectedSubject?.branch_id?._id || selectedSubject?.branch_id || '';
  const year     = selectedSubject?.year || '';

  // ── Exam pattern ──
  const patternReady = !!(filters.subject_id && filters.semester);

  const { data: patternData, isLoading: loadingPattern } = useQuery({
    queryKey: ['coord-exam-pattern', filters.subject_id, filters.semester],
    queryFn: () => coordinatorApi.getExamPattern({
      subject_id: filters.subject_id,
      semester:   filters.semester,
    }),
    enabled: patternReady,
    onSuccess: () => setFilters((p) => ({ ...p, exam_component_id: '' })),
  });

  const components = patternData?.components || [];
  const allowedComponents = components.filter(
    (c) => c.entered_by === 'faculty' || c.entered_by === 'coordinator'
  );
  const selectedComponent = components.find((c) => c._id === filters.exam_component_id);

  // ── Lock status ──
  const lockReady = !!(filters.subject_id && branchId && year && filters.exam_component_id);
  const { data: lockData } = useQuery({
    queryKey: ['coord-lock-status', filters.subject_id, branchId, year, filters.exam_component_id],
    queryFn: () => coordinatorApi.getMarksLockStatus({
      subject_id:        filters.subject_id,
      branch_id:         branchId,
      year:              year,
      exam_component_id: filters.exam_component_id,
    }),
    enabled: lockReady,
    staleTime: 0,
    cacheTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 5000,
  });

  const isLocked = lockData?.locked ?? false;

  // ── Marks entries ──
  const ready = !!(filters.subject_id && filters.semester && filters.exam_component_id);

  const { data: entriesData, isLoading } = useQuery({
    queryKey: ['coordinator-marks-entries', filters],
    queryFn:  () => coordinatorApi.getMarksEntries({
      subject_id:        filters.subject_id,
      branch_id:         branchId,
      year:              year,
      semester:          filters.semester,
      exam_component_id: filters.exam_component_id,
    }),
    enabled: ready,
    onSuccess: (data) => {
      const init = {};
      (data?.students || []).forEach((s) => {
        if (s.marks?.total_marks !== undefined) init[s._id] = s.marks.total_marks;
      });
      setMarksInput(init);
    },
  });

  const students = entriesData?.students || [];

  // ── Submit ──
  const submit = useMutation({
    mutationFn: (entries) => coordinatorApi.submitMarks({
      subject_id:        filters.subject_id,
      branch_id:         branchId,
      year:              Number(year),
      semester:          Number(filters.semester),
      exam_component_id: filters.exam_component_id,
      entries,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['coordinator-marks-entries']);
      toast.success('Marks saved successfully.');
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const handleSubmit = () => {
    if (isLocked) { toast.error('This component is locked by HOD.'); return; }
    if (!students.length) { toast.error('No students to submit marks for.'); return; }

    const entries = students.map((s) => ({
      student_id:  s._id,
      total_marks: Number(marksInput[s._id] ?? s.marks?.total_marks ?? 0),
      max_marks:   selectedComponent?.max_marks ?? 100,
    }));
    submit.mutate(entries);
  };

  const max = selectedComponent?.max_marks ?? 100;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Subject Marks Entry"
        description="Enter internal marks for your assigned subjects."
      />

      {/* ── Filters ── */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Subject</label>
            <select
              className="input"
              value={filters.subject_id}
              onChange={(e) => {
                setFilters({ subject_id: e.target.value, semester: '', exam_component_id: '' });
                setMarksInput({});
              }}
            >
              <option value="">Select subject</option>
              {subjectsData.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.code}) — Year {s.year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Semester</label>
            <select
              className="input"
              value={filters.semester}
              disabled={!filters.subject_id}
              onChange={(e) => {
                setFilters((p) => ({ ...p, semester: e.target.value, exam_component_id: '' }));
                setMarksInput({});
              }}
            >
              <option value="">Select semester</option>
              {getSemestersForYear(year).map((s) => (
                <option key={s} value={s}>Sem {s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Exam Component</label>
            {loadingPattern ? (
              <div className="input flex items-center text-gray-400 text-xs">Loading components…</div>
            ) : (
              <select
                className="input"
                value={filters.exam_component_id}
                disabled={!patternReady || !allowedComponents.length}
                onChange={(e) => {
                  setFilters((p) => ({ ...p, exam_component_id: e.target.value }));
                  setMarksInput({});
                }}
              >
                <option value="">
                  {!patternReady
                    ? 'Select subject & semester first'
                    : allowedComponents.length === 0
                    ? 'No components available'
                    : 'Select component'}
                </option>
                {allowedComponents.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} — {c.max_marks} marks
                  </option>
                ))}
              </select>
            )}
            {patternReady && !loadingPattern && components.length > 0 && allowedComponents.length === 0 && (
              <p className="text-xs text-orange-600 mt-1">No components assigned for coordinator/faculty entry.</p>
            )}
            {patternReady && !loadingPattern && components.length === 0 && (
              <p className="text-xs text-red-500 mt-1">No exam pattern found for this subject + semester.</p>
            )}
          </div>
        </div>

        {selectedComponent && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
              Max marks: {selectedComponent.max_marks}
            </span>
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
              Weightage: {selectedComponent.weightage_percent}%
            </span>
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
              Pass marks: {selectedComponent.pass_marks}
            </span>
            {selectedComponent.include_in_sgpa && (
              <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full">
                Included in SGPA
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Locked banner ── */}
      {ready && isLocked && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <Lock className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            This component has been locked by the HOD. Marks cannot be edited.
          </p>
        </div>
      )}

      {!ready && (
        <EmptyState title="Select filters above" description="Choose subject, semester and component to enter marks." />
      )}

      {ready && isLoading && <LoadingSpinner className="py-16" />}

      {ready && !isLoading && students.length === 0 && (
        <EmptyState title="No students found" description="No active students found for this subject." />
      )}

      {ready && !isLoading && students.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                {selectedComponent?.name} — {students.length} students
                {isLocked && <Lock className="h-3.5 w-3.5 text-red-400" />}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedSubject?.name} ({selectedSubject?.code})
              </p>
            </div>
            {!isLocked && (
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={submit.isPending}
              >
                {submit.isPending ? 'Saving…' : 'Save Marks'}
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Enrollment</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    Marks <span className="text-gray-400 font-normal ml-1">/ {max}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {students.map((s, i) => {
                  const current = marksInput[s._id] ?? s.marks?.total_marks ?? '';
                  const pct     = current !== '' ? Math.round((Number(current) / max) * 100) : null;
                  return (
                    <tr key={s._id} className={`hover:bg-gray-50 ${isLocked ? 'bg-gray-50' : ''}`}>
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{s.enrollment_number}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {isLocked ? (
                            <span className="text-gray-700 font-medium w-24 inline-block">
                              {current !== '' ? current : '—'}
                            </span>
                          ) : (
                            <input
                              type="number"
                              className="input w-24"
                              min={0}
                              max={max}
                              value={current}
                              onChange={(e) =>
                                setMarksInput((p) => ({ ...p, [s._id]: e.target.value }))
                              }
                            />
                          )}
                          {pct !== null && (
                            <span className={`text-xs font-medium ${pct >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                              {pct}%
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoordinatorSubjectMarks;
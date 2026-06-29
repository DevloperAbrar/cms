import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Save, Lock } from 'lucide-react';
import { facultyApi } from '../../api/faculty.api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { CSVTemplateDownload } from '../../components/marks/CSVTemplateDownload';
import { MarksCSVUpload } from '../../components/marks/MarksCSVUpload';
import toast from 'react-hot-toast';

const FacultyMarks = () => {
  const [filters, setFilters] = useState({
    subject_id: '',
    branch_id: '',
    year: '',
    semester: '',
    exam_component_id: '',
  });
  const [marksMap, setMarksMap] = useState({});

  const { data: subjects = [] } = useQuery({
    queryKey: ['faculty-subjects'],
    queryFn: facultyApi.getMySubjects,
  });

  const selectedSubject = subjects.find((s) => s._id === filters.subject_id);

  const patternReady = !!(filters.subject_id && filters.semester);
  const { data: patternData, isLoading: loadingPattern } = useQuery({
    queryKey: ['faculty-exam-pattern', filters.subject_id, filters.semester],
    queryFn: () => facultyApi.getExamPattern({
      subject_id: filters.subject_id,
      semester: filters.semester,
    }),
    enabled: patternReady,
    onSuccess: () => setFilters((p) => ({ ...p, exam_component_id: '' })),
  });

  const components = patternData?.components || [];
  const allowedComponents = components.filter((c) => c.entered_by === 'faculty');
  const selectedComponent = components.find((c) => c._id === filters.exam_component_id);

  // Lock status check
  const lockReady = !!(filters.subject_id && filters.branch_id && filters.year && filters.exam_component_id);
  const { data: lockData } = useQuery({
    queryKey: ['faculty-lock-status', filters.subject_id, filters.branch_id, filters.year, filters.exam_component_id],
    queryFn: () => facultyApi.getMarksLockStatus({
      subject_id:        filters.subject_id,
      branch_id:         filters.branch_id,
      year:              filters.year,
      exam_component_id: filters.exam_component_id,
    }),
    enabled: lockReady,
    staleTime: 0,
    cacheTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 5000,   // poll every 5s so unlock reflects without page refresh
  });

  const isLocked = lockData?.locked ?? false;

  const ready = !!(
    filters.subject_id && filters.branch_id && filters.year &&
    filters.semester && filters.exam_component_id
  );

  const { data, isLoading } = useQuery({
    queryKey: ['faculty-marks-entries', filters],
    queryFn: () => facultyApi.getMarksEntries(filters),
    enabled: ready,
    onSuccess: (res) => {
      const init = {};
      (res?.students || []).forEach((s) => {
        if (s.marks?.total_marks !== undefined) init[s._id] = s.marks.total_marks;
      });
      setMarksMap(init);
    },
  });

  const students       = data?.students       || [];
  const subFieldConfig = data?.sub_field_config || null;
  const hasSubFields   = subFieldConfig?.sub_fields?.length > 0;

  const submitMutation = useMutation({
    mutationFn: (entries) =>
      facultyApi.submitMarks({
        ...filters,
        year:     Number(filters.year),
        semester: Number(filters.semester),
        entries,
      }),
    onSuccess: () => toast.success('Marks submitted successfully.'),
    onError:   (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const handleSubmit = () => {
    if (isLocked) { toast.error('This component is locked by HOD.'); return; }
    if (!students.length) { toast.error('No students to submit.'); return; }

    const entries = students.map((s) => {
      const changes = marksMap[s._id] || {};
      if (hasSubFields) {
        const sub_field_entries = subFieldConfig.sub_fields.map((sf) => ({
          sub_field_id: sf._id,
          marks_obtained: Number(
            changes[sf._id] ??
            s.marks?.sub_field_entries?.find(
              (e) => e.sub_field_id?.toString() === sf._id?.toString()
            )?.marks_obtained ?? 0
          ),
        }));
        return {
          student_id: s._id,
          sub_field_entries,
          max_marks: subFieldConfig.sub_fields.reduce((sum, sf) => sum + sf.max_marks, 0),
        };
      }
      return {
        student_id:  s._id,
        total_marks: Number(changes['total'] ?? s.marks?.total_marks ?? 0),
        max_marks:   selectedComponent?.max_marks ?? 0,
      };
    });

    submitMutation.mutate(entries);
  };

  const handleChange = useCallback((studentId, field, value) => {
    if (isLocked) return;
    setMarksMap((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [field]: value },
    }));
  }, [isLocked]);

  const max = selectedComponent?.max_marks ?? 100;

  return (
    <div className="space-y-4">
      <PageHeader title="Marks Entry" description="Enter marks for your assigned subjects." />

      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Subject</label>
            <select
              className="input"
              value={filters.subject_id}
              onChange={(e) => {
                const sub = subjects.find((s) => s._id === e.target.value);
                setFilters({
                  subject_id:        e.target.value,
                  branch_id:         sub?.branch_id?._id || sub?.branch_id || '',
                  year:              String(sub?.year || ''),
                  semester:          '',
                  exam_component_id: '',
                });
                setMarksMap({});
              }}
            >
              <option value="">Select subject</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.code}) — Year {s.year}</option>
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
                setMarksMap({});
              }}
            >
              <option value="">Select semester</option>
              {[1,2,3,4,5,6,7,8].map((s) => (
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
                  setMarksMap({});
                }}
              >
                <option value="">
                  {!patternReady ? 'Select subject & semester first'
                    : allowedComponents.length === 0 ? 'No components available'
                    : 'Select component'}
                </option>
                {allowedComponents.map((c) => (
                  <option key={c._id} value={c._id}>{c.name} — {c.max_marks} marks</option>
                ))}
              </select>
            )}
            {patternReady && !loadingPattern && components.length > 0 && allowedComponents.length === 0 && (
              <p className="text-xs text-orange-600 mt-1">No components assigned to faculty for this pattern.</p>
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

      {/* Locked banner */}
      {ready && isLocked && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <Lock className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            This component has been locked by the HOD. Marks cannot be edited.
          </p>
        </div>
      )}

      {/* CSV tools — hidden when locked */}
      {ready && !isLocked && (
        <div className="flex items-center gap-3">
          <CSVTemplateDownload
            onDownload={() => facultyApi.downloadMarksTemplate(filters)}
            filename="marks_template.csv"
          />
          <MarksCSVUpload
            onUpload={(fd) => facultyApi.uploadMarksCSV(fd)}
            isLoading={false}
          />
        </div>
      )}

      {!ready && (
        <EmptyState
          title="Select filters above"
          description="Choose subject, semester, and exam component to enter marks."
        />
      )}

      {ready && (
        <div className="card">
          {isLoading ? (
            <LoadingSpinner className="py-8" />
          ) : students.length === 0 ? (
            <EmptyState title="No students found" description="No active students found for this subject." />
          ) : (
            <>
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
                    className="btn-primary flex items-center gap-2"
                    onClick={handleSubmit}
                    disabled={submitMutation.isPending}
                  >
                    <Save className="h-4 w-4" />
                    {submitMutation.isPending ? 'Saving…' : 'Submit Marks'}
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
                      {hasSubFields
                        ? subFieldConfig.sub_fields.map((sf) => (
                            <th key={sf._id} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                              {sf.name} <span className="text-gray-400 font-normal">/{sf.max_marks}</span>
                            </th>
                          ))
                        : (
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                            Marks <span className="text-gray-400 font-normal">/ {max}</span>
                          </th>
                        )
                      }
                      {hasSubFields && (
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {students.map((s, i) => {
                      const changes = marksMap[s._id] || {};

                      if (hasSubFields) {
                        const subTotal = subFieldConfig.sub_fields.reduce((sum, sf) => {
                          const v = changes[sf._id] ??
                            s.marks?.sub_field_entries?.find(
                              (e) => e.sub_field_id?.toString() === sf._id?.toString()
                            )?.marks_obtained;
                          return sum + (v !== undefined && v !== '' ? Number(v) : 0);
                        }, 0);
                        const subMax = subFieldConfig.sub_fields.reduce((sum, sf) => sum + sf.max_marks, 0);
                        const pct = subMax > 0 ? Math.round((subTotal / subMax) * 100) : null;

                        return (
                          <tr key={s._id} className={`hover:bg-gray-50 ${isLocked ? 'bg-gray-50' : ''}`}>
                            <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{s.enrollment_number}</td>
                            {subFieldConfig.sub_fields.map((sf) => {
                              const entry = s.marks?.sub_field_entries?.find(
                                (e) => e.sub_field_id?.toString() === sf._id?.toString()
                              );
                              const val = changes[sf._id] ?? entry?.marks_obtained ?? '';
                              return (
                                <td key={sf._id} className="px-4 py-3">
                                  {isLocked ? (
                                    <span className="text-gray-700 font-medium">{val !== '' ? val : '—'}</span>
                                  ) : (
                                    <input
                                      type="number" min={0} max={sf.max_marks}
                                      className="input w-20" value={val}
                                      onChange={(e) => handleChange(s._id, sf._id, e.target.value)}
                                    />
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-800">{subTotal}</span>
                                {pct !== null && (
                                  <span className={`text-xs font-medium ${pct >= 50 ? 'text-green-600' : 'text-red-500'}`}>{pct}%</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      const current = changes['total'] ?? s.marks?.total_marks ?? '';
                      const pct = current !== '' ? Math.round((Number(current) / max) * 100) : null;

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
                                  type="number" className="input w-24" min={0} max={max}
                                  value={current}
                                  onChange={(e) => handleChange(s._id, 'total', e.target.value)}
                                />
                              )}
                              {pct !== null && (
                                <span className={`text-xs font-medium ${pct >= 50 ? 'text-green-600' : 'text-red-500'}`}>{pct}%</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FacultyMarks;
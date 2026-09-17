import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { examControllerApi } from '../../api/examcontroller.api';
import { getSemestersForYear } from '../../utils/semester';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { MarksTable } from '../../components/marks/MarksTable';
import { CSVTemplateDownload } from '../../components/marks/CSVTemplateDownload';
import { MarksCSVUpload } from '../../components/marks/MarksCSVUpload';
import toast from 'react-hot-toast';

const ExamControllerEndSemMarks = () => {
  const [filters, setFilters] = useState({ branch_id: '', year: '', semester: '', subject_id: '', exam_component_id: '' });
  const [marksMap, setMarksMap] = useState({});
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const { data: branches = [] } = useQuery({ queryKey: ['ec-branches'], queryFn: examControllerApi.getAllBranches });

  const { data: subjects = [] } = useQuery({
    queryKey: ['ec-subjects', filters.branch_id, filters.year],
    queryFn: () => examControllerApi.getAllSubjects({ branch_id: filters.branch_id, year: filters.year }),
    enabled: !!(filters.branch_id && filters.year),
  });

  // Fetch the exam pattern for the selected subject + semester so the
  // Component dropdown only ever shows components that actually exist for it.
  const patternReady = !!(filters.subject_id && filters.semester);
  const { data: patternData, status: patternStatus } = useQuery({
    queryKey: ['ec-exam-pattern', filters.subject_id, filters.semester],
    queryFn: () => examControllerApi.getExamPattern({ subject_id: filters.subject_id, semester: filters.semester }),
    enabled: patternReady,
    retry: false,
    throwOnError: false,
  });

  const [components, setComponents] = useState([]);
  useEffect(() => {
    if (patternStatus === 'success') {
      const comps = patternData?.data?.components || patternData?.components || [];
      // Only components the exam controller (or coordinator, before EC overwrite) is allowed to enter —
      // matches the backend's own check in submitEndSemMarks.
      setComponents(comps.filter((c) => ['examcontroller', 'coordinator'].includes(c.entered_by)));
    } else {
      setComponents([]);
    }
  }, [patternStatus, patternData]);

  const ready = !!(filters.branch_id && filters.year && filters.semester && filters.subject_id && filters.exam_component_id);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['ec-marks-entries', filters],
    queryFn: () => examControllerApi.getMarksEntries(filters),
    enabled: ready,
  });

  const submitMutation = useMutation({
    mutationFn: (payload) => examControllerApi.submitEndSemMarks(payload),
    onSuccess: (data) => {
      if (data?.requires_confirmation) {
        toast('Coordinator already submitted. Click Submit again to overwrite.', { icon: '⚠️' });
        setConfirmOverwrite(true);
      } else {
        toast.success('Marks submitted successfully');
        setConfirmOverwrite(false);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const handleChange = useCallback((studentId, fieldId, value) => {
    setMarksMap((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), [fieldId]: value } }));
  }, []);

  const handleSubmit = () => {
    const entries_data = entries.map((s) => {
      const changes = marksMap[s._id] || {};
      return {
        student_id: s._id,
        total_marks: Number(changes['total'] ?? s.marks?.total_marks ?? 0),
        max_marks: 100,
      };
    });
    submitMutation.mutate({
      ...filters,
      year: Number(filters.year),
      semester: Number(filters.semester),
      entries: entries_data,
      confirm_overwrite: confirmOverwrite,
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="End Semester Marks" description="Enter or upload end semester marks institute-wide" />

      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Branch</label>
            <select className="input" value={filters.branch_id} onChange={(e) => setFilters((p) => ({ ...p, branch_id: e.target.value, subject_id: '' }))}>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select className="input" value={filters.year} onChange={(e) => setFilters((p) => ({ ...p, year: e.target.value, subject_id: '', semester: '' }))}>
              <option value="">Year</option>
              {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Semester</label>
            <select className="input" value={filters.semester} disabled={!filters.year} onChange={(e) => setFilters((p) => ({ ...p, semester: e.target.value }))}>
              <option value="">Semester</option>
              {getSemestersForYear(filters.year).map((s) => <option key={s} value={s}>Sem {s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Subject</label>
            <select className="input" value={filters.subject_id} onChange={(e) => setFilters((p) => ({ ...p, subject_id: e.target.value, exam_component_id: '' }))}>
              <option value="">Select subject</option>
              {subjects.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Exam Component</label>
            <select
              className="input"
              value={filters.exam_component_id}
              disabled={!patternReady || components.length === 0}
              onChange={(e) => setFilters((p) => ({ ...p, exam_component_id: e.target.value }))}
            >
              <option value="">
                {!patternReady ? 'Select subject & semester first' : components.length === 0 ? 'No component configured for EC/coordinator' : 'Select Component'}
              </option>
              {components.map((c) => <option key={c._id} value={c._id}>{c.name} — {c.max_marks} marks</option>)}
            </select>
            {patternReady && patternStatus === 'error' && (
              <p className="text-xs text-red-500 mt-1">No exam pattern found for this year/semester.</p>
            )}
          </div>
        </div>
      </div>

      {ready && (
        <>
          <div className="flex items-center gap-3">
            <CSVTemplateDownload
              onDownload={() => examControllerApi.downloadMarksTemplate({ branch_id: filters.branch_id, year: filters.year })}
              filename="endsem_template.csv"
            />
            <MarksCSVUpload
              onUpload={(fd) => examControllerApi.uploadMarksCSV(fd)}
              isLoading={false}
            />
          </div>

          <div className="card">
            {isLoading ? <LoadingSpinner className="py-8" /> : entries.length === 0 ? (
              <EmptyState title="No students found" />
            ) : (
              <>
                <MarksTable students={entries} onChange={handleChange} />
                <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
                  {confirmOverwrite && (
                    <p className="text-sm text-amber-700 font-medium">⚠ Coordinator marks exist. Submitting will overwrite them.</p>
                  )}
                  <div className="ml-auto">
                    <button className="btn-primary" onClick={handleSubmit} disabled={submitMutation.isPending}>
                      <Save className="h-4 w-4" />
                      {submitMutation.isPending ? 'Submitting...' : confirmOverwrite ? 'Confirm & Overwrite' : 'Submit Marks'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {!ready && <EmptyState title="Select all filters above" description="Choose branch, year, semester, subject, and component to begin." />}
    </div>
  );
};

export default ExamControllerEndSemMarks;
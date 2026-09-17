import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { coordinatorApi } from '../../api/coordinator.api';
import { getSemestersForYear } from '../../utils/semester';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { MarksTable } from '../../components/marks/MarksTable';
import { CSVTemplateDownload } from '../../components/marks/CSVTemplateDownload';
import { MarksCSVUpload } from '../../components/marks/MarksCSVUpload';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const CoordinatorEndSemMarks = () => {
  const { user } = useAuthStore();
  const branches = user?.coordinator_branches || [];
  const [filters, setFilters] = useState({ branch_id: branches[0]?.branch_id?._id || branches[0]?.branch_id || '', year: '', semester: '', subject_id: '', exam_component_id: '' });
  const [marksMap, setMarksMap] = useState({});

  const { data: subjects = [] } = useQuery({
    queryKey: ['coordinator-subjects', filters.branch_id, filters.year],
    queryFn: () => coordinatorApi.getMySubjects(),
    enabled: !!(filters.branch_id && filters.year),
  });

  const ready = !!(filters.branch_id && filters.year && filters.semester && filters.subject_id && filters.exam_component_id);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['coordinator-endsem-entries', filters],
    queryFn: () => coordinatorApi.getMarksEntries(filters),
    enabled: ready,
  });

  const submitMutation = useMutation({
    mutationFn: (data) => coordinatorApi.submitEndSemMarks(data),
    onSuccess: () => toast.success('End semester marks submitted'),
    onError: (e) => toast.error(e.message),
  });

  const handleChange = useCallback((studentId, _, value) => {
    setMarksMap((prev) => ({ ...prev, [studentId]: value }));
  }, []);

  const handleSubmit = () => {
    const submitEntries = entries.map((s) => ({
      student_id: s._id,
      total_marks: Number(marksMap[s._id] ?? s.marks?.total_marks ?? 0),
      max_marks: 100,
    }));
    submitMutation.mutate({ ...filters, year: Number(filters.year), semester: Number(filters.semester), entries: submitEntries });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="End Semester Marks" description="Enter end semester marks for your assigned branch" />

      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {branches.length > 1 && (
            <div>
              <label className="label">Branch</label>
              <select className="input" value={filters.branch_id} onChange={(e) => setFilters((p) => ({ ...p, branch_id: e.target.value }))}>
              {branches.map((b) => (
  <option key={b._id} value={b.branch_id?._id || b.branch_id}>
    {b.branch_id?.name || b.branch_id} (Year {b.year})
  </option>
))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Year</label>
            <select className="input" value={filters.year} onChange={(e) => setFilters((p) => ({ ...p, year: e.target.value, subject_id: '', semester: '' }))}>
              <option value="">Year</option>
              {[1,2,3,4].map((y) => <option key={y} value={y}>Year {y}</option>)}
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
            <select className="input" value={filters.subject_id} onChange={(e) => setFilters((p) => ({ ...p, subject_id: e.target.value }))}>
              <option value="">Select subject</option>
              {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Component ID</label>
            <input className="input" placeholder="Exam component ID" value={filters.exam_component_id} onChange={(e) => setFilters((p) => ({ ...p, exam_component_id: e.target.value }))} />
          </div>
        </div>
      </div>

      {ready && (
        <>
          <div className="flex gap-3">
            <CSVTemplateDownload onDownload={() => coordinatorApi.downloadEndSemTemplate({ branch_id: filters.branch_id, year: filters.year })} filename="endsem_template.csv" />
            <MarksCSVUpload onUpload={(fd) => coordinatorApi.uploadEndSemCSV(fd)} isLoading={false} />
          </div>
          <div className="card">
            {isLoading ? <LoadingSpinner className="py-8" /> : entries.length === 0 ? (
              <EmptyState title="No students found" />
            ) : (
              <>
                <MarksTable students={entries} onChange={handleChange} />
                <div className="px-5 py-4 border-t border-gray-200 flex justify-end">
                  <button className="btn-primary" onClick={handleSubmit} disabled={submitMutation.isPending}>
                    <Save className="h-4 w-4" />
                    {submitMutation.isPending ? 'Submitting...' : 'Submit End Sem Marks'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
      {!ready && <EmptyState title="Select all filters above" />}
    </div>
  );
};

export default CoordinatorEndSemMarks;
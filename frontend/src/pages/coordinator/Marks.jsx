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
import toast from 'react-hot-toast';

const CoordinatorMarks = () => {
  const [filters, setFilters] = useState({ subject_id: '', branch_id: '', year: '', semester: '', exam_component_id: '' });
  const [marksMap, setMarksMap] = useState({});

  const { data: subjects = [] } = useQuery({ queryKey: ['coordinator-subjects'], queryFn: coordinatorApi.getMySubjects });

  const ready = !!(filters.subject_id && filters.branch_id && filters.year && filters.semester && filters.exam_component_id);

  const { data, isLoading } = useQuery({
    queryKey: ['coordinator-marks-entries', filters],
    queryFn: () => coordinatorApi.getMarksEntries(filters),
    enabled: ready,
  });

  const students = data?.students || [];
  const subFieldConfig = data?.sub_field_config || null;

  const submitMutation = useMutation({
    mutationFn: (entries) => coordinatorApi.submitMarks({ ...filters, year: Number(filters.year), semester: Number(filters.semester), entries }),
    onSuccess: () => toast.success('Marks submitted'),
    onError: (e) => toast.error(e.message),
  });

  const handleChange = useCallback((studentId, fieldId, value) => {
    setMarksMap((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), [fieldId]: value } }));
  }, []);

  const handleSubmit = () => {
    const entries = students.map((s) => {
      const changes = marksMap[s._id] || {};
      if (subFieldConfig?.sub_fields?.length) {
        const sub_field_entries = subFieldConfig.sub_fields.map((sf) => ({
          sub_field_id: sf._id,
          marks_obtained: Number(changes[sf._id] ?? s.marks?.sub_field_entries?.find((e) => e.sub_field_id?.toString() === sf._id?.toString())?.marks_obtained ?? 0),
        }));
        return { student_id: s._id, sub_field_entries, max_marks: subFieldConfig.sub_fields.reduce((sum, sf) => sum + sf.max_marks, 0) };
      }
      return { student_id: s._id, total_marks: Number(changes['total'] ?? s.marks?.total_marks ?? 0), max_marks: 100 };
    });
    submitMutation.mutate(entries);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Subject Marks Entry" description="Enter internal marks for your assigned subjects" />

      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Subject</label>
            <select className="input" value={filters.subject_id} onChange={(e) => {
              const sub = subjects.find((s) => s._id === e.target.value);
              setFilters((p) => ({ ...p, subject_id: e.target.value, branch_id: sub?.branch_id?._id || sub?.branch_id || '', year: String(sub?.year || ''), semester: '' }));
            }}>
              <option value="">Select subject</option>
              {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
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
            <label className="label">Component ID</label>
            <input className="input" placeholder="Component ID" value={filters.exam_component_id} onChange={(e) => setFilters((p) => ({ ...p, exam_component_id: e.target.value }))} />
          </div>
        </div>
      </div>

      {ready && (
        <>
          <div className="flex gap-3">
            <CSVTemplateDownload onDownload={() => coordinatorApi.downloadMarksTemplate(filters)} filename="marks_template.csv" />
            <MarksCSVUpload onUpload={(fd) => coordinatorApi.uploadMarksCSV(fd)} isLoading={false} />
          </div>
          <div className="card">
            {isLoading ? <LoadingSpinner className="py-8" /> : students.length === 0 ? (
              <EmptyState title="No students found" />
            ) : (
              <>
                <MarksTable students={students} subFieldConfig={subFieldConfig} onChange={handleChange} />
                <div className="px-5 py-4 border-t border-gray-200 flex justify-end">
                  <button className="btn-primary" onClick={handleSubmit} disabled={submitMutation.isPending}>
                    <Save className="h-4 w-4" />
                    {submitMutation.isPending ? 'Submitting...' : 'Submit Marks'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
      {!ready && <EmptyState title="Select filters above" />}
    </div>
  );
};

export default CoordinatorMarks;
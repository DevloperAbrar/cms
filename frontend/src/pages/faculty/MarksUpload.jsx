import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { facultyApi } from '../../api/faculty.api';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { MarksCSVUpload } from '../../components/marks/MarksCSVUpload';
import { CSVTemplateDownload } from '../../components/marks/CSVTemplateDownload';

const FacultyMarksUpload = () => {
  const [filters, setFilters] = useState({ subject_id: '', branch_id: '', year: '', semester: '', exam_component_id: '' });

  const { data: subjects = [] } = useQuery({
    queryKey: ['faculty-subjects'],
    queryFn: facultyApi.getMySubjects,
  });

  const ready = !!(filters.subject_id && filters.branch_id && filters.year && filters.semester && filters.exam_component_id);

  return (
    <div className="space-y-4">
      <PageHeader title="Marks CSV Upload" description="Download template, fill marks, and upload" />

      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Subject</label>
            <select
              className="input"
              value={filters.subject_id}
              onChange={(e) => {
                const sub = subjects.find((s) => s._id === e.target.value);
                setFilters((p) => ({
                  ...p,
                  subject_id: e.target.value,
                  branch_id: sub?.branch_id?._id || sub?.branch_id || '',
                  year: String(sub?.year || ''),
                }));
              }}
            >
              <option value="">Select subject</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Semester</label>
            <select className="input" value={filters.semester} onChange={(e) => setFilters((p) => ({ ...p, semester: e.target.value }))}>
              <option value="">Semester</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>Sem {s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Component ID</label>
            <input
              className="input"
              placeholder="Exam component ID"
              value={filters.exam_component_id}
              onChange={(e) => setFilters((p) => ({ ...p, exam_component_id: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {ready ? (
        <div className="card p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Step 1 — Download Template</h3>
            <CSVTemplateDownload
              onDownload={() => facultyApi.downloadMarksTemplate(filters)}
              filename="marks_template.csv"
              label="Download Marks Template"
            />
            <p className="text-xs text-gray-400 mt-2">
              Fill in the <code>marks_obtained</code> column (or sub-field columns) and save as CSV.
            </p>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Step 2 — Upload Filled CSV</h3>
            <MarksCSVUpload
              onUpload={(fd) => {
                Object.entries(filters).forEach(([k, v]) => fd.append(k, v));
                return facultyApi.uploadMarksCSV(fd);
              }}
              isLoading={false}
            />
          </div>
        </div>
      ) : (
        <EmptyState
          title="Select filters above"
          description="Choose subject, semester, and component to access the CSV upload."
        />
      )}
    </div>
  );
};

export default FacultyMarksUpload;
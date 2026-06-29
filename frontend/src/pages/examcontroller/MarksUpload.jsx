import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { examControllerApi } from '../../api/examcontroller.api';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { MarksCSVUpload } from '../../components/marks/MarksCSVUpload';
import { CSVTemplateDownload } from '../../components/marks/CSVTemplateDownload';

const ExamControllerMarksUpload = () => {
  const [filters, setFilters] = useState({
    branch_id: '',
    year: '',
    semester: '',
    subject_id: '',
    exam_component_id: '',
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['ec-branches'],
    queryFn: examControllerApi.getAllBranches,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['ec-subjects', filters.branch_id, filters.year],
    queryFn: () => examControllerApi.getAllSubjects({ branch_id: filters.branch_id, year: filters.year }),
    enabled: !!(filters.branch_id && filters.year),
  });

  const ready = !!(
    filters.branch_id &&
    filters.year &&
    filters.semester &&
    filters.subject_id &&
    filters.exam_component_id
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="End Sem Marks Upload"
        description="Download template, fill end semester marks, and upload"
      />

      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Branch</label>
            <select
              className="input"
              value={filters.branch_id}
              onChange={(e) => setFilters((p) => ({ ...p, branch_id: e.target.value, subject_id: '' }))}
            >
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select
              className="input"
              value={filters.year}
              onChange={(e) => setFilters((p) => ({ ...p, year: e.target.value, subject_id: '' }))}
            >
              <option value="">Year</option>
              {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Semester</label>
            <select
              className="input"
              value={filters.semester}
              onChange={(e) => setFilters((p) => ({ ...p, semester: e.target.value }))}
            >
              <option value="">Semester</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>Sem {s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Subject</label>
            <select
              className="input"
              value={filters.subject_id}
              onChange={(e) => setFilters((p) => ({ ...p, subject_id: e.target.value }))}
            >
              <option value="">Select subject</option>
              {subjects.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
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
              onDownload={() =>
                examControllerApi.downloadMarksTemplate({
                  branch_id: filters.branch_id,
                  year: filters.year,
                })
              }
              filename="endsem_template.csv"
              label="Download End Sem Template"
            />
            <p className="text-xs text-gray-400 mt-2">
              Fill in the <code>marks_obtained</code> column for each student and save as CSV.
            </p>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Step 2 — Upload Filled CSV</h3>
            <MarksCSVUpload
              onUpload={(fd) => {
                Object.entries(filters).forEach(([k, v]) => fd.append(k, v));
                return examControllerApi.uploadMarksCSV(fd);
              }}
              isLoading={false}
            />
          </div>
        </div>
      ) : (
        <EmptyState
          title="Select all filters above"
          description="Choose branch, year, semester, subject, and component to proceed."
        />
      )}
    </div>
  );
};

export default ExamControllerMarksUpload;
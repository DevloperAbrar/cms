import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Trash2, Save } from 'lucide-react';
import { facultyApi } from '../../api/faculty.api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { SubFieldTable } from '../../components/marks/SubFieldTable';
import toast from 'react-hot-toast';

const FacultySubFieldConfig = () => {
  const [filters, setFilters] = useState({ subject_id: '', branch_id: '', year: '', exam_component_id: '' });
  const [subFields, setSubFields] = useState([]);

  const { data: subjects = [] } = useQuery({ queryKey: ['faculty-subjects'], queryFn: facultyApi.getMySubjects });

  const ready = !!(filters.subject_id && filters.branch_id && filters.year && filters.exam_component_id);

  const { isLoading } = useQuery({
    queryKey: ['faculty-subfield-config', filters],
    queryFn: () => facultyApi.getSubFieldConfig(filters),
    enabled: ready,
    onSuccess: (data) => {
      if (data?.sub_fields) setSubFields(data.sub_fields);
      else setSubFields([]);
    },
  });

  const save = useMutation({
    mutationFn: () => facultyApi.saveSubFieldConfig({ ...filters, year: Number(filters.year), sub_fields: subFields }),
    onSuccess: () => toast.success('Sub-field config saved'),
    onError: (e) => toast.error(e.message),
  });

  const handleChange = (i, key, value) => {
    setSubFields((prev) => prev.map((sf, idx) => idx === i ? { ...sf, [key]: value } : sf));
  };

  const addField = () => setSubFields((prev) => [...prev, { name: '', max_marks: 0, display_order: prev.length }]);
  const removeField = (i) => setSubFields((prev) => prev.filter((_, idx) => idx !== i));

  const totalMax = subFields.reduce((s, sf) => s + Number(sf.max_marks || 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Sub-Field Config" description="Configure mark breakdown fields for each component" />

      <div className="card p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Subject</label>
            <select className="input" value={filters.subject_id} onChange={(e) => {
              const sub = subjects.find((s) => s._id === e.target.value);
              setFilters((p) => ({ ...p, subject_id: e.target.value, branch_id: sub?.branch_id?._id || sub?.branch_id || '', year: String(sub?.year || '') }));
            }}>
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
        <div className="card">
          {isLoading ? <LoadingSpinner className="py-8" /> : (
            <>
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Sub-Fields</h2>
                <button type="button" className="btn-secondary btn-sm" onClick={addField}>
                  <Plus className="h-3.5 w-3.5" /> Add Field
                </button>
              </div>

              {subFields.length === 0 ? (
                <EmptyState title="No sub-fields" description="Add sub-fields to break down this component." />
              ) : (
                <SubFieldTable subFields={subFields} onChange={handleChange} />
              )}

              <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
                <p className={`text-sm font-medium ${totalMax > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  Total Max Marks: {totalMax}
                </p>
                <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending || subFields.length === 0}>
                  <Save className="h-4 w-4" />
                  {save.isPending ? 'Saving...' : 'Save Config'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {!ready && <EmptyState title="Select subject and component" />}
    </div>
  );
};

export default FacultySubFieldConfig;
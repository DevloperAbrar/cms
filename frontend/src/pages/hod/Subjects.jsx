import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { hodApi } from '../../api/hod.api';
import { getSemestersForYear } from '../../utils/semester';
import { PageHeader } from '../../components/common/PageHeader';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import toast from 'react-hot-toast';

const HODSubjects = () => {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [filters, setFilters] = useState({ branch_id: '', year: '' });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();
  const formYear = useWatch({ control, name: 'year' });

  const { data: branches = [] } = useQuery({
    queryKey: ['hod-branches'],
    queryFn: hodApi.getDeptBranches,
  });

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['hod-subjects-faculty', filters.branch_id, filters.year],
    queryFn: () => hodApi.getSubjectsWithFaculty({
      branch_id: filters.branch_id || undefined,
      year: filters.year || undefined,
    }),
  });

  const create = useMutation({
    mutationFn: hodApi.createSubject,
    onSuccess: () => { qc.invalidateQueries(['hod-subjects-faculty']); toast.success('Subject created'); setModal(false); reset(); },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => hodApi.updateSubject(id, data),
    onSuccess: () => { qc.invalidateQueries(['hod-subjects-faculty']); toast.success('Subject updated'); setModal(false); setEditing(null); reset(); },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const remove = useMutation({
    mutationFn: hodApi.deleteSubject,
    onSuccess: () => { qc.invalidateQueries(['hod-subjects-faculty']); toast.success('Subject deleted'); setDeleting(null); },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', code: '', branch_id: '', year: '', semester: '', type: 'theory', credits: 0 });
    setModal(true);
  };

  const openEdit = (subject) => {
    setEditing(subject);
    reset({
      name: subject.name,
      code: subject.code,
      branch_id: subject.branch_id?._id || subject.branch_id,
      year: subject.year,
      semester: subject.semester,
      type: subject.type,
      credits: subject.credits,
    });
    setModal(true);
  };

  const onSubmit = (data) => {
    if (editing) update.mutate({ id: editing._id, data });
    else create.mutate(data);
  };

  const cols = [
    { key: 'name', header: 'Name' },
    { key: 'code', header: 'Code' },
    { key: 'branch', header: 'Branch', render: (r) => r.branch_id?.name || '—' },
    { key: 'year', header: 'Year', render: (r) => `Year ${r.year}` },
    { key: 'semester', header: 'Sem', render: (r) => `Sem ${r.semester}` },
    { key: 'type', header: 'Type' },
    { key: 'credits', header: 'Credits' },
    {
      key: 'faculty',
      header: 'Assigned Faculty',
      render: (r) => r.assigned_faculty?.name
        ? <span className="text-green-700 font-medium">{r.assigned_faculty.name}</span>
        : <span className="text-gray-400">Unassigned</span>,
    },
    {
      key: 'actions', header: '',
      render: (r) => (
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></button>
          <button className="btn-danger btn-sm" onClick={() => setDeleting(r)}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Subjects"
        description="Manage subjects in your department"
        action={
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Subject
          </button>
        }
      />

      <div className="card p-4">
        <div className="flex gap-3">
          <select className="input w-48" value={filters.branch_id} onChange={(e) => setFilters((p) => ({ ...p, branch_id: e.target.value }))}>
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <select className="input w-32" value={filters.year} onChange={(e) => setFilters((p) => ({ ...p, year: e.target.value }))}>
            <option value="">All Years</option>
            {[1,2,3,4].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <Table columns={cols} data={subjects} isLoading={isLoading} emptyTitle="No subjects found" />
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Subject' : 'Add Subject'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name</label>
              <input className="input" {...register('name', { required: 'Required' })} />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Code</label>
              <input className="input" {...register('code', { required: 'Required' })} />
              {errors.code && <p className="text-xs text-red-600 mt-1">{errors.code.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Branch</label>
              <select className="input" {...register('branch_id', { required: 'Required' })}>
                <option value="">Select branch</option>
                {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
              {errors.branch_id && <p className="text-xs text-red-600 mt-1">{errors.branch_id.message}</p>}
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" {...register('type')}>
                <option value="theory">Theory</option>
                <option value="practical">Practical</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Year</label>
              <select className="input" {...register('year', { required: 'Required' })}>
                <option value="">Year</option>
                {[1,2,3,4].map((y) => <option key={y} value={y}>Year {y}</option>)}
              </select>
              {errors.year && <p className="text-xs text-red-600 mt-1">{errors.year.message}</p>}
            </div>
            <div>
              <label className="label">Semester</label>
              <select className="input" {...register('semester', { required: 'Required' })} disabled={!formYear}>
                <option value="">{formYear ? 'Semester' : 'Select year first'}</option>
                {getSemestersForYear(formYear).map((s) => <option key={s} value={s}>Sem {s}</option>)}
              </select>
              {errors.semester && <p className="text-xs text-red-600 mt-1">{errors.semester.message}</p>}
            </div>
            <div>
              <label className="label">Credits</label>
              <input type="number" className="input" min={0} {...register('credits')} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting._id)}
        title="Delete Subject"
        message={`Delete "${deleting?.name}"?`}
        isLoading={remove.isPending}
      />
    </div>
  );
};

export default HODSubjects;
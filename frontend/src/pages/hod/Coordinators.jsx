import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { hodApi } from '../../api/hod.api';
import { PageHeader } from '../../components/common/PageHeader';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useForm, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';

const CoordinatorsPage = () => {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', data: coordinator }
  const [deleting, setDeleting] = useState(null);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm({
    defaultValues: { faculty_id: '', coordinator_branches: [{ branch_id: '', year: '' }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'coordinator_branches' });

  const { data: faculty = [], isLoading } = useQuery({
    queryKey: ['hod-faculty'],
    queryFn: hodApi.getDeptFaculty,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['hod-branches'],
    queryFn: hodApi.getDeptBranches,
  });

  const assign = useMutation({
    mutationFn: hodApi.assignCoordinator,
    onSuccess: () => {
      qc.invalidateQueries(['hod-faculty']);
      toast.success(modal?.mode === 'edit' ? 'Coordinator updated' : 'Coordinator assigned');
      setModal(null);
      reset();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeCoord = useMutation({
    mutationFn: hodApi.removeCoordinator,
    onSuccess: () => {
      qc.invalidateQueries(['hod-faculty']);
      toast.success('Coordinator removed');
      setDeleting(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const coordinators = faculty.filter((f) => f.role === 'coordinator');

  const openEdit = (coordinator) => {
    reset({
      faculty_id: coordinator._id,
      coordinator_branches: coordinator.coordinator_branches?.length
        ? coordinator.coordinator_branches.map((b) => ({ branch_id: b.branch_id?._id || b.branch_id, year: String(b.year) }))
        : [{ branch_id: '', year: '' }],
    });
    setModal({ mode: 'edit', data: coordinator });
  };

  const cols = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    {
      key: 'branches',
      header: 'Assigned Branches',
      render: (r) =>
        r.coordinator_branches?.length
          ? r.coordinator_branches.map((b) => `${b.branch_id?.name || '—'} (Year ${b.year})`).join(', ')
          : '—',
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary btn-sm" onClick={() => openEdit(r)} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button className="btn-danger btn-sm" onClick={() => setDeleting(r)} title="Remove">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const onSubmit = (data) => {
    assign.mutate({
      faculty_id: modal?.mode === 'edit' ? modal.data._id : data.faculty_id,
      coordinator_branches: data.coordinator_branches.map((cb) => ({
        branch_id: cb.branch_id,
        year: Number(cb.year),
      })),
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Coordinators"
        description="Manage branch coordinators in your department"
        action={
          <button className="btn-primary" onClick={() => { reset({ faculty_id: '', coordinator_branches: [{ branch_id: '', year: '' }] }); setModal({ mode: 'create' }); }}>
            <Plus className="h-4 w-4" /> Assign Coordinator
          </button>
        }
      />

      <div className="card">
        <Table
          columns={cols}
          data={coordinators}
          isLoading={isLoading}
          emptyTitle="No coordinators assigned"
          emptyDescription="Assign a faculty member as coordinator for a branch."
        />
      </div>

      <Modal isOpen={!!modal} onClose={() => { setModal(null); reset(); }} title={modal?.mode === 'edit' ? 'Edit Coordinator' : 'Assign Coordinator'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* Faculty select — only for create */}
          {modal?.mode === 'create' && (
            <div>
              <label className="label">Select Faculty</label>
              <select className="input" {...register('faculty_id', { required: 'Required' })}>
                <option value="">Select faculty</option>
                {faculty.map((f) => (
                  <option key={f._id} value={f._id}>{f.name} ({f.email})</option>
                ))}
              </select>
              {errors.faculty_id && <p className="text-xs text-red-600 mt-1">{errors.faculty_id.message}</p>}
            </div>
          )}

          {/* Show name when editing */}
          {modal?.mode === 'edit' && (
            <div>
              <label className="label">Faculty</label>
              <input className="input bg-gray-50" value={modal.data.name} disabled />
            </div>
          )}

          <div>
            <label className="label">Branch + Year Assignments</label>
            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={field.id} className="flex gap-2 items-center">
                  <select className="input flex-1" {...register(`coordinator_branches.${i}.branch_id`, { required: true })}>
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                  <select className="input w-28" {...register(`coordinator_branches.${i}.year`, { required: true })}>
                    <option value="">Year</option>
                    {[1, 2, 3, 4].map((y) => (
                      <option key={y} value={y}>Year {y}</option>
                    ))}
                  </select>
                  {fields.length > 1 && (
                    <button type="button" className="btn-danger btn-sm" onClick={() => remove(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn-secondary btn-sm mt-2"
              onClick={() => append({ branch_id: '', year: '' })}
            >
              <Plus className="h-3.5 w-3.5" /> Add Another
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => { setModal(null); reset(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={assign.isPending}>
              {assign.isPending ? 'Saving...' : modal?.mode === 'edit' ? 'Update' : 'Assign'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => removeCoord.mutate(deleting._id)}
        title="Remove Coordinator"
        message={`Remove "${deleting?.name}" as coordinator? They will be reverted to faculty role.`}
        confirmLabel="Remove"
        variant="danger"
        isLoading={removeCoord.isPending}
      />
    </div>
  );
};

export default CoordinatorsPage;
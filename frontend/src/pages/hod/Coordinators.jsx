import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { hodApi } from '../../api/hod.api';
import { PageHeader } from '../../components/common/PageHeader';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { useForm, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';

const CoordinatorsPage = () => {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
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
      toast.success('Coordinator assigned');
      setModal(false);
      reset();
    },
    onError: (e) => toast.error(e.message),
  });

  const coordinators = faculty.filter((f) => f.role === 'coordinator');

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
  ];

  const onSubmit = (data) => {
    assign.mutate({
      faculty_id: data.faculty_id,
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
          <button className="btn-primary" onClick={() => { reset(); setModal(true); }}>
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

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Assign Coordinator">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={assign.isPending}>
              {assign.isPending ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CoordinatorsPage;
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { PageHeader } from '../../components/common/PageHeader';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { StatusBadge } from '../../components/common/StatusBadge';
import { superadminApi } from '../../api/superadmin.api';
import toast from 'react-hot-toast';

const DepartmentsPage = () => {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: superadminApi.getDepartments,
  });
  const { data: streams = [] } = useQuery({
    queryKey: ['streams'],
    queryFn: superadminApi.getStreams,
  });

  const create = useMutation({
    mutationFn: superadminApi.createDepartment,
    onSuccess: () => { qc.invalidateQueries(['departments']); toast.success('Department created'); closeModal(); },
    onError: (e) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, data }) => superadminApi.updateDepartment(id, data),
    onSuccess: () => { qc.invalidateQueries(['departments']); toast.success('Updated'); closeModal(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: superadminApi.deleteDepartment,
    onSuccess: () => { qc.invalidateQueries(['departments']); toast.success('Deleted'); setDeleting(null); },
    onError: (e) => toast.error(e.message),
  });

  const closeModal = () => { setModal(null); reset({}); };

  const onSubmit = (data) => {
    if (modal.mode === 'create') create.mutate(data);
    else update.mutate({ id: modal.data._id, data });
  };

  const cols = [
    { key: 'name', header: 'Name' },
    { key: 'code', header: 'Code' },
    { key: 'stream', header: 'Stream', render: (r) => r.stream_id?.name || '—' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', header: '',
      render: (r) => (
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary btn-sm" onClick={() => { reset({ ...r, stream_id: r.stream_id?._id }); setModal({ mode: 'edit', data: r }); }}><Pencil className="h-3.5 w-3.5" /></button>
          <button className="btn-danger btn-sm" onClick={() => setDeleting(r)}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Departments" action={
        <button className="btn-primary" onClick={() => { reset({}); setModal({ mode: 'create' }); }}>
          <Plus className="h-4 w-4" />Add Department
        </button>
      } />
      <div className="card">
        <Table columns={cols} data={departments} isLoading={isLoading} emptyTitle="No departments yet" />
      </div>

      <Modal isOpen={!!modal} onClose={closeModal} title={modal?.mode === 'create' ? 'Add Department' : 'Edit Department'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className={`input ${errors.name ? 'border-red-400' : ''}`} {...register('name', { required: 'Required' })} />
          </div>
          <div>
            <label className="label">Code</label>
            <input className="input uppercase" {...register('code', { required: 'Required' })} />
          </div>
          <div>
            <label className="label">Stream</label>
            <select className="input" {...register('stream_id', { required: 'Required' })}>
              <option value="">Select stream</option>
              {streams.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting._id)} title="Delete Department"
        message={`Delete "${deleting?.name}"?`} isLoading={remove.isPending} />
    </div>
  );
};

export default DepartmentsPage;
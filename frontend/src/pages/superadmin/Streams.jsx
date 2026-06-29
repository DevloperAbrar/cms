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

/* ─── STREAMS ─────────────────────────────────────────────────────────────── */
export const StreamsPage = () => {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null); // { mode: 'create'|'edit', data? }
  const [deleting, setDeleting] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: streams = [], isLoading } = useQuery({
    queryKey: ['streams'],
    queryFn: superadminApi.getStreams,
  });

  const create = useMutation({
    mutationFn: superadminApi.createStream,
    onSuccess: () => { qc.invalidateQueries(['streams']); toast.success('Stream created'); closeModal(); },
    onError: (e) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, data }) => superadminApi.updateStream(id, data),
    onSuccess: () => { qc.invalidateQueries(['streams']); toast.success('Stream updated'); closeModal(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: superadminApi.deleteStream,
    onSuccess: () => { qc.invalidateQueries(['streams']); toast.success('Stream deleted'); setDeleting(null); },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => { reset({}); setModal({ mode: 'create' }); };
  const openEdit = (row) => { reset(row); setModal({ mode: 'edit', data: row }); };
  const closeModal = () => { setModal(null); reset({}); };

  const onSubmit = (data) => {
    if (modal.mode === 'create') create.mutate(data);
    else update.mutate({ id: modal.data._id, data });
  };

  const cols = [
    { key: 'name', header: 'Name' },
    { key: 'code', header: 'Code' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', header: '',
      render: (r) => (
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary btn-sm" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></button>
          <button className="btn-danger btn-sm" onClick={() => setDeleting(r)}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Streams" action={<button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" />Add Stream</button>} />
      <div className="card">
        <Table columns={cols} data={streams} isLoading={isLoading} emptyTitle="No streams yet" />
      </div>
      <Modal isOpen={!!modal} onClose={closeModal} title={modal?.mode === 'create' ? 'Add Stream' : 'Edit Stream'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className={`input ${errors.name ? 'border-red-400' : ''}`} {...register('name', { required: 'Required' })} />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Code</label>
            <input className={`input uppercase ${errors.code ? 'border-red-400' : ''}`} {...register('code', { required: 'Required' })} />
            {errors.code && <p className="text-xs text-red-600 mt-1">{errors.code.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting._id)}
        title="Delete Stream"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        isLoading={remove.isPending}
      />
    </div>
  );
};
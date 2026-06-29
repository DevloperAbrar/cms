import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { PageHeader } from '../../components/common/PageHeader';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { StatusBadge } from '../../components/common/StatusBadge';
import { superadminApi } from '../../api/superadmin.api';
import toast from 'react-hot-toast';
import api from '../../api/axiosInstance';

const NoticePriority = ({ priority }) => <StatusBadge status={priority} />;

const NoticesPage = () => {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { priority: 'normal', target_type: 'all' },
  });

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['superadmin-notices'],
    queryFn: () => api.get('/superadmin/notices').then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (data) => api.post('/superadmin/notices', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['superadmin-notices']);
      toast.success('Notice posted');
      setModal(false);
      reset();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/superadmin/notices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['superadmin-notices']);
      toast.success('Notice deleted');
      setDeleting(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const cols = [
    { key: 'title', header: 'Title' },
    { key: 'priority', header: 'Priority', render: (r) => <NoticePriority priority={r.priority} /> },
    { key: 'target_type', header: 'Target' },
    { key: 'posted_by', header: 'Posted By', render: (r) => r.posted_by?.name || 'Super Admin' },
    {
      key: 'created_at', header: 'Date',
      render: (r) => new Date(r.created_at).toLocaleDateString('en-IN'),
    },
    {
      key: 'actions', header: '',
      render: (r) => (
        <button className="btn-danger btn-sm" onClick={() => setDeleting(r)}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Notices"
        action={
          <button className="btn-primary" onClick={() => { reset({ priority: 'normal', target_type: 'all' }); setModal(true); }}>
            <Plus className="h-4 w-4" /> Post Notice
          </button>
        }
      />

      <div className="card">
        <Table columns={cols} data={notices} isLoading={isLoading} emptyTitle="No notices posted" />
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Post Notice" size="lg">
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className={`input ${errors.title ? 'border-red-400' : ''}`} {...register('title', { required: 'Required' })} />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="label">Body</label>
            <textarea className="input min-h-[100px]" {...register('body', { required: 'Required' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Priority</label>
              <select className="input" {...register('priority')}>
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="label">Target</label>
              <select className="input" {...register('target_type')}>
                <option value="all">Everyone</option>
                <option value="stream">Stream</option>
                <option value="department">Department</option>
                <option value="branch">Branch</option>
                <option value="individual">Individual</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Schedule At (optional)</label>
              <input type="datetime-local" className="input" {...register('schedule_at')} />
            </div>
            <div>
              <label className="label">Expires At (optional)</label>
              <input type="datetime-local" className="input" {...register('expires_at')} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Posting...' : 'Post Notice'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting._id)}
        title="Delete Notice"
        message={`Delete "${deleting?.title}"?`}
        isLoading={remove.isPending}
      />
    </div>
  );
};

export default NoticesPage;
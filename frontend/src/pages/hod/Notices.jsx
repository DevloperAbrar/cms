import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Bell } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { hodApi } from '../../api/hod.api';
import { PageHeader } from '../../components/common/PageHeader';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';

const HODNotices = () => {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { priority: 'normal', target_type: 'all' },
  });

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['hod-notices'],
    queryFn: hodApi.getNotices,
  });

  const create = useMutation({
    mutationFn: hodApi.postNotice,
    onSuccess: () => { qc.invalidateQueries(['hod-notices']); toast.success('Notice posted'); setModal(false); reset(); },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/hod/notices/${id}`),
    onSuccess: () => { qc.invalidateQueries(['hod-notices']); toast.success('Deleted'); setDeleting(null); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notices"
        action={
          <button className="btn-primary" onClick={() => { reset({ priority: 'normal', target_type: 'all' }); setModal(true); }}>
            <Plus className="h-4 w-4" /> Post Notice
          </button>
        }
      />

      {isLoading ? <LoadingSpinner className="py-16" /> : notices.length === 0 ? (
        <EmptyState title="No notices" />
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <div key={n._id} className={`card p-4 ${!n.is_read ? 'border-primary-200 bg-primary-50/20' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Bell className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{n.body}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString('en-IN')} — {n.posted_by?.name || 'You'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={n.priority} />
                  <button className="btn-danger btn-sm" onClick={() => setDeleting(n)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Post Notice" size="lg">
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className={`input ${errors.title ? 'border-red-400' : ''}`} {...register('title', { required: 'Required' })} />
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
                <option value="department">Department</option>
                <option value="branch">Branch</option>
                <option value="individual">Individual</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Posting...' : 'Post'}
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

export default HODNotices;
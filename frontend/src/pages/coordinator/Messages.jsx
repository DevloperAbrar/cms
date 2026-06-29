import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, MessageSquare } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { coordinatorApi } from '../../api/coordinator.api';
import { PageHeader } from '../../components/common/PageHeader';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const CoordinatorMessages = () => {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const branches = user?.coordinator_branches || [];
  const [branchId] = useState(branches[0]?._id || branches[0] || '');
  const [modal, setModal] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['coordinator-messages'],
    queryFn: coordinatorApi.getMessages,
  });

  const { data: students = [] } = useQuery({
    queryKey: ['coordinator-branch-students', branchId],
    queryFn: () => coordinatorApi.getBranchStudents({ branch_id: branchId }),
    enabled: !!branchId,
  });

  const send = useMutation({
    mutationFn: coordinatorApi.sendMessage,
    onSuccess: () => { qc.invalidateQueries(['coordinator-messages']); toast.success('Sent'); setModal(false); reset(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Messages"
        action={
          <button className="btn-primary" onClick={() => { reset(); setModal(true); }}>
            <Send className="h-4 w-4" /> Send Message
          </button>
        }
      />

      {isLoading ? <LoadingSpinner className="py-16" /> : messages.length === 0 ? (
        <EmptyState title="No messages" />
      ) : (
        <div className="space-y-3">
          {messages.map((m) => {
            const isSent = m.sender_id?._id === user?._id || m.sender_id === user?._id;
            return (
              <div key={m._id} className={`card p-4 ${isSent ? 'border-l-4 border-l-primary-400' : ''}`}>
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{m.body}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {isSent ? `To: ${m.recipient_id?.name}` : `From: ${m.sender_id?.name}`} · {new Date(m.created_at).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Send Message">
        <form onSubmit={handleSubmit((d) => send.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Recipient</label>
            <select className="input" {...register('recipient_id', { required: 'Required' })}>
              <option value="">Select student</option>
              {students.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.enrollment_number})</option>)}
            </select>
            {errors.recipient_id && <p className="text-xs text-red-600 mt-1">{errors.recipient_id.message}</p>}
          </div>
          <div>
            <label className="label">Message</label>
            <textarea className="input min-h-[100px]" {...register('body', { required: 'Required' })} />
            {errors.body && <p className="text-xs text-red-600 mt-1">{errors.body.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={send.isPending}>
              {send.isPending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CoordinatorMessages;
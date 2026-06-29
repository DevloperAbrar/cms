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

const BranchesPage = () => {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: branches = [], isLoading } = useQuery({ queryKey: ['branches'], queryFn: superadminApi.getBranches });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: superadminApi.getDepartments });

  const create = useMutation({ mutationFn: superadminApi.createBranch, onSuccess: () => { qc.invalidateQueries(['branches']); toast.success('Branch created'); closeModal(); }, onError: (e) => toast.error(e.message) });
  const update = useMutation({ mutationFn: ({ id, data }) => superadminApi.updateBranch(id, data), onSuccess: () => { qc.invalidateQueries(['branches']); toast.success('Updated'); closeModal(); }, onError: (e) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: superadminApi.deleteBranch, onSuccess: () => { qc.invalidateQueries(['branches']); toast.success('Deleted'); setDeleting(null); }, onError: (e) => toast.error(e.message) });

  const closeModal = () => { setModal(null); reset({}); };
  const onSubmit = (data) => modal.mode === 'create' ? create.mutate(data) : update.mutate({ id: modal.data._id, data });

  const cols = [
    { key: 'name', header: 'Name' },
    { key: 'code', header: 'Code' },
    { key: 'dept', header: 'Department', render: (r) => r.department_id?.name || '—' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex gap-2 justify-end">
        <button className="btn-secondary btn-sm" onClick={() => { reset({ ...r, department_id: r.department_id?._id }); setModal({ mode: 'edit', data: r }); }}><Pencil className="h-3.5 w-3.5" /></button>
        <button className="btn-danger btn-sm" onClick={() => setDeleting(r)}><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Branches" action={<button className="btn-primary" onClick={() => { reset({}); setModal({ mode: 'create' }); }}><Plus className="h-4 w-4" />Add Branch</button>} />
      <div className="card"><Table columns={cols} data={branches} isLoading={isLoading} emptyTitle="No branches yet" /></div>
      <Modal isOpen={!!modal} onClose={closeModal} title={modal?.mode === 'create' ? 'Add Branch' : 'Edit Branch'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div><label className="label">Name</label><input className="input" {...register('name', { required: true })} /></div>
          <div><label className="label">Code</label><input className="input uppercase" {...register('code', { required: true })} /></div>
          <div>
            <label className="label">Department</label>
            <select className="input" {...register('department_id', { required: true })}>
              <option value="">Select department</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting._id)} title="Delete Branch" message={`Delete "${deleting?.name}"?`} isLoading={remove.isPending} />
    </div>
  );
};

export default BranchesPage;
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { PageHeader } from '../../components/common/PageHeader';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { superadminApi } from '../../api/superadmin.api';
import toast from 'react-hot-toast';

const SubjectsPage = () => {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { register, handleSubmit, reset } = useForm();

  const { data: subjects = [], isLoading } = useQuery({ queryKey: ['subjects'], queryFn: superadminApi.getSubjects });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: superadminApi.getBranches });

  const create = useMutation({ mutationFn: superadminApi.createSubject, onSuccess: () => { qc.invalidateQueries(['subjects']); toast.success('Subject created'); closeModal(); }, onError: (e) => toast.error(e.message) });
  const update = useMutation({ mutationFn: ({ id, data }) => superadminApi.updateSubject(id, data), onSuccess: () => { qc.invalidateQueries(['subjects']); toast.success('Updated'); closeModal(); }, onError: (e) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: superadminApi.deleteSubject, onSuccess: () => { qc.invalidateQueries(['subjects']); toast.success('Deleted'); setDeleting(null); }, onError: (e) => toast.error(e.message) });

  const closeModal = () => { setModal(null); reset({}); };
  const onSubmit = (data) => modal.mode === 'create' ? create.mutate(data) : update.mutate({ id: modal.data._id, data });

  const cols = [
    { key: 'name', header: 'Name' },
    { key: 'code', header: 'Code' },
    { key: 'branch', header: 'Branch', render: (r) => r.branch_id?.name || '—' },
    { key: 'year', header: 'Year' },
    { key: 'semester', header: 'Sem' },
    { key: 'type', header: 'Type' },
    { key: 'credits', header: 'Credits' },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex gap-2 justify-end">
        <button className="btn-secondary btn-sm" onClick={() => { reset({ ...r, branch_id: r.branch_id?._id }); setModal({ mode: 'edit', data: r }); }}><Pencil className="h-3.5 w-3.5" /></button>
        <button className="btn-danger btn-sm" onClick={() => setDeleting(r)}><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Subjects" action={<button className="btn-primary" onClick={() => { reset({}); setModal({ mode: 'create' }); }}><Plus className="h-4 w-4" />Add Subject</button>} />
      <div className="card"><Table columns={cols} data={subjects} isLoading={isLoading} emptyTitle="No subjects yet" /></div>

      <Modal isOpen={!!modal} onClose={closeModal} title={modal?.mode === 'create' ? 'Add Subject' : 'Edit Subject'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label">Name</label><input className="input" {...register('name', { required: true })} /></div>
          <div><label className="label">Code</label><input className="input uppercase" {...register('code', { required: true })} /></div>
          <div>
            <label className="label">Branch</label>
            <select className="input" {...register('branch_id', { required: true })}>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="label">Year</label><input type="number" min="1" max="6" className="input" {...register('year', { required: true, valueAsNumber: true })} /></div>
          <div><label className="label">Semester</label><input type="number" min="1" max="12" className="input" {...register('semester', { required: true, valueAsNumber: true })} /></div>
          <div>
            <label className="label">Type</label>
            <select className="input" {...register('type')}>
              <option value="theory">Theory</option>
              <option value="practical">Practical</option>
            </select>
          </div>
          <div><label className="label">Credits</label><input type="number" min="0" className="input" {...register('credits', { valueAsNumber: true })} /></div>
          <div className="col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting._id)} title="Delete Subject" message={`Delete "${deleting?.name}"?`} isLoading={remove.isPending} />
    </div>
  );
};

export default SubjectsPage;
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, UserX, Trash2, Upload, Download } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { PageHeader } from '../../components/common/PageHeader';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { StatusBadge } from '../../components/common/StatusBadge';
import { superadminApi } from '../../api/superadmin.api';
import { downloadBlob } from '../../utils/csvTemplateGenerator';
import toast from 'react-hot-toast';

const UsersPage = ({ role, title }) => {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deactivating, setDeactivating] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', role],
    queryFn: () => superadminApi.getUsers({ role }),
  });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: superadminApi.getDepartments });

  const create = useMutation({
    mutationFn: (data) => superadminApi.createUser({ ...data, role }),
    onSuccess: () => { qc.invalidateQueries(['users', role]); toast.success('User created'); closeModal(); },
    onError: (e) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, data }) => superadminApi.updateUser(id, data),
    onSuccess: () => { qc.invalidateQueries(['users', role]); toast.success('Updated'); closeModal(); },
    onError: (e) => toast.error(e.message),
  });
  const deactivate = useMutation({
    mutationFn: superadminApi.deactivateUser,
    onSuccess: () => { qc.invalidateQueries(['users', role]); toast.success('User deactivated'); setDeactivating(null); },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: superadminApi.deleteUser,
    onSuccess: () => { qc.invalidateQueries(['users', role]); toast.success('Deleted'); setDeleting(null); },
    onError: (e) => toast.error(e.message),
  });

  const closeModal = () => { setModal(null); reset({}); };
  const onSubmit = (data) => modal.mode === 'create' ? create.mutate(data) : update.mutate({ id: modal.data._id, data });

  const handleCSVUpload = async () => {
    if (!csvFile) return;
    setCsvUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', csvFile);
      const res = await superadminApi.uploadStudentsCSV(fd);
      // res is already unwrapped by axiosInstance → { imported, skipped, errors }
      const imported = res?.imported ?? res?.data?.imported ?? 0;
      toast.success(`${imported} students imported`);
      if (res?.errors?.length || res?.data?.errors?.length) {
        const errors = res?.errors || res?.data?.errors;
        toast.error(`${errors.length} rows had errors`);
      }
      qc.invalidateQueries(['users', 'student']);
      setCsvFile(null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCsvUploading(false);
    }
  };

  const handleTemplateDownload = async () => {
    try {
      const res = await superadminApi.downloadStudentTemplate();
      downloadBlob(res, 'student_template.csv');
    } catch (e) {
      toast.error(e.message);
    }
  };
  
  const cols = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    ...(role === 'student' ? [
      { key: 'enrollment_number', header: 'Enrollment No' },
      { key: 'year', header: 'Year' },
    ] : []),
    { key: 'dept', header: 'Department', render: (r) => r.department_id?.name || '—' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex gap-2 justify-end">
        <button className="btn-secondary btn-sm" onClick={() => { reset({ ...r, department_id: r.department_id?._id }); setModal({ mode: 'edit', data: r }); }}><Pencil className="h-3.5 w-3.5" /></button>
        <button className="btn-secondary btn-sm" onClick={() => setDeactivating(r)} title="Deactivate"><UserX className="h-3.5 w-3.5" /></button>
        <button className="btn-danger btn-sm" onClick={() => setDeleting(r)}><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title={title} action={
        <div className="flex gap-2">
          {role === 'student' && (
            <>
              <button className="btn-secondary" onClick={handleTemplateDownload}><Download className="h-4 w-4" />Template</button>
              <label className="btn-secondary cursor-pointer">
                <Upload className="h-4 w-4" />
                {csvFile ? csvFile.name : 'Import CSV'}
                <input type="file" accept=".csv" className="hidden" onChange={(e) => setCsvFile(e.target.files[0])} />
              </label>
              {csvFile && <button className="btn-primary" onClick={handleCSVUpload} disabled={csvUploading}>{csvUploading ? 'Uploading...' : 'Upload'}</button>}
            </>
          )}
          <button className="btn-primary" onClick={() => { reset({}); setModal({ mode: 'create' }); }}><Plus className="h-4 w-4" />Add {title.slice(0, -1)}</button>
        </div>
      } />
      <div className="card"><Table columns={cols} data={users} isLoading={isLoading} emptyTitle={`No ${title.toLowerCase()} found`} /></div>

      <Modal isOpen={!!modal} onClose={closeModal} title={modal?.mode === 'create' ? `Add ${title.slice(0, -1)}` : `Edit ${title.slice(0, -1)}`}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div><label className="label">Full Name</label><input className="input" {...register('name', { required: true })} /></div>
          <div><label className="label">Email</label><input type="email" className="input" {...register('email', { required: true })} /></div>
          {role !== 'examcontroller' && (
            <div>
              <label className="label">Department</label>
              <select className="input" {...register('department_id')}>
                <option value="">Select department</option>
                {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
          )}
          <div><label className="label">Phone</label><input className="input" {...register('phone')} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deactivating} onClose={() => setDeactivating(null)} onConfirm={() => deactivate.mutate(deactivating._id)} title="Deactivate User" message={`Deactivate "${deactivating?.name}"?`} confirmLabel="Deactivate" variant="danger" isLoading={deactivate.isPending} />
      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting._id)} title="Delete User" message={`Permanently delete "${deleting?.name}"? ${role === 'student' ? 'Student data will be retained.' : ''}`} isLoading={remove.isPending} />
    </div>
  );
};

export const StudentsPage = () => <UsersPage role="student" title="Students" />;
export const FacultyPage = () => <UsersPage role="faculty" title="Faculty" />;
export const HODsPage = () => <UsersPage role="hod" title="HODs" />;
export const ExamControllerPage = () => <UsersPage role="examcontroller" title="Exam Controllers" />;

export default UsersPage;
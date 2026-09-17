import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, UserX, Trash2, Upload, Download, Search, X } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
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
  const { register, handleSubmit, reset, control } = useForm();

  // Filter state (only for students)
  const [filters, setFilters] = useState({ search: '', department_id: '', branch_id: '', year: '', semester: '', section: '' });

  const selectedDeptId = useWatch({ control, name: 'department_id' });

  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: superadminApi.getDepartments });
  const { data: allBranches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => superadminApi.getBranches(),
    enabled: role === 'student' || role === 'hod' || role === 'faculty',
  });

  // Active query params — only send non-empty filters
  const activeParams = { role, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')) };
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', role, activeParams],
    queryFn: () => superadminApi.getUsers(activeParams),
  });

  const filteredBranches = selectedDeptId
    ? allBranches.filter((b) => b.department_id?._id === selectedDeptId || b.departmentId === selectedDeptId)
    : allBranches;

  // Branches filtered by filter dept for the filter bar
  const filterBranches = filters.department_id
    ? allBranches.filter((b) => b.department_id?._id === filters.department_id || b.departmentId === filters.department_id)
    : allBranches;

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

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, ...(key === 'department_id' ? { branch_id: '' } : {}) }));
  const clearFilters = () => setFilters({ search: '', department_id: '', branch_id: '', year: '', semester: '', section: '' });
  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  const cols = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    ...(role === 'student' ? [
      { key: 'enrollment_number', header: 'Enrollment No' },
      { key: 'year', header: 'Year' },
      { key: 'semester', header: 'Sem' },
      { key: 'section', header: 'Section' },
    ] : []),
    { key: 'dept', header: 'Department', render: (r) => r.department_id?.name || '—' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex gap-2 justify-end">
        <button className="btn-secondary btn-sm" onClick={() => {
          reset({ ...r, department_id: r.department_id?._id, branch_id: r.branch_id?._id || r.branch_id, enrollment_number: r.enrollment_number, year: r.year ? String(r.year) : '', semester: r.semester ? String(r.semester) : '', section: r.section || '' });
          setModal({ mode: 'edit', data: r });
        }}><Pencil className="h-3.5 w-3.5" /></button>
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

      {/* Filter bar — students only */}
      {role === 'student' && (
        <div className="card mb-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[180px]">
              <label className="label">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input className="input pl-9" placeholder="Name, email, enrollment..." value={filters.search} onChange={(e) => setFilter('search', e.target.value)} />
              </div>
            </div>
            {/* Department */}
            <div className="min-w-[160px]">
              <label className="label">Department</label>
              <select className="input" value={filters.department_id} onChange={(e) => setFilter('department_id', e.target.value)}>
                <option value="">All departments</option>
                {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
            {/* Branch */}
            <div className="min-w-[160px]">
              <label className="label">Branch</label>
              <select className="input" value={filters.branch_id} onChange={(e) => setFilter('branch_id', e.target.value)}>
                <option value="">All branches</option>
                {filterBranches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
            {/* Year */}
            <div className="min-w-[110px]">
              <label className="label">Year</label>
              <select className="input" value={filters.year} onChange={(e) => setFilter('year', e.target.value)}>
                <option value="">All years</option>
                <option value="1">Year 1</option>
                <option value="2">Year 2</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
              </select>
            </div>
            {/* Semester */}
            <div className="min-w-[120px]">
              <label className="label">Semester</label>
              <select className="input" value={filters.semester} onChange={(e) => setFilter('semester', e.target.value)}>
                <option value="">All sems</option>
                {[1,2,3,4,5,6,7,8].map((s) => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>
            {/* Section */}
            <div className="min-w-[100px]">
              <label className="label">Section</label>
              <input className="input" placeholder="e.g. A" value={filters.section} onChange={(e) => setFilter('section', e.target.value)} />
            </div>
            {/* Clear */}
            {hasActiveFilters && (
              <button className="btn-secondary flex items-center gap-1" onClick={clearFilters}>
                <X className="h-4 w-4" /> Clear
              </button>
            )}
          </div>
        </div>
      )}

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

          {(role === 'student' || role === 'hod' || role === 'faculty') && (
            <div>
              <label className="label">Branch {role === 'student' && <span className="text-red-500">*</span>}</label>
              <select className="input" {...register('branch_id', { required: role === 'student' })}>
                <option value="">Select branch</option>
                {filteredBranches.map((b) => <option key={b._id} value={b._id}>{b.name} {b.code ? `(${b.code})` : ''}</option>)}
              </select>
            </div>
          )}

          {role === 'student' && (
            <>
              <div>
                <label className="label">Year <span className="text-red-500">*</span></label>
                <select className="input" {...register('year', { required: true })}>
                  <option value="">Select year</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>
              <div>
                <label className="label">Semester <span className="text-red-500">*</span></label>
                <select className="input" {...register('semester', { required: true })}>
                  <option value="">Select semester</option>
                  {[1,2,3,4,5,6,7,8].map((s) => <option key={s} value={String(s)}>Semester {s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Section</label>
                <input className="input" placeholder="e.g. A" {...register('section')} />
              </div>
              <div>
                <label className="label">Enrollment Number</label>
                <input className="input" placeholder="e.g. 2024CS001" {...register('enrollment_number')} />
              </div>
            </>
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
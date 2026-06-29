import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCog } from 'lucide-react';
import { hodApi } from '../../api/hod.api';
import { PageHeader } from '../../components/common/PageHeader';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const FacultyManagePage = () => {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [branchFilter, setBranchFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: faculty = [], isLoading } = useQuery({
    queryKey: ['hod-faculty'],
    queryFn: hodApi.getDeptFaculty,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['hod-branches'],
    queryFn: hodApi.getDeptBranches,
  });

  const { data: subjects = [], isLoading: ls } = useQuery({
    queryKey: ['hod-subjects-faculty', branchFilter, yearFilter],
    queryFn: () => hodApi.getSubjectsWithFaculty({
      branch_id: branchFilter || undefined,
      year: yearFilter || undefined,
    }),
  });

  const assign = useMutation({
    mutationFn: hodApi.assignSubjectFaculty,
    onSuccess: () => {
      qc.invalidateQueries(['hod-subjects-faculty']);
      toast.success('Faculty assigned to subject');
      setModal(false);
      reset();
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const facultyCols = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (r) => <StatusBadge status={r.role} /> },
    {
      key: 'branches',
      header: 'Coordinator Branches',
      render: (r) =>
        r.coordinator_branches?.length
          ? r.coordinator_branches.map((b) => `${b.branch_id?.name || '—'} (Year ${b.year})`).join(', ')
          : '—',
    },
  ];

  const subjectCols = [
    { key: 'name', header: 'Subject' },
    { key: 'code', header: 'Code' },
    { key: 'branch', header: 'Branch', render: (r) => r.branch_id?.name || '—' },
    { key: 'year', header: 'Year', render: (r) => `Year ${r.year}` },
    { key: 'semester', header: 'Sem', render: (r) => `Sem ${r.semester}` },
    {
      key: 'faculty',
      header: 'Assigned Faculty',
      render: (r) => r.assigned_faculty?.name
        ? <span className="text-green-700 font-medium">{r.assigned_faculty.name}</span>
        : <span className="text-gray-400">Unassigned</span>,
    },
    {
      key: 'action',
      header: '',
      render: (r) => (
        <button
          className="btn-secondary btn-sm"
          onClick={() => { reset({ subject_id: r._id, faculty_id: r.assigned_faculty?._id || '' }); setModal(true); }}
        >
          <UserCog className="h-3.5 w-3.5" /> Assign
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Faculty" description="All faculty members in your department" />

      <div className="card">
        <Table columns={facultyCols} data={faculty} isLoading={isLoading} emptyTitle="No faculty found" />
      </div>

      {/* Subject-Faculty Assignment */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Subject — Faculty Assignment</h2>
          <div className="flex gap-3">
            <select className="input w-48" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="">All Branches</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
            <select className="input w-32" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="">All Years</option>
              {[1,2,3,4].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
        </div>
        <Table columns={subjectCols} data={subjects} isLoading={ls} emptyTitle="No subjects found" />
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Assign Faculty to Subject">
        <form onSubmit={handleSubmit((d) => assign.mutate(d))} className="space-y-4">
          <input type="hidden" {...register('subject_id')} />
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

export default FacultyManagePage;
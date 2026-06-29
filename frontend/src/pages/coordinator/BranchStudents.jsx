import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { coordinatorApi } from '../../api/coordinator.api';
import { PageHeader } from '../../components/common/PageHeader';
import { Table } from '../../components/common/Table';
import useAuthStore from '../../store/authStore';

const CoordinatorBranchStudents = () => {
  const { user } = useAuthStore();
  const branches = user?.coordinator_branches || [];
  const [branchId, setBranchId] = useState(branches[0]?.branch_id?._id || branches[0]?.branch_id || '');

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['coordinator-branch-students', branchId],
    queryFn: () => coordinatorApi.getBranchStudents({ branch_id: branchId }),
    enabled: !!branchId,
  });

  const cols = [
    { key: 'name', header: 'Name' },
    { key: 'enrollment_number', header: 'Enrollment No' },
    { key: 'email', header: 'Email' },
    { key: 'year', header: 'Year', render: (r) => `Year ${r.year}` },
    { key: 'section', header: 'Section', render: (r) => r.section || '—' },
    { key: 'semester', header: 'Semester', render: (r) => `Sem ${r.semester}` },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Branch Students" description="All students in your assigned branch" />

      {branches.length > 1 && (
        <div className="card p-4">
          <label className="label">Select Branch</label>
          <select className="input w-64" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => (
              <option key={b._id} value={b.branch_id?._id || b.branch_id}>
                {b.branch_id?.name || b.branch_id} (Year {b.year})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="card">
        <Table columns={cols} data={students} isLoading={isLoading} emptyTitle="No students found" />
      </div>
    </div>
  );
};

export default CoordinatorBranchStudents;
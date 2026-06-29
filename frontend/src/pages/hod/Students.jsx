// pages/hod/Students.jsx
import { useQuery } from '@tanstack/react-query';
import { hodApi } from '../../api/hod.api';
import { PageHeader } from '../../components/common/PageHeader';
import { Table } from '../../components/common/Table';
import { StatusBadge } from '../../components/common/StatusBadge';

const HODStudents = () => {
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['hod-students'],
    queryFn: hodApi.getDeptStudents,
  });

  const cols = [
    { key: 'name', header: 'Name' },
    { key: 'enrollment_number', header: 'Enrollment No' },
    { key: 'email', header: 'Email' },
    { key: 'branch', header: 'Branch', render: (r) => r.branch_id?.name || '—' },
    { key: 'year', header: 'Year' },
    { key: 'section', header: 'Section', render: (r) => r.section || '—' },
  ];

  return (
    <div>
      <PageHeader title="Students" description="All students in your department" />
      <div className="card">
        <Table columns={cols} data={students} isLoading={isLoading} emptyTitle="No students found" />
      </div>
    </div>
  );
};

export default HODStudents;
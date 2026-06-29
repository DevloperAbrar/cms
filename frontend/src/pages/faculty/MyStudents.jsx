import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { facultyApi } from '../../api/faculty.api';
import { PageHeader } from '../../components/common/PageHeader';
import { Table } from '../../components/common/Table';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const FacultyStudents = () => {
  const [subjectId, setSubjectId] = useState('');

  const { data: subjects = [] } = useQuery({
    queryKey: ['faculty-subjects'],
    queryFn: facultyApi.getMySubjects,
  });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['faculty-students', subjectId],
    queryFn: () => facultyApi.getMyStudents({ subject_id: subjectId }),
    enabled: !!subjectId,
  });

  const cols = [
    { key: 'name', header: 'Name' },
    { key: 'enrollment_number', header: 'Enrollment No' },
    { key: 'email', header: 'Email' },
    { key: 'section', header: 'Section', render: (r) => r.section || '—' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="My Students" description="Students assigned to your subjects" />

      <div className="card p-4">
        <label className="label">Select Subject</label>
        <select className="input w-full sm:w-80" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Select a subject</option>
          {subjects.map((s) => (
            <option key={s._id} value={s._id}>{s.name} ({s.code}) — Year {s.year}</option>
          ))}
        </select>
      </div>

      {subjectId && (
        <div className="card">
          <Table columns={cols} data={students} isLoading={isLoading} emptyTitle="No students found" />
        </div>
      )}
    </div>
  );
};

export default FacultyStudents;
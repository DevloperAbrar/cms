import { useQuery } from '@tanstack/react-query';
import { examControllerApi } from '../../api/examcontroller.api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { GitBranch, Users, ClipboardList } from 'lucide-react';
import useAuthStore from '../../store/authStore';

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="card p-5 flex items-center gap-4">
    <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${color}`}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  </div>
);

const ExamControllerDashboard = () => {
  const { user } = useAuthStore();

  const { data: branches = [], isLoading: lb } = useQuery({
    queryKey: ['ec-branches'],
    queryFn: examControllerApi.getAllBranches,
  });

  const { data: subjects = [], isLoading: ls } = useQuery({
    queryKey: ['ec-subjects'],
    queryFn: () => examControllerApi.getAllSubjects({}),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user?.name?.split(' ')[0] || 'Exam Controller'}!`}
        description="Institute-wide final result (CGPA / percentage) publishing"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Branches" value={branches.length} icon={GitBranch} color="bg-primary-600" />
        <StatCard label="Total Subjects" value={subjects.length} icon={ClipboardList} color="bg-violet-600" />
        <StatCard label="Role" value="Exam Controller" icon={Users} color="bg-green-600" />
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Access Scope</h2>
        <p className="text-sm text-gray-500">
          You have institute-wide access to enter and publish final results (CGPA / percentage) only. Navigate to <strong>Final Results</strong>, pick a Department, Branch, Year and Semester, and enter each student's final value.
        </p>
      </div>
    </div>
  );
};

export default ExamControllerDashboard;
import { useQuery } from '@tanstack/react-query';
import { hodApi } from '../../api/hod.api';
import FinalResultsRankings from '../../components/finalresults/FinalResultsRankings';
import useAuthStore from '../../store/authStore';

const HODFinalResults = () => {
  const { user } = useAuthStore();

  // HOD's own branches (scoped to their department in backend)
  const { data: branches = [] } = useQuery({
    queryKey: ['hod-branches-for-rankings'],
    queryFn: hodApi.getDeptBranches,
  });

  // HOD belongs to exactly one department — build a single-item array from auth store
  // department_id may be a populated object or just an id string depending on login response
  const deptId = user?.department_id?._id || user?.department_id;
  const deptName = user?.department_id?.name || 'My Department';
  const departments = deptId ? [{ _id: deptId, name: deptName }] : [];

  return <FinalResultsRankings api={hodApi} branches={branches} departments={departments} />;
};

export default HODFinalResults;
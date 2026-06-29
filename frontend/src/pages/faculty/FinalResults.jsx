import { useQuery } from '@tanstack/react-query';
import { facultyApi } from '../../api/faculty.api';
import FinalResultsRankings from '../../components/finalresults/FinalResultsRankings';
import useAuthStore from '../../store/authStore';

const FacultyFinalResults = () => {
  const { user } = useAuthStore();

  // Faculty's own branches via their API
  const { data: branches = [] } = useQuery({
    queryKey: ['faculty-branches-for-rankings'],
    queryFn: facultyApi.getFinalResultBranches,
  });

  // Faculty belongs to exactly one department — build from auth store
  const deptId = user?.department_id?._id || user?.department_id;
  const deptName = user?.department_id?.name || 'My Department';
  const departments = deptId ? [{ _id: deptId, name: deptName }] : [];

  return <FinalResultsRankings api={facultyApi} branches={branches} departments={departments} />;
};

export default FacultyFinalResults;
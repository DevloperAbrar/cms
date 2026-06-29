import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getRoleHome } from '../../utils/roleGuard';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const GoogleCallback = () => {
  const { fetchMe } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const role = params.get('role');

  useEffect(() => {
    const finish = async () => {
      const user = await fetchMe();
      if (user) {
        toast.success(`Welcome, ${user.name}!`);
        navigate(getRoleHome(user.role));
      } else {
        toast.error('Authentication failed. Please try again.');
        navigate('/');
      }
    };
    finish();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-gray-500">Completing sign in...</p>
    </div>
  );
};

export default GoogleCallback;
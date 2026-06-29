import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentApi } from '../../api/student.api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Bell } from 'lucide-react';

const StudentNotices = () => {
  const qc = useQueryClient();

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['student-notices'],
    queryFn: studentApi.getNotices,
  });

  const markRead = useMutation({
    mutationFn: studentApi.markNoticeRead,
    onSuccess: () => qc.invalidateQueries(['student-notices']),
  });

  if (isLoading) return <LoadingSpinner className="py-16" />;

  return (
    <div className="space-y-4">
      <PageHeader title="Notices" />

      {notices.length === 0 ? (
        <EmptyState title="No notices" description="You have no notices at this time." />
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <div
              key={n._id}
              className={`card p-5 cursor-pointer transition-colors ${n.is_read ? '' : 'border-primary-200 bg-primary-50/30'}`}
              onClick={() => !n.is_read && markRead.mutate(n._id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Bell className={`h-4 w-4 mt-0.5 flex-shrink-0 ${n.is_read ? 'text-gray-400' : 'text-primary-600'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${n.is_read ? 'text-gray-700' : 'text-gray-900'}`}>{n.title}</p>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{n.body}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString('en-IN')}</p>
                      <p className="text-xs text-gray-400">— {n.posted_by?.name}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={n.priority} />
                  {!n.is_read && <span className="h-2 w-2 bg-primary-600 rounded-full" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentNotices;
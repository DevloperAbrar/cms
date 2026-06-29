import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Trash2, BarChart2, Pencil } from 'lucide-react';
import { facultyApi } from '../../api/faculty.api';
import { coordinatorApi } from '../../api/coordinator.api';
import { PageHeader } from '../../components/common/PageHeader';
import { Table } from '../../components/common/Table';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useState } from 'react';
import toast from 'react-hot-toast';

const getApi = (apiBase) => apiBase === 'coordinator' ? coordinatorApi : facultyApi;

const FacultyQuiz = ({ apiBase = 'faculty' }) => {
  const qc = useQueryClient();
  const api = getApi(apiBase);
  const [deleting, setDeleting] = useState(null);

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: [`${apiBase}-quizzes`],
    queryFn: api.getMyQuizzes,
    refetchOnMount: true,           // always refetch when navigating back
    refetchOnWindowFocus: false,
  });

  const publishMutation = useMutation({
    mutationFn: (id) => api.publishQuiz(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`${apiBase}-quizzes`] });
      toast.success('Quiz published');
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.deleteQuiz(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`${apiBase}-quizzes`] });
      toast.success('Quiz deleted');
      setDeleting(null);
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const handlePublish = (quiz) => {
    if (!quiz.questions || quiz.questions.length === 0) {
      toast.error('Add at least one question before publishing.');
      return;
    }
    publishMutation.mutate(quiz._id);
  };

  const cols = [
    { key: 'title', header: 'Title' },
    { key: 'subject', header: 'Subject', render: (r) => r.subject_id?.name || '—' },
    { key: 'questions', header: 'Questions', render: (r) => r.questions?.length || 0 },
    { key: 'total_marks', header: 'Total Marks' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'time',
      header: 'Schedule',
      render: (r) => (
        <span className="text-xs text-gray-500">
          {new Date(r.start_time).toLocaleDateString('en-IN')} –{' '}
          {new Date(r.end_time).toLocaleDateString('en-IN')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex gap-2 justify-end">
          {r.status === 'draft' && (
            <>
              {/* Edit draft */}
              <Link
                to={`/${apiBase}/quiz/${r._id}/edit`}
                className="btn-secondary btn-sm"
                title="Edit draft"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Link>
              {/* Publish */}
              <button
                className="btn-primary btn-sm"
                onClick={() => handlePublish(r)}
                disabled={publishMutation.isPending}
              >
                Publish
              </button>
              {/* Delete */}
              <button className="btn-danger btn-sm" onClick={() => setDeleting(r)}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {/* Results — always visible */}
          <Link to={`/${apiBase}/quiz/${r._id}/results`} className="btn-secondary btn-sm" title="Results">
            <BarChart2 className="h-3.5 w-3.5" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Quizzes"
        action={
          <Link to={`/${apiBase}/quiz/create`} className="btn-primary">
            <Plus className="h-4 w-4" /> Create Quiz
          </Link>
        }
      />

      <div className="card">
        <Table
          columns={cols}
          data={quizzes}
          isLoading={isLoading}
          emptyTitle="No quizzes yet"
          emptyDescription="Create your first quiz."
        />
      </div>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutate(deleting._id)}
        title="Delete Quiz"
        message={`Delete "${deleting?.title}"? This cannot be undone.`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default FacultyQuiz;
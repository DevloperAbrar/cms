import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { studentApi } from '../../api/student.api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Clock, CheckCircle, ChevronRight, BarChart2, Trophy, BookOpen } from 'lucide-react';

const StudentQuiz = () => {
  const { data: activeQuizzes = [], isLoading: loadingActive } = useQuery({
    queryKey: ['active-quizzes'],
    queryFn: studentApi.getActiveQuizzes,
    refetchInterval: 30000, // refresh every 30s while on page
  });

  const { data: pastQuizzes = [], isLoading: loadingPast } = useQuery({
    queryKey: ['past-quizzes'],
    queryFn: studentApi.getPastQuizzes,
  });

  const isLoading = loadingActive || loadingPast;
  if (isLoading) return <LoadingSpinner className="py-16" />;

  return (
    <div className="space-y-8">
      <PageHeader title="My Quizzes" />

      {/* ── Active Quizzes ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-green-100">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </span>
          <h2 className="text-sm font-semibold text-gray-900">Active Now</h2>
          {activeQuizzes.length > 0 && (
            <span className="ml-1 text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
              {activeQuizzes.length}
            </span>
          )}
        </div>

        {activeQuizzes.length === 0 ? (
          <div className="card p-6 text-center">
            <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No quizzes are running right now.</p>
            <p className="text-xs text-gray-400 mt-1">Check back later or refresh the page.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeQuizzes.map((q) => {
              const endTime = new Date(q.end_time);
              const now = new Date();
              const minsLeft = Math.max(0, Math.floor((endTime - now) / 60000));
              const isUrgent = minsLeft <= 10;

              return (
                <div
                  key={q._id}
                  className="card p-5 flex items-center justify-between gap-4 border-l-4 border-l-green-400"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{q.title}</p>
                      {q.attempts_made > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          <CheckCircle className="h-3 w-3" /> Attempted
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {q.subject_id?.name} • {q.total_marks} marks • {q.duration_minutes} min
                    </p>
                    <div className={`flex items-center gap-1.5 mt-1.5 text-xs font-medium ${isUrgent ? 'text-red-500' : 'text-gray-400'}`}>
                      <Clock className="h-3 w-3" />
                      {isUrgent
                        ? `Only ${minsLeft} min left!`
                        : `Ends ${endTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {q.can_attempt ? (
                      <Link
                        to={`/student/quiz/${q._id}/attempt`}
                        className="btn-primary flex items-center gap-1.5"
                      >
                        {q.attempts_made > 0 ? 'Re-attempt' : 'Start Quiz'}
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <span className="text-xs font-medium text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
                        Max attempts reached
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Past Quizzes ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Past Quizzes</h2>
          {pastQuizzes.length > 0 && (
            <span className="ml-1 text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-full">
              {pastQuizzes.length}
            </span>
          )}
        </div>

        {pastQuizzes.length === 0 ? (
          <div className="card p-6 text-center">
            <BookOpen className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No past quizzes yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pastQuizzes.map((q) => {
              const endTime = new Date(q.end_time);
              const pct = q.score != null ? Math.round((q.score / q.total_marks) * 100) : null;

              return (
                <div key={q._id} className="card p-5 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{q.title}</p>
                      {!q.attempted && (
                        <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">
                          Not attempted
                        </span>
                      )}
                      {q.attempted && pct !== null && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          pct >= 75
                            ? 'bg-green-100 text-green-700'
                            : pct >= 40
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-red-100 text-red-600'
                        }`}>
                          {pct}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {q.subject_id?.name} • {q.total_marks} marks
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Ended {endTime.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {q.attempted && q.score != null && (
                        <span className="ml-2 text-gray-500 font-medium">
                          Score: {q.score}/{q.total_marks}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {q.attempted && q.result_available ? (
                      <Link
                        to={`/student/quiz/${q._id}/result`}
                        className="btn-secondary flex items-center gap-1.5 text-sm"
                      >
                        <BarChart2 className="h-4 w-4" />
                        View Result
                      </Link>
                    ) : q.attempted && !q.result_available ? (
                      <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg">
                        Result not published
                      </span>
                    ) : (
                      <span className="text-xs text-red-400 bg-red-50 px-3 py-1.5 rounded-lg">
                        Missed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default StudentQuiz;
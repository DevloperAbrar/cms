import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { studentApi } from '../../api/student.api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ChevronLeft, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

const StudentQuizResult = () => {
  const { quiz_id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['quiz-result', quiz_id],
    queryFn: () => studentApi.getQuizResult(quiz_id),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner className="mx-auto" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="card w-full max-w-md p-8 text-center space-y-4">
          <div className="text-5xl">🔒</div>
          <h2 className="text-lg font-bold text-gray-900">Result Not Available</h2>
          <p className="text-sm text-gray-500">
            {error?.response?.data?.message || 'Results have not been published by your faculty yet.'}
          </p>
          <button className="btn-secondary w-full" onClick={() => navigate('/student/quiz')}>
            ← Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const {
    mode,
    score,
    total_marks,
    submitted_at,
    is_auto_submitted,
    quiz_title,
    rank,
    total_participants,
    questions,
  } = data;

  const pct = Math.round((score / total_marks) * 100);
  const passed = pct >= 40;
  const scoreColor = pct >= 75 ? '#16a34a' : pct >= 40 ? '#2563eb' : '#dc2626';

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">

      {/* ── Back button ── */}
      <button
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        onClick={() => navigate('/student/quiz')}
      >
        <ChevronLeft className="h-4 w-4" /> Back to Quizzes
      </button>

      {/* ── Score card ── */}
      <div className="card p-8">
        <div className="flex flex-col sm:flex-row items-center gap-6">

          {/* Score ring */}
          <div className="relative flex-shrink-0 inline-flex items-center justify-center">
            <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke={scoreColor}
                strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - pct / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <p className="text-2xl font-bold text-gray-900">{pct}%</p>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <div>
              <h1 className="text-lg font-bold text-gray-900">{quiz_title}</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Submitted {new Date(submitted_at).toLocaleString('en-IN')}
                {is_auto_submitted && (
                  <span className="ml-2 text-orange-500">⏰ Auto-submitted</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-4 justify-center sm:justify-start flex-wrap">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{score}</p>
                <p className="text-xs text-gray-400">out of {total_marks}</p>
              </div>

              {rank != null && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">#{rank}</p>
                  <p className="text-xs text-gray-400">of {total_participants} students</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
              }`}>
                {passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {passed ? 'Passed' : 'Needs Improvement'}
              </span>

              {/* Mode badge */}
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                {mode === 'scores_only' && '📊 Scores shared'}
                {mode === 'scores_with_rank' && '🏆 Scores + Rank shared'}
                {mode === 'scores_with_solution' && '📋 Full solution shared'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Solution (only if mode = scores_with_solution) ── */}
      {mode === 'scores_with_solution' && questions && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 px-1">Answer Review</h2>

          {questions.map((q, qi) => {
            const wasAnswered = q.selected_options.length > 0;

            return (
              <div key={q.question_id} className={`card p-5 space-y-4 border-l-4 ${
                !wasAnswered
                  ? 'border-l-gray-300'
                  : q.is_correct
                  ? 'border-l-green-400'
                  : 'border-l-red-400'
              }`}>
                {/* Question header */}
                <div className="flex items-start gap-3">
                  <span className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    !wasAnswered
                      ? 'bg-gray-100 text-gray-500'
                      : q.is_correct
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {qi + 1}
                  </span>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        q.type === 'multiple'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {q.type === 'multiple' ? 'Multiple correct' : 'Single correct'}
                      </span>
                      <span className="text-xs text-gray-400">{q.marks} marks</span>
                      {/* Result indicator */}
                      {!wasAnswered ? (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <MinusCircle className="h-3.5 w-3.5" /> Not answered
                        </span>
                      ) : q.is_correct ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Correct (+{q.marks})
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-red-500">
                          <XCircle className="h-3.5 w-3.5" /> Wrong
                          {q.negative_marks > 0 && ` (-${q.negative_marks})`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 leading-relaxed">{q.question_text}</p>
                  </div>
                </div>

                {/* Question image */}
                {q.image_path && (
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 ml-10">
                    <img
                      src={`/api/static/quiz/${q.image_path.split('/').pop()}`}
                      alt="Question"
                      className="max-h-48 w-full object-contain"
                    />
                  </div>
                )}

                {/* Options */}
                <div className="space-y-2 ml-10">
                  {q.options.map((opt, oi) => {
                    const isSelected = q.selected_options.includes(opt._id.toString());
                    const isCorrect = opt.is_correct;

                    let optStyle = 'border-gray-200 bg-gray-50 text-gray-600'; // default
                    let labelStyle = 'border-gray-300 text-gray-400 bg-white';

                    if (isCorrect && isSelected) {
                      // Correct and student selected — green
                      optStyle = 'border-green-400 bg-green-50 text-green-800';
                      labelStyle = 'border-green-500 bg-green-500 text-white';
                    } else if (isCorrect && !isSelected) {
                      // Correct but student missed — green dashed
                      optStyle = 'border-green-300 bg-green-50/50 text-green-700 border-dashed';
                      labelStyle = 'border-green-400 text-green-600 bg-white';
                    } else if (!isCorrect && isSelected) {
                      // Wrong and student selected — red
                      optStyle = 'border-red-400 bg-red-50 text-red-800';
                      labelStyle = 'border-red-500 bg-red-500 text-white';
                    }

                    return (
                      <div
                        key={opt._id}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 ${optStyle}`}
                      >
                        <span className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${labelStyle}`}>
                          {OPTION_LABELS[oi]}
                        </span>

                        {opt.image_path && (
                          <img
                            src={`/api/static/quiz/${opt.image_path.split('/').pop()}`}
                            alt={`Option ${OPTION_LABELS[oi]}`}
                            className="h-10 w-10 object-cover rounded-lg flex-shrink-0"
                          />
                        )}

                        <span className="text-sm font-medium flex-1">{opt.text}</span>

                        {/* Indicator icons */}
                        {isCorrect && isSelected && <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />}
                        {isCorrect && !isSelected && (
                          <span className="text-xs text-green-600 font-semibold flex-shrink-0">✓ Correct</span>
                        )}
                        {!isCorrect && isSelected && <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Rank-only mode info ── */}
      {mode === 'scores_with_rank' && (
        <div className="card p-5 text-center text-sm text-gray-500">
          Your faculty has not shared the full solution yet. Only scores and ranks are visible.
        </div>
      )}
    </div>
  );
};

export default StudentQuizResult;
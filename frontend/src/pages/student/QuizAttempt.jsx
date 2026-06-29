import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { studentApi } from '../../api/student.api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { QuizTimer } from '../../components/quiz/QuizTimer';
import toast from 'react-hot-toast';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ─── Leave-confirmation modal ─────────────────────────────────────────────────
const LeaveConfirmModal = ({ onStay, onSubmitAndLeave, isSubmitting }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
    <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
          <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">Leave the quiz?</h3>
          <p className="text-sm text-gray-500 mt-1">
            Your progress is saved, but the timer keeps running. If you leave without submitting,
            your quiz will be auto-submitted when time runs out.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-1">
        <button
          onClick={onSubmitAndLeave}
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {isSubmitting ? 'Submitting…' : 'Submit & Leave'}
        </button>
        <button
          onClick={onStay}
          className="w-full py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
        >
          Stay on Quiz
        </button>
      </div>
    </div>
  </div>
);

// ─── Submit confirmation modal ────────────────────────────────────────────────
const SubmitConfirmModal = ({ answeredCount, totalQ, onConfirm, onCancel, isSubmitting }) => {
  const unanswered = totalQ - answeredCount;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
            <svg className="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">Submit Quiz?</h3>
          {unanswered > 0 ? (
            <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              ⚠ {unanswered} question{unanswered > 1 ? 's' : ''} left unanswered
            </p>
          ) : (
            <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
              ✓ All {totalQ} questions answered
            </p>
          )}
          <p className="text-xs text-gray-400">You cannot change answers after submitting.</p>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
          >
            Review
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {isSubmitting ? 'Submitting…' : 'Confirm Submit'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const StudentQuizAttempt = () => {
  const { quiz_id } = useParams();
  const navigate = useNavigate();

  const [attemptId, setAttemptId]                 = useState(null);
  const [startedAt, setStartedAt]                 = useState(null);
  const [quiz, setQuiz]                           = useState(null);
  const [answers, setAnswers]                     = useState({});
  const [submitted, setSubmitted]                 = useState(false);
  const [result, setResult]                       = useState(null);
  const [activeQ, setActiveQ]                     = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm]   = useState(false);
  const pendingNavRef                             = useRef(null); // stores the URL to navigate to after confirm

  const submittedRef = useRef(false);
  const quizActiveRef = useRef(false); // true once quiz is loaded and not yet submitted

  // ── Load / resume in-progress attempt ─────────────────────────────────────
  const startMutation = useMutation({
    mutationFn: () => studentApi.startQuiz(quiz_id),
    onSuccess: (data) => {
      setAttemptId(data.attempt._id);
      setStartedAt(data.attempt.started_at); // server timestamp — survives refresh
      setQuiz(data.quiz);
      quizActiveRef.current = true;

      // Restore saved answers if student refreshed mid-quiz
      const saved = sessionStorage.getItem(`quiz_answers_${data.attempt._id}`);
      if (saved) {
        try { setAnswers(JSON.parse(saved)); } catch (_) {}
      }
    },
    onError: (e) => {
      toast.error(e?.response?.data?.message || e.message);
      navigate('/student/quiz');
    },
  });

  useEffect(() => { startMutation.mutate(); }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: ({ id, payload }) => studentApi.submitQuiz(id, payload),
    onSuccess: (data) => {
      submittedRef.current = true;
      quizActiveRef.current = false;
      setSubmitted(true);
      setResult(data);
      if (attemptId) sessionStorage.removeItem(`quiz_answers_${attemptId}`);
    },
    onError: (e) => {
      submittedRef.current = false; // allow retry
      toast.error(e?.response?.data?.message || e.message);
    },
  });

  const doSubmit = useCallback((isAuto = false, afterCb = null) => {
    if (!attemptId || submittedRef.current) return;
    submittedRef.current = true;
    submitMutation.mutate(
      {
        id: attemptId,
        payload: {
          answers: Object.entries(answers).map(([question_id, selected_options]) => ({
            question_id,
            selected_options,
          })),
          is_auto_submitted: isAuto,
        },
      },
      { onSettled: afterCb }
    );
  }, [attemptId, answers, submitMutation]);

  // ── Auto-save answers to sessionStorage ───────────────────────────────────
  useEffect(() => {
    if (!attemptId || Object.keys(answers).length === 0) return;
    sessionStorage.setItem(`quiz_answers_${attemptId}`, JSON.stringify(answers));
  }, [answers, attemptId]);

  // ── Warn on browser refresh / tab close ───────────────────────────────────
  useEffect(() => {
    if (submitted) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [submitted]);

  // ── Intercept browser back button via popstate ────────────────────────────
  // Works with BrowserRouter (no data router needed)
  useEffect(() => {
    if (submitted) return;

    // Push a dummy history entry so back button triggers popstate instead of leaving
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      if (!quizActiveRef.current || submittedRef.current) return;
      // Push state again to prevent actual navigation
      window.history.pushState(null, '', window.location.href);
      pendingNavRef.current = null; // back button — no target URL
      setShowLeaveConfirm(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [submitted]);

  // ── Intercept sidebar / internal link clicks via navigate override ─────────
  // We wrap navigate so any programmatic navigation during quiz shows the modal
  const safeNavigate = useCallback((to, options) => {
    if (!quizActiveRef.current || submittedRef.current) {
      navigate(to, options);
      return;
    }
    pendingNavRef.current = { to, options };
    setShowLeaveConfirm(true);
  }, [navigate]);

  const handleStay = () => {
    pendingNavRef.current = null;
    setShowLeaveConfirm(false);
  };

  const handleSubmitAndLeave = () => {
    const pending = pendingNavRef.current;
    doSubmit(false, () => {
      setShowLeaveConfirm(false);
      if (pending) {
        navigate(pending.to, pending.options);
      } else {
        navigate('/student/quiz');
      }
    });
  };

  const handleLeaveWithoutSubmit = () => {
    // Just leave — timer keeps running, auto-submit will fire when time is up
    quizActiveRef.current = false;
    submittedRef.current = true; // prevent any further blocks
    const pending = pendingNavRef.current;
    setShowLeaveConfirm(false);
    if (pending) {
      navigate(pending.to, pending.options);
    } else {
      navigate('/student/quiz');
    }
  };

  // ── Timer expired ──────────────────────────────────────────────────────────
  const handleTimeUp = useCallback(() => {
    if (!submittedRef.current) {
      toast('Time is up! Submitting automatically.', { icon: '⏰' });
      doSubmit(true);
    }
  }, [doSubmit]);

  // ── Answer toggle ──────────────────────────────────────────────────────────
  const toggleAnswer = (questionId, optionId, type) => {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      if (type === 'single') return { ...prev, [questionId]: [optionId] };
      if (current.includes(optionId))
        return { ...prev, [questionId]: current.filter((id) => id !== optionId) };
      return { ...prev, [questionId]: [...current, optionId] };
    });
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (startMutation.isPending || (!quiz && !startMutation.isError)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <LoadingSpinner className="mx-auto" />
          <p className="text-sm text-gray-500">Loading quiz…</p>
        </div>
      </div>
    );
  }

  if (!quiz) return null;

  // ── Result screen ──────────────────────────────────────────────────────────
  if (submitted) {
    const pct =
      result?.score !== undefined
        ? Math.round((result.score / result.total_marks) * 100)
        : null;
    const passed = pct !== null && pct >= 40;

    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="card w-full max-w-md p-8 text-center space-y-6">
          <div className="text-6xl">
            {pct === null ? '📋' : pct >= 75 ? '🏆' : pct >= 40 ? '✅' : '📝'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Quiz Submitted!</h1>
            <p className="text-sm text-gray-500 mt-1">{quiz.title}</p>
          </div>

          {result?.score !== undefined ? (
            <div className="space-y-3">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="50" fill="none"
                    stroke={pct >= 75 ? '#16a34a' : pct >= 40 ? '#2563eb' : '#dc2626'}
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
              <p className="text-3xl font-bold text-gray-900">
                {result.score}{' '}
                <span className="text-lg font-normal text-gray-400">/ {result.total_marks}</span>
              </p>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
              }`}>
                {passed ? 'Passed' : 'Needs Improvement'}
              </span>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
              {result?.message || 'Result will be available after the quiz ends.'}
            </div>
          )}

          {result?.is_auto_submitted && (
            <p className="text-xs text-orange-500 bg-orange-50 rounded-lg px-3 py-2">
              ⏰ Auto-submitted when time ran out
            </p>
          )}

          <button className="btn-primary w-full" onClick={() => navigate('/student/quiz')}>
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  // ── Attempt screen ─────────────────────────────────────────────────────────
  const answeredCount      = Object.values(answers).filter((a) => a && a.length > 0).length;
  const totalQ             = quiz.questions.length;
  const progress           = Math.round((answeredCount / totalQ) * 100);
  const currentQ           = quiz.questions[activeQ];
  const selectedForCurrent = answers[currentQ?._id] || [];

  return (
    <>
      {/* ── Modals ── */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Leave the quiz?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Timer keeps running if you leave. Submit now to save your answers, or leave and let it auto-submit when time runs out.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={handleSubmitAndLeave}
                disabled={submitMutation.isPending}
                className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {submitMutation.isPending ? 'Submitting…' : 'Submit & Leave'}
              </button>
              <button
                onClick={handleLeaveWithoutSubmit}
                className="w-full py-2.5 px-4 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 text-sm font-medium transition-colors border border-gray-200"
              >
                Leave without submitting
              </button>
              <button
                onClick={handleStay}
                className="w-full py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
              >
                Stay on Quiz
              </button>
            </div>
          </div>
        </div>
      )}

      {showSubmitConfirm && (
        <SubmitConfirmModal
          answeredCount={answeredCount}
          totalQ={totalQ}
          onConfirm={() => { setShowSubmitConfirm(false); doSubmit(false); }}
          onCancel={() => setShowSubmitConfirm(false)}
          isSubmitting={submitMutation.isPending}
        />
      )}

      <div className="max-w-4xl mx-auto space-y-4 pb-8">

        {/* ── Sticky header ── */}
        <div className="card p-4 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-gray-900 truncate">{quiz.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-500">{answeredCount}/{totalQ} answered</span>
                <span className="text-xs text-gray-300">|</span>
                <span className="text-xs text-gray-500">{quiz.total_marks} marks</span>
                <div className="flex-1 max-w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-primary-600 font-medium">{progress}%</span>
              </div>
            </div>

            {/* Timer — startedAt from server, survives page refresh */}
            {startedAt && (
              <QuizTimer
                startedAt={startedAt}
                durationMinutes={quiz.duration_minutes}
                onTimeUp={handleTimeUp}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

          {/* ── Question navigator (sidebar) ── */}
          <div className="lg:col-span-1">
            <div className="card p-4 space-y-3 sticky top-24">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Questions</p>
              <div className="grid grid-cols-5 lg:grid-cols-4 gap-1.5">
                {quiz.questions.map((q, i) => {
                  const isAnswered = (answers[q._id] || []).length > 0;
                  const isActive   = i === activeQ;
                  return (
                    <button
                      key={q._id}
                      onClick={() => setActiveQ(i)}
                      className={`h-8 w-8 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-primary-600 text-white shadow-sm'
                          : isAnswered
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-1.5 pt-1 border-t border-gray-100">
                {[
                  { color: 'bg-primary-600', label: 'Current' },
                  { color: 'bg-green-100 border border-green-200', label: 'Answered' },
                  { color: 'bg-gray-100', label: 'Not answered' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2 text-xs text-gray-500">
                    <span className={`h-3 w-3 rounded inline-block ${color}`} /> {label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Active question ── */}
          <div className="lg:col-span-3 space-y-4">
            {currentQ && (
              <div className="card p-6 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex-shrink-0">
                        {activeQ + 1}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        currentQ.type === 'multiple'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {currentQ.type === 'multiple' ? 'Multiple correct' : 'Single correct'}
                      </span>
                    </div>
                    <p className="text-base font-medium text-gray-900 leading-relaxed">
                      {currentQ.text}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-gray-400 whitespace-nowrap bg-gray-50 px-2 py-1 rounded-lg">
                    {currentQ.marks} {currentQ.marks === 1 ? 'mark' : 'marks'}
                  </span>
                </div>

                {currentQ.image_path && (
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    <img
                      src={`/api/static/quiz/${currentQ.image_path.split('/').pop()}`}
                      alt="Question"
                      className="max-h-56 w-full object-contain"
                    />
                  </div>
                )}

                <p className="text-xs text-gray-400 italic">
                  {currentQ.type === 'multiple'
                    ? '✦ Select all correct answers'
                    : '✦ Select one answer'}
                </p>

                <div className="space-y-2.5">
                  {currentQ.options.map((opt, oi) => {
                    const isSelected = selectedForCurrent.includes(opt._id);
                    return (
                      <button
                        key={opt._id}
                        type="button"
                        onClick={() => toggleAnswer(currentQ._id, opt._id, currentQ.type)}
                        className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150 ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                          isSelected
                            ? 'bg-primary-600 border-primary-600 text-white'
                            : 'border-gray-300 text-gray-400'
                        }`}>
                          {OPTION_LABELS[oi]}
                        </span>
                        {opt.image_path && (
                          <img
                            src={`/api/static/quiz/${opt.image_path.split('/').pop()}`}
                            alt={`Option ${OPTION_LABELS[oi]}`}
                            className="h-10 w-10 object-cover rounded-lg flex-shrink-0"
                          />
                        )}
                        <span className={`text-sm font-medium ${
                          isSelected ? 'text-primary-800' : 'text-gray-700'
                        }`}>
                          {opt.text}
                        </span>
                        {isSelected && (
                          <span className="ml-auto flex-shrink-0 text-primary-600">
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                            </svg>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Navigation + Submit ── */}
            <div className="flex items-center justify-between gap-3">
              <button
                className="btn-secondary"
                onClick={() => setActiveQ((p) => Math.max(0, p - 1))}
                disabled={activeQ === 0}
              >
                ← Previous
              </button>

              <span className="text-xs text-gray-400">{activeQ + 1} of {totalQ}</span>

              {activeQ < totalQ - 1 ? (
                <button
                  className="btn-primary"
                  onClick={() => setActiveQ((p) => Math.min(totalQ - 1, p + 1))}
                >
                  Next →
                </button>
              ) : (
                <button
                  className="btn-primary bg-green-600 hover:bg-green-700 border-green-600"
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={submitMutation.isPending}
                >
                  Submit Quiz
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentQuizAttempt;
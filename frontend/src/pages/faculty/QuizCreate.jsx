import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { facultyApi } from '../../api/faculty.api';
import { coordinatorApi } from '../../api/coordinator.api';
import { PageHeader } from '../../components/common/PageHeader';
import { QuestionBuilder } from '../../components/quiz/QuestionBuilder';
import toast from 'react-hot-toast';

const getApi = (apiBase) => apiBase === 'coordinator' ? coordinatorApi : facultyApi;

const FacultyQuizCreate = ({ apiBase = 'faculty' }) => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const api = getApi(apiBase);

  const { data: subjects = [] } = useQuery({
    queryKey: [`${apiBase}-subjects`],
    queryFn: api.getMySubjects,
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: '',
      subject_id: '',
      branch_id: '',
      year: '',
      start_time: '',
      end_time: '',
      duration_minutes: 30,
      total_marks: 0,
      negative_marking: false,
      negative_value: 0,
      shuffle_questions: false,
      shuffle_options: false,
      attempts_allowed: 1,
      result_visibility: 'immediate',
      questions: [],
    },
  });

  // Auto-calculate total_marks from question marks
  const questions = useWatch({ control, name: 'questions' });
  useEffect(() => {
    const total = (questions || []).reduce((sum, q) => sum + (Number(q?.marks) || 0), 0);
    setValue('total_marks', total);
  }, [questions, setValue]);

  const create = useMutation({
    mutationFn: api.createQuiz,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`${apiBase}-quizzes`] });
      toast.success('Quiz saved as draft');
      navigate(`/${apiBase}/quiz`);
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const onSubmit = (data) => {
    if (!data.questions || data.questions.length === 0) {
      toast.error('Add at least one question before saving.');
      return;
    }
    const subject = subjects.find((s) => s._id === data.subject_id);
    create.mutate({
      ...data,
      branch_id: data.branch_id || subject?.branch_id?._id || subject?.branch_id,
      year: Number(data.year || subject?.year),
      duration_minutes: Number(data.duration_minutes),
      attempts_allowed: Number(data.attempts_allowed),
      negative_value: Number(data.negative_value),
      total_marks: (data.questions || []).reduce((s, q) => s + (Number(q?.marks) || 0), 0),
    });
  };

  const watchNegative = watch('negative_marking');
  const totalMarks = watch('total_marks');

  return (
    <div className="space-y-6">
      <PageHeader title="Create Quiz" description="Build an MCQ quiz for your students" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Quiz Settings */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Quiz Settings</h2>

          <div>
            <label className="label">Title</label>
            <input
              className={`input ${errors.title ? 'border-red-400' : ''}`}
              placeholder="Quiz title"
              {...register('title', { required: 'Required' })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Subject</label>
              <select
                className="input"
                {...register('subject_id', { required: 'Required' })}
                onChange={(e) => {
                  const sub = subjects.find((s) => s._id === e.target.value);
                  setValue('subject_id', e.target.value);
                  setValue('year', String(sub?.year || ''));
                  setValue('branch_id', sub?.branch_id?._id || sub?.branch_id || '');
                }}
              >
                <option value="">Select subject</option>
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Duration (minutes)</label>
              <input
                type="number"
                min="1"
                className="input"
                {...register('duration_minutes', { required: true, valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Time</label>
              <input
                type="datetime-local"
                className="input"
                {...register('start_time', { required: 'Required' })}
              />
            </div>
            <div>
              <label className="label">End Time</label>
              <input
                type="datetime-local"
                className="input"
                {...register('end_time', { required: 'Required' })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Attempts Allowed</label>
              <input
                type="number"
                min="1"
                className="input"
                {...register('attempts_allowed', { valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="label">Result Visibility</label>
              <select className="input" {...register('result_visibility')}>
                <option value="immediate">Immediate</option>
                <option value="after_end">After End Time</option>
              </select>
            </div>
            <div>
              <label className="label">
                Total Marks{' '}
                <span className="text-xs font-normal text-gray-400">(auto)</span>
              </label>
              <div className="input bg-gray-100 cursor-not-allowed text-gray-700 font-semibold select-none">
                {totalMarks}
              </div>
            </div>
          </div>

          <div className="flex gap-6 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" className="rounded" {...register('negative_marking')} />
              Negative Marking
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" className="rounded" {...register('shuffle_questions')} />
              Shuffle Questions
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" className="rounded" {...register('shuffle_options')} />
              Shuffle Options
            </label>
          </div>

          {watchNegative && (
            <div className="w-48">
              <label className="label">Penalty per wrong answer</label>
              <input
                type="number"
                min="0"
                step="0.25"
                className="input"
                {...register('negative_value', { valueAsNumber: true })}
              />
            </div>
          )}
        </div>

        {/* Question Builder */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Questions{' '}
            {totalMarks > 0 && (
              <span className="text-xs font-normal text-gray-500 ml-2">
                Total: {totalMarks} marks
              </span>
            )}
          </h2>
          <QuestionBuilder
            control={control}
            register={register}
            watch={watch}
            setValue={setValue}
            apiBase={apiBase}
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(`/${apiBase}/quiz`)}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Saving...' : 'Save as Draft'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FacultyQuizCreate;
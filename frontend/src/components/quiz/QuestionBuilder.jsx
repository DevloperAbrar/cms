import { useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { QuestionImageUpload } from './QuestionImageUpload';

export const QuestionBuilder = ({ control, register, watch, setValue, apiBase = 'faculty' }) => {
  const { fields: questions, append: addQ, remove: removeQ } = useFieldArray({ control, name: 'questions' });

  const addQuestion = () => addQ({
    text: '',
    image_path: null,
    type: 'single',
    marks: 1,
    negative_marks: 0,
    options: [
      { text: '', image_path: null, is_correct: false },
      { text: '', image_path: null, is_correct: false },
    ],
  });

  return (
    <div className="space-y-6">
      {questions.map((q, qi) => (
        <QuestionCard
          key={q.id}
          qi={qi}
          control={control}
          register={register}
          watch={watch}
          setValue={setValue}
          onRemove={() => removeQ(qi)}
          apiBase={apiBase}
        />
      ))}

      <button type="button" className="btn-secondary w-full" onClick={addQuestion}>
        <Plus className="h-4 w-4" /> Add Question
      </button>
    </div>
  );
};

const QuestionCard = ({ qi, control, register, watch, setValue, onRemove, apiBase }) => {
  const { fields: options, append: addOpt, remove: removeOpt } = useFieldArray({ control, name: `questions.${qi}.options` });
  const qType = watch(`questions.${qi}.type`);

  const toggleCorrect = (oi) => {
    if (qType === 'single') {
      options.forEach((_, i) => setValue(`questions.${qi}.options.${i}.is_correct`, i === oi));
    } else {
      const current = watch(`questions.${qi}.options.${oi}.is_correct`);
      setValue(`questions.${qi}.options.${oi}.is_correct`, !current);
    }
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">Question {qi + 1}</span>
        <button type="button" className="btn-danger btn-sm" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div>
        <label className="label">Question Text</label>
        <textarea className="input min-h-[72px]" {...register(`questions.${qi}.text`, { required: true })} />
      </div>

      <QuestionImageUpload
        questionId={`q_${qi}`}
        currentPath={watch(`questions.${qi}.image_path`)}
        apiBase={apiBase}
        onUploaded={(path) => setValue(`questions.${qi}.image_path`, path)}
      />

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Type</label>
          <select className="input" {...register(`questions.${qi}.type`)}>
            <option value="single">Single Correct</option>
            <option value="multiple">Multiple Correct</option>
          </select>
        </div>
        <div>
          <label className="label">Marks</label>
          <input type="number" min="0" className="input" {...register(`questions.${qi}.marks`, { required: true, valueAsNumber: true })} />
        </div>
        <div>
          <label className="label">Negative Marks</label>
          <input type="number" min="0" className="input" {...register(`questions.${qi}.negative_marks`, { valueAsNumber: true })} />
        </div>
      </div>

      <div>
        <label className="label">Options <span className="text-gray-400">(mark correct with checkbox)</span></label>
        <div className="space-y-2">
          {options.map((opt, oi) => {
            const isCorrect = watch(`questions.${qi}.options.${oi}.is_correct`);
            return (
              <div key={opt.id} className={`flex items-center gap-2 p-2 rounded-lg border ${isCorrect ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                <input
                  type={qType === 'single' ? 'radio' : 'checkbox'}
                  name={`q${qi}_correct`}
                  checked={!!isCorrect}
                  onChange={() => toggleCorrect(oi)}
                  className="h-4 w-4 text-primary-600"
                />
                <input className="flex-1 input border-0 bg-transparent p-0 focus:ring-0" placeholder={`Option ${oi + 1}`} {...register(`questions.${qi}.options.${oi}.text`)} />
                {options.length > 2 && (
                  <button type="button" onClick={() => removeOpt(oi)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
          {options.length < 6 && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => addOpt({ text: '', image_path: null, is_correct: false })}>
              <Plus className="h-3.5 w-3.5" /> Add Option
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
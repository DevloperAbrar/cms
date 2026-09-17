import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Unlock } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { PageHeader } from '../../components/common/PageHeader';
import { superadminApi } from '../../api/superadmin.api';
import { getSemestersForYear } from '../../utils/semester';
import toast from 'react-hot-toast';

const ENTERED_BY_OPTIONS = ['faculty', 'coordinator', 'examcontroller'];

const ExamPatternPage = () => {
  const qc = useQueryClient();
  const [selected, setSelected] = useState({ stream_id: '', year: '', semester: '' });

  const { data: streams = [] } = useQuery({ queryKey: ['streams'], queryFn: superadminApi.getStreams });

  const { data: pattern, isLoading } = useQuery({
    queryKey: ['exam-pattern', selected],
    queryFn: () => superadminApi.getExamPattern(selected),
    enabled: !!(selected.stream_id && selected.year && selected.semester),
    retry: false,
  });

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm({
    defaultValues: { stream_id: '', year: '', semester: '', components: [], sgpa_formula: 'weighted_average' },
    values: pattern ? { ...selected, components: pattern.components, sgpa_formula: pattern.sgpa_formula } : { ...selected, components: [{ name: '', max_marks: 0, weightage_percent: 0, entered_by: 'faculty', include_in_sgpa: true, pass_marks: 0 }], sgpa_formula: 'weighted_average' },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'components' });
  const components = watch('components');
  const totalWeightage = components.reduce((s, c) => s + Number(c.weightage_percent || 0), 0);

  const upsert = useMutation({
    mutationFn: superadminApi.upsertExamPattern,
    onSuccess: () => { qc.invalidateQueries(['exam-pattern']); toast.success('Pattern saved'); },
    onError: (e) => toast.error(e.message),
  });

  const forceUnlock = useMutation({
    mutationFn: superadminApi.forceUnlockPattern,
    onSuccess: () => { qc.invalidateQueries(['exam-pattern']); toast.success('Pattern unlocked'); },
    onError: (e) => toast.error(e.message),
  });

  const onSubmit = (data) => {
    upsert.mutate({ ...data, year: Number(data.year), semester: Number(data.semester) });
  };

  return (
    <div>
      <PageHeader title="Exam Pattern" description="Configure marks components per stream, year, and semester" />

      {/* Filter */}
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Stream</label>
            <select className="input" value={selected.stream_id} onChange={(e) => setSelected((p) => ({ ...p, stream_id: e.target.value }))}>
              <option value="">Select stream</option>
              {streams.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select className="input" value={selected.year} onChange={(e) => setSelected((p) => ({ ...p, year: e.target.value, semester: '' }))}>
              <option value="">Select year</option>
              {[1,2,3,4].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Semester</label>
            <select className="input" value={selected.semester} disabled={!selected.year} onChange={(e) => setSelected((p) => ({ ...p, semester: e.target.value }))}>
              <option value="">Select semester</option>
              {getSemestersForYear(selected.year).map((s) => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {selected.stream_id && selected.year && selected.semester && (
        <div className="card p-6">
          {pattern?.locked && (
            <div className="mb-4 flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-700 font-medium">Pattern is locked — marks submission has started.</p>
              <button className="btn-secondary btn-sm" onClick={() => forceUnlock.mutate(pattern._id)} disabled={forceUnlock.isPending}>
                <Unlock className="h-3.5 w-3.5" />Force Unlock
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <input type="hidden" {...register('stream_id')} value={selected.stream_id} />
            <input type="hidden" {...register('year')} value={selected.year} />
            <input type="hidden" {...register('semester')} value={selected.semester} />

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm mb-4">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <th className="px-3 py-2 text-left">Component Name</th>
                    <th className="px-3 py-2 text-left">Max Marks</th>
                    <th className="px-3 py-2 text-left">Weightage %</th>
                    <th className="px-3 py-2 text-left">Entered By</th>
                    <th className="px-3 py-2 text-left">Pass Marks</th>
                    <th className="px-3 py-2 text-left">In SGPA</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fields.map((field, i) => (
                    <tr key={field.id}>
                      <td className="px-3 py-2"><input className="input" {...register(`components.${i}.name`, { required: true })} /></td>
                      <td className="px-3 py-2"><input type="number" min="0" className="input w-24" {...register(`components.${i}.max_marks`, { required: true, valueAsNumber: true })} /></td>
                      <td className="px-3 py-2"><input type="number" min="0" max="100" className="input w-24" {...register(`components.${i}.weightage_percent`, { required: true, valueAsNumber: true })} /></td>
                      <td className="px-3 py-2">
                        <select className="input" {...register(`components.${i}.entered_by`)}>
                          {ENTERED_BY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2"><input type="number" min="0" className="input w-24" {...register(`components.${i}.pass_marks`, { valueAsNumber: true })} /></td>
                      <td className="px-3 py-2">
                        <input type="checkbox" className="rounded" {...register(`components.${i}.include_in_sgpa`)} defaultChecked />
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" className="btn-danger btn-sm" onClick={() => remove(i)} disabled={pattern?.locked}><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mb-4">
              <button type="button" className="btn-secondary btn-sm" onClick={() => append({ name: '', max_marks: 0, weightage_percent: 0, entered_by: 'faculty', include_in_sgpa: true, pass_marks: 0 })} disabled={pattern?.locked}>
                <Plus className="h-3.5 w-3.5" />Add Component
              </button>
              <div className={`text-sm font-medium ${totalWeightage === 100 ? 'text-green-600' : 'text-red-600'}`}>
                Total Weightage: {totalWeightage}% {totalWeightage !== 100 && '(must be 100%)'}
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="btn-primary" disabled={upsert.isPending || pattern?.locked || totalWeightage !== 100}>
                {upsert.isPending ? 'Saving...' : 'Save Pattern'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ExamPatternPage;
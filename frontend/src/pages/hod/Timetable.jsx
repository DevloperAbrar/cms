import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Send } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { hodApi } from '../../api/hod.api';
import { superadminApi } from '../../api/superadmin.api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const HODTimetable = () => {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ branch_id: '', year: '', semester: '', academic_year: '2024-25' });

  const { data: branches = [] } = useQuery({ queryKey: ['hod-branches'], queryFn: hodApi.getDeptBranches });
  const { data: subjects = [] } = useQuery({
    queryKey: ['hod-subjects', filters.branch_id, filters.year],
    queryFn: () => hodApi.getDeptSubjects({ branch_id: filters.branch_id, year: filters.year }),
    enabled: !!filters.branch_id && !!filters.year,
  });
  const { data: faculty = [] } = useQuery({ queryKey: ['hod-faculty'], queryFn: hodApi.getDeptFaculty });

  const { data: timetable, isLoading } = useQuery({
    queryKey: ['timetable', filters],
    queryFn: () => hodApi.getTimetable(filters),
    enabled: !!(filters.branch_id && filters.year && filters.semester && filters.academic_year),
  });

  const { register, handleSubmit, control } = useForm({
    values: { slots: timetable?.slots || [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'slots' });

  const upsert = useMutation({
    mutationFn: (data) => hodApi.upsertTimetable({ ...filters, year: Number(filters.year), semester: Number(filters.semester), slots: data.slots }),
    onSuccess: () => { qc.invalidateQueries(['timetable']); toast.success('Timetable saved'); },
    onError: (e) => toast.error(e.message),
  });

  const publish = useMutation({
    mutationFn: () => hodApi.publishTimetable(timetable._id),
    onSuccess: () => { qc.invalidateQueries(['timetable']); toast.success('Timetable published'); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Timetable" />

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="label">Branch</label>
            <select className="input" value={filters.branch_id} onChange={(e) => setFilters((p) => ({ ...p, branch_id: e.target.value }))}>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select className="input" value={filters.year} onChange={(e) => setFilters((p) => ({ ...p, year: e.target.value }))}>
              <option value="">Year</option>
              {[1, 2, 3, 4].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Semester</label>
            <select className="input" value={filters.semester} onChange={(e) => setFilters((p) => ({ ...p, semester: e.target.value }))}>
              <option value="">Semester</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Academic Year</label>
            <input className="input" value={filters.academic_year} onChange={(e) => setFilters((p) => ({ ...p, academic_year: e.target.value }))} />
          </div>
        </div>
      </div>

      {filters.branch_id && filters.year && filters.semester && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Slots</h2>
            <div className="flex gap-2">
              {timetable?._id && timetable.status !== 'published' && (
                <button className="btn-secondary" onClick={() => publish.mutate()} disabled={publish.isPending}>
                  <Send className="h-4 w-4" /> Publish
                </button>
              )}
              {timetable?.status === 'published' && <span className="badge bg-green-100 text-green-700">Published</span>}
            </div>
          </div>

          {isLoading ? <LoadingSpinner className="py-8" /> : (
            <form onSubmit={handleSubmit((d) => upsert.mutate(d))} className="p-4">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Day</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Time Slot</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Subject</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Faculty</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Room</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Lab</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fields.map((field, i) => (
                      <tr key={field.id}>
                        <td className="px-3 py-2">
                          <select className="input" {...register(`slots.${i}.day`)}>
                            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2"><input className="input w-28" placeholder="09:00-10:00" {...register(`slots.${i}.time_slot`)} /></td>
                        <td className="px-3 py-2">
                          <select className="input" {...register(`slots.${i}.subject_id`)}>
                            <option value="">Select</option>
                            {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select className="input" {...register(`slots.${i}.faculty_id`)}>
                            <option value="">Select</option>
                            {faculty.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2"><input className="input w-20" {...register(`slots.${i}.room`)} /></td>
                        <td className="px-3 py-2"><input type="checkbox" {...register(`slots.${i}.is_lab`)} /></td>
                        <td className="px-3 py-2">
                          <button type="button" className="btn-danger btn-sm" onClick={() => remove(i)}><Trash2 className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <button type="button" className="btn-secondary btn-sm" onClick={() => append({ day: 'Monday', time_slot: '', subject_id: '', faculty_id: '', room: '', is_lab: false })}>
                  <Plus className="h-3.5 w-3.5" /> Add Slot
                </button>
                <button type="submit" className="btn-primary" disabled={upsert.isPending}>
                  {upsert.isPending ? 'Saving...' : 'Save Timetable'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default HODTimetable;
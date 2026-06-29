import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { superadminApi } from '../../api/superadmin.api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import toast from 'react-hot-toast';

const METRIC_TYPES = [
  { value: 'cgpa', label: 'CGPA' },
  { value: 'sgpa', label: 'SGPA' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'grade', label: 'Grade Points' },
  { value: 'custom', label: 'Custom' },
];

const EMPTY_FORM = {
  label: '', metric_type: 'cgpa', year: '', semester: '',
  max_value: 10, passing_value: 4, decimal_places: 2,
};

const SuperAdminFinalResults = () => {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedConfig, setExpandedConfig] = useState(null);
  const [viewFilter, setViewFilter] = useState({ branch_id: '', department_id: '' });

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['sa-final-configs'],
    queryFn: superadminApi.getFinalResultConfigs,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['sa-branches-all'],
    queryFn: () => superadminApi.getBranches(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['sa-departments-all'],
    queryFn: () => superadminApi.getDepartments(),
  });

  const { data: viewResults = [], isLoading: resultsLoading } = useQuery({
    queryKey: ['sa-final-results', expandedConfig, viewFilter],
    queryFn: () => superadminApi.getFinalResultsAdmin({
      config_id: expandedConfig,
      branch_id: viewFilter.branch_id || undefined,
      department_id: viewFilter.department_id || undefined,
    }),
    enabled: !!expandedConfig,
  });

  const createMutation = useMutation({
    mutationFn: superadminApi.createFinalResultConfig,
    onSuccess: () => {
      toast.success('Config created');
      qc.invalidateQueries({ queryKey: ['sa-final-configs'] });
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: superadminApi.deleteFinalResultConfig,
    onSuccess: () => {
      toast.success('Config deleted');
      qc.invalidateQueries({ queryKey: ['sa-final-configs'] });
      setExpandedConfig(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => superadminApi.updateFinalResultConfig(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa-final-configs'] }),
    onError: (e) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!form.label || !form.year || !form.semester) return toast.error('Fill all required fields');
    createMutation.mutate(form);
  };

  const metricLabel = (type) => METRIC_TYPES.find((m) => m.value === type)?.label || type;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Final Results Configuration"
        description="Create and manage CGPA / SGPA / percentage configs. Coordinators fill student values."
        action={
          <button className="btn-primary" onClick={() => setShowForm((p) => !p)}>
            <Plus className="h-4 w-4" /> New Config
          </button>
        }
      />

      {showForm && (
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">Create New Config</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Label <span className="text-red-500">*</span></label>
              <input className="input" placeholder="e.g. CGPA Semester 3" value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} />
            </div>
            <div>
              <label className="label">Metric Type <span className="text-red-500">*</span></label>
              <select className="input" value={form.metric_type}
                onChange={(e) => setForm((p) => ({ ...p, metric_type: e.target.value }))}>
                {METRIC_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Year <span className="text-red-500">*</span></label>
              <select className="input" value={form.year}
                onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}>
                <option value="">Select year</option>
                {[1,2,3,4,5,6].map((y) => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Semester <span className="text-red-500">*</span></label>
              <select className="input" value={form.semester}
                onChange={(e) => setForm((p) => ({ ...p, semester: e.target.value }))}>
                <option value="">Select semester</option>
                {[1,2,3,4,5,6,7,8].map((s) => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Max Value</label>
              <input className="input" type="number" value={form.max_value}
                onChange={(e) => setForm((p) => ({ ...p, max_value: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Passing Value</label>
              <input className="input" type="number" value={form.passing_value}
                onChange={(e) => setForm((p) => ({ ...p, passing_value: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Decimal Places</label>
              <input className="input" type="number" min={0} max={4} value={form.decimal_places}
                onChange={(e) => setForm((p) => ({ ...p, decimal_places: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn-primary" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Config'}
            </button>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? <LoadingSpinner /> : configs.length === 0 ? (
        <EmptyState title="No configs yet" description="Create a config to let coordinators enter final results." />
      ) : (
        <div className="space-y-3">
          {configs.map((cfg) => (
            <div key={cfg._id} className="card">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-semibold text-gray-800">{cfg.label}</p>
                    <p className="text-xs text-gray-500">
                      {metricLabel(cfg.metric_type)} · Year {cfg.year} · Sem {cfg.semester} ·
                      Max: {cfg.max_value} · Pass: {cfg.passing_value}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {cfg.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                    onClick={() => toggleMutation.mutate({ id: cfg._id, is_active: !cfg.is_active })}
                  >
                    {cfg.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    className="p-1.5 text-gray-400 hover:text-blue-600"
                    onClick={() => {
                      setExpandedConfig(expandedConfig === cfg._id ? null : cfg._id);
                      setViewFilter({ branch_id: '', department_id: '' });
                    }}
                    title="View results"
                  >
                    {expandedConfig === cfg._id ? <ChevronUp className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    className="p-1.5 text-gray-400 hover:text-red-600"
                    onClick={() => { if (confirm('Delete this config?')) deleteMutation.mutate(cfg._id); }}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {expandedConfig === cfg._id && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                  <div className="flex gap-3 flex-wrap">
                    <select className="input w-48" value={viewFilter.branch_id}
                      onChange={(e) => setViewFilter((p) => ({ ...p, branch_id: e.target.value, department_id: '' }))}>
                      <option value="">All Branches</option>
                      {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                    <select className="input w-48" value={viewFilter.department_id}
                      onChange={(e) => setViewFilter((p) => ({ ...p, department_id: e.target.value, branch_id: '' }))}>
                      <option value="">All Departments</option>
                      {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                  </div>

                  {resultsLoading ? <LoadingSpinner className="py-4" /> : viewResults.length === 0 ? (
                    <EmptyState title="No results submitted yet" />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Rank</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Enrollment</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Branch</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{cfg.label}</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {viewResults.map((r) => (
                            <tr key={r._id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 font-bold text-gray-600">#{r.rank}</td>
                              <td className="px-4 py-2 text-xs text-gray-500">{r.student_id?.enrollment_number}</td>
                              <td className="px-4 py-2 font-medium">{r.student_id?.name}</td>
                              <td className="px-4 py-2 text-gray-600">{r.branch_id?.name}</td>
                              <td className="px-4 py-2 font-semibold text-blue-700">
                                {r.value.toFixed(cfg.decimal_places)}
                              </td>
                              <td className="px-4 py-2">
                                {r.is_published
                                  ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Published</span>
                                  : <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Draft</span>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SuperAdminFinalResults;
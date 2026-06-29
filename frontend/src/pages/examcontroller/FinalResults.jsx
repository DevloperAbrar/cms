import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Globe, EyeOff, BarChart2, List } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, PieChart, Pie, Legend,
} from 'recharts';
import { examControllerApi } from '../../api/examcontroller.api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import toast from 'react-hot-toast';

const buildDistribution = (students, config, valuesMap) => {
  if (!students.length || !config) return [];
  const max = config.max_value ?? 10;
  const bucketCount = 6;
  const step = max / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    range: `${(i * step).toFixed(1)}-${((i + 1) * step).toFixed(1)}`,
    count: 0,
  }));
  students.forEach((s) => {
    const v = Number(valuesMap[s._id] ?? s.result?.value ?? 0);
    if (v > 0) {
      const idx = Math.min(Math.floor(v / step), bucketCount - 1);
      buckets[idx].count += 1;
    }
  });
  return buckets.filter((b) => b.count > 0);
};

const StatsBar = ({ students, config, valuesMap }) => {
  const filled = students.filter((s) => {
    const v = Number(valuesMap[s._id] ?? s.result?.value ?? '');
    return v > 0;
  });
  if (!filled.length || !config) return null;
  const vals = filled.map((s) => Number(valuesMap[s._id] ?? s.result?.value));
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const passed = vals.filter((v) => v >= (config.passing_value ?? 0)).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {[
        { label: 'Filled', value: `${filled.length}/${students.length}`, color: 'text-gray-700' },
        { label: 'Average', value: avg.toFixed(2), color: 'text-blue-700' },
        { label: 'Highest', value: max.toFixed(2), color: 'text-green-700' },
        { label: 'Lowest', value: min.toFixed(2), color: 'text-red-600' },
        { label: 'Pass Rate', value: `${((passed / filled.length) * 100).toFixed(0)}%`, color: 'text-emerald-600' },
      ].map((s) => (
        <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
          <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          <p className="text-xs text-gray-500">{s.label}</p>
        </div>
      ))}
    </div>
  );
};

const ExamControllerFinalResults = () => {
  const qc = useQueryClient();

  const [selectedConfig, setSelectedConfig] = useState('');
  const [selectedStream, setSelectedStream] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [valuesMap, setValuesMap] = useState({});
  const [viewMode, setViewMode] = useState('table');

  const { data: configs = [], isLoading: configsLoading } = useQuery({
    queryKey: ['ec-final-configs'],
    queryFn: examControllerApi.getFinalResultConfigs,
  });

  const { data: streams = [] } = useQuery({
    queryKey: ['ec-fr-streams'],
    queryFn: examControllerApi.getFinalResultStreams,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['ec-fr-departments', selectedStream],
    queryFn: () => examControllerApi.getFinalResultDepartments({ stream_id: selectedStream }),
    enabled: !!selectedStream,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['ec-fr-branches', selectedDept],
    queryFn: () => examControllerApi.getFinalResultBranches({ department_id: selectedDept }),
    enabled: !!selectedDept,
  });

  const ready = !!(selectedConfig && selectedBranch);

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['ec-final-students', selectedConfig, selectedBranch],
    queryFn: () => examControllerApi.getFinalResultStudents({
      config_id: selectedConfig,
      branch_id: selectedBranch,
    }),
    enabled: ready,
    onSuccess: (data) => {
      const map = {};
      (data.students || []).forEach((s) => {
        if (s.result?.value != null) map[s._id] = String(s.result.value);
      });
      setValuesMap(map);
    },
  });

  const config = studentsData?.config;
  const students = studentsData?.students || [];
  const isPublished = students.length > 0 && students.every((s) => s.result?.is_published);
  const hasAnyResult = students.some((s) => s.result);

  const submitMutation = useMutation({
    mutationFn: examControllerApi.submitFinalResults,
    onSuccess: () => {
      toast.success('Results saved');
      qc.invalidateQueries({ queryKey: ['ec-final-students', selectedConfig, selectedBranch] });
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const publishMutation = useMutation({
    mutationFn: examControllerApi.publishFinalResults,
    onSuccess: () => {
      toast.success('Results published');
      qc.invalidateQueries({ queryKey: ['ec-final-students', selectedConfig, selectedBranch] });
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const unpublishMutation = useMutation({
    mutationFn: examControllerApi.unpublishFinalResults,
    onSuccess: () => {
      toast.success('Results unpublished');
      qc.invalidateQueries({ queryKey: ['ec-final-students', selectedConfig, selectedBranch] });
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const handleSave = () => {
    const entries = students.map((s) => ({
      student_id: s._id,
      value: Number(valuesMap[s._id] ?? s.result?.value ?? 0),
    }));
    submitMutation.mutate({ config_id: selectedConfig, branch_id: selectedBranch, entries });
  };

  const getValue = (s) =>
    valuesMap[s._id] ?? (s.result?.value != null ? String(s.result.value) : '');

  const filledStudents = students.filter((s) => getValue(s) !== '');
  const distData = buildDistribution(students, config, valuesMap);

  const passCount = filledStudents.filter((s) => Number(getValue(s)) >= (config?.passing_value ?? 0)).length;
  const failCount = filledStudents.length - passCount;
  const pieData = [
    { name: 'Pass', value: passCount, fill: '#10b981' },
    { name: 'Fail', value: failCount, fill: '#f43f5e' },
  ].filter((d) => d.value > 0);

  if (configsLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Final Results"
        description="Enter and publish CGPA / SGPA / percentage for any branch institute-wide"
      />

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="label">Result Config</label>
            <select className="input" value={selectedConfig}
              onChange={(e) => { setSelectedConfig(e.target.value); setValuesMap({}); }}>
              <option value="">Select config</option>
              {configs.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.label} — Year {c.year} Sem {c.semester}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Stream</label>
            <select className="input" value={selectedStream}
              onChange={(e) => {
                setSelectedStream(e.target.value);
                setSelectedDept('');
                setSelectedBranch('');
                setValuesMap({});
              }}>
              <option value="">Select stream</option>
              {streams.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Department</label>
            <select className="input" value={selectedDept} disabled={!selectedStream}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setSelectedBranch('');
                setValuesMap({});
              }}>
              <option value="">Select department</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Branch</label>
            <select className="input" value={selectedBranch} disabled={!selectedDept}
              onChange={(e) => { setSelectedBranch(e.target.value); setValuesMap({}); }}>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!ready && <EmptyState title="Select a config and branch above to begin" />}
      {ready && studentsLoading && <LoadingSpinner />}
      {ready && !studentsLoading && students.length === 0 && (
        <EmptyState
          title="No students found"
          description="No active students match this config's year and semester for the selected branch."
        />
      )}

      {ready && !studentsLoading && students.length > 0 && (
        <>
          {/* Stats */}
          {filledStudents.length > 0 && (
            <StatsBar students={students} config={config} valuesMap={valuesMap} />
          )}

          {/* Charts */}
          {filledStudents.length >= 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {distData.length > 0 && (
                <div className="card p-5">
                  <p className="font-semibold text-gray-800 mb-1">Score Distribution</p>
                  <p className="text-xs text-gray-400 mb-3">Spread across all entered values</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={distData} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                        {distData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={
                              parseFloat(entry.range.split('-')[1]) <= (config?.passing_value ?? 0)
                                ? '#fca5a5'
                                : '#3b82f6'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {pieData.length > 0 && (
                <div className="card p-5">
                  <p className="font-semibold text-gray-800 mb-1">Pass / Fail Split</p>
                  <p className="text-xs text-gray-400 mb-3">Based on values entered so far</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={80}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Table / Chart toggle */}
          <div className="card">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-gray-800">{config?.label}</p>
                <p className="text-xs text-gray-500">
                  Year {config?.year} · Sem {config?.semester} · Max: {config?.max_value} · Pass: {config?.passing_value}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isPublished && (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                    Published
                  </span>
                )}
                <button
                  onClick={() => setViewMode(viewMode === 'table' ? 'chart' : 'table')}
                  className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
                  title="Toggle view"
                >
                  {viewMode === 'table' ? <BarChart2 className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {viewMode === 'chart' && filledStudents.length > 0 ? (
              <div className="p-5">
                <ResponsiveContainer width="100%" height={Math.max(filledStudents.length * 36, 200)}>
                  <BarChart
                    data={filledStudents
                      .map((s) => ({
                        name: s.name?.split(' ')[0] || '—',
                        value: Number(getValue(s)),
                      }))
                      .sort((a, b) => b.value - a.value)}
                    layout="vertical"
                    barCategoryGap="15%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" domain={[0, config?.max_value ?? 10]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [v.toFixed(config?.decimal_places ?? 2), config?.label]} />
                    <ReferenceLine x={config?.passing_value} stroke="#f43f5e" strokeDasharray="4 2"
                      label={{ value: 'Pass', position: 'insideTopRight', fontSize: 10 }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {filledStudents
                        .sort((a, b) => Number(getValue(b)) - Number(getValue(a)))
                        .map((s, i) => (
                          <Cell
                            key={i}
                            fill={Number(getValue(s)) >= (config?.passing_value ?? 0) ? '#3b82f6' : '#fca5a5'}
                          />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Enrollment</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        {config?.label} <span className="text-gray-400 normal-case">/ {config?.max_value}</span>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Bar</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pass / Fail</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {students.map((s) => {
                      const val = getValue(s);
                      const numVal = Number(val);
                      const passed = val !== '' && numVal >= (config?.passing_value ?? 0);
                      const pct = config?.max_value && val !== '' ? (numVal / config.max_value) * 100 : 0;
                      return (
                        <tr key={s._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2 text-xs text-gray-500">{s.enrollment_number}</td>
                          <td className="px-4 py-2 font-medium">{s.name}</td>
                          <td className="px-4 py-2">
                            {isPublished ? (
                              <span className="font-semibold text-blue-700">
                                {Number(s.result?.value).toFixed(config?.decimal_places ?? 2)}
                              </span>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                max={config?.max_value}
                                step={config?.decimal_places > 0 ? Math.pow(10, -(config?.decimal_places)) : 1}
                                className="input w-28"
                                value={val}
                                onChange={(e) =>
                                  setValuesMap((p) => ({ ...p, [s._id]: e.target.value }))
                                }
                              />
                            )}
                          </td>
                          <td className="px-4 py-2 w-24">
                            {val !== '' && (
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${passed ? 'bg-blue-500' : 'bg-red-400'}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {val !== '' && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {passed ? 'Pass' : 'Fail'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {s.result?.is_published
                              ? <span className="text-xs text-green-600">Published</span>
                              : s.result
                              ? <span className="text-xs text-yellow-600">Saved</span>
                              : <span className="text-xs text-gray-400">—</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Actions */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3 justify-end">
              {!isPublished && (
                <button className="btn-primary" onClick={handleSave} disabled={submitMutation.isPending}>
                  <Save className="h-4 w-4" />
                  {submitMutation.isPending ? 'Saving...' : 'Save Results'}
                </button>
              )}
              {!isPublished && (
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  onClick={() => {
                    if (!hasAnyResult) return toast.error('Save results first before publishing');
                    publishMutation.mutate({ config_id: selectedConfig, branch_id: selectedBranch });
                  }}
                  disabled={publishMutation.isPending}
                >
                  <Globe className="h-4 w-4" />
                  {publishMutation.isPending ? 'Publishing...' : 'Publish Results'}
                </button>
              )}
              {isPublished && (
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500 text-white text-sm font-medium hover:bg-yellow-600 disabled:opacity-50"
                  onClick={() => unpublishMutation.mutate({ config_id: selectedConfig, branch_id: selectedBranch })}
                  disabled={unpublishMutation.isPending}
                >
                  <EyeOff className="h-4 w-4" />
                  {unpublishMutation.isPending ? 'Unpublishing...' : 'Unpublish'}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ExamControllerFinalResults;
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Medal, Award, BarChart2, List } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, PieChart, Pie, Legend,
} from 'recharts';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';

const COLORS = ['#f59e0b', '#94a3b8', '#b45309', '#3b82f6', '#10b981', '#8b5cf6', '#f43f5e', '#06b6d4'];

const rankIcon = (rank) => {
  if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" />;
  if (rank === 3) return <Award className="h-4 w-4 text-amber-600" />;
  return <span className="text-sm font-bold text-gray-500">#{rank}</span>;
};

// Distribution bucketing: e.g. 0-4, 4-6, 6-8, 8-10 for CGPA
const buildDistribution = (results, config) => {
  if (!results.length || !config) return [];
  const max = config.max_value ?? 10;
  const bucketCount = 8;
  const step = max / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    range: `${(i * step).toFixed(1)}-${((i + 1) * step).toFixed(1)}`,
    count: 0,
  }));
  results.forEach((r) => {
    const idx = Math.min(Math.floor(r.value / step), bucketCount - 1);
    buckets[idx].count += 1;
  });
  return buckets.filter((b) => b.count > 0);
};

// Branch-wise average for pie/bar
const buildBranchAvg = (results) => {
  const map = {};
  results.forEach((r) => {
    const name = r.branch_id?.name || 'Unknown';
    if (!map[name]) map[name] = { total: 0, count: 0 };
    map[name].total += r.value;
    map[name].count += 1;
  });
  return Object.entries(map).map(([name, { total, count }]) => ({
    name,
    avg: parseFloat((total / count).toFixed(2)),
  })).sort((a, b) => b.avg - a.avg);
};

const CustomTooltip = ({ active, payload, label, config }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

const StatsBar = ({ results, config }) => {
  if (!results.length || !config) return null;
  const vals = results.map((r) => r.value);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const passed = vals.filter((v) => v >= (config.passing_value ?? 0)).length;
  const passRate = ((passed / vals.length) * 100).toFixed(1);

  const stats = [
    { label: 'Average', value: avg.toFixed(2), color: 'text-blue-700' },
    { label: 'Highest', value: max.toFixed(2), color: 'text-green-700' },
    { label: 'Lowest', value: min.toFixed(2), color: 'text-red-600' },
    { label: 'Pass Rate', value: `${passRate}%`, color: 'text-emerald-600' },
    { label: 'Total Students', value: results.length, color: 'text-gray-700' },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="card p-3 text-center">
          <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
};

const FinalResultsRankings = ({ api, branches = [], departments = [] }) => {
  const [selectedConfig, setSelectedConfig] = useState('');
  const [scope, setScope] = useState('institute');
  const [scopeId, setScopeId] = useState('');
  const [top, setTop] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'chart'

  const { data: configs = [], isLoading: configsLoading } = useQuery({
    queryKey: ['final-configs-published', api],
    queryFn: api.getFinalResultConfigs,
  });

  const rankingReady = !!selectedConfig;

  const { data: rankData, isLoading: rankLoading } = useQuery({
    queryKey: ['final-rankings', selectedConfig, scope, scopeId, top],
    queryFn: () => api.getFinalResultRankings({
      config_id: selectedConfig,
      scope,
      branch_id: scope === 'branch' ? scopeId : undefined,
      department_id: scope === 'department' ? scopeId : undefined,
      top: top || undefined,
    }),
    enabled: rankingReady,
  });

  const config = rankData?.config;
  const results = rankData?.results || [];
  const distData = buildDistribution(results, config);
  const branchAvg = buildBranchAvg(results);
  const avgVal = results.length ? results.reduce((s, r) => s + r.value, 0) / results.length : 0;

  if (configsLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Final Results & Rankings"
        description="View published CGPA / SGPA / percentage rankings across the institute"
      />

      {/* ── Filters ── */}
      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="label">Result Config</label>
            <select className="input" value={selectedConfig}
              onChange={(e) => { setSelectedConfig(e.target.value); setScopeId(''); }}>
              <option value="">Select config</option>
              {configs.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.label} — Y{c.year} S{c.semester}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Scope</label>
            <select className="input" value={scope}
              onChange={(e) => { setScope(e.target.value); setScopeId(''); }}>
              <option value="institute">Institute</option>
              <option value="department">Department</option>
              <option value="branch">Branch</option>
            </select>
          </div>
          {scope === 'branch' && (
            <div>
              <label className="label">Branch</label>
              <select className="input" value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
                <option value="">All</option>
                {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
          )}
          {scope === 'department' && (
            <div>
              <label className="label">Department</label>
              <select className="input" value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
                <option value="">All</option>
                {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Show Top</label>
            <select className="input" value={top} onChange={(e) => setTop(e.target.value)}>
              <option value="">All</option>
              <option value="5">Top 5</option>
              <option value="10">Top 10</option>
              <option value="100">Top 100</option>
            </select>
          </div>
        </div>
      </div>

      {!rankingReady && <EmptyState title="Select a config to view rankings" />}
      {rankingReady && rankLoading && <LoadingSpinner />}
      {rankingReady && !rankLoading && results.length === 0 && (
        <EmptyState title="No published results" description="No results have been published for this config yet." />
      )}

      {rankingReady && !rankLoading && results.length > 0 && (
        <>
          {/* ── Stats Row ── */}
          <StatsBar results={results} config={config} />

          {/* ── Charts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Score Distribution */}
            <div className="card p-5">
              <p className="font-semibold text-gray-800 mb-1">Score Distribution</p>
              <p className="text-xs text-gray-400 mb-4">How scores are spread across all students</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={distData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    x={distData.find((b) => parseFloat(b.range) <= avgVal && avgVal <= parseFloat(b.range.split('-')[1]))?.range}
                    stroke="#3b82f6" strokeDasharray="4 2"
                  />
                  <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                    {distData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          config && parseFloat(entry.range.split('-')[1]) <= config.passing_value
                            ? '#fca5a5'
                            : '#3b82f6'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-center text-gray-400 mt-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-red-300 mr-1 align-middle" />Below pass ·
                <span className="inline-block w-3 h-3 rounded-sm bg-blue-500 mx-1 align-middle" />Above pass
              </p>
            </div>

            {/* Branch Average */}
            <div className="card p-5">
              <p className="font-semibold text-gray-800 mb-1">Branch-wise Average</p>
              <p className="text-xs text-gray-400 mb-4">Average {config?.label} per branch</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={branchAvg} layout="vertical" barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, config?.max_value ?? 10]}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avg" name="Avg Score" radius={[0, 4, 4, 0]}>
                    {branchAvg.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Top 3 Podium ── */}
          {results.length >= 3 && (
            <div className="card p-5">
              <p className="font-semibold text-gray-800 mb-4">🏆 Top Performers</p>
              <div className="flex items-end justify-center gap-4">
                {/* 2nd */}
                {results[1] && (
                  <div className="flex flex-col items-center gap-2 w-32">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <Medal className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-xs font-semibold text-center text-gray-700 leading-tight">
                      {results[1].student_id?.name}
                    </p>
                    <p className="text-xs text-gray-400">{results[1].branch_id?.name}</p>
                    <div className="bg-gray-200 rounded-t-lg w-full flex flex-col items-center py-3" style={{ height: 64 }}>
                      <p className="text-lg font-bold text-gray-700">
                        {results[1].value.toFixed(config?.decimal_places ?? 2)}
                      </p>
                      <p className="text-xs text-gray-500">#2</p>
                    </div>
                  </div>
                )}
                {/* 1st */}
                {results[0] && (
                  <div className="flex flex-col items-center gap-2 w-36">
                    <div className="w-14 h-14 rounded-full bg-yellow-50 border-2 border-yellow-300 flex items-center justify-center">
                      <Trophy className="h-7 w-7 text-yellow-500" />
                    </div>
                    <p className="text-sm font-bold text-center text-gray-800 leading-tight">
                      {results[0].student_id?.name}
                    </p>
                    <p className="text-xs text-gray-400">{results[0].branch_id?.name}</p>
                    <div className="bg-yellow-400 rounded-t-lg w-full flex flex-col items-center py-3" style={{ height: 88 }}>
                      <p className="text-xl font-bold text-white">
                        {results[0].value.toFixed(config?.decimal_places ?? 2)}
                      </p>
                      <p className="text-xs text-yellow-100">#1</p>
                    </div>
                  </div>
                )}
                {/* 3rd */}
                {results[2] && (
                  <div className="flex flex-col items-center gap-2 w-32">
                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                      <Award className="h-6 w-6 text-amber-600" />
                    </div>
                    <p className="text-xs font-semibold text-center text-gray-700 leading-tight">
                      {results[2].student_id?.name}
                    </p>
                    <p className="text-xs text-gray-400">{results[2].branch_id?.name}</p>
                    <div className="bg-amber-200 rounded-t-lg w-full flex flex-col items-center py-3" style={{ height: 48 }}>
                      <p className="text-lg font-bold text-amber-800">
                        {results[2].value.toFixed(config?.decimal_places ?? 2)}
                      </p>
                      <p className="text-xs text-amber-700">#3</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Table ── */}
          <div className="card">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-gray-800">{config?.label} Rankings</p>
                <p className="text-xs text-gray-500">
                  Year {config?.year} · Sem {config?.semester} · {results.length} students
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-primary-100 text-primary-700' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('chart')}
                  className={`p-1.5 rounded ${viewMode === 'chart' ? 'bg-primary-100 text-primary-700' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <BarChart2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {viewMode === 'chart' ? (
              <div className="p-5">
                <ResponsiveContainer width="100%" height={Math.max(results.length * 36, 200)}>
                  <BarChart
                    data={results.slice(0, 20).map((r) => ({
                      name: r.student_id?.name?.split(' ')[0] || '—',
                      value: r.value,
                      rank: r.rank,
                    }))}
                    layout="vertical"
                    barCategoryGap="15%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" domain={[0, config?.max_value ?? 10]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v, n, p) => [
                        `${v.toFixed(config?.decimal_places ?? 2)} (Rank #${p.payload.rank})`,
                        config?.label,
                      ]}
                    />
                    <ReferenceLine x={config?.passing_value} stroke="#f43f5e" strokeDasharray="4 2" label={{ value: 'Pass', position: 'top', fontSize: 10 }} />
                    <Bar dataKey="value" name={config?.label} radius={[0, 4, 4, 0]}>
                      {results.slice(0, 20).map((r, i) => (
                        <Cell
                          key={i}
                          fill={r.value >= (config?.passing_value ?? 0) ? COLORS[i % 5 === 0 ? 3 : 4] : '#fca5a5'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {results.length > 20 && (
                  <p className="text-xs text-center text-gray-400 mt-2">Showing top 20 in chart view. Switch to table for all.</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-16">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Enrollment</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Branch</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Dept</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{config?.label}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Bar</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pass/Fail</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {results.map((r) => {
                      const passed = r.value >= (config?.passing_value ?? 0);
                      const pct = config?.max_value ? (r.value / config.max_value) * 100 : 0;
                      return (
                        <tr key={r._id} className={`hover:bg-gray-50 transition-colors ${r.rank <= 3 ? 'bg-yellow-50/40' : ''}`}>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1">{rankIcon(r.rank)}</div>
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-500">{r.student_id?.enrollment_number}</td>
                          <td className="px-4 py-2 font-medium">{r.student_id?.name}</td>
                          <td className="px-4 py-2 text-gray-600">{r.branch_id?.name}</td>
                          <td className="px-4 py-2 text-gray-600">{r.department_id?.name}</td>
                          <td className="px-4 py-2 font-semibold text-blue-700">
                            {r.value.toFixed(config?.decimal_places ?? 2)}
                          </td>
                          <td className="px-4 py-2 w-28">
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${passed ? 'bg-blue-500' : 'bg-red-400'}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {passed ? 'Pass' : 'Fail'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FinalResultsRankings;
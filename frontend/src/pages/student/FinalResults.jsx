import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import { Trophy, TrendingUp, Users, Award, ChevronDown, ChevronUp } from 'lucide-react';
import { studentApi } from '../../api/student.api';
import { getSemestersForYear } from '../../utils/semester';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import useAuthStore from '../../store/authStore';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const metricLabel = (type) => ({
  cgpa: 'CGPA', sgpa: 'SGPA', percentage: 'Percentage', grade: 'Grade Points', custom: 'Score',
}[type] || type);

const rankSuffix = (n) => {
  if (n >= 11 && n <= 13) return 'th';
  const s = ['th', 'st', 'nd', 'rd'];
  return s[n % 10] || s[0];
};

const getValueColor = (value, max, passing) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  if (value >= passing) return { text: 'text-green-700', bar: '#22c55e' };
  if (pct >= 60) return { text: 'text-amber-600', bar: '#f59e0b' };
  return { text: 'text-red-600', bar: '#ef4444' };
};

// ─── Rank card ───────────────────────────────────────────────────────────────

const RankCard = ({ label, rank, total, icon: Icon, color }) => (
  <div className="card p-4 flex flex-col items-center text-center gap-1">
    <Icon size={18} className={color} />
    <p className="text-xs text-gray-500 font-medium">{label}</p>
    <p className="text-2xl font-bold text-gray-900">
      {rank}<sup className="text-sm font-semibold">{rankSuffix(rank)}</sup>
    </p>
    <p className="text-xs text-gray-400">of {total}</p>
  </div>
);

// ─── Result detail panel ─────────────────────────────────────────────────────

const ResultDetail = ({ config, myResult, ranks }) => {
  const { result } = myResult;
  const { bar, text } = getValueColor(result.value, config.max_value, config.passing_value);
  const pct = config.max_value > 0 ? Math.round((result.value / config.max_value) * 100) : 0;
  const passed = result.value >= config.passing_value;

  return (
    <div className="space-y-4 border-t border-gray-100 pt-4">
      {/* Score display */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Radial gauge */}
        <div className="card p-5 flex flex-col items-center">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Your {metricLabel(config.metric_type)}</p>
          <div className="relative w-32 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%" cy="50%"
                innerRadius="68%" outerRadius="100%"
                barSize={10}
                data={[{ value: pct, fill: bar }]}
                startAngle={90} endAngle={90 - 360 * (pct / 100)}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar background dataKey="value" cornerRadius={6} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${text}`}>
                {result.value.toFixed(config.decimal_places ?? 2)}
              </span>
              <span className="text-xs text-gray-400">/ {config.max_value}</span>
            </div>
          </div>
          <span className={`mt-2 text-xs font-semibold px-3 py-1 rounded-full ${passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {passed ? '✓ Pass' : '✗ Below passing'}
          </span>
          <p className="text-xs text-gray-400 mt-1">Passing mark: {config.passing_value}</p>
        </div>

        {/* Info */}
        <div className="card p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase">Result details</p>
          {[
            { label: 'Config', value: config.label },
            { label: 'Type', value: metricLabel(config.metric_type) },
            { label: 'Year', value: `Year ${config.year}` },
            { label: 'Semester', value: `Semester ${config.semester}` },
            { label: 'Branch', value: result.branch_id?.name || '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-800">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rank cards */}
      <div className="grid grid-cols-3 gap-3">
        <RankCard
          label="Branch rank"
          rank={ranks.branch.rank}
          total={ranks.branch.total}
          icon={Award}
          color="text-blue-500"
        />
        <RankCard
          label="Department rank"
          rank={ranks.department.rank}
          total={ranks.department.total}
          icon={TrendingUp}
          color="text-purple-500"
        />
        <RankCard
          label="Institute rank"
          rank={ranks.institute.rank}
          total={ranks.institute.total}
          icon={Trophy}
          color="text-amber-500"
        />
      </div>
    </div>
  );
};

// ─── Rankings panel ───────────────────────────────────────────────────────────

const RankingsPanel = ({ config }) => {
  const [scope, setScope] = useState('institute');

  const { data, isLoading } = useQuery({
    queryKey: ['student-final-rankings', config._id, scope],
    queryFn: () => studentApi.getFinalResultRankings({ config_id: config._id, scope, top: 20 }),
  });

  const results = data?.data?.results ?? data?.results ?? [];

  const chartData = results.slice(0, 10).map((r) => ({
    name: r.student_id?.name?.split(' ')[0] || '—',
    value: r.value,
    fill: '#3b82f6',
  }));

  return (
    <div className="space-y-4 border-t border-gray-100 pt-4">
      {/* Scope selector */}
      <div className="flex gap-2">
        {[
          { label: 'Institute', value: 'institute' },
          { label: 'Branch', value: 'branch' },
          { label: 'Department', value: 'department' },
        ].map((s) => (
          <button
            key={s.value}
            onClick={() => setScope(s.value)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              scope === s.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner className="py-6" />
      ) : results.length === 0 ? (
        <EmptyState title="No rankings available" description="Rankings will appear once results are published." />
      ) : (
        <>
          {/* Mini bar chart — top 10 */}
          {chartData.length > 1 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-600 mb-3">Top 10 performers</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={chartData} barCategoryGap="25%">
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, config.max_value]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [v.toFixed(config.decimal_places ?? 2), metricLabel(config.metric_type)]} />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Leaderboard table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Rank', 'Name', 'Enrollment', metricLabel(config.metric_type), 'Bar'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {results.map((r) => {
                  const pct = config.max_value > 0 ? (r.value / config.max_value) * 100 : 0;
                  const passed = r.value >= config.passing_value;
                  return (
                    <tr key={r._id} className={`hover:bg-gray-50 ${r.rank <= 3 ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-4 py-2.5">
                        <span className={`font-bold ${r.rank === 1 ? 'text-amber-500' : r.rank === 2 ? 'text-gray-400' : r.rank === 3 ? 'text-amber-700' : 'text-gray-600'}`}>
                          #{r.rank}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{r.student_id?.name || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{r.student_id?.enrollment_number || '—'}</td>
                      <td className="px-4 py-2.5 font-semibold text-blue-700">
                        {r.value.toFixed(config.decimal_places ?? 2)}
                      </td>
                      <td className="px-4 py-2.5 w-24">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${passed ? 'bg-blue-500' : 'bg-red-400'}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Config row ───────────────────────────────────────────────────────────────

const ConfigRow = ({ config }) => {
  const [tab, setTab] = useState(null); // null | 'result' | 'rankings'

  const { data: myResultRaw, isLoading: loadingResult, error: resultError } = useQuery({
    queryKey: ['student-own-result', config._id],
    queryFn: () => studentApi.getMyFinalResult({ config_id: config._id }),
    retry: false,
  });

  const myResult = myResultRaw?.data ?? myResultRaw;

  const hasResult = !resultError && myResult?.result;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 flex-wrap gap-3">
        <div>
          <p className="font-semibold text-gray-900">{config.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {metricLabel(config.metric_type)} · Year {config.year} · Semester {config.semester} · Max: {config.max_value}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loadingResult ? (
            <span className="text-xs text-gray-400">Loading…</span>
          ) : hasResult ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
              Result available
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              Not published
            </span>
          )}
          <button
            onClick={() => setTab(tab === 'result' ? null : 'result')}
            disabled={!hasResult}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            My result
            {tab === 'result' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button
            onClick={() => setTab(tab === 'rankings' ? null : 'rankings')}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
          >
            <Users size={12} /> Rankings
            {tab === 'rankings' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Panels */}
      {tab === 'result' && hasResult && (
        <div className="px-5 pb-5">
          <ResultDetail config={config} myResult={myResult} ranks={myResult.ranks} />
        </div>
      )}

      {tab === 'rankings' && (
        <div className="px-5 pb-5">
          <RankingsPanel config={config} />
        </div>
      )}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const StudentFinalResults = () => {
  const { user } = useAuthStore();
  const [yearFilter, setYearFilter] = useState('');
  const [semFilter, setSemFilter] = useState('');

  const { data: configsRaw, isLoading } = useQuery({
    queryKey: ['student-final-configs', yearFilter, semFilter],
    queryFn: () => studentApi.getFinalResultConfigs({
      year: yearFilter || undefined,
      semester: semFilter || undefined,
    }),
  });

  const configs = configsRaw?.data ?? configsRaw ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Final Results"
        description="View your published results and see how you rank among peers"
      />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <select className="input w-36" value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setSemFilter(''); }}>
          <option value="">All years</option>
          {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}
        </select>
        <select className="input w-40" value={semFilter} disabled={!yearFilter} onChange={(e) => setSemFilter(e.target.value)}>
          <option value="">All semesters</option>
          {getSemestersForYear(yearFilter).map((s) => <option key={s} value={s}>Semester {s}</option>)}
        </select>
        {(yearFilter || semFilter) && (
          <button
            className="text-xs text-gray-400 hover:text-gray-600 underline"
            onClick={() => { setYearFilter(''); setSemFilter(''); }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner className="py-16" />
      ) : configs.length === 0 ? (
        <EmptyState
          title="No results published yet"
          description="Your results will appear here once your coordinator publishes them."
        />
      ) : (
        <div className="space-y-4">
          {configs.map((cfg) => (
            <ConfigRow key={cfg._id} config={cfg} />
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentFinalResults;
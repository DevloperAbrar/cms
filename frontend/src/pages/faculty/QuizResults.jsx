import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ReferenceLine,
} from 'recharts';
import { facultyApi } from '../../api/faculty.api';
import { coordinatorApi } from '../../api/coordinator.api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Eye, EyeOff, TrendingUp, Users, Award, Target, BarChart2, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

const getApi = (apiBase) => apiBase === 'coordinator' ? coordinatorApi : facultyApi;

const PUBLISH_MODES = [
  { value: 'scores_only',          label: 'Scores Only',       desc: 'Students see their score and percentage only.',        icon: '📊' },
  { value: 'scores_with_rank',     label: 'Scores + Rank',     desc: 'Students also see their rank among all participants.', icon: '🏆' },
  { value: 'scores_with_solution', label: 'Scores + Solution', desc: 'Students see score, rank, and all correct answers.',   icon: '📋' },
];

const MODE_LABELS = {
  none:                  { label: 'Not Published',           pill: 'bg-gray-100 text-gray-500' },
  scores_only:           { label: 'Scores Published',        pill: 'bg-blue-100 text-blue-700' },
  scores_with_rank:      { label: 'Scores + Rank',           pill: 'bg-yellow-100 text-yellow-700' },
  scores_with_solution:  { label: 'Full Solution Published',  pill: 'bg-green-100 text-green-700' },
};

const buildHistogram = (attempts, totalMarks) => {
  const bucketCount = Math.min(10, Math.max(4, totalMarks));
  const step = totalMarks / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    range: `${Math.round(i * step)}-${Math.round((i + 1) * step)}`,
    count: 0,
    min: i * step,
    max: (i + 1) * step,
  }));
  for (const a of attempts) {
    const score = a.score || 0;
    const idx = Math.min(Math.floor(score / step), bucketCount - 1);
    buckets[idx].count++;
  }
  return buckets;
};

const buildTimeline = (attempts) => {
  const byMinute = {};
  for (const a of attempts) {
    if (!a.submitted_at) continue;
    const key = new Date(a.submitted_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    byMinute[key] = (byMinute[key] || 0) + 1;
  }
  return Object.entries(byMinute)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, count]) => ({ time, count }));
};

const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-2.5 text-xs">
        <p className="font-semibold text-gray-700">Score: {label}</p>
        <p className="text-primary-600 mt-0.5">{payload[0].value} student{payload[0].value !== 1 ? 's' : ''}</p>
      </div>
    );
  }
  return null;
};

const StatCard = ({ icon: Icon, iconColor, value, label, sub }) => (
  <div className="card p-5 flex items-center gap-4">
    <div className={`flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center ${iconColor}`}>
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const FacultyQuizResults = ({ apiBase = 'faculty' }) => {
  const { id } = useParams();
  const api = getApi(apiBase);
  const queryClient = useQueryClient();
  const [selectedMode, setSelectedMode] = useState(null);
  const [showPublishPanel, setShowPublishPanel] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: [`${apiBase}-quiz-results`, id],
    queryFn: () => api.getQuizResults(id),
  });

  const publishMutation = useMutation({
    mutationFn: (mode) => api.publishResults(id, mode),
    onSuccess: () => {
      toast.success('Results published to students!');
      setShowPublishPanel(false);
      setSelectedMode(null);
      queryClient.invalidateQueries({ queryKey: [`${apiBase}-quiz-results`, id] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  if (isLoading) return <LoadingSpinner className="py-16" />;
  if (!data) return <EmptyState title="No results found" />;

  const { quiz, attempts = [] } = data;
  const currentMode = quiz.result_publish_mode || 'none';
  const modeInfo = MODE_LABELS[currentMode];

  const scores = attempts.map((a) => a.score || 0);
  const totalMarks = quiz.total_marks;
  const passThreshold = totalMarks * 0.4;

  const avgScore = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
  const highScore = scores.length ? Math.max(...scores) : 0;
  const lowScore = scores.length ? Math.min(...scores) : 0;
  const passCount = scores.filter((s) => s >= passThreshold).length;
  const failCount = scores.length - passCount;
  const passRate = scores.length ? Math.round((passCount / scores.length) * 100) : 0;
  const avgPct = totalMarks ? Math.round((avgScore / totalMarks) * 100) : 0;

  const histogram = buildHistogram(attempts, totalMarks);
  const timeline = buildTimeline(attempts);
  const pieData = [
    { name: 'Pass', value: passCount, color: '#22c55e' },
    { name: 'Fail', value: failCount, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  const BANDS = [
    { label: '90-100%', min: 90,  max: 100, color: '#6366f1', bg: 'bg-indigo-100', text: 'text-indigo-700', tag: 'Excellent' },
    { label: '75-89%',  min: 75,  max: 89,  color: '#22c55e', bg: 'bg-green-100',  text: 'text-green-700',  tag: 'Good' },
    { label: '60-74%',  min: 60,  max: 74,  color: '#eab308', bg: 'bg-yellow-100', text: 'text-yellow-700', tag: 'Average' },
    { label: '40-59%',  min: 40,  max: 59,  color: '#f97316', bg: 'bg-orange-100', text: 'text-orange-700', tag: 'Below Avg' },
    { label: '0-39%',   min: 0,   max: 39,  color: '#ef4444', bg: 'bg-red-100',    text: 'text-red-700',   tag: 'Fail' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={`Results: ${quiz.title}`} description={`${totalMarks} marks · ${attempts.length} submissions`} />

      {/* Publish Panel */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${modeInfo.pill}`}>
              {currentMode === 'none' ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {modeInfo.label}
            </span>
            <p className="text-sm text-gray-500">
              {currentMode === 'none' ? 'Students cannot see results yet.' : 'Students can now view their results.'}
            </p>
          </div>
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowPublishPanel((p) => !p)}>
            <Eye className="h-4 w-4" />
            {currentMode === 'none' ? 'Publish Results' : 'Change Visibility'}
          </button>
        </div>

        {showPublishPanel && (
          <div className="mt-5 pt-5 border-t border-gray-100 space-y-4">
            <p className="text-sm font-semibold text-gray-700">Choose what students can see:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PUBLISH_MODES.map((m) => {
                const isSelected = selectedMode === m.value;
                const isCurrent = currentMode === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => setSelectedMode(m.value)}
                    className={`text-left p-4 rounded-xl border-2 transition-all space-y-1.5 ${isSelected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg">{m.icon}</span>
                      {isCurrent && <span className="text-xs text-primary-600 font-medium bg-primary-100 px-2 py-0.5 rounded-full">Current</span>}
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{m.label}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{m.desc}</p>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <button
                className="btn-primary"
                disabled={!selectedMode || publishMutation.isPending || selectedMode === currentMode}
                onClick={() => publishMutation.mutate(selectedMode)}
              >
                {publishMutation.isPending ? 'Publishing...' : 'Confirm & Publish'}
              </button>
              <button className="btn-secondary" onClick={() => { setShowPublishPanel(false); setSelectedMode(null); }}>
                Cancel
              </button>
              {selectedMode === currentMode && <p className="text-xs text-gray-400">Already set to this mode.</p>}
            </div>
          </div>
        )}
      </div>

      {attempts.length === 0 ? (
        <EmptyState title="No attempts yet" description="No students have submitted this quiz yet." />
      ) : (
        <>
          {/* Key Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users}      iconColor="bg-blue-100 text-blue-600"    value={attempts.length}                      label="Total Submissions" />
            <StatCard icon={TrendingUp} iconColor="bg-indigo-100 text-indigo-600" value={`${avgScore.toFixed(1)}/${totalMarks}`} label="Average Score"   sub={`${avgPct}% class average`} />
            <StatCard icon={Target}     iconColor="bg-green-100 text-green-600"   value={`${passCount}/${attempts.length}`}     label="Passed"           sub={`${passRate}% pass rate`} />
            <StatCard icon={Award}      iconColor="bg-yellow-100 text-yellow-600" value={`${highScore}/${totalMarks}`}          label="Top Score"        sub={`Low: ${lowScore}/${totalMarks}`} />
          </div>

          {/* Row 1: Score histogram + Pass/Fail pie */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card p-5 lg:col-span-2">
              <div className="flex items-center gap-2 mb-5">
                <BarChart2 className="h-4 w-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Score Distribution</h2>
                <span className="ml-auto text-xs text-gray-400">by score range</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={histogram} barSize={26}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#f9fafb' }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {histogram.map((entry) => (
                      <Cell
                        key={entry.range}
                        fill={entry.max <= passThreshold ? '#fca5a5' : entry.max <= totalMarks * 0.75 ? '#93c5fd' : '#6366f1'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-5 mt-3 justify-center">
                <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="h-2.5 w-2.5 rounded-sm bg-red-300 inline-block" /> Below pass</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="h-2.5 w-2.5 rounded-sm bg-blue-300 inline-block" /> Pass – 75%</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-500 inline-block" /> Above 75%</span>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-5">Pass / Fail</h2>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={76} paddingAngle={3} dataKey="value">
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} students`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-6 mt-2">
                {pieData.map((d) => (
                  <div key={d.name} className="text-center">
                    <div className="flex items-center gap-1.5 justify-center">
                      <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: d.color }} />
                      <span className="text-xs text-gray-500">{d.name}</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">{d.value}</p>
                    <p className="text-xs text-gray-400">{Math.round((d.value / attempts.length) * 100)}%</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Performance bands + Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-5">
                <BookOpen className="h-4 w-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Performance Bands</h2>
              </div>
              <div className="space-y-3">
                {BANDS.map((band) => {
                  const count = scores.filter((s) => {
                    const pct = totalMarks ? Math.round((s / totalMarks) * 100) : 0;
                    return pct >= band.min && pct <= band.max;
                  }).length;
                  const pct = attempts.length ? Math.round((count / attempts.length) * 100) : 0;
                  return (
                    <div key={band.label} className="flex items-center gap-3">
                      <div className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-md w-20 text-center ${band.bg} ${band.text}`}>
                        {band.tag}
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: band.color }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 font-medium w-5 text-right">{count}</span>
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {timeline.length > 1 ? (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-5">
                  <TrendingUp className="h-4 w-4 text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-900">Submission Timeline</h2>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={24} />
                    <Tooltip
                      formatter={(v) => [`${v} submission${v !== 1 ? 's' : ''}`, '']}
                      contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e5e7eb' }}
                    />
                    <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="card p-5 flex flex-col justify-center items-center text-center space-y-4">
                <TrendingUp className="h-8 w-8 text-gray-300" />
                <div className="grid grid-cols-2 gap-6 w-full">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{attempts.filter((a) => a.is_auto_submitted).length}</p>
                    <p className="text-xs text-gray-500 mt-1">Auto-submitted</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{attempts.filter((a) => !a.is_auto_submitted).length}</p>
                    <p className="text-xs text-gray-500 mt-1">Manually submitted</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-5">
              <Award className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Leaderboard</h2>
              <span className="ml-auto text-xs text-gray-400">sorted by score</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-12">Rank</th>
                    <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Student</th>
                    <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Score</th>
                    <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Progress</th>
                    <th className="pb-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {attempts.map((a, i) => {
                    const pct = totalMarks ? Math.round(((a.score || 0) / totalMarks) * 100) : 0;
                    const passed = (a.score || 0) >= passThreshold;
                    const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                    return (
                      <tr key={a._id} className={`hover:bg-gray-50 transition-colors ${i === 0 ? 'bg-yellow-50/40' : ''}`}>
                        <td className="py-3 pr-4">
                          {rankEmoji ? (
                            <span className="text-lg">{rankEmoji}</span>
                          ) : (
                            <span className="text-xs font-semibold text-gray-400">{i + 1}</span>
                          )}
                        </td>
                        <td className="py-3 pr-6">
                          <p className="font-semibold text-gray-900">{a.student_id?.name}</p>
                          <p className="text-xs text-gray-400">{a.student_id?.enrollment_number}</p>
                        </td>
                        <td className="py-3 pr-6">
                          <span className="font-bold text-gray-900">{a.score || 0}</span>
                          <span className="text-gray-400 text-xs">/{totalMarks}</span>
                        </td>
                        <td className="py-3 pr-6 min-w-[120px]">
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-32">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: pct >= 75 ? '#6366f1' : pct >= 40 ? '#22c55e' : '#ef4444' }}
                            />
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            passed
                              ? pct >= 75 ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-600'
                          }`}>
                            {pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FacultyQuizResults;
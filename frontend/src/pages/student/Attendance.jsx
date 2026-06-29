import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { studentApi } from '../../api/student.api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import { AlertTriangle, CheckCircle, BookOpen, TrendingUp } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getColor = (pct) => {
  if (pct >= 85) return { bar: '#22c55e', text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };
  if (pct >= 75) return { bar: '#3b82f6', text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
  if (pct >= 60) return { bar: '#f59e0b', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
  return { bar: '#ef4444', text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
};

const StatusBadge = ({ pct }) => {
  if (pct >= 75) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
      <CheckCircle size={10} /> Good
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
      <AlertTriangle size={10} /> Low
    </span>
  );
};

// How many more classes needed to reach 75%
const classesNeeded = (present, total) => {
  // x = extra classes needed: (present + x) / (total + x) >= 0.75
  if (total === 0) return null;
  const pct = (present / total) * 100;
  if (pct >= 75) return null;
  // solve: 0.75(total + x) = present + x  →  x = (0.75*total - present) / 0.25
  const x = Math.ceil((0.75 * total - present) / 0.25);
  return x > 0 ? x : null;
};

// ─── Main component ───────────────────────────────────────────────────────────

const StudentAttendance = () => {
  const [view, setView] = useState('overview'); // 'overview' | 'subject'
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['student-attendance'],
    queryFn: studentApi.getAttendance,
  });

  const overall = data?.data?.overall ?? data?.overall ?? {};
  const subjectWise = data?.data?.subject_wise ?? data?.subject_wise ?? [];

  const filtered = useMemo(() =>
    subjectWise.filter((s) =>
      !search || (s.subject_name || s.subject_code || '').toLowerCase().includes(search.toLowerCase())
    ), [subjectWise, search]);

  if (isLoading) return <LoadingSpinner className="py-20" />;

  const overallPct = overall?.percentage ?? 0;
  const colors = getColor(overallPct);
  const needed = classesNeeded(overall?.present ?? 0, overall?.total ?? 0);

  // Chart data — top/bottom subjects
  const chartData = [...subjectWise]
    .sort((a, b) => a.percentage - b.percentage)
    .map((s) => ({
      name: s.subject_code || s.subject_name?.slice(0, 10) || 'Sub',
      pct: s.percentage,
      fill: getColor(s.percentage).bar,
    }));

  const atRisk = subjectWise.filter((s) => s.percentage < 75);
  const safe = subjectWise.filter((s) => s.percentage >= 75);

  return (
    <div className="space-y-5">
      <PageHeader title="My Attendance" description="Track your attendance across all subjects" />

      {/* ── Overall radial + stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Radial gauge */}
        <div className="card p-5 flex flex-col items-center justify-center">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Overall Attendance</p>
          <div className="relative w-36 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%" cy="50%"
                innerRadius="70%" outerRadius="100%"
                barSize={12}
                data={[{ value: overallPct, fill: colors.bar }]}
                startAngle={90} endAngle={90 - 360 * (overallPct / 100)}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar background dataKey="value" cornerRadius={6} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${colors.text}`}>{overallPct}%</span>
            </div>
          </div>
          {overallPct < 75 ? (
            <p className="text-xs text-red-600 font-medium mt-2 flex items-center gap-1">
              <AlertTriangle size={11} /> Below 75% threshold
            </p>
          ) : (
            <p className="text-xs text-green-600 font-medium mt-2 flex items-center gap-1">
              <CheckCircle size={11} /> Above required 75%
            </p>
          )}
        </div>

        {/* Stat cards */}
        <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Total Classes', value: overall?.total ?? 0, color: 'text-gray-800', icon: <BookOpen size={16} className="text-gray-400" /> },
            { label: 'Present', value: overall?.present ?? 0, color: 'text-green-700', icon: <CheckCircle size={16} className="text-green-500" /> },
            { label: 'Absent', value: overall?.absent ?? 0, color: 'text-red-600', icon: <AlertTriangle size={16} className="text-red-400" /> },
            { label: 'Subjects', value: subjectWise.length, color: 'text-blue-700', icon: <TrendingUp size={16} className="text-blue-400" /> },
            { label: 'Safe', value: safe.length, color: 'text-green-700', icon: <CheckCircle size={16} className="text-green-400" /> },
            { label: 'At Risk', value: atRisk.length, color: 'text-red-600', icon: <AlertTriangle size={16} className="text-red-400" /> },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <div className="flex items-center justify-between mb-1">
                {s.icon}
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Alert if needed ── */}
      {needed !== null && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">
            You need to attend <span className="font-semibold">{needed} more consecutive classes</span> to reach 75% attendance.
          </p>
        </div>
      )}

      {/* ── Chart ── */}
      {chartData.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Subject-wise Attendance</h2>
          <ResponsiveContainer width="100%" height={Math.max(chartData.length * 38, 160)}>
            <BarChart data={chartData} layout="vertical" barCategoryGap="25%">
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v}%`, 'Attendance']} />
              {/* 75% reference line */}
              <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-green-500 inline-block" /> ≥85%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-blue-500 inline-block" /> 75–84%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-amber-400 inline-block" /> 60–74%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-red-400 inline-block" /> &lt;60%</span>
          </div>
        </div>
      )}

      {/* ── Subject table ── */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-900">Subject Breakdown</h2>
          <input
            className="input w-48 text-sm"
            placeholder="Search subject…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No attendance data" description="Attendance records will appear here once marked." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Subject', 'Total', 'Present', 'Absent', 'Attendance', 'Status', 'Classes Needed'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filtered.map((row, i) => {
                  const pct = row.percentage ?? 0;
                  const c = getColor(pct);
                  const need = classesNeeded(row.present ?? 0, row.total ?? 0);
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{row.subject_name || '—'}</p>
                        {row.subject_code && <p className="text-xs text-gray-400">{row.subject_code}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{row.total ?? 0}</td>
                      <td className="px-4 py-3 font-medium text-green-700">{row.present ?? 0}</td>
                      <td className="px-4 py-3 font-medium text-red-600">{row.absent ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: c.bar }} />
                          </div>
                          <span className={`text-xs font-semibold ${c.text}`}>{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge pct={pct} /></td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {need !== null ? (
                          <span className="text-red-600 font-medium">{need} more</span>
                        ) : (
                          <span className="text-green-600">✓ On track</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentAttendance;
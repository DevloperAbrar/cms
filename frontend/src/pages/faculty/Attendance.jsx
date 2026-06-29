import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facultyApi } from '../../api/faculty.api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { getAttendanceColor } from '../../utils/gradeCalculator';
import { useToast } from '../../hooks/useToast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Download, Users, BookOpen, TrendingUp, Calendar, ChevronDown } from 'lucide-react';
import api from '../../api/axiosInstance';

// ─── constants ───────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ['present', 'absent', 'late'];
const STATUS_COLORS  = {
  present: { btn: 'bg-green-100 text-green-700 border-green-300', chart: '#16a34a' },
  absent:  { btn: 'bg-red-100 text-red-700 border-red-300',       chart: '#dc2626' },
  late:    { btn: 'bg-yellow-100 text-yellow-700 border-yellow-300', chart: '#d97706' },
};
const TABS = [
  { id: 'mark',    label: 'Mark Attendance' },
  { id: 'summary', label: 'Subject Summary' },
  { id: 'student', label: 'Student View'    },
  { id: 'charts',  label: 'Charts'          },
];

const today = () => new Date().toISOString().split('T')[0];

// ─── helpers ─────────────────────────────────────────────────────────────────
const pctBg = (pct) =>
  pct >= 75 ? 'bg-green-100 text-green-700' : pct >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600';

const weekRange = () => {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
};
const monthRange = (offset = 0) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const first = new Date(y, m, 1);
  const last  = new Date(y, m + 1, 0);
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
};

// Download helper
const downloadBlob = (res, filename) => {
  const url = URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ─── Sub-components ───────────────────────────────────────────────────────────

// Stat card
const StatCard = ({ label, value, sub, color = 'text-gray-900' }) => (
  <div className="card p-4 text-center">
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

// Percentage badge pill
const PctBadge = ({ pct }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pctBg(pct)}`}>{pct}%</span>
);

// Status toggle button
const StatusBtn = ({ status, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${
      active ? STATUS_COLORS[status].btn : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400'
    }`}
  >
    {status.charAt(0).toUpperCase() + status.slice(1)}
  </button>
);

// ─── MARK TAB ────────────────────────────────────────────────────────────────
const MarkTab = ({ subjects }) => {
  const qc = useQueryClient();
  const toast = useToast();
  const [filters, setFilters] = useState({ subject_id: '', date: today(), slot: '' });
  const [attendance, setAttendance] = useState({});

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['faculty-attendance-mark', filters.subject_id, filters.date],
    queryFn: () => facultyApi.getAttendanceByDate({ subject_id: filters.subject_id, date: filters.date }),
    enabled: !!(filters.subject_id && filters.date),
    onSuccess: (data) => {
      const init = {};
      data.forEach((s) => { init[s._id] = s.status; });
      setAttendance(init);
    },
  });

  const submit = useMutation({
    mutationFn: () => facultyApi.submitAttendance({
      subject_id: filters.subject_id,
      date: filters.date,
      slot: filters.slot,
      entries: Object.entries(attendance).map(([student_id, status]) => ({ student_id, status })),
    }),
    onSuccess: () => { qc.invalidateQueries(['faculty-attendance-mark']); toast.success('Attendance saved.'); },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const markAll = (status) => {
    const u = {};
    students.forEach((s) => { u[s._id] = status; });
    setAttendance(u);
  };

  const marked   = Object.values(attendance).filter(Boolean).length;
  const unmarked = students.length - marked;

  const ready = !!(filters.subject_id && filters.date);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Subject</label>
            <select className="input" value={filters.subject_id}
              onChange={(e) => setFilters((p) => ({ ...p, subject_id: e.target.value }))}>
              <option value="">Select subject</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.code}) — Year {s.year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={filters.date} max={today()}
              onChange={(e) => setFilters((p) => ({ ...p, date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Slot (optional)</label>
            <input className="input" placeholder="e.g. 10:00–11:00" value={filters.slot}
              onChange={(e) => setFilters((p) => ({ ...p, slot: e.target.value }))} />
          </div>
        </div>
      </div>

      {!ready && <EmptyState title="Select a subject and date" description="Choose a subject and date to start marking attendance." />}
      {ready && isLoading && <LoadingSpinner className="py-16" />}
      {ready && !isLoading && students.length === 0 && <EmptyState title="No students found for this subject." />}

      {ready && !isLoading && students.length > 0 && (
        <div className="card">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-900">Students ({students.length})</h2>
              {unmarked > 0 && (
                <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                  {unmarked} unmarked
                </span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map((s) => (
                <button key={s}
                  className={`px-3 py-1.5 rounded text-xs font-medium border ${STATUS_COLORS[s].btn}`}
                  onClick={() => markAll(s)}>
                  All {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          {marked > 0 && (
            <div className="px-5 pt-3 pb-1">
              <div className="flex gap-1 h-2 rounded-full overflow-hidden">
                {['present','absent','late'].map((st) => {
                  const c = Object.values(attendance).filter((v) => v === st).length;
                  return c > 0 ? (
                    <div key={st} style={{ width: `${(c / students.length) * 100}%`, background: STATUS_COLORS[st].chart }} />
                  ) : null;
                })}
              </div>
              <div className="flex gap-4 mt-1">
                {STATUS_OPTIONS.map((st) => {
                  const c = Object.values(attendance).filter((v) => v === st).length;
                  return c > 0 ? (
                    <span key={st} className="text-xs text-gray-500">
                      <span className="font-medium" style={{ color: STATUS_COLORS[st].chart }}>{c}</span> {st}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Student list */}
          <div className="divide-y divide-gray-100">
            {students.map((s) => (
              <div key={s._id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.enrollment_number}{s.section ? ` • ${s.section}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map((status) => (
                    <StatusBtn key={status} status={status}
                      active={attendance[s._id] === status}
                      onClick={() => setAttendance((p) => ({ ...p, [s._id]: status }))} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-xs text-gray-400">{marked}/{students.length} marked</p>
            <button className="btn-primary" onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? 'Saving…' : 'Save Attendance'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── SUMMARY TAB ─────────────────────────────────────────────────────────────
const SummaryTab = ({ subjects }) => {
  const toast = useToast();
  const [subjectId, setSubjectId] = useState('');
  const [search, setSearch]       = useState('');
  const [sortBy, setSortBy]       = useState('name'); // name | pct_asc | pct_desc

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ['faculty-attendance-summary', subjectId],
    queryFn: () => facultyApi.getAttendanceSummary({ subject_id: subjectId }),
    enabled: !!subjectId,
  });

  const filtered = useMemo(() => {
    let rows = summary.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.enrollment_number?.toLowerCase().includes(search.toLowerCase())
    );
    if (sortBy === 'pct_asc')  rows = [...rows].sort((a, b) => a.percentage - b.percentage);
    if (sortBy === 'pct_desc') rows = [...rows].sort((a, b) => b.percentage - a.percentage);
    if (sortBy === 'name')     rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [summary, search, sortBy]);

  const defaulters = filtered.filter((s) => s.percentage < 75);
  const avgPct = summary.length
    ? Math.round(summary.reduce((a, s) => a + s.percentage, 0) / summary.length)
    : 0;

    const handleDownload = async () => {
      try {
        const baseURL = import.meta.env.VITE_API_URL || '/api';
        const response = await fetch(
          `${baseURL}/faculty/attendance/summary/export?subject_id=${subjectId}`,
          { credentials: 'include' }
        );
        if (!response.ok) throw new Error('Export failed');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'attendance_summary.csv';
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        toast.error('Download failed.');
      }
    };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <label className="label">Subject</label>
            <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Select subject</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.code}) — Year {s.year}</option>
              ))}
            </select>
          </div>
          {subjectId && summary.length > 0 && (
            <>
              <div className="flex-1 min-w-40">
                <label className="label">Search student</label>
                <input className="input" placeholder="Name or enrollment…" value={search}
                  onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div>
                <label className="label">Sort</label>
                <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="name">Name A–Z</option>
                  <option value="pct_desc">% High → Low</option>
                  <option value="pct_asc">% Low → High</option>
                </select>
              </div>
              <button className="btn-secondary flex items-center gap-1.5 text-sm" onClick={handleDownload}>
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </>
          )}
        </div>
      </div>

      {!subjectId && <EmptyState title="Select a subject" description="Choose a subject to view its attendance summary." />}
      {subjectId && isLoading && <LoadingSpinner className="py-16" />}
      {subjectId && !isLoading && summary.length === 0 && <EmptyState title="No records yet" description="No attendance has been marked for this subject." />}

      {subjectId && !isLoading && summary.length > 0 && (
        <>
          {/* Stat row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Students" value={summary.length} />
            <StatCard label="Avg Attendance" value={`${avgPct}%`} color={getAttendanceColor(avgPct)} />
            <StatCard label="Above 75%" value={summary.filter((s) => s.percentage >= 75).length} color="text-green-600" />
            <StatCard label="Defaulters" value={defaulters.length} color={defaulters.length > 0 ? 'text-red-600' : 'text-gray-900'} />
          </div>

          {/* Table */}
          <div className="card overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Enrollment</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Present</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Absent</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Late</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">%</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filtered.map((s, i) => (
                  <tr key={s._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.enrollment_number}</td>
                    <td className="px-4 py-3 text-center">{s.total}</td>
                    <td className="px-4 py-3 text-center text-green-700 font-medium">{s.present}</td>
                    <td className="px-4 py-3 text-center text-red-600 font-medium">{s.absent}</td>
                    <td className="px-4 py-3 text-center text-yellow-600 font-medium">{s.late}</td>
                    <td className="px-4 py-3 text-center"><PctBadge pct={s.percentage} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Defaulters callout */}
          {defaulters.length > 0 && (
            <div className="card border-l-4 border-red-400 p-4">
              <p className="text-sm font-semibold text-red-700 mb-2">⚠ Defaulters below 75% ({defaulters.length})</p>
              <div className="flex flex-wrap gap-2">
                {defaulters.map((d) => (
                  <span key={d._id} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                    {d.name} — {d.percentage}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── STUDENT VIEW TAB ────────────────────────────────────────────────────────
const StudentTab = ({ subjects }) => {
  const [subjectId, setSubjectId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [range, setRange]         = useState('month'); // day | week | month | custom
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');

  const { data: summary = [] } = useQuery({
    queryKey: ['faculty-attendance-summary', subjectId],
    queryFn: () => facultyApi.getAttendanceSummary({ subject_id: subjectId }),
    enabled: !!subjectId,
  });

  // Build date params from range
  const dateParams = useMemo(() => {
    if (range === 'day')    return { from: today(), to: today() };
    if (range === 'week')   return weekRange();
    if (range === 'month')  return monthRange();
    if (range === 'custom') return { from: customFrom, to: customTo };
    return {};
  }, [range, customFrom, customTo]);

  // Student's records for selected date range — reuse summary but filter by date client-side via a separate endpoint
  // We use getAttendanceByDate scoped to this student using summary as the source of truth
  const studentSummary = summary.find((s) => s._id === studentId);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Subject</label>
            <select className="input" value={subjectId}
              onChange={(e) => { setSubjectId(e.target.value); setStudentId(''); }}>
              <option value="">Select subject</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.code}) — Year {s.year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Student</label>
            <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}
              disabled={!subjectId}>
              <option value="">Select student</option>
              {summary.map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.enrollment_number})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Range</label>
            <select className="input" value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="day">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>
        {range === 'custom' && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="label">From</label>
              <input type="date" className="input" value={customFrom} max={today()}
                onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input" value={customTo} max={today()}
                onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {!studentId && <EmptyState title="Select a subject and student" description="Choose both to view individual attendance." />}

      {studentId && studentSummary && (
        <div className="space-y-4">
          {/* Student header */}
          <div className="card p-5">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{studentSummary.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{studentSummary.enrollment_number}</p>
              </div>
              <PctBadge pct={studentSummary.percentage} />
            </div>
            <div className="grid grid-cols-4 gap-4 mt-5">
              <StatCard label="Total Classes" value={studentSummary.total} />
              <StatCard label="Present" value={studentSummary.present} color="text-green-600" />
              <StatCard label="Absent"  value={studentSummary.absent}  color="text-red-600" />
              <StatCard label="Late"    value={studentSummary.late}    color="text-yellow-600" />
            </div>

            {/* Attendance bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Attendance</span>
                <span>{studentSummary.percentage}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-green-500 transition-all"
                  style={{ width: `${(studentSummary.present / studentSummary.total) * 100}%` }} />
                <div className="h-full bg-yellow-400 transition-all"
                  style={{ width: `${(studentSummary.late / studentSummary.total) * 100}%` }} />
              </div>
              <div className="flex gap-4 mt-1.5 text-xs text-gray-400">
                <span>🟢 Present</span><span>🟡 Late</span><span>⬜ Absent</span>
              </div>
            </div>

            {/* Shortage warning */}
            {studentSummary.percentage < 75 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                ⚠ Short by <strong>{Math.ceil((75 * studentSummary.total / 100) - studentSummary.present)}</strong> classes to reach 75%.
                Needs to attend next <strong>{Math.ceil(
                  (0.75 * studentSummary.total - studentSummary.present) / (1 - 0.75)
                )}</strong> consecutive classes to recover.
              </div>
            )}
            {studentSummary.percentage >= 75 && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                ✓ Can afford to miss <strong>{Math.floor(studentSummary.present - 0.75 * studentSummary.total)}</strong> more class(es) and stay above 75%.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── CHARTS TAB ──────────────────────────────────────────────────────────────
const ChartsTab = ({ subjects }) => {
  const [subjectId, setSubjectId] = useState('');

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ['faculty-attendance-summary', subjectId],
    queryFn: () => facultyApi.getAttendanceSummary({ subject_id: subjectId }),
    enabled: !!subjectId,
  });

  // Buckets: 0-40, 40-60, 60-75, 75-90, 90-100
  const buckets = useMemo(() => {
    const b = { '0–40': 0, '40–60': 0, '60–75': 0, '75–90': 0, '90–100': 0 };
    summary.forEach((s) => {
      if (s.percentage < 40)       b['0–40']++;
      else if (s.percentage < 60)  b['40–60']++;
      else if (s.percentage < 75)  b['60–75']++;
      else if (s.percentage < 90)  b['75–90']++;
      else                         b['90–100']++;
    });
    return Object.entries(b).map(([name, count]) => ({ name, count }));
  }, [summary]);

  const pieData = useMemo(() => {
    const total  = summary.reduce((a, s) => a + s.total, 0);
    const present = summary.reduce((a, s) => a + s.present, 0);
    const absent  = summary.reduce((a, s) => a + s.absent, 0);
    const late    = summary.reduce((a, s) => a + s.late, 0);
    return [
      { name: 'Present', value: present, color: STATUS_COLORS.present.chart },
      { name: 'Absent',  value: absent,  color: STATUS_COLORS.absent.chart  },
      { name: 'Late',    value: late,    color: STATUS_COLORS.late.chart    },
    ].filter((d) => d.value > 0);
  }, [summary]);

  // Top 5 lowest attendance
  const bottomFive = useMemo(() =>
    [...summary].sort((a, b) => a.percentage - b.percentage).slice(0, 5),
    [summary]
  );

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <label className="label">Subject</label>
        <select className="input w-72" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Select subject</option>
          {subjects.map((s) => (
            <option key={s._id} value={s._id}>{s.name} ({s.code}) — Year {s.year}</option>
          ))}
        </select>
      </div>

      {!subjectId && <EmptyState title="Select a subject" description="Choose a subject to see attendance charts." />}
      {subjectId && isLoading && <LoadingSpinner className="py-16" />}
      {subjectId && !isLoading && summary.length === 0 && <EmptyState title="No attendance data yet." />}

      {subjectId && !isLoading && summary.length > 0 && (
        <div className="space-y-4">
          {/* Row 1: Pie + Bar side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pie — overall status distribution */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Overall Status Distribution</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar — student distribution by bucket */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Students by Attendance Range</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={buckets} barSize={32}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Students" radius={[4,4,0,0]}>
                    {buckets.map((b) => (
                      <Cell key={b.name}
                        fill={b.name === '0–40' || b.name === '40–60' ? '#dc2626' : b.name === '60–75' ? '#d97706' : '#16a34a'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2: Bottom 5 students */}
          {bottomFive.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Lowest Attendance (Bottom 5)</h3>
              <div className="space-y-3">
                {bottomFive.map((s) => (
                  <div key={s._id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-800">{s.name}</span>
                      <PctBadge pct={s.percentage} />
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${s.percentage}%`, background: s.percentage >= 75 ? '#16a34a' : s.percentage >= 60 ? '#d97706' : '#dc2626' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Row 3: Full student bar chart */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">All Students — Attendance %</h3>
            <ResponsiveContainer width="100%" height={Math.max(summary.length * 28, 200)}>
              <BarChart data={summary} layout="vertical" barSize={14}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="percentage" name="Attendance" radius={[0,4,4,0]}>
                  {summary.map((s) => (
                    <Cell key={s._id}
                      fill={s.percentage >= 75 ? '#16a34a' : s.percentage >= 60 ? '#d97706' : '#dc2626'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const FacultyAttendance = () => {
  const [tab, setTab] = useState('mark');

  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['faculty-subjects'],
    queryFn: facultyApi.getMySubjects,
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Attendance" description="Mark attendance, view summaries, and track student trends." />

      {/* Stats overview */}
      {subjects.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Subjects" value={subjects.length} />
          <StatCard label="Year Groups" value={[...new Set(subjects.map((s) => s.year))].length} />
          <StatCard label="Today" value={new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} />
          <StatCard label="Academic Year" value={`${new Date().getFullYear()}`} />
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loadingSubjects ? <LoadingSpinner className="py-16" /> : (
        <>
          {tab === 'mark'    && <MarkTab    subjects={subjects} />}
          {tab === 'summary' && <SummaryTab subjects={subjects} />}
          {tab === 'student' && <StudentTab subjects={subjects} />}
          {tab === 'charts'  && <ChartsTab  subjects={subjects} />}
        </>
      )}
    </div>
  );
};

export default FacultyAttendance;
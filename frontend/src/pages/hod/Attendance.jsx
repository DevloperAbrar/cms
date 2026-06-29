import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hodApi } from '../../api/hod.api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { AttendanceGrid } from '../../components/attendance/AttendanceGrid';
import { AttendancePDFExport } from '../../components/attendance/AttendancePDFExport';
import { EmptyState } from '../../components/common/EmptyState';
import { getAttendanceColor } from '../../utils/gradeCalculator';
import { useToast } from '../../hooks/useToast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';

// ─── constants ────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ['Present', 'Absent', 'Late'];
const toValue = (s) => s.toLowerCase();

const STATUS_COLORS = {
  present: { bg: 'bg-green-100 text-green-700 border-green-300', chart: '#16a34a' },
  absent:  { bg: 'bg-red-100 text-red-700 border-red-300',       chart: '#dc2626' },
  late:    { bg: 'bg-yellow-100 text-yellow-700 border-yellow-300', chart: '#d97706' },
};

const today       = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().getMonth() + 1;
const currentYear  = () => new Date().getFullYear();

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear() - i);

// ─── shared helpers ───────────────────────────────────────────────────────────
const pctBg = (pct) =>
  pct >= 75 ? 'bg-green-100 text-green-700' : pct >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600';

const PctBadge = ({ pct }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pctBg(pct)}`}>{pct}%</span>
);

const StatCard = ({ label, value, color = 'text-gray-900' }) => (
  <div className="card p-4 text-center">
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
  </div>
);

// ─── STUDENT CHARTS ───────────────────────────────────────────────────────────
const StudentChartsTab = ({ branches }) => {
  const [filters, setFilters] = useState({ branch_id: '', year: '' });
  const [threshold, setThreshold] = useState(75);

  const ready = !!(filters.branch_id && filters.year);

  // All students — threshold 101 means $lt:101 which returns everyone (0–100%)
  const { data: allStudents = [], isLoading: la } = useQuery({
    queryKey: ['hod-all-students-chart', filters.branch_id, filters.year],
    queryFn: () => hodApi.getBranchDefaulters({ ...filters, threshold: 101 }),
    enabled: ready,
  });

  // Defaulters — filtered by chosen threshold, derived from allStudents client-side
  const defaulters = useMemo(
    () => allStudents.filter((s) => s.percentage < threshold),
    [allStudents, threshold]
  );

  const isLoading = la;

  // Buckets
  const buckets = useMemo(() => {
    const b = { '0–40': 0, '40–60': 0, '60–75': 0, '75–90': 0, '90–100': 0 };
    allStudents.forEach((s) => {
      if (s.percentage < 40)       b['0–40']++;
      else if (s.percentage < 60)  b['40–60']++;
      else if (s.percentage < 75)  b['60–75']++;
      else if (s.percentage < 90)  b['75–90']++;
      else                         b['90–100']++;
    });
    return Object.entries(b).map(([name, count]) => ({ name, count }));
  }, [allStudents]);

  // Pie: above/below threshold
  const pieData = useMemo(() => {
    const above = allStudents.filter((s) => s.percentage >= threshold).length;
    const below = allStudents.length - above;
    return [
      { name: `≥ ${threshold}%`, value: above, color: '#16a34a' },
      { name: `< ${threshold}%`, value: below,  color: '#dc2626' },
    ].filter((d) => d.value > 0);
  }, [allStudents, threshold]);

  // Top 5 worst
  const bottomFive = useMemo(() =>
    [...allStudents].sort((a, b) => a.percentage - b.percentage).slice(0, 5),
    [allStudents]
  );

  // Top 5 best
  const topFive = useMemo(() =>
    [...allStudents].sort((a, b) => b.percentage - a.percentage).slice(0, 5),
    [allStudents]
  );

  const avgPct = allStudents.length
    ? Math.round(allStudents.reduce((a, s) => a + s.percentage, 0) / allStudents.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Branch</label>
            <select className="input" value={filters.branch_id}
              onChange={(e) => setFilters((p) => ({ ...p, branch_id: e.target.value }))}>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select className="input" value={filters.year}
              onChange={(e) => setFilters((p) => ({ ...p, year: e.target.value }))}>
              <option value="">Select year</option>
              {[1,2,3,4].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Threshold (%)</label>
            <input type="number" className="input" value={threshold} min={1} max={100}
              onChange={(e) => setThreshold(Number(e.target.value))} />
          </div>
        </div>
      </div>

      {!ready && <EmptyState title="Select branch and year" description="Choose a branch and year to see attendance charts." />}
      {ready && isLoading && <LoadingSpinner className="py-16" />}
      {ready && !isLoading && allStudents.length === 0 && <EmptyState title="No data found" description="No attendance records for this branch and year." />}

      {ready && !isLoading && allStudents.length > 0 && (
        <div className="space-y-4">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Students" value={allStudents.length} />
            <StatCard label="Avg Attendance" value={`${avgPct}%`} color={getAttendanceColor(avgPct)} />
            <StatCard label={`Above ${threshold}%`}
              value={allStudents.filter((s) => s.percentage >= threshold).length}
              color="text-green-600" />
            <StatCard label="Defaulters" value={defaulters.length}
              color={defaulters.length > 0 ? 'text-red-600' : 'text-gray-900'} />
          </div>

          {/* Row 1: Pie + Bucket bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Students vs Threshold ({threshold}%)
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

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

          {/* Row 2: Bottom 5 + Top 5 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">⚠ Lowest Attendance (Bottom 5)</h3>
              <div className="space-y-3">
                {bottomFive.map((s) => (
                  <div key={s.student_id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-800">{s.student_name}</span>
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

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">✓ Highest Attendance (Top 5)</h3>
              <div className="space-y-3">
                {topFive.map((s) => (
                  <div key={s.student_id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-800">{s.student_name}</span>
                      <PctBadge pct={s.percentage} />
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${s.percentage}%`, background: '#16a34a' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 3: Full horizontal bar — all students */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">All Students — Attendance %</h3>
            <ResponsiveContainer width="100%" height={Math.max(allStudents.length * 28, 200)}>
              <BarChart
                data={[...allStudents].sort((a, b) => a.percentage - b.percentage)}
                layout="vertical" barSize={14}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <YAxis type="category" dataKey="student_name" width={130} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="percentage" name="Attendance" radius={[0,4,4,0]}>
                  {[...allStudents]
                    .sort((a, b) => a.percentage - b.percentage)
                    .map((s) => (
                      <Cell key={s.student_id}
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

// ─── FACULTY ATTENDANCE TAB ───────────────────────────────────────────────────
const FacultyAttendanceTab = () => {
  const qc = useQueryClient();
  const toast = useToast();
  const [summaryDate, setSummaryDate]         = useState(today());
  const [detailFacultyId, setDetailFacultyId] = useState('');
  const [detailMonth, setDetailMonth]         = useState(currentMonth());
  const [detailYear, setDetailYear]           = useState(currentYear());
  const [statusMap, setStatusMap]             = useState({});
  const [noteMap, setNoteMap]                 = useState({});

  const { data: summaryData, isLoading: ls } = useQuery({
    queryKey: ['hod-faculty-summary', summaryDate],
    queryFn: () => hodApi.getFacultyAttendanceSummary(summaryDate),
  });

  const { data: detailData, isLoading: ld } = useQuery({
    queryKey: ['hod-faculty-detail', detailFacultyId, detailMonth, detailYear],
    queryFn: () => hodApi.getFacultyAttendance({ faculty_id: detailFacultyId, month: detailMonth, year: detailYear }),
    enabled: !!detailFacultyId,
  });

  const { mutate: markAttendance, isLoading: saving } = useMutation({
    mutationFn: (records) => hodApi.markFacultyAttendance(records),
    onSuccess: () => {
      toast.success('Faculty attendance saved successfully.');
      qc.invalidateQueries(['hod-faculty-summary', summaryDate]);
      qc.invalidateQueries(['hod-faculty-detail', detailFacultyId]);
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to save attendance.'),
  });

  const summary = summaryData?.summary || [];

  const seededMap = {};
  const seededNotes = {};
  summary.forEach((f) => {
    seededMap[f.faculty_id]   = statusMap[f.faculty_id]  ?? f.status ?? '';
    seededNotes[f.faculty_id] = noteMap[f.faculty_id]    ?? f.note   ?? '';
  });

  const handleSave = () => {
    const records = summary
      .filter((f) => seededMap[f.faculty_id])
      .map((f) => ({
        faculty_id: f.faculty_id,
        date: summaryDate,
        status: seededMap[f.faculty_id],
        note: seededNotes[f.faculty_id] || undefined,
      }));
    if (!records.length) { toast.error('Please mark at least one faculty status before saving.'); return; }
    markAttendance(records);
  };

  return (
    <div className="space-y-6">
      {/* Mark attendance */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Mark Faculty Attendance</h2>
          <div className="flex items-center gap-3">
            <input type="date" className="input w-44" value={summaryDate} max={today()}
              onChange={(e) => { setSummaryDate(e.target.value); setStatusMap({}); setNoteMap({}); }} />
            <button className="btn-primary text-sm px-4 py-2 rounded-md"
              onClick={handleSave} disabled={saving || ls}>
              {saving ? 'Saving…' : 'Save Attendance'}
            </button>
          </div>
        </div>
        {ls ? <LoadingSpinner className="py-8" /> : summary.length === 0 ? (
          <EmptyState title="No faculty found" description="No active faculty in your department." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Faculty</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {summary.map((f) => (
                  <tr key={f.faculty_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{f.name}</p>
                      <p className="text-xs text-gray-400">{f.email}</p>
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-500">{f.role}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {STATUS_OPTIONS.map((s) => {
                          const val = toValue(s);
                          const active = seededMap[f.faculty_id] === val;
                          return (
                            <button key={s}
                              onClick={() => setStatusMap((p) => ({ ...p, [f.faculty_id]: val }))}
                              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                active ? STATUS_COLORS[val].bg : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                              }`}>
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input type="text" placeholder="Optional note" className="input text-xs py-1 w-40"
                        value={seededNotes[f.faculty_id] || ''}
                        onChange={(e) => setNoteMap((p) => ({ ...p, [f.faculty_id]: e.target.value }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Per-faculty monthly detail */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Faculty Attendance Detail</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Faculty</label>
              <select className="input" value={detailFacultyId}
                onChange={(e) => setDetailFacultyId(e.target.value)}>
                <option value="">Select faculty</option>
                {summary.map((f) => <option key={f.faculty_id} value={f.faculty_id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Month</label>
              <select className="input" value={detailMonth}
                onChange={(e) => setDetailMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Year</label>
              <select className="input" value={detailYear}
                onChange={(e) => setDetailYear(Number(e.target.value))}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        {!detailFacultyId ? (
          <EmptyState title="Select a faculty member" description="Choose a faculty to view their attendance history." />
        ) : ld ? (
          <LoadingSpinner className="py-8" />
        ) : (
          <>
            {detailData?.summary && (
              <div className="grid grid-cols-4 gap-4 p-5 border-b border-gray-100">
                <div className="text-center">
                  <p className="text-2xl font-bold">{detailData.summary.total}</p>
                  <p className="text-xs text-gray-500 mt-1">Total Days</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-700">{detailData.summary.present}</p>
                  <p className="text-xs text-gray-500 mt-1">Present</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{detailData.summary.absent}</p>
                  <p className="text-xs text-gray-500 mt-1">Absent</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${getAttendanceColor(detailData.summary.percentage)}`}>
                    {detailData.summary.percentage}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Percentage</p>
                </div>
              </div>
            )}
            {!detailData?.records?.length ? (
              <EmptyState title="No records" description="No attendance marked for this period." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Day</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {detailData.records.map((r) => {
                      const d = new Date(r.date);
                      return (
                        <tr key={r._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">
                            {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {d.toLocaleDateString('en-IN', { weekday: 'long' })}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[r.status]?.bg || ''}`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{r.note || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── FACULTY CHARTS TAB ───────────────────────────────────────────────────────
const FacultyChartsTab = () => {
  const [chartMonth, setChartMonth] = useState(currentMonth());
  const [chartYear, setChartYear]   = useState(currentYear());

  // Fetch summary for "today" to get the faculty list
  const { data: summaryData, isLoading: ls } = useQuery({
    queryKey: ['hod-faculty-summary', today()],
    queryFn: () => hodApi.getFacultyAttendanceSummary(today()),
  });

  const facultyList = summaryData?.summary || [];

  // For each faculty fetch their monthly detail, then aggregate
  const { data: monthlyAll = [], isLoading: lm } = useQuery({
    queryKey: ['hod-faculty-monthly-all', chartMonth, chartYear, facultyList.map((f) => f.faculty_id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        facultyList.map((f) =>
          hodApi.getFacultyAttendance({ faculty_id: f.faculty_id, month: chartMonth, year: chartYear })
            .then((d) => ({
              name: f.name,
              faculty_id: f.faculty_id,
              total: d?.summary?.total || 0,
              present: d?.summary?.present || 0,
              absent: d?.summary?.absent || 0,
              late: d?.summary?.late || 0,
              percentage: d?.summary?.percentage || 0,
            }))
            .catch(() => ({
              name: f.name, faculty_id: f.faculty_id,
              total: 0, present: 0, absent: 0, late: 0, percentage: 0,
            }))
        )
      );
      return results;
    },
    enabled: facultyList.length > 0,
  });

  const isLoading = ls || lm;

  // Pie: overall present/absent/late across all faculty
  const pieData = useMemo(() => {
    const present = monthlyAll.reduce((a, f) => a + f.present, 0);
    const absent  = monthlyAll.reduce((a, f) => a + f.absent,  0);
    const late    = monthlyAll.reduce((a, f) => a + f.late,    0);
    return [
      { name: 'Present', value: present, color: '#16a34a' },
      { name: 'Absent',  value: absent,  color: '#dc2626' },
      { name: 'Late',    value: late,    color: '#d97706' },
    ].filter((d) => d.value > 0);
  }, [monthlyAll]);

  const avgPct = monthlyAll.length
    ? Math.round(monthlyAll.reduce((a, f) => a + f.percentage, 0) / monthlyAll.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* Month/year filter */}
      <div className="card p-4">
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="label">Month</label>
            <select className="input" value={chartMonth} onChange={(e) => setChartMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select className="input" value={chartYear} onChange={(e) => setChartYear(Number(e.target.value))}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {isLoading && <LoadingSpinner className="py-16" />}
      {!isLoading && facultyList.length === 0 && (
        <EmptyState title="No faculty found" description="No active faculty in your department." />
      )}
      {!isLoading && facultyList.length > 0 && (
        <div className="space-y-4">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Faculty" value={monthlyAll.length} />
            <StatCard label="Avg Attendance" value={`${avgPct}%`} color={getAttendanceColor(avgPct)} />
            <StatCard label="Above 75%"
              value={monthlyAll.filter((f) => f.percentage >= 75).length}
              color="text-green-600" />
            <StatCard label="Below 75%"
              value={monthlyAll.filter((f) => f.percentage < 75).length}
              color={monthlyAll.filter((f) => f.percentage < 75).length > 0 ? 'text-red-600' : 'text-gray-900'} />
          </div>

          {/* Row 1: Pie + Horizontal bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Overall Distribution — {MONTHS[chartMonth - 1]} {chartYear}
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Faculty Attendance %</h3>
              <ResponsiveContainer width="100%" height={Math.max(monthlyAll.length * 36, 200)}>
                <BarChart data={monthlyAll} layout="vertical" barSize={16}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="percentage" name="Attendance" radius={[0,4,4,0]}>
                    {monthlyAll.map((f) => (
                      <Cell key={f.faculty_id}
                        fill={f.percentage >= 75 ? '#16a34a' : f.percentage >= 60 ? '#d97706' : '#dc2626'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2: Grouped bar — present/absent/late per faculty */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Present / Absent / Late Breakdown — {MONTHS[chartMonth - 1]} {chartYear}
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(monthlyAll.length * 40, 200)}>
              <BarChart data={monthlyAll} layout="vertical" barSize={10} barGap={2}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="present" name="Present" fill="#16a34a" radius={[0,3,3,0]} />
                <Bar dataKey="absent"  name="Absent"  fill="#dc2626" radius={[0,3,3,0]} />
                <Bar dataKey="late"    name="Late"    fill="#d97706" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Row 3: Bottom performers */}
          {monthlyAll.filter((f) => f.total > 0).length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Faculty Attendance Overview</h3>
              <div className="space-y-3">
                {[...monthlyAll]
                  .filter((f) => f.total > 0)
                  .sort((a, b) => a.percentage - b.percentage)
                  .map((f) => (
                    <div key={f.faculty_id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-800">{f.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">{f.present}/{f.total} days</span>
                          <PctBadge pct={f.percentage} />
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                        <div className="h-full bg-green-500"
                          style={{ width: `${(f.present / f.total) * 100}%` }} />
                        <div className="h-full bg-yellow-400"
                          style={{ width: `${(f.late / f.total) * 100}%` }} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const HODAttendance = () => {
  const [mainTab, setMainTab]   = useState('student'); // 'student' | 'faculty'
  const [studentTab, setStudentTab] = useState('view');  // 'view' | 'charts'
  const [facultyTab, setFacultyTab] = useState('mark');  // 'mark' | 'charts'

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [threshold, setThreshold]             = useState(75);
  const [filters, setFilters]                 = useState({ branch_id: '', year: '' });

  const { data: students = [] } = useQuery({ queryKey: ['hod-students'], queryFn: hodApi.getDeptStudents });
  const { data: branches = [] } = useQuery({ queryKey: ['hod-branches'], queryFn: hodApi.getDeptBranches });

  const { data: attendance, isLoading: la } = useQuery({
    queryKey: ['hod-attendance', selectedStudent?._id],
    queryFn: () => hodApi.getStudentAttendance(selectedStudent._id),
    enabled: !!selectedStudent,
  });

  const { data: defaulters = [], isLoading: ld } = useQuery({
    queryKey: ['hod-defaulters', filters, threshold],
    queryFn: () => hodApi.getBranchDefaulters({ ...filters, threshold }),
    enabled: !!(filters.branch_id && filters.year),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Attendance" description="Monitor student and faculty attendance across your department." />

      {/* Main tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'student', label: 'Student Attendance' },
          { id: 'faculty', label: 'Faculty Attendance' },
        ].map((t) => (
          <button key={t.id} onClick={() => setMainTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              mainTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── STUDENT SECTION ── */}
      {mainTab === 'student' && (
        <div className="space-y-4">
          {/* Student sub-tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {[
              { id: 'view',   label: 'View Records' },
              { id: 'charts', label: 'Charts & Analytics' },
            ].map((t) => (
              <button key={t.id} onClick={() => setStudentTab(t.id)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  studentTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Student — View Records */}
          {studentTab === 'view' && (
            <>
              {/* Student picker */}
              <div className="card p-4">
                <label className="label">View Student Attendance</label>
                <select className="input w-full sm:w-72" value={selectedStudent?._id || ''}
                  onChange={(e) => setSelectedStudent(students.find((s) => s._id === e.target.value) || null)}>
                  <option value="">Select a student</option>
                  {students.map((s) => (
                    <option key={s._id} value={s._id}>{s.name} ({s.enrollment_number})</option>
                  ))}
                </select>
              </div>

              {selectedStudent && (
                <div className="card">
                  <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-900">{selectedStudent.name}</h2>
                    <AttendancePDFExport studentId={selectedStudent._id} studentName={selectedStudent.name} />
                  </div>
                  {la ? <LoadingSpinner className="py-8" /> : (
                    <>
                      <div className="grid grid-cols-3 gap-4 p-5 border-b border-gray-100">
                        <div className="text-center">
                          <p className="text-2xl font-bold">{attendance?.overall?.total || 0}</p>
                          <p className="text-xs text-gray-500 mt-1">Total</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-700">{attendance?.overall?.present || 0}</p>
                          <p className="text-xs text-gray-500 mt-1">Present</p>
                        </div>
                        <div className="text-center">
                          <p className={`text-2xl font-bold ${getAttendanceColor(attendance?.overall?.percentage || 0)}`}>
                            {attendance?.overall?.percentage || 0}%
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Percentage</p>
                        </div>
                      </div>
                      <AttendanceGrid data={attendance?.subject_wise || []} />
                    </>
                  )}
                </div>
              )}

              {/* Defaulters list */}
              <div className="card">
                <div className="px-5 py-4 border-b border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-900 mb-3">Defaulters List</h2>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">Branch</label>
                      <select className="input" value={filters.branch_id}
                        onChange={(e) => setFilters((p) => ({ ...p, branch_id: e.target.value }))}>
                        <option value="">Select branch</option>
                        {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Year</label>
                      <select className="input" value={filters.year}
                        onChange={(e) => setFilters((p) => ({ ...p, year: e.target.value }))}>
                        <option value="">Year</option>
                        {[1,2,3,4].map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Threshold (%)</label>
                      <input type="number" className="input" value={threshold} min={1} max={100}
                        onChange={(e) => setThreshold(Number(e.target.value))} />
                    </div>
                  </div>
                </div>
                {filters.branch_id && filters.year ? (
                  ld ? <LoadingSpinner className="py-8" /> : defaulters.length === 0 ? (
                    <EmptyState title="No defaulters" description={`All students are above ${threshold}%`} />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Enrollment</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Present</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {defaulters.map((d) => (
                            <tr key={d.student_id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium">{d.student_name}</td>
                              <td className="px-4 py-3 text-gray-500">{d.enrollment_number}</td>
                              <td className="px-4 py-3">{d.present}</td>
                              <td className="px-4 py-3">{d.total}</td>
                              <td className={`px-4 py-3 font-semibold ${getAttendanceColor(d.percentage)}`}>
                                {d.percentage}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  <EmptyState title="Select branch and year" description="Choose a branch and year to view defaulters." />
                )}
              </div>
            </>
          )}

          {/* Student — Charts */}
          {studentTab === 'charts' && <StudentChartsTab branches={branches} />}
        </div>
      )}

      {/* ── FACULTY SECTION ── */}
      {mainTab === 'faculty' && (
        <div className="space-y-4">
          {/* Faculty sub-tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {[
              { id: 'mark',   label: 'Mark & View' },
              { id: 'charts', label: 'Charts & Analytics' },
            ].map((t) => (
              <button key={t.id} onClick={() => setFacultyTab(t.id)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  facultyTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {facultyTab === 'mark'   && <FacultyAttendanceTab />}
          {facultyTab === 'charts' && <FacultyChartsTab />}
        </div>
      )}
    </div>
  );
};

export default HODAttendance;
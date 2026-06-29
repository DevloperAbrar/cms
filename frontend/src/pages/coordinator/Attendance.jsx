import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coordinatorApi } from '../../api/coordinator.api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { getAttendanceColor } from '../../utils/gradeCalculator';
import { useToast } from '../../hooks/useToast';
import useAuthStore from '../../store/authStore';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Download } from 'lucide-react';
import api from '../../api/axiosInstance';

// ─── constants ────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ['present', 'absent', 'late'];
const STATUS_COLORS = {
  present: { btn: 'bg-green-100 text-green-700 border-green-300', chart: '#16a34a' },
  absent:  { btn: 'bg-red-100 text-red-700 border-red-300',       chart: '#dc2626' },
  late:    { btn: 'bg-yellow-100 text-yellow-700 border-yellow-300', chart: '#d97706' },
};
const TABS = [
  { id: 'mark',    label: 'Mark Attendance'   },
  { id: 'branch',  label: 'Branch View'       },
  { id: 'summary', label: 'Subject Summary'   },
  { id: 'charts',  label: 'Charts'            },
];

const todayStr = () => new Date().toISOString().split('T')[0];

// ─── helpers ──────────────────────────────────────────────────────────────────
const pctBg = (pct) =>
  pct >= 75 ? 'bg-green-100 text-green-700' : pct >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600';

const downloadBlob = (res, filename) => {
  const url = URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ─── shared sub-components ────────────────────────────────────────────────────
const StatCard = ({ label, value, color = 'text-gray-900' }) => (
  <div className="card p-4 text-center">
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
  </div>
);

const PctBadge = ({ pct }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pctBg(pct)}`}>{pct}%</span>
);

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

// ─── MARK TAB ─────────────────────────────────────────────────────────────────
// Coordinator marks attendance for their own assigned subjects (faculty context)
const MarkTab = ({ mySubjects }) => {
  const qc = useQueryClient();
  const toast = useToast();
  const [filters, setFilters] = useState({ subject_id: '', date: todayStr(), slot: '' });
  const [attendance, setAttendance] = useState({});

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['coord-attendance-mark', filters.subject_id, filters.date],
    queryFn: () => coordinatorApi.getAttendanceByDate({
      subject_id: filters.subject_id,
      date: filters.date,
    }),
    enabled: !!(filters.subject_id && filters.date),
    onSuccess: (data) => {
      const init = {};
      data.forEach((s) => { init[s._id] = s.status; });
      setAttendance(init);
    },
  });

  const submit = useMutation({
    mutationFn: () => coordinatorApi.submitAttendance({
      subject_id: filters.subject_id,
      date: filters.date,
      slot: filters.slot,
      entries: Object.entries(attendance).map(([student_id, status]) => ({ student_id, status })),
    }),
    onSuccess: () => {
      qc.invalidateQueries(['coord-attendance-mark']);
      toast.success('Attendance saved successfully.');
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const handleSave = () => {
    const marked = Object.values(attendance).filter(Boolean).length;
    if (!marked) { toast.error('Please mark at least one student before saving.'); return; }
    submit.mutate();
  };

  const markAll = (status) => {
    const u = {};
    students.forEach((s) => { u[s._id] = status; });
    setAttendance(u);
  };

  const marked   = Object.values(attendance).filter(Boolean).length;
  const unmarked = students.length - marked;
  const ready    = !!(filters.subject_id && filters.date);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Subject (My Subjects)</label>
            <select className="input" value={filters.subject_id}
              onChange={(e) => setFilters((p) => ({ ...p, subject_id: e.target.value }))}>
              <option value="">Select subject</option>
              {mySubjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.code}) — Year {s.year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={filters.date} max={todayStr()}
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
                {STATUS_OPTIONS.map((st) => {
                  const c = Object.values(attendance).filter((v) => v === st).length;
                  return c > 0 ? (
                    <div key={st}
                      style={{ width: `${(c / students.length) * 100}%`, background: STATUS_COLORS[st].chart }} />
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
            <button className="btn-primary" onClick={handleSave} disabled={submit.isPending}>
              {submit.isPending ? 'Saving…' : 'Save Attendance'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── BRANCH VIEW TAB ──────────────────────────────────────────────────────────
// Coordinator sees all students in their branch with full subject-wise breakdown
const BranchTab = ({ branches }) => {
  const [branchId, setBranchId] = useState(
    branches[0]?.branch_id?._id || branches[0]?.branch_id || ''
  );
  const [year, setYear] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const ready = !!(branchId && year);

  const { data: viewData = [], isLoading } = useQuery({
    queryKey: ['coord-branch-attendance', branchId, year],
    queryFn: () => coordinatorApi.getBranchAttendance({ branch_id: branchId, year }),
    enabled: ready,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return viewData;
    const q = search.toLowerCase();
    return viewData.filter(
      ({ student }) =>
        student.name.toLowerCase().includes(q) ||
        student.enrollment_number?.toLowerCase().includes(q)
    );
  }, [viewData, search]);

  const defaulters = viewData.filter(({ overall }) => (overall?.percentage || 0) < 75);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Branch</label>
            <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => (
                <option key={b._id} value={b.branch_id?._id || b.branch_id}>
                  {b.branch_id?.name || b.branch_id} (Year {b.year})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select className="input" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">Select year</option>
              {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          {ready && viewData.length > 0 && (
            <div>
              <label className="label">Search student</label>
              <input className="input" placeholder="Name or enrollment…" value={search}
                onChange={(e) => setSearch(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {!ready && <EmptyState title="Select branch and year" description="Choose a branch and year to view attendance." />}
      {ready && isLoading && <LoadingSpinner className="py-16" />}
      {ready && !isLoading && viewData.length === 0 && <EmptyState title="No attendance data" description="No records found for this branch and year." />}

      {ready && !isLoading && viewData.length > 0 && (
        <>
          {/* Summary stat row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Students" value={viewData.length} />
            <StatCard label="Avg Attendance"
              value={`${Math.round(viewData.reduce((a, d) => a + (d.overall?.percentage || 0), 0) / viewData.length)}%`}
              color={getAttendanceColor(Math.round(viewData.reduce((a, d) => a + (d.overall?.percentage || 0), 0) / viewData.length))} />
            <StatCard label="Above 75%"
              value={viewData.filter(({ overall }) => (overall?.percentage || 0) >= 75).length}
              color="text-green-600" />
            <StatCard label="Defaulters" value={defaulters.length}
              color={defaulters.length > 0 ? 'text-red-600' : 'text-gray-900'} />
          </div>

          {/* Defaulters callout */}
          {defaulters.length > 0 && (
            <div className="card border-l-4 border-red-400 p-4">
              <p className="text-sm font-semibold text-red-700 mb-2">⚠ Defaulters below 75% ({defaulters.length})</p>
              <div className="flex flex-wrap gap-2">
                {defaulters.map(({ student, overall }) => (
                  <span key={student._id} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                    {student.name} — {overall?.percentage || 0}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Student cards */}
          <div className="space-y-2">
            {filtered.map(({ student, overall, subject_wise }) => {
              const pct = overall?.percentage || 0;
              const isOpen = expandedId === student._id;
              return (
                <div key={student._id} className="card overflow-hidden">
                  {/* Student header row — clickable to expand */}
                  <button
                    onClick={() => setExpandedId(isOpen ? null : student._id)}
                    className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{student.name}</p>
                        <p className="text-xs text-gray-500">{student.enrollment_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-gray-400">{overall?.present || 0}/{overall?.total || 0} present</p>
                      </div>
                      <PctBadge pct={pct} />
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Attendance bar */}
                  {overall?.total > 0 && (
                    <div className="px-5 pb-2">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
                        <div className="h-full bg-green-500"
                          style={{ width: `${((overall.present || 0) / overall.total) * 100}%` }} />
                        <div className="h-full bg-yellow-400"
                          style={{ width: `${((overall.late || 0) / overall.total) * 100}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Subject-wise breakdown — expandable */}
                  {isOpen && subject_wise && subject_wise.length > 0 && (
                    <div className="border-t border-gray-100 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Subject</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Total</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Present</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Absent</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Late</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {subject_wise.map((sw, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-5 py-2.5 font-medium text-gray-800 text-xs">
                                {sw.subject_name || sw.subject_code}
                              </td>
                              <td className="px-4 py-2.5 text-center text-xs">{sw.total}</td>
                              <td className="px-4 py-2.5 text-center text-xs text-green-700 font-medium">{sw.present}</td>
                              <td className="px-4 py-2.5 text-center text-xs text-red-600 font-medium">{sw.absent}</td>
                              <td className="px-4 py-2.5 text-center text-xs text-yellow-600 font-medium">{sw.late}</td>
                              <td className="px-4 py-2.5 text-center"><PctBadge pct={sw.percentage} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {isOpen && (!subject_wise || subject_wise.length === 0) && (
                    <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400">No subject-wise data available.</div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// ─── SUMMARY TAB ──────────────────────────────────────────────────────────────
const SummaryTab = ({ allBranchSubjects }) => {
  const toast = useToast();
  const [subjectId, setSubjectId] = useState('');
  const [search, setSearch]       = useState('');
  const [sortBy, setSortBy]       = useState('name');

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ['coord-attendance-summary', subjectId],
    queryFn: () => coordinatorApi.getAttendanceSummary({ subject_id: subjectId }),
    enabled: !!subjectId,
  });

  const filtered = useMemo(() => {
    let rows = summary.filter((s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.enrollment_number?.toLowerCase().includes(search.toLowerCase())
    );
    if (sortBy === 'pct_asc')  rows = [...rows].sort((a, b) => a.percentage - b.percentage);
    if (sortBy === 'pct_desc') rows = [...rows].sort((a, b) => b.percentage - a.percentage);
    if (sortBy === 'name')     rows = [...rows].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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
          `${baseURL}/coordinator/attendance/summary/export?subject_id=${subjectId}`,
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
              {allBranchSubjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.code}) — Year {s.year}</option>
              ))}
            </select>
          </div>
          {subjectId && summary.length > 0 && (
            <>
              <div className="flex-1 min-w-40">
                <label className="label">Search</label>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Students" value={summary.length} />
            <StatCard label="Avg Attendance" value={`${avgPct}%`} color={getAttendanceColor(avgPct)} />
            <StatCard label="Above 75%" value={summary.filter((s) => s.percentage >= 75).length} color="text-green-600" />
            <StatCard label="Defaulters" value={defaulters.length} color={defaulters.length > 0 ? 'text-red-600' : 'text-gray-900'} />
          </div>

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

// ─── CHARTS TAB ───────────────────────────────────────────────────────────────
const ChartsTab = ({ allBranchSubjects }) => {
  const [subjectId, setSubjectId] = useState('');

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ['coord-attendance-summary', subjectId],
    queryFn: () => coordinatorApi.getAttendanceSummary({ subject_id: subjectId }),
    enabled: !!subjectId,
  });

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
    const present = summary.reduce((a, s) => a + (s.present || 0), 0);
    const absent  = summary.reduce((a, s) => a + (s.absent  || 0), 0);
    const late    = summary.reduce((a, s) => a + (s.late    || 0), 0);
    return [
      { name: 'Present', value: present, color: STATUS_COLORS.present.chart },
      { name: 'Absent',  value: absent,  color: STATUS_COLORS.absent.chart  },
      { name: 'Late',    value: late,    color: STATUS_COLORS.late.chart    },
    ].filter((d) => d.value > 0);
  }, [summary]);

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
          {allBranchSubjects.map((s) => (
            <option key={s._id} value={s._id}>{s.name} ({s.code}) — Year {s.year}</option>
          ))}
        </select>
      </div>

      {!subjectId && <EmptyState title="Select a subject" description="Choose a subject to see attendance charts." />}
      {subjectId && isLoading && <LoadingSpinner className="py-16" />}
      {subjectId && !isLoading && summary.length === 0 && <EmptyState title="No attendance data yet." />}

      {subjectId && !isLoading && summary.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pie */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Overall Status Distribution</h3>
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

            {/* Bucket bar */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Students by Attendance Range</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={buckets} barSize={32}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                    {buckets.map((b) => (
                      <Cell key={b.name}
                        fill={b.name === '0–40' || b.name === '40–60' ? '#dc2626' : b.name === '60–75' ? '#d97706' : '#16a34a'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom 5 */}
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
                        style={{
                          width: `${s.percentage}%`,
                          background: s.percentage >= 75 ? '#16a34a' : s.percentage >= 60 ? '#d97706' : '#dc2626',
                        }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full horizontal bar chart */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">All Students — Attendance %</h3>
            <ResponsiveContainer width="100%" height={Math.max(summary.length * 28, 200)}>
              <BarChart data={summary} layout="vertical" barSize={14}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="percentage" name="Attendance" radius={[0, 4, 4, 0]}>
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
const CoordinatorAttendance = () => {
  const { user } = useAuthStore();
  const branches = user?.coordinator_branches || [];
  const [tab, setTab] = useState('mark');

  // Fetch my subjects (for Mark tab — faculty context)
  const { data: mySubjects = [], isLoading: loadingMine } = useQuery({
    queryKey: ['coord-my-subjects'],
    queryFn: coordinatorApi.getMySubjects,
  });

  // Fetch all branch subjects (for Summary + Charts tabs)
  const { data: allBranchSubjects = [], isLoading: loadingBranch } = useQuery({
    queryKey: ['coord-branch-subjects'],
    queryFn: coordinatorApi.getBranchSubjects,
  });

  const loading = loadingMine || loadingBranch;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Attendance"
        description="Mark attendance for your subjects, view branch-wide records, and track trends."
      />

      {/* Quick stat overview */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="My Subjects"     value={mySubjects.length} />
          <StatCard label="Branch Subjects" value={allBranchSubjects.length} />
          <StatCard label="Branches"        value={branches.length} />
          <StatCard label="Today"
            value={new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} />
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner className="py-16" /> : (
        <>
          {tab === 'mark'    && <MarkTab    mySubjects={mySubjects} />}
          {tab === 'branch'  && <BranchTab  branches={branches} />}
          {tab === 'summary' && <SummaryTab allBranchSubjects={allBranchSubjects} />}
          {tab === 'charts'  && <ChartsTab  allBranchSubjects={allBranchSubjects} />}
        </>
      )}
    </div>
  );
};

export default CoordinatorAttendance;
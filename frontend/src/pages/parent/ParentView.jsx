import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { parentApi } from '../../api/parent.api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  Bell, User, BookOpen, AlertCircle, CheckCircle2, TrendingUp, TrendingDown,
  CalendarDays, Award, BarChart3, GraduationCap, Home, ChevronRight,
  Menu, X, Activity,
} from 'lucide-react';
import {
  RadialBarChart, RadialBar, ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { useState, useMemo } from 'react';

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  teal:     '#0EA5E9',
  tealDk:   '#0284C7',
  tealLt:   '#E0F2FE',
  tealMid:  '#38BDF8',
  emerald:  '#10B981',
  emerLt:   '#D1FAE5',
  amber:    '#F59E0B',
  amberLt:  '#FEF3C7',
  rose:     '#F43F5E',
  roseLt:   '#FFE4E6',
  slate:    '#0F172A',
  slate2:   '#1E293B',
  muted:    '#64748B',
  border:   '#E2E8F0',
  bg:       '#F8FAFC',
  white:    '#FFFFFF',
};

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const attColor = (pct) => {
  if (pct >= 75) return C.emerald;
  if (pct >= 60) return C.amber;
  return C.rose;
};

const attBg = (pct) => {
  if (pct >= 75) return C.emerLt;
  if (pct >= 60) return C.amberLt;
  return C.roseLt;
};

// ── Sidebar nav items ──────────────────────────────────────────────────────
const NAV = [
  { id: 'overview',      label: 'Overview',        icon: Home },
  { id: 'attendance',   label: 'Attendance',       icon: CalendarDays },
  { id: 'marks',        label: 'Subject Marks',    icon: BarChart3 },
  { id: 'results',      label: 'Final Results',    icon: GraduationCap },
  { id: 'notices',      label: 'Notices',          icon: Bell },
];

// ── Styles ─────────────────────────────────────────────────────────────────
const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  .pv { min-height: 100vh; background: ${C.bg}; font-family: Inter, system-ui, sans-serif; display: flex; flex-direction: column; }

  /* Top header bar */
  .pv-topbar {
    height: 56px; background: ${C.white}; border-bottom: 1px solid ${C.border};
    display: flex; align-items: center; padding: 0 16px; gap: 12px;
    position: sticky; top: 0; z-index: 30; flex-shrink: 0;
  }
  .pv-logo { font-size: 15px; font-weight: 700; color: ${C.tealDk}; letter-spacing: -0.3px; }
  .pv-student-pill {
    margin-left: auto; display: flex; align-items: center; gap: 8px;
    background: ${C.tealLt}; border-radius: 99px; padding: 5px 12px 5px 8px;
  }
  .pv-student-pill-avatar {
    width: 26px; height: 26px; border-radius: 50%; background: ${C.tealDk};
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .pv-student-pill-name { font-size: 12px; font-weight: 600; color: ${C.tealDk}; white-space: nowrap; max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
  .pv-menu-btn { display: none; background: none; border: none; cursor: pointer; padding: 6px; border-radius: 8px; }
  @media (max-width: 767px) { .pv-menu-btn { display: flex; align-items: center; } }

  /* Body = sidebar + content */
  .pv-body { display: flex; flex: 1; min-height: 0; }

  /* Sidebar */
  .pv-sidebar {
    width: 220px; flex-shrink: 0; background: ${C.white}; border-right: 1px solid ${C.border};
    display: flex; flex-direction: column; padding: 16px 10px;
    position: sticky; top: 56px; height: calc(100vh - 56px); overflow-y: auto;
  }
  @media (max-width: 767px) {
    .pv-sidebar {
      position: fixed; top: 56px; left: 0; bottom: 0; z-index: 20;
      transform: translateX(-100%); transition: transform 0.25s ease;
      height: calc(100vh - 56px); width: 240px;
    }
    .pv-sidebar.open { transform: translateX(0); }
    .pv-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 19; display: none; }
    .pv-overlay.open { display: block; }
  }

  .pv-nav-item {
    display: flex; align-items: center; gap: 10px; padding: 9px 12px;
    border-radius: 10px; cursor: pointer; color: ${C.muted};
    font-size: 13px; font-weight: 500; transition: all 0.15s; user-select: none;
    margin-bottom: 2px;
  }
  .pv-nav-item:hover { background: ${C.bg}; color: ${C.slate2}; }
  .pv-nav-item.active { background: ${C.tealLt}; color: ${C.tealDk}; font-weight: 600; }
  .pv-nav-badge {
    margin-left: auto; background: ${C.rose}; color: #fff;
    font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 99px;
  }
  .pv-sidebar-section { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.6px; padding: 12px 12px 6px; }

  /* Main content */
  .pv-content { flex: 1; min-width: 0; padding: 24px 24px 48px; display: flex; flex-direction: column; gap: 20px; }
  @media (max-width: 640px) { .pv-content { padding: 16px 14px 48px; } }

  /* Page title */
  .pv-page-title { font-size: 18px; font-weight: 700; color: ${C.slate}; margin-bottom: 4px; }
  .pv-page-sub { font-size: 12px; color: ${C.muted}; }

  /* Stat cards row */
  .pv-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; }
  .pv-stat-card {
    background: ${C.white}; border: 1px solid ${C.border}; border-radius: 12px;
    padding: 14px; display: flex; flex-direction: column; gap: 4px;
  }
  .pv-stat-label { font-size: 11px; color: ${C.muted}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
  .pv-stat-value { font-size: 24px; font-weight: 700; line-height: 1; }
  .pv-stat-sub { font-size: 11px; color: ${C.muted}; }

  /* Card */
  .pv-card { background: ${C.white}; border: 1px solid ${C.border}; border-radius: 12px; overflow: hidden; }
  .pv-card-header { padding: 14px 16px; border-bottom: 1px solid ${C.border}; display: flex; align-items: center; gap: 8px; }
  .pv-card-title { font-size: 13px; font-weight: 700; color: ${C.slate}; text-transform: uppercase; letter-spacing: 0.4px; }
  .pv-card-body { padding: 16px; }

  /* Tabs */
  .pv-tabs { display: flex; gap: 4px; background: ${C.bg}; border-radius: 10px; padding: 4px; margin-bottom: 16px; }
  .pv-tab { flex: 1; text-align: center; font-size: 12px; font-weight: 600; padding: 7px 4px; border-radius: 8px; cursor: pointer; color: ${C.muted}; transition: all 0.15s; }
  .pv-tab.active { background: ${C.white}; color: ${C.slate}; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }

  /* Subject row */
  .pv-sub-row { display: flex; flex-direction: column; gap: 8px; padding: 14px; background: ${C.bg}; border: 1px solid ${C.border}; border-radius: 12px; }
  .pv-bar-track { flex: 1; background: ${C.border}; border-radius: 99px; height: 6px; overflow: hidden; }
  .pv-bar-fill { height: 100%; border-radius: 99px; transition: width 0.6s ease; }

  /* Alert */
  .pv-alert { display: flex; gap: 10px; align-items: center; padding: 10px 14px; border-radius: 10px; font-size: 12px; font-weight: 500; }
  .pv-alert-danger { background: ${C.roseLt}; color: ${C.rose}; border: 1px solid #FECDD3; }
  .pv-alert-warn { background: ${C.amberLt}; color: #92400E; border: 1px solid #FDE68A; }

  /* Chips */
  .pv-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 99px; }
  .pv-chip-danger { background: ${C.roseLt}; color: ${C.rose}; border: 1px solid #FECDD3; }
  .pv-chip-success { background: ${C.emerLt}; color: #065F46; border: 1px solid #A7F3D0; }
  .pv-chip-warn { background: ${C.amberLt}; color: #78350F; border: 1px solid #FDE68A; }
  .pv-chip-prov { background: #FEF9C3; color: #713F12; border: 1px solid #FEF08A; }

  /* Notice item */
  .pv-notice { display: flex; gap: 12px; align-items: flex-start; padding: 14px; }
  .pv-notice + .pv-notice { border-top: 1px solid ${C.border}; }
  .pv-notice-icon { width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }

  /* Radial helper */
  .pv-radial-wrap { position: relative; flex-shrink: 0; }
  .pv-radial-label { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }

  /* SGPA scroll */
  .pv-sem-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
  .pv-sem-pill { flex-shrink: 0; min-width: 58px; text-align: center; background: ${C.bg}; border: 1px solid ${C.border}; border-radius: 10px; padding: 8px 6px; }

  .pv-section-divider { height: 1px; background: ${C.border}; margin: 4px 0; }

  /* Two column grid for charts */
  .pv-chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }

  /* Footer badge */
  .pv-footer { display: flex; justify-content: center; padding-top: 8px; }
  .pv-footer-badge { display: inline-flex; align-items: center; gap: 6px; background: ${C.bg}; border: 1px solid ${C.border}; border-radius: 99px; padding: 6px 14px; }
`;

// ── Mini components ────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color = C.slate, icon: Icon, bg }) => (
  <div className="pv-stat-card">
    {Icon && (
      <div style={{ width: 30, height: 30, borderRadius: 8, background: bg || C.tealLt, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
        <Icon size={14} color={color} />
      </div>
    )}
    <p className="pv-stat-label">{label}</p>
    <p className="pv-stat-value" style={{ color }}>{value}</p>
    {sub && <p className="pv-stat-sub">{sub}</p>}
  </div>
);

const SectionHead = ({ icon: Icon, title, right }) => (
  <div className="pv-card-header">
    <Icon size={16} color={C.teal} />
    <span className="pv-card-title">{title}</span>
    {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
  </div>
);

// ── Radial chart ───────────────────────────────────────────────────────────
const AttRadial = ({ pct, size = 100 }) => {
  const color = attColor(pct);
  const data = [{ value: pct, fill: color }, { value: 100 - pct, fill: '#F1F5F9' }];
  return (
    <div className="pv-radial-wrap" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="100%"
          startAngle={90} endAngle={-270} data={data} barSize={10}>
          <RadialBar dataKey="value" cornerRadius={5} background={{ fill: '#F1F5F9' }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pv-radial-label">
        <span style={{ fontSize: 17, fontWeight: 700, color, lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 8, color: '#94A3B8', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Overall</span>
      </div>
    </div>
  );
};

// ── Attendance subject pie ─────────────────────────────────────────────────
const SubjectPie = ({ data }) => {
  if (!data?.length) return null;
  const top5 = [...data].sort((a, b) => (b.percentage || 0) - (a.percentage || 0)).slice(0, 5);
  const COLORS = [C.teal, C.emerald, C.amber, C.rose, '#8B5CF6'];
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={top5} dataKey="present" nameKey="subject_name" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
          {top5.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

// ── Monthly area chart ─────────────────────────────────────────────────────
const MonthlyChart = ({ data }) => {
  if (!data?.length) return <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '32px 0' }}>No monthly data yet.</p>;
  const avg = Math.round(data.reduce((s, d) => s + (d.percentage || 0), 0) / data.length);
  const lc = attColor(avg);
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>6-month trend</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: lc, background: attBg(avg), padding: '2px 8px', borderRadius: 99 }}>Avg {avg}%</span>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="mfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lc} stopOpacity={0.2} />
              <stop offset="100%" stopColor={lc} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="month_label" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#CBD5E1' }} axisLine={false} tickLine={false} width={28} />
          <Tooltip formatter={(v) => [`${v}%`, 'Attendance']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Area type="monotone" dataKey="percentage" stroke={lc} strokeWidth={2} fill="url(#mfill)" dot={{ r: 3, fill: lc, strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </>
  );
};

// ── Weekly stacked bar ─────────────────────────────────────────────────────
const WeeklyChart = ({ data }) => {
  if (!data?.length) return <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '32px 0' }}>No weekly data yet.</p>;
  const chartData = data.map((w, i) => ({ ...w, week: `W${i + 1}` }));
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: '#CBD5E1' }} axisLine={false} tickLine={false} width={28} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Bar dataKey="present" stackId="a" fill={C.emerald} name="Present" radius={[0, 0, 0, 0]} />
        <Bar dataKey="absent" stackId="a" fill={C.rose} name="Absent" />
        <Bar dataKey="late" stackId="a" fill={C.amber} name="Late" radius={[3, 3, 0, 0]} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── Subject attendance bar ─────────────────────────────────────────────────
const SubjectAttBar = ({ data }) => {
  if (!data?.length) return <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '32px 0' }}>No subject data yet.</p>;
  const sorted = [...data].sort((a, b) => (a.percentage || 0) - (b.percentage || 0));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.map((s, i) => {
        const color = attColor(s.percentage || 0);
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.slate2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{s.subject_name || s.subject_code}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>{s.percentage || 0}%</span>
            </div>
            <div className="pv-bar-track">
              <div className="pv-bar-fill" style={{ width: `${Math.min(100, s.percentage || 0)}%`, background: color }} />
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, marginTop: 4, color: C.muted }}>
              <span style={{ color: C.emerald }}>● {s.present || 0}P</span>
              <span style={{ color: C.rose }}>● {s.absent || 0}A</span>
              {(s.late || 0) > 0 && <span style={{ color: C.amber }}>● {s.late}L</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Marks bar chart per subject ────────────────────────────────────────────
const MarksBarChart = ({ marks }) => {
  if (!marks?.length) return null;
  const chartData = marks.map((s) => {
    const obt = s.components.reduce((sum, c) => sum + (c.total_marks || 0), 0);
    const max = s.components.reduce((sum, c) => sum + (c.max_marks || 0), 0);
    return { name: s.subject_code || s.subject_name?.slice(0, 8), obtained: obt, max, pct: max > 0 ? Math.round((obt / max) * 100) : 0 };
  });
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: '#CBD5E1' }} axisLine={false} tickLine={false} width={28} />
        <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Bar dataKey="obtained" name="Obtained" radius={[3, 3, 0, 0]}>
          {chartData.map((d, i) => <Cell key={i} fill={attColor(d.pct)} />)}
        </Bar>
        <Bar dataKey="max" name="Max" fill="#E2E8F0" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── SubjectMarksRow (expandable) ───────────────────────────────────────────
const SubjectMarksRow = ({ subject }) => {
  const [open, setOpen] = useState(false);
  const obt = subject.components.reduce((s, c) => s + (c.total_marks || 0), 0);
  const max = subject.components.reduce((s, c) => s + (c.max_marks || 0), 0);
  const pct = max > 0 ? Math.round((obt / max) * 100) : 0;
  const color = attColor(pct);

  return (
    <div className="pv-sub-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.tealLt, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BookOpen size={13} color={C.tealDk} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.slate2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subject.subject_name}</p>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{subject.subject_code}</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 6 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color, margin: 0 }}>{obt}/{max}</p>
          <p style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{pct}%</p>
        </div>
        <ChevronRight size={14} color="#94A3B8" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }} />
      </div>
      <div style={{ paddingLeft: 42 }}>
        <div className="pv-bar-track">
          <div className="pv-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
        </div>
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 42, paddingTop: 4 }}>
          {subject.components.map((c, i) => {
            const cPct = c.max_marks > 0 ? Math.round((c.total_marks / c.max_marks) * 100) : 0;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: C.muted, minWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.component_name || `Component ${i + 1}`}
                </span>
                <div className="pv-bar-track">
                  <div className="pv-bar-fill" style={{ width: `${Math.min(100, cPct)}%`, background: attColor(cPct) }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.slate2, minWidth: 52, textAlign: 'right', flexShrink: 0 }}>
                  {c.total_marks ?? '—'}/{c.max_marks ?? '—'}
                </span>
                {!c.locked && <span className="pv-chip pv-chip-prov">PROV.</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── OVERVIEW PAGE ──────────────────────────────────────────────────────────
const OverviewPage = ({ student, attendance, grades, marks, final_results, notices, onNav }) => {
  const overall = attendance?.overall || {};
  const overallPct = overall.percentage || 0;
  const totalObt = marks?.reduce((s, sub) => s + sub.components.reduce((ss, c) => ss + (c.total_marks || 0), 0), 0) || 0;
  const totalMax = marks?.reduce((s, sub) => s + sub.components.reduce((ss, c) => ss + (c.max_marks || 0), 0), 0) || 0;
  const marksPct = totalMax > 0 ? Math.round((totalObt / totalMax) * 100) : 0;
  const markColor = attColor(marksPct);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <p className="pv-page-title">Good day 👋</p>
        <p className="pv-page-sub">Academic summary for {student.name}</p>
      </div>

      {/* Quick stat cards */}
      <div className="pv-stat-grid">
        <StatCard label="Attendance" value={`${overallPct}%`} color={attColor(overallPct)} icon={CalendarDays} bg={attBg(overallPct)}
          sub={`${overall.present || 0} present · ${overall.absent || 0} absent`} />
        <StatCard label="Marks" value={`${marksPct}%`} color={markColor} icon={BarChart3} bg={attBg(marksPct)}
          sub={`${totalObt}/${totalMax} total`} />
        {grades?.sgpa?.sgpa && (
          <StatCard label="Current SGPA" value={grades.sgpa.sgpa.toFixed(2)} color={C.tealDk} icon={Award} bg={C.tealLt}
            sub="out of 10.00" />
        )}
        {grades?.cgpa?.cgpa && (
          <StatCard label="Overall CGPA" value={grades.cgpa.cgpa.toFixed(2)} color={C.tealDk} icon={Activity} bg={C.tealLt}
            sub="cumulative" />
        )}
      </div>

      {/* Attendance alert */}
      {overallPct < 75 && (
        <div className="pv-alert pv-alert-danger">
          <AlertCircle size={14} />
          Attendance is below the required 75% threshold. Please contact the department.
        </div>
      )}

      {/* Attendance + marks side by side overview */}
      <div className="pv-chart-grid">
        <div className="pv-card" style={{ cursor: 'pointer' }} onClick={() => onNav('attendance')}>
          <SectionHead icon={CalendarDays} title="Attendance" right={<ChevronRight size={14} color={C.muted} />} />
          <div className="pv-card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <AttRadial pct={overallPct} size={90} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Present', v: overall.present || 0, c: C.emerald },
                { label: 'Absent',  v: overall.absent  || 0, c: C.rose },
                { label: 'Late',    v: overall.late    || 0, c: C.amber },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.c, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.slate2 }}>{item.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pv-card" style={{ cursor: 'pointer' }} onClick={() => onNav('marks')}>
          <SectionHead icon={BarChart3} title="Subject marks" right={<ChevronRight size={14} color={C.muted} />} />
          <div className="pv-card-body">
            <MarksBarChart marks={marks} />
          </div>
        </div>
      </div>

      {/* Recent notice snippet */}
      {notices?.length > 0 && (
        <div className="pv-card" style={{ cursor: 'pointer' }} onClick={() => onNav('notices')}>
          <SectionHead icon={Bell} title="Latest notice" right={<ChevronRight size={14} color={C.muted} />} />
          <div className="pv-notice">
            <div className="pv-notice-icon" style={{ background: notices[0].priority === 'high' ? C.roseLt : C.tealLt }}>
              <Bell size={14} color={notices[0].priority === 'high' ? C.rose : C.teal} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.slate2, marginBottom: 2 }}>{notices[0].title}</p>
              {notices[0].body && <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{notices[0].body.slice(0, 100)}{notices[0].body.length > 100 ? '…' : ''}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── ATTENDANCE PAGE ────────────────────────────────────────────────────────
const AttendancePage = ({ attendance }) => {
  const [tab, setTab] = useState('overview');
  const overall = attendance?.overall || {};
  const subjectWise = attendance?.subject_wise || [];
  const monthly = attendance?.monthly || [];
  const weekly = attendance?.weekly || [];
  const pct = overall.percentage || 0;
  const weakest = subjectWise.length ? [...subjectWise].sort((a, b) => (a.percentage || 0) - (b.percentage || 0))[0] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <p className="pv-page-title">Attendance</p>
        <p className="pv-page-sub">Detailed attendance across subjects and time</p>
      </div>

      {pct < 75 && (
        <div className="pv-alert pv-alert-danger"><AlertCircle size={14} />Attendance below 75% — action required.</div>
      )}

      <div className="pv-stat-grid">
        <StatCard label="Overall" value={`${pct}%`} color={attColor(pct)} />
        <StatCard label="Present" value={overall.present || 0} color={C.emerald} />
        <StatCard label="Absent"  value={overall.absent  || 0} color={C.rose} />
        <StatCard label="Late"    value={overall.late    || 0} color={C.amber} />
      </div>

      {weakest && (
        <div className="pv-alert pv-alert-warn">
          <TrendingDown size={14} />
          Lowest subject: <strong style={{ marginLeft: 4 }}>{weakest.subject_name}</strong>
          <span style={{ marginLeft: 4 }}>at {weakest.percentage}%</span>
        </div>
      )}

      {/* Tabs */}
      <div className="pv-card">
        <div className="pv-card-body" style={{ paddingBottom: 0 }}>
          <div className="pv-tabs">
            {[['overview','Overview'],['subjects','Subjects'],['monthly','Monthly'],['weekly','Weekly']].map(([id, label]) => (
              <div key={id} className={`pv-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</div>
            ))}
          </div>
        </div>

        <div className="pv-card-body" style={{ paddingTop: 0 }}>
          {tab === 'overview' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <AttRadial pct={pct} size={110} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <SubjectPie data={subjectWise} />
              </div>
            </div>
          )}
          {tab === 'subjects' && <SubjectAttBar data={subjectWise} />}
          {tab === 'monthly'  && <MonthlyChart data={monthly} />}
          {tab === 'weekly'   && <WeeklyChart data={weekly} />}
        </div>
      </div>
    </div>
  );
};

// ── MARKS PAGE ─────────────────────────────────────────────────────────────
const MarksPage = ({ marks, grades }) => {
  const sorted = useMemo(() => {
    if (!marks) return [];
    return [...marks].sort((a, b) => {
      const pctOf = (s) => {
        const max = s.components.reduce((sum, c) => sum + (c.max_marks || 0), 0);
        const obt = s.components.reduce((sum, c) => sum + (c.total_marks || 0), 0);
        return max > 0 ? obt / max : 1;
      };
      return pctOf(a) - pctOf(b);
    });
  }, [marks]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <p className="pv-page-title">Subject marks</p>
        <p className="pv-page-sub">Component-wise marks across all subjects</p>
      </div>

      {/* SGPA/CGPA if available */}
      {(grades?.sgpa || grades?.cgpa) && (
        <div className="pv-card">
          <SectionHead icon={Award} title="Academic grades" />
          <div className="pv-card-body">
            <div className="pv-stat-grid" style={{ marginBottom: grades?.sgpa?.components?.length ? 14 : 0 }}>
              {grades.sgpa?.sgpa != null && (
                <StatCard label="Current SGPA" value={grades.sgpa.sgpa.toFixed(2)} color={C.tealDk} sub="/ 10.00" />
              )}
              {grades.cgpa?.cgpa != null && (
                <StatCard label="Overall CGPA" value={grades.cgpa.cgpa.toFixed(2)} color={C.tealDk} sub="cumulative" />
              )}
            </div>
            {grades.sgpa?.components?.length > 0 && (
              <>
                <div className="pv-section-divider" />
                <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '10px 0 8px' }}>Semester-wise SGPA</p>
                <div className="pv-sem-scroll">
                  {grades.sgpa.components.map((comp, i) => (
                    <div key={i} className="pv-sem-pill">
                      <p style={{ fontSize: 9, color: C.muted, fontWeight: 600, marginBottom: 3 }}>Sem {comp.semester}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: C.teal }}>{comp.sgpa.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Marks overview bar chart */}
      {sorted.length > 0 && (
        <div className="pv-card">
          <SectionHead icon={BarChart3} title="Marks overview" />
          <div className="pv-card-body">
            <MarksBarChart marks={sorted} />
          </div>
        </div>
      )}

      {/* Per-subject expandable rows */}
      <div className="pv-card">
        <SectionHead icon={BookOpen} title="Subject breakdown" />
        <div className="pv-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.length === 0 ? (
            <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '24px 0' }}>No marks recorded yet.</p>
          ) : sorted.map((s, i) => <SubjectMarksRow key={i} subject={s} />)}
        </div>
      </div>
    </div>
  );
};

// ── RESULTS PAGE ───────────────────────────────────────────────────────────
const ResultsPage = ({ final_results }) => {
  const chartData = final_results?.map((r) => ({ name: `Sem ${r.semester}`, value: r.value })) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <p className="pv-page-title">Final results</p>
        <p className="pv-page-sub">Published results by the department</p>
      </div>

      {!final_results?.length ? (
        <div className="pv-card">
          <div className="pv-card-body" style={{ textAlign: 'center', padding: '40px 16px' }}>
            <GraduationCap size={32} color="#CBD5E1" style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: 14, color: C.muted }}>No results published yet.</p>
          </div>
        </div>
      ) : (
        <>
          {chartData.length > 1 && (
            <div className="pv-card">
              <SectionHead icon={TrendingUp} title="Result trend" />
              <div className="pv-card-body">
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rfill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.teal} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={C.teal} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 9, fill: '#CBD5E1' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="value" stroke={C.teal} strokeWidth={2} fill="url(#rfill)" dot={{ r: 4, fill: C.teal, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {final_results.map((r) => {
              const color = r.value >= 8 ? C.emerald : r.value >= 6 ? C.amber : C.rose;
              return (
                <div key={r._id} className="pv-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: attBg(r.value * 10), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <GraduationCap size={18} color={color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.slate2, marginBottom: 2 }}>{r.config_name}</p>
                      <p style={{ fontSize: 11, color: C.muted }}>Semester {r.semester} · {fmtDate(r.published_at)}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{r.value.toFixed(2)}</p>
                      {r.metric_type && <p style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', marginTop: 2 }}>{r.metric_type}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// ── NOTICES PAGE ───────────────────────────────────────────────────────────
const NoticesPage = ({ notices }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div>
      <p className="pv-page-title">Notices</p>
      <p className="pv-page-sub">Recent announcements from the institution</p>
    </div>
    {!notices?.length ? (
      <div className="pv-card">
        <div className="pv-card-body" style={{ textAlign: 'center', padding: '40px 16px' }}>
          <Bell size={32} color="#CBD5E1" style={{ margin: '0 auto 10px' }} />
          <p style={{ fontSize: 14, color: C.muted }}>No notices at the moment.</p>
        </div>
      </div>
    ) : (
      <div className="pv-card">
        {notices.map((n) => (
          <div key={n._id} className="pv-notice">
            <div className="pv-notice-icon" style={{ background: n.priority === 'high' ? C.roseLt : C.tealLt }}>
              <Bell size={14} color={n.priority === 'high' ? C.rose : C.teal} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.slate2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</p>
                {n.priority === 'high' && <span className="pv-chip pv-chip-danger">URGENT</span>}
              </div>
              {n.body && <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.55, marginBottom: 4 }}>{n.body}</p>}
              <p style={{ fontSize: 11, color: '#94A3B8' }}>{fmtDate(n.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ── ROOT COMPONENT ─────────────────────────────────────────────────────────
const ParentView = () => {
  const { token } = useParams();
  const [page, setPage] = useState('overview');
  const [sideOpen, setSideOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['parent-view', token],
    queryFn: () => parentApi.getParentView(token),
    retry: false,
  });

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: C.roseLt, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <AlertCircle size={24} color={C.rose} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.slate2, marginBottom: 6 }}>Link invalid or expired</p>
          <p style={{ fontSize: 13, color: C.muted }}>
            {error?.message || 'Please contact the institution for a new link.'}
          </p>
        </div>
      </div>
    );
  }

  const { student, attendance, marks, grades, final_results, recent_notices } = data;
  const overallPct = attendance?.overall?.percentage || 0;
  const unreadNotices = recent_notices?.filter(n => n.priority === 'high')?.length || 0;

  const navTo = (id) => { setPage(id); setSideOpen(false); };

  return (
    <>
      <style>{STYLES}</style>
      <div className="pv">

        {/* Top bar */}
        <header className="pv-topbar">
          <button className="pv-menu-btn" onClick={() => setSideOpen(!sideOpen)} aria-label="Toggle menu">
            {sideOpen ? <X size={20} color={C.muted} /> : <Menu size={20} color={C.muted} />}
          </button>
          <span className="pv-logo">CampusCMS</span>
          <div className="pv-student-pill">
            <div className="pv-student-pill-avatar">
              <User size={12} color="#fff" />
            </div>
            <span className="pv-student-pill-name">{student.name}</span>
            <span style={{ fontSize: 11, color: C.muted, marginLeft: 2 }}>· Sem {student.semester}</span>
          </div>
        </header>

        <div className="pv-body">
          {/* Mobile overlay */}
          <div className={`pv-overlay ${sideOpen ? 'open' : ''}`} onClick={() => setSideOpen(false)} />

          {/* Sidebar */}
          <nav className={`pv-sidebar ${sideOpen ? 'open' : ''}`}>
            <div className="pv-sidebar-section">Navigation</div>
            {NAV.map(({ id, label, icon: Icon }) => (
              <div
                key={id}
                className={`pv-nav-item ${page === id ? 'active' : ''}`}
                onClick={() => navTo(id)}
              >
                <Icon size={16} />
                {label}
                {id === 'attendance' && overallPct < 75 && (
                  <span className="pv-nav-badge">!</span>
                )}
                {id === 'notices' && unreadNotices > 0 && (
                  <span className="pv-nav-badge">{unreadNotices}</span>
                )}
              </div>
            ))}

            <div style={{ marginTop: 'auto', paddingTop: 16 }}>
              <div className="pv-section-divider" />
              <div style={{ padding: '12px 12px 0', fontSize: 11, color: '#94A3B8' }}>
                <p style={{ fontWeight: 600, color: C.muted, marginBottom: 2 }}>{student.name}</p>
                <p>{student.enrollment_number}</p>
                <p>{student.branch} · Year {student.year}</p>
                {student.section && <p>Section {student.section}</p>}
              </div>
            </div>
          </nav>

          {/* Main content */}
          <main className="pv-content">
            {page === 'overview'    && <OverviewPage student={student} attendance={attendance} grades={grades} marks={marks} final_results={final_results} notices={recent_notices} onNav={navTo} />}
            {page === 'attendance'  && <AttendancePage attendance={attendance} />}
            {page === 'marks'       && <MarksPage marks={marks} grades={grades} />}
            {page === 'results'     && <ResultsPage final_results={final_results} />}
            {page === 'notices'     && <NoticesPage notices={recent_notices} />}

            <div className="pv-footer">
              <div className="pv-footer-badge">
                <CheckCircle2 size={11} color="#94A3B8" />
                <span style={{ fontSize: 11, color: '#94A3B8' }}>Read-only · CampusCMS</span>
              </div>
            </div>
          </main>
        </div>

      </div>
    </>
  );
};

export default ParentView;
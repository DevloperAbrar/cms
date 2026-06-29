import { useQuery } from '@tanstack/react-query';
import { superadminApi } from '../../api/superadmin.api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  Users, BookOpen, GitBranch, School, ClipboardList, UserCog,
  TrendingUp, Bell, ShieldCheck, Activity, ChevronRight, AlertCircle,
  BarChart2, Layers, GraduationCap
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

// ─── Design tokens ────────────────────────────────────────────────────────────
// Palette: Deep navy (#0F172A) base, electric indigo (#6366F1) primary,
// emerald (#10B981) positive, amber (#F59E0B) warning, rose (#F43F5E) alert
// Typography: Inter via system stack; display numbers in tabular-nums

const COLORS = {
  indigo: '#6366F1',
  emerald: '#10B981',
  amber:   '#F59E0B',
  rose:    '#F43F5E',
  cyan:    '#06B6D4',
  violet:  '#8B5CF6',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const KpiCard = ({ label, value, icon: Icon, accent, delta, sub }) => (
  <div style={{
    background: '#fff',
    borderRadius: 16,
    padding: '20px 24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    border: '1px solid #F1F5F9',
    position: 'relative',
    overflow: 'hidden',
  }}>
    {/* accent stripe */}
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: 3, background: accent, borderRadius: '16px 16px 0 0',
    }} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: accent + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} color={accent} strokeWidth={2} />
      </div>
      {delta != null && (
        <span style={{
          fontSize: 11, fontWeight: 600, color: delta >= 0 ? COLORS.emerald : COLORS.rose,
          background: (delta >= 0 ? COLORS.emerald : COLORS.rose) + '15',
          borderRadius: 20, padding: '2px 8px',
        }}>
          {delta >= 0 ? '+' : ''}{delta}%
        </span>
      )}
    </div>
    <div>
      <p style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.5px', lineHeight: 1 }}>
        {value ?? <span style={{ opacity: 0.3 }}>—</span>}
      </p>
      <p style={{ fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: 500 }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{sub}</p>}
    </div>
  </div>
);

const SectionCard = ({ title, children, action }) => (
  <div style={{
    background: '#fff', borderRadius: 16,
    boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)',
    border: '1px solid #F1F5F9', overflow: 'hidden',
  }}>
    <div style={{
      padding: '16px 20px',
      borderBottom: '1px solid #F1F5F9',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', margin: 0 }}>{title}</h3>
      {action && (
        <button style={{
          fontSize: 12, color: COLORS.indigo, background: 'none',
          border: 'none', cursor: 'pointer', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          {action} <ChevronRight size={12} />
        </button>
      )}
    </div>
    <div style={{ padding: 20 }}>{children}</div>
  </div>
);

const RoleBadge = ({ role }) => {
  const map = {
    faculty: { color: COLORS.indigo, label: 'Faculty' },
    student: { color: COLORS.emerald, label: 'Student' },
    hod:     { color: COLORS.violet, label: 'HOD' },
    coordinator: { color: COLORS.cyan, label: 'Coordinator' },
    examcontroller: { color: COLORS.amber, label: 'Exam Controller' },
  };
  const { color, label } = map[role] || { color: '#94A3B8', label: role };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color,
      background: color + '15', borderRadius: 20, padding: '2px 8px',
    }}>{label}</span>
  );
};

// ─── Custom tooltip for charts ─────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0F172A', borderRadius: 8, padding: '8px 12px',
      color: '#fff', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────

const SuperAdminDashboard = () => {
  const { data: streams = [], isLoading: ls } = useQuery({
    queryKey: ['streams'],
    queryFn: superadminApi.getStreams,
  });
  const { data: departments = [], isLoading: ld } = useQuery({
    queryKey: ['departments'],
    queryFn: superadminApi.getDepartments,
  });
  const { data: branches = [], isLoading: lb } = useQuery({
    queryKey: ['branches'],
    queryFn: superadminApi.getBranches,
  });
  const { data: faculty = [], isLoading: lf } = useQuery({
    queryKey: ['users', 'faculty'],
    queryFn: () => superadminApi.getUsers({ role: 'faculty' }),
  });
  const { data: students = [], isLoading: lst } = useQuery({
    queryKey: ['users', 'student'],
    queryFn: () => superadminApi.getUsers({ role: 'student' }),
  });
  const { data: hods = [] } = useQuery({
    queryKey: ['users', 'hod'],
    queryFn: () => superadminApi.getUsers({ role: 'hod' }),
  });
  const { data: coordinators = [] } = useQuery({
    queryKey: ['users', 'coordinator'],
    queryFn: () => superadminApi.getUsers({ role: 'coordinator' }),
  });
  const { data: notices = [] } = useQuery({
    queryKey: ['admin-notices'],
    queryFn: superadminApi.getNotices,
  });
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => superadminApi.getAuditLogs({ limit: 8 }),
  });

  const isLoading = ls || ld || lb || lf || lst;

  // Compute dept → student count for bar chart
  const deptStudentData = departments.slice(0, 6).map((dept) => ({
    name: dept.code || dept.name?.slice(0, 5),
    students: students.filter((s) => s.department_id?._id === dept._id || s.department_id === dept._id).length,
    faculty: faculty.filter((f) => f.department_id?._id === dept._id || f.department_id === dept._id).length,
  }));

  // Pie data: user roles
  const rolePieData = [
    { name: 'Students', value: students.length, color: COLORS.emerald },
    { name: 'Faculty',  value: faculty.length,  color: COLORS.indigo },
    { name: 'HODs',     value: hods.length,      color: COLORS.violet },
    { name: 'Coords',   value: coordinators.length, color: COLORS.cyan },
  ].filter(d => d.value > 0);

  // Recent user activity from audit logs
  const recentLogs = Array.isArray(auditLogs?.logs) ? auditLogs.logs : [];

  // Active vs inactive students
  const activeStudents = students.filter(s => s.status === 'active').length;
  const inactiveStudents = students.length - activeStudents;

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
      <LoadingSpinner />
    </div>
  );

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 13, color: '#94A3B8', fontWeight: 500, marginBottom: 4 }}>
            {greeting}, Super Admin
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
            System Overview
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
            {now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#F0FDF4', border: '1px solid #BBF7D0',
          borderRadius: 10, padding: '8px 14px',
        }}>
          <ShieldCheck size={14} color={COLORS.emerald} />
          <span style={{ fontSize: 12, color: COLORS.emerald, fontWeight: 600 }}>System Operational</span>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Streams"     value={streams.length}     icon={School}      accent={COLORS.indigo} />
        <KpiCard label="Departments" value={departments.length} icon={Layers}      accent={COLORS.violet} />
        <KpiCard label="Branches"    value={branches.length}    icon={GitBranch}   accent={COLORS.cyan}   />
        <KpiCard label="Faculty"     value={faculty.length}     icon={UserCog}     accent={COLORS.amber}  />
        <KpiCard label="Students"    value={students.length}    icon={GraduationCap} accent={COLORS.emerald}
          sub={`${activeStudents} active · ${inactiveStudents} inactive`}
        />
        <KpiCard label="HODs"        value={hods.length}        icon={ClipboardList} accent={COLORS.rose}  />
      </div>

      {/* ── Charts Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Dept breakdown */}
        <SectionCard title="Department Distribution">
          {deptStudentData.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', padding: '32px 0', fontSize: 13 }}>
              No department data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptStudentData} barGap={4} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F8FAFC' }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="students" name="Students" fill={COLORS.emerald} radius={[4,4,0,0]} />
                <Bar dataKey="faculty"  name="Faculty"  fill={COLORS.indigo}  radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Role pie */}
        <SectionCard title="User Composition">
          {rolePieData.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', padding: '32px 0', fontSize: 13 }}>
              No users yet.
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie data={rolePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    dataKey="value" paddingAngle={3}>
                    {rolePieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {rolePieData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                      <span style={{ fontSize: 12, color: '#475569' }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{d.value}</span>
                  </div>
                ))}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#94A3B8' }}>Total users</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                      {rolePieData.reduce((s, d) => s + d.value, 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Bottom Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Recent Notices */}
        <SectionCard title="Recent Notices" action="View all">
          {notices.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '24px 0' }}>No notices posted yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notices.slice(0, 5).map((n) => (
                <div key={n._id} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '10px 12px', borderRadius: 10,
                  background: n.priority === 'high' ? '#FFF7ED' : '#F8FAFC',
                  border: `1px solid ${n.priority === 'high' ? '#FED7AA' : '#F1F5F9'}`,
                }}>
                  <Bell size={14} color={n.priority === 'high' ? COLORS.amber : '#94A3B8'} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</p>
                    <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                      {new Date(n.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {n.priority === 'high' && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.amber, background: '#FEF3C7', borderRadius: 4, padding: '1px 6px' }}>HIGH</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Audit Log */}
        <SectionCard title="Recent Activity" action="Full logs">
          {recentLogs.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '24px 0' }}>No activity logged yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentLogs.slice(0, 6).map((log, i) => (
                <div key={log._id || i} style={{
                  display: 'flex', gap: 10, alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: i < recentLogs.length - 1 ? '1px solid #F1F5F9' : 'none',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Activity size={12} color="#6366F1" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.actor_name || 'System'}
                      <span style={{ fontWeight: 400, color: '#64748B' }}> · {log.action}</span>
                    </p>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                      <RoleBadge role={log.actor_role} />
                      <span style={{ fontSize: 10, color: '#94A3B8' }}>
                        {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Streams & Dept quick table ── */}
      <div style={{ marginTop: 20 }}>
        <SectionCard title="Academic Structure">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  {['Stream', 'Code', 'Departments', 'Branches'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {streams.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: '#94A3B8' }}>No streams configured yet.</td>
                  </tr>
                ) : streams.map((stream, i) => {
                  const depts = departments.filter(d => d.stream_id?._id === stream._id || d.stream_id === stream._id);
                  const deptIds = depts.map(d => d._id);
                  const branchCount = branches.filter(b => deptIds.includes(b.department_id?._id) || deptIds.includes(b.department_id)).length;
                  return (
                    <tr key={stream._id} style={{ background: i % 2 === 0 ? '#FAFAFA' : '#fff' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1E293B' }}>{stream.name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, background: '#EEF2FF', color: COLORS.indigo, padding: '2px 8px', borderRadius: 4 }}>{stream.code}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>{depts.length}</td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>{branchCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

    </div>
  );
};

export default SuperAdminDashboard;
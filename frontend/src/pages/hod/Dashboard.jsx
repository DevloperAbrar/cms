import { useQuery } from '@tanstack/react-query';
import { hodApi } from '../../api/hod.api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  Users, BookOpen, Bell, MessageSquare, ChevronRight,
  AlertCircle, UserCheck, UserX, CheckCircle2, TrendingUp,
  GraduationCap, Shield, Zap,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
  PieChart, Pie,
} from 'recharts';
import { Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

// ─── Design tokens (mirrors StudentDashboard) ─────────────────────────────────
const C = {
  teal:    '#0EA5E9',
  tealDk:  '#0284C7',
  tealLt:  '#E0F2FE',
  emerald: '#10B981',
  amber:   '#F59E0B',
  rose:    '#F43F5E',
  violet:  '#8B5CF6',
  slate:   '#0F172A',
  indigo:  '#6366F1',
};

// ─── Responsive styles ────────────────────────────────────────────────────────
const STYLES = `
  .hod-root {
    padding: 20px 16px;
    max-width: 1300px;
    margin: 0 auto;
    font-family: Inter, system-ui, sans-serif;
    box-sizing: border-box;
  }
  @media (min-width: 640px)  { .hod-root { padding: 24px 24px; } }
  @media (min-width: 1024px) { .hod-root { padding: 28px 32px; } }

  .hod-header {
    margin-bottom: 22px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  @media (min-width: 640px) {
    .hod-header { flex-direction: row; justify-content: space-between; align-items: flex-start; }
  }
  .hod-header-badges { display: flex; gap: 8px; flex-wrap: wrap; }

  /* Stats grid — 2 cols mobile, 3 tablet, 6 desktop */
  .hod-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }
  @media (min-width: 640px)  { .hod-stats { grid-template-columns: repeat(3, 1fr); } }
  @media (min-width: 1100px) { .hod-stats { grid-template-columns: repeat(6, 1fr); } }

  /* Mid: charts row */
  .hod-mid {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 16px;
  }
  @media (min-width: 768px) { .hod-mid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; } }

  /* Bottom: lists row */
  .hod-bottom {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  @media (min-width: 768px) { .hod-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; } }

  /* Three-col bottom on big screens */
  @media (min-width: 1100px) { .hod-bottom { grid-template-columns: 1fr 1fr 1fr; } }

  /* Stat card */
  .hod-stat-card {
    background: #fff;
    border-radius: 14px;
    padding: 14px 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.03);
    border: 1px solid #F1F5F9;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .hod-stat-icon {
    width: 32px; height: 32px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
  }
  .hod-stat-value {
    font-size: 20px; font-weight: 700; color: #0F172A;
    margin: 0; font-variant-numeric: tabular-nums; line-height: 1;
  }
  @media (max-width: 480px) { .hod-stat-value { font-size: 17px; } }
  .hod-stat-label {
    font-size: 10px; color: #64748B; font-weight: 500; margin-top: 3px; line-height: 1.3;
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';

// ─── Card shells ─────────────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{
    background: '#fff', borderRadius: 16,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
    border: '1px solid #F1F5F9', ...style,
  }}>
    {children}
  </div>
);

const CardHeader = ({ title, action, to }) => (
  <div style={{
    padding: '13px 16px', borderBottom: '1px solid #F1F5F9',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  }}>
    <h3 style={{ fontSize: 13, fontWeight: 600, color: C.slate, margin: 0 }}>{title}</h3>
    {action && (
      to ? (
        <Link to={to} style={{ fontSize: 11, color: C.teal, textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>
          {action} <ChevronRight size={11} />
        </Link>
      ) : (
        <button style={{ fontSize: 11, color: C.teal, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>
          {action} <ChevronRight size={11} />
        </button>
      )
    )}
  </div>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1E293B', borderRadius: 8, padding: '7px 12px', color: '#fff', fontSize: 11 }}>
      <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => <p key={i} style={{ margin: 0 }}>{p.name}: {p.value}</p>)}
    </div>
  );
};

// ─── Faculty Attendance Donut ─────────────────────────────────────────────────
const FacultyDonut = ({ present, absent, late, total }) => {
  const data = [
    { name: 'Present', value: present, fill: C.emerald },
    { name: 'Absent',  value: absent,  fill: C.rose },
    { name: 'Late',    value: late,    fill: C.amber },
    { name: 'Unknown', value: Math.max(0, total - present - absent - late), fill: '#E2E8F0' },
  ].filter((d) => d.value > 0);

  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const color = pct >= 90 ? C.emerald : pct >= 75 ? C.amber : C.rose;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={32} outerRadius={46} dataKey="value" strokeWidth={0}>
              {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1 }}>{pct}%</span>
          <span style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>TODAY</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: 'Present', value: present, color: C.emerald },
          { label: 'Absent',  value: absent,  color: C.rose },
          { label: 'Late',    value: late,    color: C.amber },
        ].map((row) => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: row.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#64748B', minWidth: 50 }}>{row.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', fontVariantNumeric: 'tabular-nums' }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const HODDashboard = () => {
  const { user } = useAuthStore();

  const { data: students = [], isLoading: ls } = useQuery({
    queryKey: ['hod-dept-students'],
    queryFn: hodApi.getDeptStudents,
  });

  const { data: faculty = [], isLoading: lf } = useQuery({
    queryKey: ['hod-dept-faculty'],
    queryFn: hodApi.getDeptFaculty,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['hod-dept-branches'],
    queryFn: hodApi.getDeptBranches,
  });

  const { data: notices = [], isLoading: ln } = useQuery({
    queryKey: ['hod-notices'],
    queryFn: hodApi.getNotices,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['hod-messages'],
    queryFn: hodApi.getMessages,
  });

  // Faculty attendance summary for today
  const { data: facAttSummary } = useQuery({
    queryKey: ['hod-faculty-att-today'],
    queryFn: () => hodApi.getFacultyAttendanceSummary({ date: new Date().toISOString().slice(0, 10) }),
  });

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'HOD';

  // Derived counts
  const coordinators = faculty.filter((f) => f.role === 'coordinator');
  const unreadMessages = messages.filter(
    (m) => !m.read_at && m.recipient_id?._id === user?._id
  ).length;
  const highPriorityNotices = notices.filter((n) => n.priority === 'high').length;

  // Today's faculty attendance
  const todaySummary = facAttSummary?.summary || [];
  const facPresent = todaySummary.filter((f) => f.status === 'present').length;
  const facAbsent  = todaySummary.filter((f) => f.status === 'absent').length;
  const facLate    = todaySummary.filter((f) => f.status === 'late').length;
  const facTotal   = todaySummary.length;
  const facNotMarked = todaySummary.filter((f) => f.status === null).length;

  // Students per branch bar chart
  const branchStudentData = branches.map((b) => ({
    name: b.code || b.name?.slice(0, 6),
    fullName: b.name,
    count: students.filter((s) => s.branch_id?._id === b._id || s.branch_id === b._id).length,
  }));

  const statsConfig = [
    { label: 'Total Students', value: students.length, icon: GraduationCap, accent: C.teal },
    { label: 'Faculty',        value: faculty.length - coordinators.length, icon: Users, accent: C.violet },
    { label: 'Coordinators',   value: coordinators.length, icon: UserCheck, accent: C.indigo },
    { label: 'Branches',       value: branches.length, icon: BookOpen, accent: C.emerald },
    { label: 'Unread Messages',value: unreadMessages, icon: MessageSquare, accent: C.amber },
    { label: 'High-Priority Notices', value: highPriorityNotices, icon: Bell, accent: C.rose },
  ];

  return (
    <>
      <style>{STYLES}</style>
      <div className="hod-root">

        {/* ── Header ── */}
        <div className="hod-header">
          <div>
            <p style={{ fontSize: 13, color: '#94A3B8', fontWeight: 500, margin: 0 }}>{greeting}</p>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.slate, margin: '2px 0 0', letterSpacing: '-0.3px' }}>
              HOD Dashboard
            </h1>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 4, marginBottom: 0 }}>
              {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              {user?.department_id?.name && ` · ${user.department_id.name}`}
            </p>
          </div>
          <div className="hod-header-badges">
            {highPriorityNotices > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 10, padding: '7px 12px' }}>
                <AlertCircle size={12} color={C.rose} />
                <span style={{ fontSize: 12, color: C.rose, fontWeight: 600 }}>{highPriorityNotices} urgent notice{highPriorityNotices !== 1 ? 's' : ''}</span>
              </div>
            )}
            {facNotMarked > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '7px 12px' }}>
                <Zap size={12} color={C.amber} />
                <span style={{ fontSize: 12, color: C.amber, fontWeight: 600 }}>{facNotMarked} attendance pending</span>
              </div>
            )}
            {unreadMessages > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10, padding: '7px 12px' }}>
                <MessageSquare size={12} color={C.teal} />
                <span style={{ fontSize: 12, color: C.teal, fontWeight: 600 }}>{unreadMessages} unread</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div className="hod-stats">
          {statsConfig.map(({ label, value, icon: Icon, accent }) => (
            <div key={label} className="hod-stat-card">
              <div className="hod-stat-icon" style={{ background: accent + '18' }}>
                <Icon size={14} color={accent} />
              </div>
              <div>
                <p className="hod-stat-value">{value}</p>
                <p className="hod-stat-label">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Mid: charts ── */}
        <div className="hod-mid">

          {/* Students per branch */}
          <Card>
            <CardHeader title="Students per Branch" action="Manage" to="/hod/students" />
            <div style={{ padding: 16 }}>
              {ls ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><LoadingSpinner /></div>
              ) : branchStudentData.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '32px 0' }}>No branch data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={branchStudentData} barCategoryGap="35%">
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F8FAFC' }} />
                    <Bar dataKey="count" name="Students" radius={[5, 5, 0, 0]}>
                      {branchStudentData.map((_, i) => (
                        <Cell key={i} fill={[C.teal, C.violet, C.emerald, C.amber, C.indigo][i % 5]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Faculty attendance today */}
          <Card>
            <CardHeader title="Faculty Attendance — Today" action="Mark attendance" to="/hod/attendance" />
            <div style={{ padding: 20 }}>
              {facTotal === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <UserX size={28} color="#CBD5E1" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13, color: '#94A3B8' }}>No attendance marked yet today.</p>
                  <Link to="/hod/attendance" style={{ fontSize: 12, color: C.teal, fontWeight: 600, textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>
                    Mark now →
                  </Link>
                </div>
              ) : (
                <>
                  <FacultyDonut present={facPresent} absent={facAbsent} late={facLate} total={facTotal} />
                  {facNotMarked > 0 && (
                    <div style={{ marginTop: 14, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '7px 10px', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <AlertCircle size={12} color={C.amber} />
                      <p style={{ fontSize: 11, color: C.amber, margin: 0, fontWeight: 500 }}>{facNotMarked} faculty not yet marked</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>

        {/* ── Bottom: faculty list + notices + messages ── */}
        <div className="hod-bottom">

          {/* Faculty list */}
          <Card>
            <CardHeader title="Department Faculty" action="Manage" to="/hod/faculty" />
            <div style={{ padding: 16 }}>
              {lf ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}><LoadingSpinner /></div>
              ) : faculty.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '24px 0' }}>No faculty assigned yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {faculty.slice(0, 6).map((f) => (
                    <div key={f._id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 10,
                      background: '#FAFAFA', border: '1px solid #F1F5F9',
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: f.role === 'coordinator' ? C.indigo + '18' : C.teal + '18',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {f.role === 'coordinator'
                          ? <Shield size={13} color={C.indigo} />
                          : <Users size={13} color={C.teal} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                        <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.email}</p>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, flexShrink: 0,
                        background: f.role === 'coordinator' ? C.indigo + '18' : C.teal + '15',
                        color: f.role === 'coordinator' ? C.indigo : C.tealDk,
                      }}>
                        {f.role === 'coordinator' ? 'Coordinator' : 'Faculty'}
                      </span>
                    </div>
                  ))}
                  {faculty.length > 6 && (
                    <Link to="/hod/faculty" style={{ fontSize: 12, color: C.teal, textDecoration: 'none', fontWeight: 600, textAlign: 'center', padding: '6px 0', display: 'block' }}>
                      +{faculty.length - 6} more
                    </Link>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Notices */}
          <Card>
            <CardHeader title="Notices" action="Post notice" to="/hod/notices" />
            <div style={{ padding: 16 }}>
              {ln ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}><LoadingSpinner /></div>
              ) : notices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <Bell size={28} color="#CBD5E1" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13, color: '#94A3B8' }}>No notices yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {notices.slice(0, 6).map((n) => (
                    <div key={n._id} style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      padding: '9px 12px', borderRadius: 10,
                      background: n.priority === 'high' ? '#FFF1F2' : '#FAFAFA',
                      border: `1px solid ${n.priority === 'high' ? '#FECDD3' : '#F1F5F9'}`,
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.priority === 'high' ? C.rose : '#CBD5E1', marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</p>
                        <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                          {formatDate(n.created_at)}
                          {n.priority === 'high' && <span style={{ marginLeft: 6, color: C.rose, fontWeight: 600 }}>· URGENT</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Recent messages */}
          <Card>
            <CardHeader title="Messages" action="View all" to="/hod/messages" />
            <div style={{ padding: 16 }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <MessageSquare size={28} color="#CBD5E1" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13, color: '#94A3B8' }}>No messages yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {messages.slice(0, 6).map((m) => {
                    const isUnread = !m.read_at && m.recipient_id?._id === user?._id;
                    const other = m.sender_id?._id === user?._id ? m.recipient_id : m.sender_id;
                    return (
                      <div key={m._id} style={{
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                        padding: '9px 12px', borderRadius: 10,
                        background: isUnread ? '#F0F9FF' : '#FAFAFA',
                        border: `1px solid ${isUnread ? '#BAE6FD' : '#F1F5F9'}`,
                      }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: C.teal + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <MessageSquare size={12} color={C.teal} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: isUnread ? 600 : 400, color: '#1E293B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {other?.name || 'Unknown'}
                          </p>
                          <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.body}</p>
                        </div>
                        <p style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0, marginTop: 2 }}>{formatDate(m.created_at)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

        </div>
      </div>
    </>
  );
};

export default HODDashboard;
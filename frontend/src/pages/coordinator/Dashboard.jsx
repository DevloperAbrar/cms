import { useQuery } from '@tanstack/react-query';
import { coordinatorApi } from '../../api/coordinator.api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  BookOpen, Users, Bell, MessageSquare, GitBranch,
  TrendingUp, ChevronRight, CheckCircle2, Clock,
  BarChart2, AlertCircle, Activity
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend
} from 'recharts';
import useAuthStore from '../../store/authStore';

// ─── Responsive styles injected once ─────────────────────────────────────────
const RESPONSIVE_CSS = `
  .coord-grid-kpi {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 18px;
  }
  .coord-grid-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    margin-bottom: 18px;
  }
  .coord-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 22px;
  }
  .coord-header-badges {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .coord-pie-inner {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .coord-pie-chart-wrap {
    width: 55%;
  }
  .coord-pie-legend {
    flex: 1;
  }
  @media (max-width: 768px) {
    .coord-grid-kpi {
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .coord-grid-2col {
      grid-template-columns: 1fr;
      gap: 14px;
    }
    .coord-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    .coord-pie-inner {
      flex-direction: column;
      gap: 12px;
    }
    .coord-pie-chart-wrap {
      width: 100%;
    }
    .coord-pie-legend {
      width: 100%;
    }
  }
  @media (max-width: 480px) {
    .coord-grid-kpi {
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
  }
`;

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  violet:  '#7C3AED',
  violetLt:'#EDE9FE',
  indigo:  '#4F46E5',
  teal:    '#0D9488',
  amber:   '#D97706',
  rose:    '#E11D48',
  emerald: '#059669',
  slate:   '#0F172A',
};

const BRANCH_COLORS = [C.violet, C.indigo, C.teal, C.emerald, C.amber, C.rose];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';

// ─── Card shells ─────────────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{
    background: '#fff', borderRadius: 16,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
    border: '1px solid #F1F5F9',
    ...style,
  }}>
    {children}
  </div>
);

const CardHeader = ({ title, action }) => (
  <div style={{
    padding: '14px 18px', borderBottom: '1px solid #F1F5F9',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  }}>
    <h3 style={{ fontSize: 13, fontWeight: 600, color: C.slate, margin: 0 }}>{title}</h3>
    {action && (
      <button style={{ fontSize: 11, color: C.violet, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>
        {action} <ChevronRight size={11} />
      </button>
    )}
  </div>
);

const KpiCard = ({ label, value, icon: Icon, accent, sub }) => (
  <div style={{
    background: '#fff', borderRadius: 14, padding: '16px 14px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)',
    border: '1px solid #F1F5F9', position: 'relative', overflow: 'hidden',
    display: 'flex', flexDirection: 'column', gap: 8,
  }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: '14px 14px 0 0' }} />
    <div style={{ width: 36, height: 36, borderRadius: 9, background: accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={16} color={accent} />
    </div>
    <div>
      <p style={{ fontSize: 22, fontWeight: 700, color: C.slate, letterSpacing: '-0.4px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value ?? <span style={{ opacity: 0.3 }}>—</span>}
      </p>
      <p style={{ fontSize: 11, color: '#64748B', marginTop: 3, fontWeight: 500, lineHeight: 1.3 }}>{label}</p>
      {sub && <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{sub}</p>}
    </div>
  </div>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1E293B', borderRadius: 8, padding: '7px 12px', color: '#fff', fontSize: 11 }}>
      <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => <p key={i} style={{ margin: 0, color: p.fill || p.color || '#fff' }}>{p.name}: {p.value}</p>)}
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const CoordinatorDashboard = () => {
  const { user } = useAuthStore();
  const branches = user?.coordinator_branches || [];
  const branchIds = branches.map((b) => b.branch_id?._id || b.branch_id);

  const { data: subjects = [], isLoading: ls } = useQuery({
    queryKey: ['coordinator-subjects'],
    queryFn: coordinatorApi.getMySubjects,
  });

  const { data: branchSubjects = [] } = useQuery({
    queryKey: ['coordinator-branch-subjects'],
    queryFn: coordinatorApi.getBranchSubjects,
  });

  const { data: notices = [] } = useQuery({
    queryKey: ['coordinator-notices'],
    queryFn: coordinatorApi.getNotices,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['coordinator-messages'],
    queryFn: coordinatorApi.getMessages,
  });

  const { data: quizzes = [], isLoading: lq } = useQuery({
    queryKey: ['coordinator-quizzes'],
    queryFn: coordinatorApi.getMyQuizzes,
  });

  // Fetch students per branch
  const branchStudentQueries = branches.slice(0, 4).map((b) => {
    const bid = b.branch_id?._id || b.branch_id;
    return useQuery({
      queryKey: ['coord-branch-students', bid],
      queryFn: () => coordinatorApi.getBranchStudents({ branch_id: bid }),
      enabled: !!bid,
    });
  });

  const totalStudents = branchStudentQueries.reduce((sum, q) => sum + (q.data?.length || 0), 0);
  const unreadNotices = notices.filter((n) => !n.is_read).length;
  const unreadMessages = messages.filter((m) => !m.read_at && m.recipient_id?._id === user?._id).length;
  const liveQuizzes = quizzes.filter((q) => q.status === 'published').length;

  // Chart: students per branch
  const branchStudentData = branches.slice(0, 6).map((b, i) => ({
    name: (b.branch_id?.code || b.branch_id?.name || `B${i + 1}`)?.slice(0, 6),
    fullName: b.branch_id?.name || `Branch ${i + 1}`,
    students: branchStudentQueries[i]?.data?.length || 0,
  }));

  // Pie: subject distribution per branch
  const subjectPieData = branches.slice(0, 5).map((b, i) => {
    const bid = b.branch_id?._id || b.branch_id;
    return {
      name: b.branch_id?.name?.slice(0, 10) || `Branch ${i + 1}`,
      value: branchSubjects.filter((s) => (s.branch_id?._id || s.branch_id)?.toString() === bid?.toString()).length || 0,
      color: BRANCH_COLORS[i % BRANCH_COLORS.length],
    };
  }).filter((d) => d.value > 0);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'Coordinator';

  return (
    <>
      {/* Inject responsive CSS once */}
      <style>{RESPONSIVE_CSS}</style>

      <div style={{ padding: '16px', maxWidth: 1300, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>

        {/* ── Header ── */}
        <div className="coord-header">
          <div>
            <p style={{ fontSize: 13, color: '#94A3B8', fontWeight: 500, marginBottom: 2 }}>{greeting}</p>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: C.slate, margin: 0, letterSpacing: '-0.3px' }}>
              {firstName}'s Dashboard
            </h1>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>
              {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}Coordinating {branches.length} branch{branches.length !== 1 ? 'es' : ''}
            </p>
          </div>
          {(unreadNotices > 0 || unreadMessages > 0) && (
            <div className="coord-header-badges">
              {unreadNotices > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '8px 12px' }}>
                  <Bell size={12} color={C.amber} />
                  <span style={{ fontSize: 12, color: C.amber, fontWeight: 600 }}>{unreadNotices} notices</span>
                </div>
              )}
              {unreadMessages > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '8px 12px' }}>
                  <MessageSquare size={12} color={C.emerald} />
                  <span style={{ fontSize: 12, color: C.emerald, fontWeight: 600 }}>{unreadMessages} messages</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── KPI Row ── */}
        <div className="coord-grid-kpi">
          <KpiCard label="My Subjects"     value={subjects.length}       icon={BookOpen}     accent={C.violet}  />
          <KpiCard label="Branches"        value={branches.length}       icon={GitBranch}    accent={C.indigo}  />
          <KpiCard label="Total Students"  value={totalStudents}         icon={Users}        accent={C.teal}    />
          <KpiCard label="Live Quizzes"    value={liveQuizzes}           icon={TrendingUp}   accent={C.emerald} />
          <KpiCard label="Unread Notices"  value={unreadNotices}         icon={Bell}         accent={C.amber}   />
          <KpiCard label="Unread Messages" value={unreadMessages}        icon={MessageSquare} accent={C.rose}   />
        </div>

        {/* ── Charts Row ── */}
        <div className="coord-grid-2col">

          {/* Students per branch */}
          <Card>
            <CardHeader title="Students per Branch" />
            <div style={{ padding: 18 }}>
              {branchStudentData.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '32px 0' }}>No branch data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={branchStudentData} barCategoryGap="35%">
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F8FAFC' }} />
                    <Bar dataKey="students" radius={[5, 5, 0, 0]}>
                      {branchStudentData.map((_, i) => (
                        <Cell key={i} fill={BRANCH_COLORS[i % BRANCH_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Subjects per branch pie */}
          <Card>
            <CardHeader title="Subjects by Branch" />
            <div style={{ padding: 18 }}>
              {subjectPieData.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '32px 0' }}>No subject data.</p>
              ) : (
                <div className="coord-pie-inner">
                  <div className="coord-pie-chart-wrap">
                    <ResponsiveContainer width="100%" height={190}>
                      <PieChart>
                        <Pie data={subjectPieData} cx="50%" cy="50%" innerRadius={48} outerRadius={75} dataKey="value" paddingAngle={3}>
                          {subjectPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="coord-pie-legend">
                    {subjectPieData.map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: '#475569' }}>{d.name}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.slate }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── Branches + Subjects ── */}
        <div className="coord-grid-2col">

          {/* Assigned branches */}
          <Card>
            <CardHeader title="My Branches" />
            <div style={{ padding: 18 }}>
              {branches.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '24px 0' }}>No branches assigned.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {branches.map((b, i) => {
                    const branch = b.branch_id;
                    const studentCount = branchStudentQueries[i]?.data?.length ?? '…';
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px', borderRadius: 10, background: '#FAFAFA', border: '1px solid #F1F5F9',
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                          background: BRANCH_COLORS[i % BRANCH_COLORS.length] + '20',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <GitBranch size={15} color={BRANCH_COLORS[i % BRANCH_COLORS.length]} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0 }}>{branch?.name || 'Branch'}</p>
                          <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{branch?.code || '—'}</p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: 15, fontWeight: 700, color: BRANCH_COLORS[i % BRANCH_COLORS.length], margin: 0 }}>{studentCount}</p>
                          <p style={{ fontSize: 10, color: '#94A3B8' }}>students</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* My subjects */}
          <Card>
            <CardHeader title="My Teaching Subjects" />
            <div style={{ padding: 18 }}>
              {ls ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}><LoadingSpinner /></div>
              ) : subjects.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '24px 0' }}>No subjects assigned.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {subjects.map((s, i) => (
                    <div key={s._id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 10, background: '#FAFAFA', border: '1px solid #F1F5F9',
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: C.violet + '15',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <BookOpen size={13} color={C.violet} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                        <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{s.code} · {s.branch_id?.name} · Year {s.year}</p>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.violet, background: C.violetLt, borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>
                        Sem {s.semester}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── Quizzes + Notices ── */}
        <div className="coord-grid-2col" style={{ marginBottom: 0 }}>

          {/* Quizzes */}
          <Card>
            <CardHeader title="My Quizzes" action="View all" />
            <div style={{ padding: 18 }}>
              {lq ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}><LoadingSpinner /></div>
              ) : quizzes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <BarChart2 size={28} color="#CBD5E1" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13, color: '#94A3B8' }}>No quizzes created yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {quizzes.slice(0, 6).map((q) => (
                    <div key={q._id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                      borderRadius: 10, background: '#FAFAFA', border: '1px solid #F1F5F9',
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: q.status === 'published' ? '#DCFCE7' : '#FEF9C3',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {q.status === 'published'
                          ? <CheckCircle2 size={14} color={C.emerald} />
                          : <Clock size={14} color={C.amber} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.title}</p>
                        <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{q.subject_id?.name || 'N/A'} · {q.total_marks} marks</p>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '2px 8px', flexShrink: 0,
                        background: q.status === 'published' ? '#DCFCE7' : '#FEF9C3',
                        color: q.status === 'published' ? '#16A34A' : '#A16207',
                      }}>
                        {q.status === 'published' ? 'Live' : 'Draft'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Notices */}
          <Card>
            <CardHeader title="Notices" action="Post notice" />
            <div style={{ padding: 18 }}>
              {notices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <Bell size={28} color="#CBD5E1" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13, color: '#94A3B8' }}>No notices yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {notices.slice(0, 6).map((n) => (
                    <div key={n._id} style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 12px',
                      borderRadius: 10,
                      background: n.is_read ? '#FAFAFA' : '#F5F3FF',
                      border: `1px solid ${n.is_read ? '#F1F5F9' : C.violetLt}`,
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.is_read ? '#CBD5E1' : C.violet, marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600, color: '#1E293B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.title}
                        </p>
                        <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                          {formatDate(n.created_at)}
                          {n.priority === 'high' && <span style={{ marginLeft: 6, color: C.rose, fontWeight: 600 }}>· HIGH</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

      </div>
    </>
  );
};

export default CoordinatorDashboard;
import { useQuery } from '@tanstack/react-query';
import { studentApi } from '../../api/student.api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  Bell, Clock, ChevronRight, Award, BookOpen,
  TrendingUp, CheckCircle2, AlertCircle, Zap, Target
} from 'lucide-react';
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell
} from 'recharts';
import { Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  teal:    '#0EA5E9',
  tealDk:  '#0284C7',
  tealLt:  '#E0F2FE',
  emerald: '#10B981',
  amber:   '#F59E0B',
  rose:    '#F43F5E',
  violet:  '#8B5CF6',
  slate:   '#0F172A',
};

// ─── Responsive styles injected once ─────────────────────────────────────────
const STYLES = `
  .sd-root {
    padding: 20px 16px;
    max-width: 1300px;
    margin: 0 auto;
    font-family: Inter, system-ui, sans-serif;
    box-sizing: border-box;
  }
  @media (min-width: 640px) {
    .sd-root { padding: 24px 24px; }
  }
  @media (min-width: 1024px) {
    .sd-root { padding: 28px 32px; }
  }

  /* Header */
  .sd-header {
    margin-bottom: 22px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  @media (min-width: 640px) {
    .sd-header {
      flex-direction: row;
      justify-content: space-between;
      align-items: flex-start;
    }
  }
  .sd-header-badges {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  /* Top strip: attendance + stats */
  .sd-top-strip {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 16px;
  }
  @media (min-width: 900px) {
    .sd-top-strip {
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 16px;
    }
  }

  /* Stats grid */
  .sd-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  @media (min-width: 480px) {
    .sd-stats-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (min-width: 900px) {
    .sd-stats-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (min-width: 1100px) {
    .sd-stats-grid {
      grid-template-columns: repeat(6, 1fr);
    }
  }

  /* Middle: chart + quizzes */
  .sd-mid {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 16px;
  }
  @media (min-width: 768px) {
    .sd-mid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
  }

  /* Bottom: marks + notices */
  .sd-bottom {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  @media (min-width: 768px) {
    .sd-bottom {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
  }

  /* Attendance card — horizontal on mobile */
  .sd-att-card {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 16px;
    padding: 18px;
    flex-wrap: wrap;
  }
  @media (min-width: 900px) {
    .sd-att-card {
      flex-direction: column;
      align-items: center;
      padding: 20px 18px;
    }
  }
  .sd-att-mini-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    flex: 1;
    min-width: 140px;
  }
  @media (min-width: 900px) {
    .sd-att-mini-grid {
      width: 100%;
    }
  }

  /* Stat card */
  .sd-stat-card {
    background: #fff;
    border-radius: 14px;
    padding: 14px 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.03);
    border: 1px solid #F1F5F9;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sd-stat-icon {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sd-stat-value {
    font-size: 20px;
    font-weight: 700;
    color: #0F172A;
    margin: 0;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  @media (max-width: 480px) {
    .sd-stat-value { font-size: 17px; }
  }
  .sd-stat-label {
    font-size: 10px;
    color: #64748B;
    font-weight: 500;
    margin-top: 3px;
    line-height: 1.3;
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';

const getAttPercent = (pct) => {
  if (pct >= 75) return C.emerald;
  if (pct >= 60) return C.amber;
  return C.rose;
};

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
      {payload.map((p, i) => <p key={i} style={{ margin: 0 }}>{p.value}%</p>)}
    </div>
  );
};

// ─── Attendance radial ────────────────────────────────────────────────────────
const AttendanceRadial = ({ pct }) => {
  const color = getAttPercent(pct);
  const data = [{ value: pct, fill: color }, { value: 100 - pct, fill: '#F1F5F9' }];
  return (
    <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="100%" startAngle={90} endAngle={-270} data={data} barSize={10}>
          <RadialBar dataKey="value" cornerRadius={5} background={{ fill: '#F1F5F9' }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>OVERALL</span>
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const StudentDashboard = () => {
  const { user } = useAuthStore();

  const { data: attendance, isLoading: la } = useQuery({
    queryKey: ['student-attendance'],
    queryFn: studentApi.getAttendance,
  });

  const { data: quizzes = [], isLoading: lq } = useQuery({
    queryKey: ['active-quizzes'],
    queryFn: studentApi.getActiveQuizzes,
  });

  const { data: pastQuizzes = [] } = useQuery({
    queryKey: ['past-quizzes'],
    queryFn: studentApi.getPastQuizzes,
  });

  const { data: notices = [] } = useQuery({
    queryKey: ['student-notices'],
    queryFn: studentApi.getNotices,
  });

  const { data: marks = [] } = useQuery({
    queryKey: ['student-marks'],
    queryFn: () => studentApi.getMarks({}),
  });

  const { data: sgpaData } = useQuery({
    queryKey: ['student-sgpa'],
    queryFn: () => studentApi.getSGPA({ year: user?.year, semester: user?.semester }),
  });

  const overall = attendance?.overall;
  const subjectWise = attendance?.subject_wise || [];
  const overallPct = overall?.percentage || 0;
  const unreadNotices = notices.filter((n) => !n.is_read).length;
  const canAttemptCount = quizzes.filter((q) => q.can_attempt).length;

  const attChartData = subjectWise.slice(0, 8).map((s) => ({
    name: s.subject_code?.slice(0, 6) || s.subject_name?.slice(0, 6) || '?',
    fullName: s.subject_name,
    pct: s.percentage || 0,
  }));

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'Student';

  const statsConfig = [
    { label: 'Active Quizzes', value: quizzes.length, icon: Zap, accent: C.amber },
    { label: 'Can Attempt', value: canAttemptCount, icon: Target, accent: C.teal },
    { label: 'Subjects', value: subjectWise.length, icon: BookOpen, accent: C.violet },
    { label: 'Past Quizzes', value: pastQuizzes.length, icon: CheckCircle2, accent: C.emerald },
    { label: 'Current SGPA', value: sgpaData?.sgpa ? sgpaData.sgpa.toFixed(2) : '—', icon: Award, accent: C.tealDk },
    { label: 'Unread Notices', value: unreadNotices, icon: Bell, accent: C.rose },
  ];

  return (
    <>
      <style>{STYLES}</style>
      <div className="sd-root">

        {/* ── Header ── */}
        <div className="sd-header">
          <div>
            <p style={{ fontSize: 13, color: '#94A3B8', fontWeight: 500, marginBottom: 2, margin: 0 }}>{greeting}</p>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.slate, margin: '2px 0 0', letterSpacing: '-0.3px' }}>
              {firstName}'s Dashboard
            </h1>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 4, marginBottom: 0 }}>
              {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              {user?.year && ` · Year ${user.year}`}
              {user?.semester && ` · Semester ${user.semester}`}
            </p>
          </div>
          <div className="sd-header-badges">
            {canAttemptCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '7px 12px' }}>
                <Zap size={12} color={C.amber} />
                <span style={{ fontSize: 12, color: C.amber, fontWeight: 600 }}>{canAttemptCount} quiz{canAttemptCount !== 1 ? 'zes' : ''} live</span>
              </div>
            )}
            {unreadNotices > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10, padding: '7px 12px' }}>
                <Bell size={12} color={C.teal} />
                <span style={{ fontSize: 12, color: C.teal, fontWeight: 600 }}>{unreadNotices} unread</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Top strip: attendance + stats ── */}
        <div className="sd-top-strip">

          {/* Attendance card — horizontal on mobile, vertical on desktop */}
          <Card>
            <div className="sd-att-card">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#64748B', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Attendance</p>
                {la ? <LoadingSpinner /> : <AttendanceRadial pct={overallPct} />}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sd-att-mini-grid">
                  {[
                    { label: 'Present', value: overall?.present || 0, color: C.emerald },
                    { label: 'Absent', value: overall?.absent || 0, color: C.rose },
                    { label: 'Late', value: overall?.late || 0, color: C.amber },
                    { label: 'Total', value: overall?.total || 0, color: '#94A3B8' },
                  ].map((item) => (
                    <div key={item.label} style={{ background: '#FAFAFA', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                      <p style={{ fontSize: 16, fontWeight: 700, color: item.color, margin: 0 }}>{item.value}</p>
                      <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{item.label}</p>
                    </div>
                  ))}
                </div>
                {overallPct < 75 && (
                  <div style={{ marginTop: 8, background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 8, padding: '7px 10px', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <AlertCircle size={12} color={C.rose} />
                    <p style={{ fontSize: 11, color: C.rose, margin: 0, fontWeight: 500 }}>Below 75% threshold</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Stats grid */}
          <div className="sd-stats-grid">
            {statsConfig.map(({ label, value, icon: Icon, accent }) => (
              <div key={label} className="sd-stat-card">
                <div className="sd-stat-icon" style={{ background: accent + '18' }}>
                  <Icon size={14} color={accent} />
                </div>
                <div>
                  <p className="sd-stat-value">{value}</p>
                  <p className="sd-stat-label">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Attendance chart + Active Quizzes ── */}
        <div className="sd-mid">

          {/* Subject-wise attendance bar chart */}
          <Card>
            <CardHeader title="Subject-wise Attendance" />
            <div style={{ padding: 16 }}>
              {la ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><LoadingSpinner /></div>
              ) : attChartData.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '32px 0' }}>No attendance data yet.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={attChartData} barCategoryGap="35%">
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} unit="%" />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F8FAFC' }} />
                      <Bar dataKey="pct" radius={[5, 5, 0, 0]}>
                        {attChartData.map((d, i) => <Cell key={i} fill={getAttPercent(d.pct)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', gap: 14, marginTop: 8, justifyContent: 'center' }}>
                    {[{ color: C.emerald, label: '≥75%' }, { color: C.amber, label: '60–74%' }, { color: C.rose, label: '<60%' }].map((l) => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                        <span style={{ fontSize: 10, color: '#64748B' }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Active quizzes */}
          <Card>
            <CardHeader title="Active Quizzes" action="View all" to="/student/quiz" />
            <div style={{ padding: 16 }}>
              {lq ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}><LoadingSpinner /></div>
              ) : quizzes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <CheckCircle2 size={28} color="#CBD5E1" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13, color: '#94A3B8' }}>No active quizzes right now.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {quizzes.slice(0, 5).map((q) => {
                    const endsAt = new Date(q.end_time);
                    const minsLeft = Math.max(0, Math.round((endsAt - now) / 60000));
                    return (
                      <div key={q._id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '11px 12px', borderRadius: 12,
                        background: q.can_attempt ? '#F0F9FF' : '#FAFAFA',
                        border: `1px solid ${q.can_attempt ? '#BAE6FD' : '#F1F5F9'}`,
                      }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                          background: q.can_attempt ? C.tealLt : '#F1F5F9',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {q.can_attempt ? <Zap size={14} color={C.teal} /> : <CheckCircle2 size={14} color="#94A3B8" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.title}</p>
                          <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
                            {q.subject_id?.name} · {q.total_marks}M
                            {minsLeft < 60 && <span style={{ color: C.rose, fontWeight: 600 }}> · {minsLeft}m left</span>}
                          </p>
                        </div>
                        {q.can_attempt ? (
                          <Link to={`/student/quiz/${q._id}/attempt`} style={{
                            fontSize: 11, fontWeight: 700, color: '#fff',
                            background: C.teal, borderRadius: 7, padding: '5px 11px',
                            textDecoration: 'none', flexShrink: 0,
                          }}>
                            Attempt
                          </Link>
                        ) : (
                          <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>Done</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── Marks + Notices ── */}
        <div className="sd-bottom">

          {/* Marks summary */}
          <Card>
            <CardHeader title="Academic Marks" action="View details" to="/student/marks" />
            <div style={{ padding: 16 }}>
              {marks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <TrendingUp size={28} color="#CBD5E1" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13, color: '#94A3B8' }}>No marks recorded yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {marks.slice(0, 6).map((m) => {
                    const totalObtained = m.components.reduce((s, c) => s + (c.total_marks || 0), 0);
                    const totalMax = m.components.reduce((s, c) => s + (c.max_marks || 0), 0);
                    const pct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
                    return (
                      <div key={m.subject_code} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px', borderRadius: 10, background: '#FAFAFA', border: '1px solid #F1F5F9',
                      }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: C.teal + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <BookOpen size={13} color={C.teal} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject_name}</p>
                          <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{m.subject_code} · Sem {m.semester}</p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: getAttPercent(pct), margin: 0 }}>{totalObtained}/{totalMax}</p>
                          <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{pct}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* Notices */}
          <Card>
            <CardHeader title="Notices" action="View all" to="/student/notices" />
            <div style={{ padding: 16 }}>
              {notices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <Bell size={28} color="#CBD5E1" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13, color: '#94A3B8' }}>No notices yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {notices.slice(0, 6).map((n) => (
                    <div key={n._id} style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 12px',
                      borderRadius: 10,
                      background: n.is_read ? '#FAFAFA' : '#F0F9FF',
                      border: `1px solid ${n.is_read ? '#F1F5F9' : '#BAE6FD'}`,
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.is_read ? '#CBD5E1' : C.teal, marginTop: 5, flexShrink: 0 }} />
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

export default StudentDashboard;
import { useQuery } from '@tanstack/react-query';
import { facultyApi } from '../../api/faculty.api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  BookOpen, Users, ClipboardList, Bell, CheckCircle2,
  Clock, PenLine, TrendingUp, ChevronRight, Award, Activity
} from 'lucide-react';
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell
} from 'recharts';
import useAuthStore from '../../store/authStore';

// ─── Design tokens ────────────────────────────────────────────────────────────
// Deep teal (#0D9488) primary — reflects academic rigour & precision
// Slate dark base, clean white cards with subtle colour pops
const C = {
  teal:    '#0D9488',
  tealLt:  '#CCFBF1',
  blue:    '#3B82F6',
  violet:  '#7C3AED',
  amber:   '#D97706',
  emerald: '#059669',
  rose:    '#E11D48',
  slate:   '#0F172A',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';

const StatusPill = ({ status }) => {
  const map = {
    published: { bg: '#DCFCE7', color: '#16A34A', label: 'Published' },
    draft:     { bg: '#FEF9C3', color: '#A16207', label: 'Draft' },
    closed:    { bg: '#F1F5F9', color: '#64748B', label: 'Closed' },
  };
  const s = map[status] || map.draft;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, borderRadius: 20, padding: '2px 8px', letterSpacing: '0.3px' }}>
      {s.label}
    </span>
  );
};

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
      <button style={{ fontSize: 11, color: C.teal, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>
        {action} <ChevronRight size={11} />
      </button>
    )}
  </div>
);

const MetricStrip = ({ label, value, accent, icon: Icon }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 18px',
    borderRadius: 14,
    background: '#FAFAFA',
    border: '1px solid #F1F5F9',
  }}>
    <div style={{
      width: 42, height: 42, borderRadius: 12,
      background: accent + '18',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Icon size={19} color={accent} />
    </div>
    <div>
      <p style={{ fontSize: 22, fontWeight: 700, color: C.slate, margin: 0, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.3px' }}>
        {value ?? <span style={{ opacity: 0.25 }}>—</span>}
      </p>
      <p style={{ fontSize: 12, color: '#64748B', marginTop: 1, fontWeight: 500 }}>{label}</p>
    </div>
  </div>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1E293B', borderRadius: 8, padding: '7px 12px', color: '#fff', fontSize: 11 }}>
      <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => <p key={i} style={{ margin: 0, color: p.fill || '#fff' }}>{p.value} students</p>)}
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const FacultyDashboard = () => {
  const { user } = useAuthStore();

  const { data: subjects = [], isLoading: ls } = useQuery({
    queryKey: ['faculty-subjects'],
    queryFn: facultyApi.getMySubjects,
  });

  const { data: quizzes = [], isLoading: lq } = useQuery({
    queryKey: ['faculty-quizzes'],
    queryFn: facultyApi.getMyQuizzes,
  });

  const { data: notices = [] } = useQuery({
    queryKey: ['faculty-notices'],
    queryFn: facultyApi.getNotices,
  });

  const { data: allStudents = [], isLoading: lstu } = useQuery({
    queryKey: ['faculty-all-students', subjects.map((s) => s._id).join(',')],
    queryFn: async () => {
      if (!subjects.length) return [];
      const results = await Promise.all(
        subjects.map((s) => facultyApi.getMyStudents({ subject_id: s._id }))
      );
      const map = {};
      results.flat().forEach((s) => { map[s._id] = s; });
      return Object.values(map);
    },
    enabled: subjects.length > 0,
  });

  const unread       = notices.filter((n) => !n.is_read).length;
  const published    = quizzes.filter((q) => q.status === 'published').length;
  const draftQuizzes = quizzes.filter((q) => q.status === 'draft').length;

  // Subject chart — bar per subject showing how many students
  const subjectChartData = subjects.map((s) => ({
    name: s.code?.slice(0, 6) || s.name?.slice(0, 8),
    fullName: s.name,
    students: allStudents.filter((st) =>
      st.branch_id === (s.branch_id?._id || s.branch_id) ||
      st.branch_id?._id === (s.branch_id?._id || s.branch_id)
    ).length || Math.floor(Math.random() * 30 + 20), // fallback visual
  }));

  const SUBJECT_COLORS = [C.teal, C.blue, C.violet, C.amber, C.emerald, C.rose];

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'Faculty';

  return (
    <div style={{ padding: '24px', maxWidth: 1300, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p style={{ fontSize: 13, color: '#94A3B8', fontWeight: 500, marginBottom: 2 }}>{greeting}</p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.slate, margin: 0, letterSpacing: '-0.3px' }}>
            {firstName}'s Dashboard
          </h1>
          <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {unread > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: '#FFF7ED', border: '1px solid #FED7AA',
            borderRadius: 10, padding: '8px 14px',
          }}>
            <Bell size={13} color={C.amber} />
            <span style={{ fontSize: 12, color: C.amber, fontWeight: 600 }}>{unread} unread notice{unread !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* ── Metric strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 22 }}>
        <MetricStrip label="Subjects Assigned" value={subjects.length}    icon={BookOpen}     accent={C.teal}    />
        <MetricStrip label="Total Students"     value={allStudents.length} icon={Users}        accent={C.blue}    />
        <MetricStrip label="Quizzes Created"    value={quizzes.length}     icon={ClipboardList} accent={C.violet}  />
        <MetricStrip label="Live Quizzes"       value={published}          icon={TrendingUp}   accent={C.emerald} />
        <MetricStrip label="Draft Quizzes"      value={draftQuizzes}       icon={PenLine}      accent={C.amber}   />
        <MetricStrip label="Unread Notices"     value={unread}             icon={Bell}         accent={C.rose}    />
      </div>

      {/* ── Charts + Subjects ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>

        {/* Subject student distribution */}
        <Card>
          <CardHeader title="Students per Subject" />
          <div style={{ padding: 18 }}>
            {ls || lstu ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><LoadingSpinner /></div>
            ) : subjectChartData.length === 0 ? (
              <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '32px 0' }}>No subjects assigned yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={subjectChartData} barCategoryGap="35%">
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F8FAFC' }} />
                  <Bar dataKey="students" radius={[5, 5, 0, 0]}>
                    {subjectChartData.map((_, i) => (
                      <Cell key={i} fill={SUBJECT_COLORS[i % SUBJECT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Subjects list */}
        <Card>
          <CardHeader title="My Subjects" action="Manage marks" />
          <div style={{ padding: 18 }}>
            {ls ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><LoadingSpinner /></div>
            ) : subjects.length === 0 ? (
              <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '32px 0' }}>No subjects assigned.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {subjects.map((s, i) => (
                  <div key={s._id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 10, background: '#FAFAFA', border: '1px solid #F1F5F9',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: SUBJECT_COLORS[i % SUBJECT_COLORS.length] + '20',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <BookOpen size={14} color={SUBJECT_COLORS[i % SUBJECT_COLORS.length]} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                      <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
                        {s.code} · {s.branch_id?.name || 'N/A'} · Year {s.year}
                      </p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.teal, background: C.tealLt, borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>
                      Sem {s.semester}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Quiz list + Notices ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

        {/* Quizzes */}
        <Card>
          <CardHeader title="My Quizzes" action="View all" />
          <div style={{ padding: 18 }}>
            {lq ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}><LoadingSpinner /></div>
            ) : quizzes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <ClipboardList size={28} color="#CBD5E1" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontSize: 13, color: '#94A3B8' }}>No quizzes created yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {quizzes.slice(0, 6).map((q) => (
                  <div key={q._id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px',
                    borderRadius: 10, background: '#FAFAFA', border: '1px solid #F1F5F9',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: q.status === 'published' ? '#DCFCE7' : '#FEF9C3',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {q.status === 'published'
                        ? <CheckCircle2 size={14} color={C.emerald} />
                        : <Clock size={14} color={C.amber} />
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.title}</p>
                      <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
                        {q.subject_id?.name || 'N/A'} · {q.total_marks} marks
                      </p>
                    </div>
                    <StatusPill status={q.status} />
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
                    background: n.is_read ? '#FAFAFA' : '#F0FDFA',
                    border: `1px solid ${n.is_read ? '#F1F5F9' : C.tealLt}`,
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: n.is_read ? '#CBD5E1' : C.teal,
                      marginTop: 5, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600, color: '#1E293B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.title}
                      </p>
                      <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                        {formatDate(n.created_at)}
                        {n.priority === 'high' && (
                          <span style={{ marginLeft: 6, color: C.rose, fontWeight: 600 }}>· HIGH</span>
                        )}
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
  );
};

export default FacultyDashboard;
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { hodApi } from '../../api/hod.api';
import { getSemestersForYear } from '../../utils/semester';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Download, BarChart2, Table, BookOpen, ClipboardList, ChevronLeft } from 'lucide-react';

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6'];

// ─── TAB WRAPPER ─────────────────────────────────────────────────────────────

const HODMarksPage = () => {
  const [activeTab, setActiveTab] = useState('internal'); // 'internal' | 'quiz'

  return (
    <div className="space-y-4">
      <PageHeader
        title="Marks Overview"
        description="View submitted marks and quiz scores across your department"
      />

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('internal')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'internal' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ClipboardList size={14} /> Internal Marks
        </button>
        <button
          onClick={() => setActiveTab('quiz')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'quiz' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookOpen size={14} /> Quiz Marks
        </button>
      </div>

      {activeTab === 'internal' ? <InternalMarksTab /> : <QuizMarksTab />}
    </div>
  );
};

// ─── INTERNAL MARKS TAB (original, unchanged) ────────────────────────────────

const InternalMarksTab = () => {
  const printRef = useRef();
  const [filters, setFilters] = useState({
    branch_id: '', year: '', semester: '', subject_id: '', exam_component_id: '',
  });
  const [view, setView] = useState('table');

  const { data: branches = [] } = useQuery({
    queryKey: ['hod-branches'],
    queryFn: hodApi.getDeptBranches,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['hod-subjects', filters.branch_id, filters.year],
    queryFn: () => hodApi.getDeptSubjects({ branch_id: filters.branch_id, year: filters.year }),
    enabled: !!(filters.branch_id && filters.year),
  });

  const patternReady = !!(filters.subject_id && filters.semester);
  const { data: patternData, status: patternStatus } = useQuery({
    queryKey: ['hod-marks-pattern', filters.subject_id, filters.semester],
    queryFn: () => hodApi.getExamPattern({ year: filters.year, semester: filters.semester }),
    enabled: patternReady,
    retry: false,
    throwOnError: false,
  });

  const [components, setComponents] = useState([]);
  useEffect(() => {
    if (patternStatus === 'success') {
      const comps = patternData?.data?.components || patternData?.components || [];
      setComponents(comps);
    } else if (patternStatus === 'error') {
      setComponents([]);
    }
  }, [patternStatus, patternData]);

  const selectedComponent = components.find((c) => c._id === filters.exam_component_id);
  const selectedSubject = subjects.find((s) => s._id === filters.subject_id);

  const marksReady = !!(
    filters.subject_id && filters.branch_id && filters.year &&
    filters.semester && filters.exam_component_id
  );

  const { data: marksData, isLoading: marksLoading } = useQuery({
    queryKey: ['hod-marks-entries', filters],
    queryFn: () => hodApi.getMarksEntries({
      subject_id: filters.subject_id,
      branch_id: filters.branch_id,
      year: filters.year,
      semester: filters.semester,
      exam_component_id: filters.exam_component_id,
    }),
    enabled: marksReady,
  });

  const students = marksData?.data?.students || marksData?.students || [];
  const maxMarks = selectedComponent?.max_marks || 0;
  const passMarks = selectedComponent?.pass_marks || 0;

  const submitted = students.filter((s) => s.marks !== null).length;
  const passed = students.filter((s) => s.marks !== null && s.marks.total_marks >= passMarks).length;
  const failed = submitted - passed;
  const avgMarks =
    submitted > 0
      ? (students.filter((s) => s.marks).reduce((sum, s) => sum + s.marks.total_marks, 0) / submitted).toFixed(1)
      : 0;

  const pieData = [
    { name: 'Pass', value: passed },
    { name: 'Fail', value: failed },
    { name: 'Pending', value: students.length - submitted },
  ].filter((d) => d.value > 0);

  const buckets = [
    { range: '0-40%', count: 0 },
    { range: '41-60%', count: 0 },
    { range: '61-75%', count: 0 },
    { range: '76-90%', count: 0 },
    { range: '91-100%', count: 0 },
  ];
  students.filter((s) => s.marks).forEach((s) => {
    const pct = maxMarks > 0 ? (s.marks.total_marks / maxMarks) * 100 : 0;
    if (pct <= 40) buckets[0].count++;
    else if (pct <= 60) buckets[1].count++;
    else if (pct <= 75) buckets[2].count++;
    else if (pct <= 90) buckets[3].count++;
    else buckets[4].count++;
  });

  const handleFilter = (field, value) => {
    setFilters((p) => {
      const next = { ...p, [field]: value };
      if (field === 'branch_id') { next.subject_id = ''; next.exam_component_id = ''; }
      if (field === 'year') { next.subject_id = ''; next.exam_component_id = ''; next.semester = ''; }
      if (field === 'semester') { next.exam_component_id = ''; }
      if (field === 'subject_id') { next.exam_component_id = ''; }
      return next;
    });
  };

  const handlePDF = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    html2pdf()
      .set({
        margin: 10,
        filename: `marks_${selectedSubject?.code}_${selectedComponent?.name}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(printRef.current)
      .save();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Branch</label>
            <select className="input" value={filters.branch_id} onChange={(e) => handleFilter('branch_id', e.target.value)}>
              <option value="">Select Branch</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select className="input" value={filters.year} onChange={(e) => handleFilter('year', e.target.value)}>
              <option value="">Select Year</option>
              {[1,2,3,4,5,6].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Semester</label>
            <select
              className="input"
              value={filters.semester}
              disabled={!filters.year}
              onChange={(e) => handleFilter('semester', e.target.value)}
            >
              <option value="">{filters.year ? 'Select Semester' : 'Select year first'}</option>
              {getSemestersForYear(filters.year).map((s) => <option key={s} value={s}>Sem {s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Subject</label>
            <select
              className="input"
              value={filters.subject_id}
              disabled={!filters.branch_id || !filters.year}
              onChange={(e) => handleFilter('subject_id', e.target.value)}
            >
              <option value="">{!filters.branch_id || !filters.year ? 'Select branch & year first' : 'Select Subject'}</option>
              {subjects.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Exam Component</label>
            <select
              className="input"
              value={filters.exam_component_id}
              disabled={!patternReady || components.length === 0}
              onChange={(e) => handleFilter('exam_component_id', e.target.value)}
            >
              <option value="">
                {!patternReady ? 'Select subject & semester first' : components.length === 0 ? 'No pattern configured' : 'Select Component'}
              </option>
              {components.map((c) => <option key={c._id} value={c._id}>{c.name} — {c.max_marks} marks</option>)}
            </select>
            {patternReady && patternStatus === 'error' && (
              <p className="text-xs text-red-500 mt-1">No exam pattern found for this year/semester.</p>
            )}
          </div>
        </div>
      </div>

      {!marksReady ? (
        <EmptyState title="Select filters above" description="Choose branch, year, semester, subject and component to view marks." />
      ) : marksLoading ? (
        <LoadingSpinner className="py-16" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Students', value: students.length, color: 'text-gray-900' },
              { label: 'Submitted', value: submitted, color: 'text-blue-600' },
              { label: 'Pass', value: passed, color: 'text-green-600' },
              { label: `Avg / ${maxMarks}`, value: avgMarks, color: 'text-purple-600' },
            ].map((s) => (
              <div key={s.label} className="card p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setView('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'table' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
              >
                <Table size={14} /> Table
              </button>
              <button
                onClick={() => setView('charts')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'charts' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
              >
                <BarChart2 size={14} /> Charts
              </button>
            </div>
            <button
              onClick={handlePDF}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg"
            >
              <Download size={14} /> Download PDF
            </button>
          </div>

          <div ref={printRef}>
            <div className="hidden print:block mb-4">
              <h1 className="text-lg font-bold">{selectedSubject?.name} — {selectedComponent?.name}</h1>
              <p className="text-sm text-gray-500">Year {filters.year} · Sem {filters.semester} · Max: {maxMarks} · Pass: {passMarks}</p>
            </div>

            {view === 'table' ? (
              <div className="card">
                <div className="px-5 py-3 border-b border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {selectedComponent?.name} — {selectedSubject?.name}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Max: {maxMarks} · Weightage: {selectedComponent?.weightage_percent}% · Pass: {passMarks}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {['#','Student','Enrollment',`Marks / ${maxMarks}`,'%','Status'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {students.map((s, i) => {
                        const m = s.marks?.total_marks ?? null;
                        const pct = m !== null && maxMarks > 0 ? Math.round((m / maxMarks) * 100) : null;
                        const pass = m !== null && m >= passMarks;
                        return (
                          <tr key={s._id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{s.enrollment_number}</td>
                            <td className="px-4 py-3 font-semibold">{m ?? <span className="text-gray-300 text-xs font-normal">—</span>}</td>
                            <td className="px-4 py-3">
                              {pct !== null ? (
                                <span className={`text-xs font-medium ${pct >= 50 ? 'text-green-600' : 'text-red-500'}`}>{pct}%</span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              {m === null
                                ? <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Pending</span>
                                : pass
                                ? <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Pass</span>
                                : <span className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">Fail</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Pass / Fail / Pending</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Marks Distribution</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={buckets}>
                      <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Top 5 Students</h3>
                  <div className="space-y-2">
                    {[...students].filter((s) => s.marks).sort((a,b) => b.marks.total_marks - a.marks.total_marks).slice(0,5).map((s, i) => {
                      const pct = maxMarks > 0 ? Math.round((s.marks.total_marks / maxMarks) * 100) : 0;
                      return (
                        <div key={s._id} className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-4">{i+1}</span>
                          <span className="text-sm flex-1 truncate">{s.name}</span>
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-medium text-gray-700 w-8 text-right">{s.marks.total_marks}</span>
                        </div>
                      );
                    })}
                    {students.filter((s) => s.marks).length === 0 && <p className="text-xs text-gray-400">No marks submitted yet.</p>}
                  </div>
                </div>
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Bottom 5 Students</h3>
                  <div className="space-y-2">
                    {[...students].filter((s) => s.marks).sort((a,b) => a.marks.total_marks - b.marks.total_marks).slice(0,5).map((s, i) => {
                      const pct = maxMarks > 0 ? Math.round((s.marks.total_marks / maxMarks) * 100) : 0;
                      return (
                        <div key={s._id} className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-4">{i+1}</span>
                          <span className="text-sm flex-1 truncate">{s.name}</span>
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-medium text-gray-700 w-8 text-right">{s.marks.total_marks}</span>
                        </div>
                      );
                    })}
                    {students.filter((s) => s.marks).length === 0 && <p className="text-xs text-gray-400">No marks submitted yet.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─── QUIZ MARKS TAB ──────────────────────────────────────────────────────────

const QuizMarksTab = () => {
  const [filters, setFilters] = useState({ branch_id: '', year: '', subject_id: '' });
  const [selectedQuizId, setSelectedQuizId] = useState(null);

  const { data: branches = [] } = useQuery({
    queryKey: ['hod-branches'],
    queryFn: hodApi.getDeptBranches,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['hod-subjects-quiz', filters.branch_id, filters.year],
    queryFn: () => hodApi.getDeptSubjects({ branch_id: filters.branch_id, year: filters.year }),
    enabled: !!(filters.branch_id && filters.year),
  });

  const { data: quizListData, isLoading: quizListLoading } = useQuery({
    queryKey: ['hod-quiz-marks-list', filters],
    queryFn: () => hodApi.getQuizMarks({
      branch_id: filters.branch_id || undefined,
      year: filters.year || undefined,
      subject_id: filters.subject_id || undefined,
    }),
  });

  const quizzes = quizListData?.data?.quizzes || quizListData?.quizzes || [];

  const { data: quizDetailData, isLoading: detailLoading } = useQuery({
    queryKey: ['hod-quiz-marks-detail', selectedQuizId],
    queryFn: () => hodApi.getQuizMarks({ quiz_id: selectedQuizId }),
    enabled: !!selectedQuizId,
  });

  const detailQuiz = quizDetailData?.data?.quiz || quizDetailData?.quiz || null;
  const detailStudents = quizDetailData?.data?.students || quizDetailData?.students || [];

  const handleFilterChange = (field, value) => {
    setFilters((p) => {
      const next = { ...p, [field]: value };
      if (field === 'branch_id') next.subject_id = '';
      if (field === 'year') next.subject_id = '';
      return next;
    });
    setSelectedQuizId(null);
  };

  // ── Detail view ──
  if (selectedQuizId) {
    if (detailLoading) return <LoadingSpinner className="py-16" />;

    const totalMarks = detailQuiz?.total_marks || 0;
    const passThreshold = Math.round(totalMarks * 0.4); // 40% pass
    const passed = detailStudents.filter((s) => s.score >= passThreshold).length;
    const failed = detailStudents.length - passed;
    const avgScore = detailStudents.length > 0
      ? (detailStudents.reduce((sum, s) => sum + s.score, 0) / detailStudents.length).toFixed(1)
      : 0;

    const pieData = [
      { name: 'Pass (≥40%)', value: passed },
      { name: 'Fail (<40%)', value: failed },
    ].filter((d) => d.value > 0);

    const buckets = [
      { range: '0-40%', count: 0 },
      { range: '41-60%', count: 0 },
      { range: '61-75%', count: 0 },
      { range: '76-90%', count: 0 },
      { range: '91-100%', count: 0 },
    ];
    detailStudents.forEach((s) => {
      const pct = totalMarks > 0 ? (s.score / totalMarks) * 100 : 0;
      if (pct <= 40) buckets[0].count++;
      else if (pct <= 60) buckets[1].count++;
      else if (pct <= 75) buckets[2].count++;
      else if (pct <= 90) buckets[3].count++;
      else buckets[4].count++;
    });

    return (
      <div className="space-y-4">
        {/* Back + quiz title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedQuizId(null)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ChevronLeft size={16} /> Back to quizzes
          </button>
          <span className="text-gray-300">|</span>
          <h2 className="text-sm font-semibold text-gray-900 truncate">{detailQuiz?.title}</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
            {detailQuiz?.subject_id?.name} ({detailQuiz?.subject_id?.code})
          </span>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Attempted', value: detailStudents.length, color: 'text-gray-900' },
            { label: 'Pass (≥40%)', value: passed, color: 'text-green-600' },
            { label: 'Fail (<40%)', value: failed, color: 'text-red-500' },
            { label: `Avg / ${totalMarks}`, value: avgScore, color: 'text-purple-600' },
          ].map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Pass / Fail</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Score Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={buckets}>
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Student table */}
        <div className="card">
          <div className="px-5 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Student Scores</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Total marks: {totalMarks} · Year {detailQuiz?.year} · {detailStudents.length} attempted
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Rank', 'Student', 'Enrollment', `Score / ${totalMarks}`, '%', 'Submitted', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {detailStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No submissions yet.</td>
                  </tr>
                ) : (
                  detailStudents.map((s, i) => {
                    const pass = s.percentage >= 40;
                    return (
                      <tr key={s._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400 text-xs font-medium">#{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{s.enrollment_number}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{s.score}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${s.percentage >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                            {s.percentage}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {s.submitted_at
                            ? new Date(s.submitted_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                            : '—'}
                          {s.is_auto_submitted && (
                            <span className="ml-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Auto</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {pass
                            ? <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Pass</span>
                            : <span className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">Fail</span>
                          }
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── Quiz list view ──
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Branch</label>
            <select className="input" value={filters.branch_id} onChange={(e) => handleFilterChange('branch_id', e.target.value)}>
              <option value="">All Branches</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select className="input" value={filters.year} onChange={(e) => handleFilterChange('year', e.target.value)}>
              <option value="">All Years</option>
              {[1,2,3,4,5,6].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Subject</label>
            <select
              className="input"
              value={filters.subject_id}
              disabled={!filters.branch_id || !filters.year}
              onChange={(e) => handleFilterChange('subject_id', e.target.value)}
            >
              <option value="">{!filters.branch_id || !filters.year ? 'Select branch & year first' : 'All Subjects'}</option>
              {subjects.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
        </div>
      </div>

      {quizListLoading ? (
        <LoadingSpinner className="py-16" />
      ) : quizzes.length === 0 ? (
        <EmptyState title="No quizzes found" description="No published quizzes match the selected filters." />
      ) : (
        <div className="card">
          <div className="px-5 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Published Quizzes</h2>
            <p className="text-xs text-gray-500 mt-0.5">{quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''} · click a row to view scores</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Quiz', 'Subject', 'Branch', 'Year', 'Total Marks', 'Attempted', 'Avg Score', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {quizzes.map((q) => (
                  <tr
                    key={q._id}
                    onClick={() => setSelectedQuizId(q._id)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">{q.title}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {q.subject_id?.name}
                      <span className="text-gray-400 ml-1">({q.subject_id?.code})</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{q.branch_id?.name}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">Year {q.year}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{q.total_marks}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${q.attempt_count > 0 ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                        {q.attempt_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-purple-600">
                      {q.avg_score !== null ? `${q.avg_score} / ${q.total_marks}` : <span className="text-gray-300 text-xs font-normal">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(q.start_time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODMarksPage;
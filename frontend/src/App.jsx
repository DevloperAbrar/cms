import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { RoleGuard, getRoleHome } from './utils/roleGuard';
import useAuthStore from './store/authStore';

import SuperAdminFinalResults from './pages/superadmin/FinalResults';
import CoordinatorFinalResults from './pages/coordinator/FinalResults';
import HODFinalResults from './pages/hod/FinalResults';
import FacultyFinalResults from './pages/faculty/FinalResults';
import StudentFinalResults from './pages/student/FinalResults';
import ExamControllerFinalResults from './pages/examcontroller/FinalResults';

// Layouts
import {
  SuperAdminLayout,
  HODLayout,
  CoordinatorLayout,
  FacultyLayout,
  ExamControllerLayout,
  StudentLayout,
} from './layouts';

// Auth pages
import SuperAdminLogin from './pages/auth/SuperAdminLogin';
import GoogleCallback from './pages/auth/GoogleCallback';

// Super Admin pages
import SuperAdminDashboard from './pages/superadmin/Dashboard';
import { StreamsPage } from './pages/superadmin/Streams';
import DepartmentsPage from './pages/superadmin/Departments';
import BranchesPage from './pages/superadmin/Branches';
import SubjectsPage from './pages/superadmin/Subjects';
import { StudentsPage, FacultyPage, HODsPage, ExamControllerPage } from './pages/superadmin/Users';
import ExamPatternPage from './pages/superadmin/ExamPattern';
import AuditLogsPage from './pages/superadmin/AuditLogs';
import SANoticesPage from './pages/superadmin/Notices';

// HOD pages
import HODDashboard from './pages/hod/Dashboard';
import HODTimetable from './pages/hod/Timetable';
import HODStudents from './pages/hod/Students';
import HODAttendance from './pages/hod/Attendance';
import HODMarks from './pages/hod/Marks';
import HODMarksLock from './pages/hod/MarksLock';
import HODFaculty from './pages/hod/FacultyManage';
import HODCoordinators from './pages/hod/Coordinators';
import HODParentURL from './pages/hod/ParentURL';
import HODNotices from './pages/hod/Notices';
import HODMessages from './pages/hod/Messages';
import HODSubjects from './pages/hod/Subjects';
import HODExamPatternPage from './pages/hod/ExamPattern';

// Coordinator pages
import CoordinatorDashboard from './pages/coordinator/Dashboard';
import CoordinatorBranchStudents from './pages/coordinator/BranchStudents';
import CoordinatorAttendance from './pages/coordinator/Attendance';
import CoordinatorMarks from './pages/coordinator/Marks';
import CoordinatorEndSemMarks from './pages/coordinator/EndSemMarks';
import CoordinatorParentURL from './pages/coordinator/ParentURL';
import CoordinatorNotices from './pages/coordinator/Notices';
import CoordinatorMessages from './pages/coordinator/Messages';
import CoordinatorSubjectMarks from './pages/coordinator/SubjectMarks';

// Faculty pages
import FacultyDashboard from './pages/faculty/Dashboard';
import FacultyStudents from './pages/faculty/MyStudents';
import FacultyMarks from './pages/faculty/Marks';
import FacultySubFieldConfig from './pages/faculty/SubFieldConfig';
import FacultyQuiz from './pages/faculty/Quiz';
import FacultyQuizCreate from './pages/faculty/QuizCreate';
import FacultyQuizResults from './pages/faculty/QuizResults';
import FacultyNotices from './pages/faculty/Notices';
import FacultyMessages from './pages/faculty/Messages';
import FacultyAttendance from './pages/faculty/Attendance';
import FacultyQuizEdit from './pages/faculty/QuizEdit';

// Exam Controller pages
import ExamControllerDashboard from './pages/examcontroller/Dashboard';
import ExamControllerEndSemMarks from './pages/examcontroller/EndSemMarks';

// Student pages
import StudentDashboard from './pages/student/Dashboard';
import StudentAttendance from './pages/student/Attendance';
import StudentMarks from './pages/student/Marks';
import StudentTimetable from './pages/student/Timetable';
import StudentQuiz from './pages/student/Quiz';
import StudentQuizAttempt from './pages/student/QuizAttempt';
import StudentNotices from './pages/student/Notices';
import StudentQuizResult from './pages/student/StudentQuizResult';

// Parent
import ParentView from './pages/parent/ParentView';

// ── Platform Owner (Main Super Admin) ────────────────────────────────────────
import PlatformLogin from './pages/platform/PlatformLogin';
import PlatformDashboard from './pages/platform/PlatformDashboard';
import PlatformGuard from './guards/PlatformGuard';
// ─────────────────────────────────────────────────────────────────────────────

const HomeRedirect = () => {
  const { user, isAuthenticated } = useAuthStore();
  if (isAuthenticated && user) return <Navigate to={getRoleHome(user.role)} replace />;
  return <SuperAdminLogin />;
};

const App = () => {
  const { fetchMe } = useAuth();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      fetchMe();
    }

    const handler = () => {
      window.location.href = '/';
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/auth/callback" element={<GoogleCallback />} />
      <Route path="/auth/error" element={<div className="min-h-screen flex items-center justify-center"><p className="text-red-600">Authentication failed. Please try again.</p></div>} />
      <Route path="/parent/:token" element={<ParentView />} />

      {/* ── Platform Owner — completely separate auth track ── */}
      <Route path="/platform/login" element={<PlatformLogin />} />
      <Route path="/platform/dashboard" element={
        <PlatformGuard>
          <PlatformDashboard />
        </PlatformGuard>
      } />
      {/* Redirect /platform → /platform/login for convenience */}
      <Route path="/platform" element={<Navigate to="/platform/login" replace />} />

      {/* Super Admin */}
      <Route path="/superadmin" element={<RoleGuard allowedRoles={['superadmin']}><SuperAdminLayout /></RoleGuard>}>
        <Route index element={<SuperAdminDashboard />} />
        <Route path="streams" element={<StreamsPage />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="subjects" element={<SubjectsPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="faculty" element={<FacultyPage />} />
        <Route path="hods" element={<HODsPage />} />
        <Route path="exam-controller" element={<ExamControllerPage />} />
        <Route path="exam-pattern" element={<ExamPatternPage />} />
        <Route path="notices" element={<SANoticesPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="final-results" element={<SuperAdminFinalResults />} />
      </Route>

      {/* HOD */}
      <Route path="/hod" element={<RoleGuard allowedRoles={['hod']}><HODLayout /></RoleGuard>}>
        <Route index element={<HODDashboard />} />
        <Route path="timetable" element={<HODTimetable />} />
        <Route path="students" element={<HODStudents />} />
        <Route path="attendance" element={<HODAttendance />} />
        <Route path="marks" element={<HODMarks />} />
        <Route path="marks-lock" element={<HODMarksLock />} />
        <Route path="faculty" element={<HODFaculty />} />
        <Route path="coordinators" element={<HODCoordinators />} />
        <Route path="parent-url" element={<HODParentURL />} />
        <Route path="notices" element={<HODNotices />} />
        <Route path="messages" element={<HODMessages />} />
        <Route path="subjects" element={<HODSubjects />} />
        <Route path="exam-pattern" element={<HODExamPatternPage />} />
        <Route path="final-results" element={<HODFinalResults />} />
      </Route>

      {/* Coordinator */}
      <Route path="/coordinator" element={<RoleGuard allowedRoles={['coordinator']}><CoordinatorLayout /></RoleGuard>}>
        <Route index element={<CoordinatorDashboard />} />
        <Route path="branch-students" element={<CoordinatorBranchStudents />} />
        <Route path="attendance" element={<CoordinatorAttendance />} />
        <Route path="marks" element={<CoordinatorSubjectMarks />} />
        <Route path="endsem-marks" element={<CoordinatorEndSemMarks />} />
        <Route path="quiz" element={<FacultyQuiz apiBase="coordinator" />} />
        <Route path="quiz/create" element={<FacultyQuizCreate apiBase="coordinator" />} />
        <Route path="quiz/:id/edit" element={<FacultyQuizEdit apiBase="coordinator" />} />
        <Route path="quiz/:id/results" element={<FacultyQuizResults apiBase="coordinator" />} />
        <Route path="parent-url" element={<CoordinatorParentURL />} />
        <Route path="notices" element={<CoordinatorNotices />} />
        <Route path="messages" element={<CoordinatorMessages />} />
        <Route path="final-results" element={<CoordinatorFinalResults />} />
      </Route>

      {/* Faculty */}
      <Route path="/faculty" element={<RoleGuard allowedRoles={['faculty']}><FacultyLayout /></RoleGuard>}>
        <Route index element={<FacultyDashboard />} />
        <Route path="students" element={<FacultyStudents />} />
        <Route path="marks" element={<FacultyMarks />} />
        <Route path="sub-field" element={<FacultySubFieldConfig />} />
        <Route path="quiz" element={<FacultyQuiz apiBase="faculty" />} />
        <Route path="quiz/create" element={<FacultyQuizCreate apiBase="faculty" />} />
        <Route path="quiz/:id/edit" element={<FacultyQuizEdit apiBase="faculty" />} />
        <Route path="quiz/:id/results" element={<FacultyQuizResults apiBase="faculty" />} />
        <Route path="notices" element={<FacultyNotices />} />
        <Route path="messages" element={<FacultyMessages />} />
        <Route path="attendance" element={<FacultyAttendance />} />
        <Route path="final-results" element={<FacultyFinalResults />} />
      </Route>

      {/* Exam Controller */}
      <Route path="/examcontroller" element={<RoleGuard allowedRoles={['examcontroller']}><ExamControllerLayout /></RoleGuard>}>
        <Route index element={<ExamControllerDashboard />} />
        <Route path="endsem-marks" element={<ExamControllerEndSemMarks />} />
        <Route path="final-results" element={<ExamControllerFinalResults />} />
      </Route>

      {/* Student */}
      <Route path="/student" element={<RoleGuard allowedRoles={['student']}><StudentLayout /></RoleGuard>}>
        <Route index element={<StudentDashboard />} />
        <Route path="attendance" element={<StudentAttendance />} />
        <Route path="marks" element={<StudentMarks />} />
        <Route path="timetable" element={<StudentTimetable />} />
        <Route path="quiz" element={<StudentQuiz />} />
        <Route path="quiz/:quiz_id/attempt" element={<StudentQuizAttempt />} />
        <Route path="quiz/:quiz_id/result" element={<StudentQuizResult />} />
        <Route path="notices" element={<StudentNotices />} />
        <Route path="final-results" element={<StudentFinalResults />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
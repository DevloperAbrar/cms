import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/common/Navbar';
import { Sidebar } from '../components/common/Sidebar';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  ClipboardList,
  CalendarDays,
  BarChart2,
  MessageSquare,
  Bell,
  Link2,
  Lock,
  FileText,
  UserCog,
  Award,
  CheckSquare,
  School,
} from 'lucide-react';

/**
 * Factory that creates a role-specific layout component with its own sidebar links.
 * Keeps layout logic DRY — every role shares the same shell, just different nav links.
 */
const createLayout = (links) => {
  const Layout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar
          links={links}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Navbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    );
  };

  return Layout;
};

// ─── SUPER ADMIN ─────────────────────────────────────────────────────────────

export const SuperAdminLayout = createLayout([
  { to: '/superadmin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/superadmin/streams', label: 'Streams', icon: School },
  { to: '/superadmin/departments', label: 'Departments', icon: BookOpen },
  { to: '/superadmin/branches', label: 'Branches', icon: GraduationCap },
  { to: '/superadmin/subjects', label: 'Subjects', icon: FileText },
  { to: '/superadmin/students', label: 'Students', icon: Users },
  { to: '/superadmin/faculty', label: 'Faculty', icon: UserCog },
  { to: '/superadmin/hods', label: 'HODs', icon: Award },
  { to: '/superadmin/exam-controller', label: 'Exam Controller', icon: CheckSquare },
  { to: '/superadmin/exam-pattern', label: 'Exam Pattern', icon: ClipboardList },
  { to: '/superadmin/notices', label: 'Notices', icon: Bell },
  { to: '/superadmin/final-results', label: 'Final Results', icon: BarChart2 },
  { to: '/superadmin/audit-logs', label: 'Audit Logs', icon: BarChart2 },

]);

// ─── HOD ─────────────────────────────────────────────────────────────────────

export const HODLayout = createLayout([
  { to: '/hod', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/hod/timetable', label: 'Timetable', icon: CalendarDays },
  { to: '/hod/students', label: 'Students', icon: Users },
  { to: '/hod/attendance', label: 'Attendance', icon: CheckSquare },
  { to: '/hod/exam-pattern', label: 'Exam Pattern', icon: ClipboardList },
  { to: '/hod/subjects', label: 'Subjects', icon: FileText },
  { to: '/hod/marks', label: 'Marks', icon: ClipboardList },
  { to: '/hod/marks-lock', label: 'Marks Lock', icon: Lock },
  { to: '/hod/final-results', label: 'Final Results', icon: BarChart2 },
  { to: '/hod/faculty', label: 'Faculty', icon: UserCog },
  { to: '/hod/coordinators', label: 'Coordinators', icon: Award },
  { to: '/hod/parent-url', label: 'Parent URL', icon: Link2 },
  { to: '/hod/notices', label: 'Notices', icon: Bell },
  { to: '/hod/messages', label: 'Messages', icon: MessageSquare },
]);

// ─── COORDINATOR ─────────────────────────────────────────────────────────────

export const CoordinatorLayout = createLayout([
  { to: '/coordinator', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/coordinator/branch-students', label: 'Branch Students', icon: Users },
  { to: '/coordinator/attendance', label: 'Attendance', icon: CheckSquare },
  { to: '/coordinator/marks', label: 'My Subject Marks', icon: ClipboardList },
  // { to: '/coordinator/endsem-marks', label: 'End Sem Marks', icon: FileText },
  { to: '/coordinator/final-results', label: 'Final Results', icon: BarChart2 },
  { to: '/coordinator/quiz', label: 'Quizzes', icon: BookOpen },
  { to: '/coordinator/parent-url', label: 'Parent URL', icon: Link2 },
  { to: '/coordinator/notices', label: 'Notices', icon: Bell },
  { to: '/coordinator/messages', label: 'Messages', icon: MessageSquare },
]);

// ─── FACULTY ─────────────────────────────────────────────────────────────────

export const FacultyLayout = createLayout([
  { to: '/faculty', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/faculty/attendance', label: 'Attendance', icon: CheckSquare },
  { to: '/faculty/students', label: 'My Students', icon: Users },
  { to: '/faculty/marks', label: 'Marks Entry', icon: ClipboardList },
  { to: '/faculty/marks-upload', label: 'Marks Upload', icon: FileText },
  { to: '/faculty/final-results', label: 'Final Results', icon: BarChart2 },
  // { to: '/faculty/sub-field', label: 'Sub-Field Config', icon: FileText },
  { to: '/faculty/quiz', label: 'Quizzes', icon: BookOpen },
  { to: '/faculty/notices', label: 'Notices', icon: Bell },
  { to: '/faculty/messages', label: 'Messages', icon: MessageSquare },
]);

// ─── EXAM CONTROLLER ─────────────────────────────────────────────────────────

export const ExamControllerLayout = createLayout([
  { to: '/examcontroller', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/examcontroller/final-results', label: 'Final Results', icon: BarChart2 },
]);

// ─── STUDENT ─────────────────────────────────────────────────────────────────

export const StudentLayout = createLayout([
  { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/student/attendance', label: 'Attendance', icon: CheckSquare },
  { to: '/student/marks', label: 'Marks', icon: ClipboardList },
  { to: '/student/final-results', label: 'Final Results', icon: BarChart2 },
  { to: '/student/timetable', label: 'Timetable', icon: CalendarDays },
  { to: '/student/quiz', label: 'Quizzes', icon: BookOpen },
  { to: '/student/notices', label: 'Notices', icon: Bell },
]);
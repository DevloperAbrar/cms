import useAuthStore from '../store/authStore';

export const ROLES = {
  SUPERADMIN: 'superadmin',
  EXAM_CONTROLLER: 'examcontroller',
  HOD: 'hod',
  COORDINATOR: 'coordinator',
  FACULTY: 'faculty',
  STUDENT: 'student',
};

export const useRole = () => {
  const { user } = useAuthStore();
  const role = user?.role;

  return {
    role,
    isSuperAdmin: role === ROLES.SUPERADMIN,
    isHOD: role === ROLES.HOD,
    isCoordinator: role === ROLES.COORDINATOR,
    isFaculty: role === ROLES.FACULTY,
    isStudent: role === ROLES.STUDENT,
    isExamController: role === ROLES.EXAM_CONTROLLER,
    hasRole: (...roles) => roles.includes(role),
  };
};
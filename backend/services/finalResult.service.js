const prisma = require('../config/prismaClient');

const getRankedResults = async (configId, filter = {}) => {
  const where = { configId, isPublished: true };
  if (filter.branch_id || filter.branchId) where.branchId = filter.branch_id || filter.branchId;
  if (filter.department_id || filter.departmentId) where.departmentId = filter.department_id || filter.departmentId;

  const results = await prisma.finalResult.findMany({
    where,
    include: {
      config: true,
      student: { select: { name: true, enrollmentNumber: true, branchId: true, departmentId: true, year: true, semester: true } },
      branch: { select: { name: true, code: true } },
      department: { select: { name: true, code: true } },
    },
    orderBy: { value: 'desc' },
  });

  return results.map((r, idx) => ({
    ...r,
    rank: idx + 1,
    _id: r.id,
    student_id: { _id: r.studentId, name: r.student?.name, enrollment_number: r.student?.enrollmentNumber },
    branch_id: r.branch ? { _id: r.branchId, name: r.branch.name, code: r.branch.code } : r.branchId,
    department_id: r.department ? { _id: r.departmentId, name: r.department.name, code: r.department.code } : r.departmentId,
    is_published: r.isPublished,
    published_at: r.publishedAt,
  }));
};

const upsertResult = async ({ configId, studentId, branchId, departmentId, year, semester, value, submittedBy, collegeId }) => {
  const result = await prisma.finalResult.upsert({
    where: { configId_studentId: { configId, studentId } },
    update: { branchId, departmentId, year, semester, value, submittedById: submittedBy },
    create: { collegeId, configId, studentId, branchId, departmentId, year, semester, value, submittedById: submittedBy },
  });
  return result;
};

const publishResults = async (configId, branchId) => {
  return prisma.finalResult.updateMany({
    where: { configId, branchId },
    data: { isPublished: true, publishedAt: new Date() },
  });
};

const unpublishResults = async (configId, branchId) => {
  return prisma.finalResult.updateMany({
    where: { configId, branchId },
    data: { isPublished: false, publishedAt: null },
  });
};

module.exports = { getRankedResults, upsertResult, publishResults, unpublishResults };
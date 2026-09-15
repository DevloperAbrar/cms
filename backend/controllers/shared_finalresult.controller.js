const prisma = require('../config/prismaClient');
const { getRankedResults } = require('../services/finalResult.service');
const { sendSuccess, sendError, sendBadRequest, sendNotFound } = require('../utils/apiResponse');

exports.getPublishedConfigs = async (req, res) => {
  try {
    const where = { isActive: true };
    if (req.user?.collegeId) where.collegeId = req.user.collegeId;
    if (req.query.year) where.year = Number(req.query.year);
    if (req.query.semester) where.semester = Number(req.query.semester);

    const configs = await prisma.finalResultConfig.findMany({ where, orderBy: [{ year: 'asc' }, { semester: 'asc' }] });

    const configIds = configs.map((c) => c.id);
    const publishedResults = await prisma.finalResult.findMany({
      where: { configId: { in: configIds }, isPublished: true },
      select: { configId: true },
      distinct: ['configId'],
    });

    const publishedSet = new Set(publishedResults.map((r) => r.configId));
    const available = configs.filter((c) => publishedSet.has(c.id));

    return sendSuccess(res, available.map((c) => ({ ...c, _id: c.id, is_active: c.isActive, metric_type: c.metricType })));
  } catch (err) { return sendError(res, err.message); }
};

exports.getFinalResultRankings = async (req, res) => {
  try {
    const { config_id, scope = 'institute', branch_id, department_id, top } = req.query;
    if (!config_id) return sendBadRequest(res, 'config_id is required.');

    const config = await prisma.finalResultConfig.findUnique({ where: { id: config_id } });
    if (!config) return sendNotFound(res, 'Config not found.');

    const filter = {};
    if (scope === 'branch' && branch_id) filter.branch_id = branch_id;
    else if (scope === 'department' && department_id) filter.department_id = department_id;

    let ranked = await getRankedResults(config_id, filter);
    if (top) ranked = ranked.slice(0, Number(top));

    return sendSuccess(res, { config: { ...config, _id: config.id }, results: ranked });
  } catch (err) { return sendError(res, err.message); }
};

exports.getStudentOwnResult = async (req, res) => {
  try {
    const { config_id } = req.query;
    if (!config_id) return sendBadRequest(res, 'config_id is required.');

    const myResult = await prisma.finalResult.findFirst({
      where: { configId: config_id, studentId: req.user.id, isPublished: true },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    });
    if (!myResult) return sendNotFound(res, 'No published result found for you in this config.');

    const [branchRank, deptRank, instituteRank, branchTotal, deptTotal, instituteTotal] = await Promise.all([
      prisma.finalResult.count({ where: { configId: config_id, branchId: myResult.branchId, value: { gt: myResult.value }, isPublished: true } }),
      prisma.finalResult.count({ where: { configId: config_id, departmentId: myResult.departmentId, value: { gt: myResult.value }, isPublished: true } }),
      prisma.finalResult.count({ where: { configId: config_id, value: { gt: myResult.value }, isPublished: true } }),
      prisma.finalResult.count({ where: { configId: config_id, branchId: myResult.branchId, isPublished: true } }),
      prisma.finalResult.count({ where: { configId: config_id, departmentId: myResult.departmentId, isPublished: true } }),
      prisma.finalResult.count({ where: { configId: config_id, isPublished: true } }),
    ]);

    return sendSuccess(res, {
      result: {
        ...myResult, _id: myResult.id, is_published: myResult.isPublished, published_at: myResult.publishedAt,
        branch_id: myResult.branch ? { _id: myResult.branchId, name: myResult.branch.name, code: myResult.branch.code } : myResult.branchId,
        department_id: myResult.department ? { _id: myResult.departmentId, name: myResult.department.name, code: myResult.department.code } : myResult.departmentId,
      },
      ranks: {
        branch: { rank: branchRank + 1, total: branchTotal },
        department: { rank: deptRank + 1, total: deptTotal },
        institute: { rank: instituteRank + 1, total: instituteTotal },
      },
    });
  } catch (err) { return sendError(res, err.message); }
};
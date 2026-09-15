const service = require('../services/academicPromotion.service');

async function openSession(req, res) {
  const { collegeId } = req.user; // set by auth.middleware — superadmin-scoped
  const session = await service.openNewSession(collegeId, req.body);
  res.status(201).json({ success: true, data: session });
}

async function promote(req, res) {
  const { collegeId } = req.user;
  const { branchId, fromSessionId, toSessionId, finalYearNumber, repeaterStudentIds } = req.body;
  const result = await service.promoteBranch({
    collegeId, branchId, fromSessionId, toSessionId, finalYearNumber, repeaterStudentIds,
  });
  res.json({ success: true, data: result });
}

async function enrollBatch(req, res) {
  const { collegeId } = req.user;
  const { branchId, academicSessionId, students } = req.body;
  const created = await service.enrollNewBatch({ collegeId, branchId, academicSessionId, students });
  res.status(201).json({ success: true, data: { count: created.length } });
}

module.exports = { openSession, promote, enrollBatch };
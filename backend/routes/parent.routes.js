const express = require('express');
const ctrl = require('../controllers/parent.controller');

const router = express.Router();

// Public — no auth
// GET /api/parent/:token
router.get('/:token', ctrl.getParentView);

module.exports = router;
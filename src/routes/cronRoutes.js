const express = require('express');
const router = express.Router();
const { processAbandonedCarts } = require('../controllers/cronController');

/**
 * Cron Routes
 * Base path: /api/cron
 * Called by Vercel Cron Jobs
 */

router.get('/process-abandoned', processAbandonedCarts);

module.exports = router;

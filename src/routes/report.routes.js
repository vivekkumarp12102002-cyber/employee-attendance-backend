const express = require("express");

const {
    getMonthlyReport
} = require("../controllers/report.controller");

const {
    authenticateToken,
    requireAdmin
} = require("../middleware/auth.middleware");


const router = express.Router();


// ======================================================
// MONTHLY ATTENDANCE REPORT
//
// GET /api/reports/monthly
//
// Example:
// /api/reports/monthly?month=2026-10
//
// ADMIN ONLY
// ======================================================

router.get(
    "/monthly",
    authenticateToken,
    requireAdmin,
    getMonthlyReport
);


module.exports = router;
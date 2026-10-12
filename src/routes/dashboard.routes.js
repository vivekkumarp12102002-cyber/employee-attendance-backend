const express = require("express");

const {
    getAttendanceDashboard
} = require("../controllers/dashboard.controller");

const {
    authenticateToken,
    requireAdmin
} = require("../middleware/auth.middleware");

const router = express.Router();

// ============================================================
// Admin Attendance Dashboard
// ============================================================

router.get(
    "/attendance",
    authenticateToken,
    requireAdmin,
    getAttendanceDashboard
);

module.exports = router;
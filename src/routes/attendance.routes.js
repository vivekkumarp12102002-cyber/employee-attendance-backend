const express = require("express");

const {
    checkIn,
    checkOut,
    getAttendance,
    getTodayAttendance,
    getEmployeeAttendance,
    getEmployeeAttendanceSummary,
    getEmployeeMonthlySummary
} = require("../controllers/attendance.controller");

const {
    authenticateToken,
    requireAdmin,
    requireEmployee
} = require("../middleware/auth.middleware");

const router = express.Router();

// ============================================================
// Employee Check-In
// ============================================================

router.post(
    "/check-in",
    authenticateToken,
    requireEmployee,
    checkIn
);

// ============================================================
// Employee Check-Out
// ============================================================

router.post(
    "/check-out",
    authenticateToken,
    requireEmployee,
    checkOut
);

// ============================================================
// Admin - All Attendance
// ============================================================

router.get(
    "/",
    authenticateToken,
    requireAdmin,
    getAttendance
);

// ============================================================
// Admin - Today's Attendance
// ============================================================

router.get(
    "/today",
    authenticateToken,
    requireAdmin,
    getTodayAttendance
);

// ============================================================
// Employee/Admin - Employee Attendance
// ============================================================

router.get(
    "/employee/:employeeId",
    authenticateToken,
    getEmployeeAttendance
);

// ============================================================
// Employee/Admin - Attendance Summary
// ============================================================

router.get(
    "/employee/:employeeId/summary",
    authenticateToken,
    getEmployeeAttendanceSummary
);

// ============================================================
// Employee/Admin - Monthly Summary
// ============================================================

router.get(
    "/employee/:employeeId/monthly-summary",
    authenticateToken,
    getEmployeeMonthlySummary
);

module.exports = router;
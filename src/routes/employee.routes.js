const express = require("express");

const {
    getEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee
} = require("../controllers/employee.controller");

const {
    authenticateToken,
    requireAdmin
} = require("../middleware/auth.middleware");

const router = express.Router();

// ============================================================
// Employee Routes
// ============================================================

// Get all employees
router.get(
    "/",
    authenticateToken,
    requireAdmin,
    getEmployees
);

// Get single employee
router.get(
    "/:id",
    authenticateToken,
    requireAdmin,
    getEmployeeById
);

// Create employee
router.post(
    "/",
    authenticateToken,
    requireAdmin,
    createEmployee
);

// Update employee
router.put(
    "/:id",
    authenticateToken,
    requireAdmin,
    updateEmployee
);

// Delete employee
router.delete(
    "/:id",
    authenticateToken,
    requireAdmin,
    deleteEmployee
);

module.exports = router;
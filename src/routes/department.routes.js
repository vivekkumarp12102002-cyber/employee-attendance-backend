const express = require("express");

const {
    getDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment
} = require("../controllers/department.controller");

const {
    authenticateToken,
    requireAdmin
} = require("../middleware/auth.middleware");

const router = express.Router();

router.get(
    "/",
    authenticateToken,
    getDepartments
);

router.get(
    "/:id",
    authenticateToken,
    requireAdmin,
    getDepartmentById
);

router.post(
    "/",
    authenticateToken,
    requireAdmin,
    createDepartment
);

router.put(
    "/:id",
    authenticateToken,
    requireAdmin,
    updateDepartment
);

router.delete(
    "/:id",
    authenticateToken,
    requireAdmin,
    deleteDepartment
);

module.exports = router;
const pool = require("../db/postgres");

// ==========================================
// GET ALL DEPARTMENTS
// ==========================================

const getDepartments = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                name
            FROM departments
            ORDER BY name ASC
        `);

        return res.status(200).json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error(
            "Get departments error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch departments"
        });
    }
};


// ==========================================
// GET DEPARTMENT BY ID
// ==========================================

const getDepartmentById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT
                id,
                name
            FROM departments
            WHERE id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Department not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error(
            "Get department error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch department"
        });
    }
};


// ==========================================
// CREATE DEPARTMENT
// ==========================================

const createDepartment = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Department name is required"
            });
        }

        const departmentName =
            name.trim();

        const existingDepartment =
            await pool.query(
                `
                SELECT id
                FROM departments
                WHERE LOWER(name) = LOWER($1)
                `,
                [departmentName]
            );

        if (
            existingDepartment.rows.length > 0
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Department already exists"
            });
        }

        const result =
            await pool.query(
                `
                INSERT INTO departments
                    (name)
                VALUES
                    ($1)
                RETURNING
                    id,
                    name
                `,
                [departmentName]
            );

        return res.status(201).json({
            success: true,
            message:
                "Department created successfully",
            data: result.rows[0]
        });

    } catch (error) {
        console.error(
            "Create department error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to create department"
        });
    }
};


// ==========================================
// UPDATE DEPARTMENT
// ==========================================

const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Department name is required"
            });
        }

        const departmentName =
            name.trim();

        const department =
            await pool.query(
                `
                SELECT id
                FROM departments
                WHERE id = $1
                `,
                [id]
            );

        if (department.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Department not found"
            });
        }

        const duplicate =
            await pool.query(
                `
                SELECT id
                FROM departments
                WHERE LOWER(name) = LOWER($1)
                AND id <> $2
                `,
                [
                    departmentName,
                    id
                ]
            );

        if (duplicate.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Another department with this name already exists"
            });
        }

        const result =
            await pool.query(
                `
                UPDATE departments
                SET name = $1
                WHERE id = $2
                RETURNING
                    id,
                    name
                `,
                [
                    departmentName,
                    id
                ]
            );

        return res.status(200).json({
            success: true,
            message:
                "Department updated successfully",
            data: result.rows[0]
        });

    } catch (error) {
        console.error(
            "Update department error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to update department"
        });
    }
};


// ==========================================
// DELETE DEPARTMENT
// ==========================================

const deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;

        const department =
            await pool.query(
                `
                SELECT
                    id,
                    name
                FROM departments
                WHERE id = $1
                `,
                [id]
            );

        if (department.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Department not found"
            });
        }

        const employees =
            await pool.query(
                `
                SELECT COUNT(*)::INTEGER AS count
                FROM employees
                WHERE department_id = $1
                `,
                [id]
            );

        const employeeCount =
            employees.rows[0].count;

        if (employeeCount > 0) {
            return res.status(409).json({
                success: false,
                message:
                    `Cannot delete department. ${employeeCount} employee(s) are assigned to this department.`
            });
        }

        await pool.query(
            `
            DELETE FROM departments
            WHERE id = $1
            `,
            [id]
        );

        return res.status(200).json({
            success: true,
            message:
                "Department deleted successfully"
        });

    } catch (error) {
        console.error(
            "Delete department error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to delete department"
        });
    }
};


// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    getDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment
};
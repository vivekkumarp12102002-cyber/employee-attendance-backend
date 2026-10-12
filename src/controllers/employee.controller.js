const pool = require("../db/postgres");
const bcrypt = require("bcryptjs");

// ============================================================
// Get All Employees
// ============================================================

const getEmployees = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                e.id,
                e.user_id,
                e.employee_code,
                e.name,
                e.email,
                e.department_id,
                d.name AS department,
                e.joining_date,
                e.status,
                e.created_at
            FROM employees e
            LEFT JOIN departments d
                ON e.department_id = d.id
            ORDER BY e.name ASC;
        `);

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error(
            "Get employees error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch employees"
        });
    }
};

// ============================================================
// Get Single Employee
// ============================================================

const getEmployeeById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || Number.isNaN(Number(id))) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee ID"
            });
        }

        const result = await pool.query(
            `
            SELECT
                e.id,
                e.user_id,
                e.employee_code,
                e.name,
                e.email,
                e.department_id,
                d.name AS department,
                e.joining_date,
                e.status,
                e.created_at
            FROM employees e
            LEFT JOIN departments d
                ON e.department_id = d.id
            WHERE e.id = $1;
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error(
            "Get employee error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch employee"
        });
    }
};

// ============================================================
// Create Employee
// ============================================================

const createEmployee = async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            employee_code,
            name,
            email,
            password,
            department_id,
            joining_date,
            status = "active"
        } = req.body;

        // ------------------------------------------------------
        // Validation
        // ------------------------------------------------------

        if (
            !employee_code ||
            !name ||
            !email ||
            !password ||
            !department_id ||
            !joining_date
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Employee code, name, email, password, department and joining date are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message:
                    "Password must be at least 6 characters"
            });
        }

        if (
            !["active", "inactive"].includes(
                status
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Status must be active or inactive"
            });
        }

        const cleanEmployeeCode =
            employee_code.trim();

        const cleanName =
            name.trim();

        const cleanEmail =
            email.trim().toLowerCase();

        // ------------------------------------------------------
        // Check Department
        // ------------------------------------------------------

        const departmentResult =
            await client.query(
                `
                SELECT id
                FROM departments
                WHERE id = $1;
                `,
                [department_id]
            );

        if (
            departmentResult.rows.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Department not found"
            });
        }

        // ------------------------------------------------------
        // Check Duplicate Email
        // ------------------------------------------------------

        const emailResult =
            await client.query(
                `
                SELECT id
                FROM users
                WHERE LOWER(email) = LOWER($1);
                `,
                [cleanEmail]
            );

        if (emailResult.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Email is already registered"
            });
        }

        // ------------------------------------------------------
        // Check Duplicate Employee Code
        // ------------------------------------------------------

        const codeResult =
            await client.query(
                `
                SELECT id
                FROM employees
                WHERE employee_code = $1;
                `,
                [cleanEmployeeCode]
            );

        if (codeResult.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Employee code already exists"
            });
        }

        // ------------------------------------------------------
        // Hash Password
        // ------------------------------------------------------

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );

        // ------------------------------------------------------
        // Start Transaction
        // ------------------------------------------------------

        await client.query("BEGIN");

        // ------------------------------------------------------
        // Create User
        // ------------------------------------------------------

        const userResult =
            await client.query(
                `
                INSERT INTO users (
                    email,
                    password,
                    role
                )
                VALUES ($1, $2, 'employee')
                RETURNING id, email, role;
                `,
                [
                    cleanEmail,
                    hashedPassword
                ]
            );

        const user =
            userResult.rows[0];

        // ------------------------------------------------------
        // Create Employee
        // ------------------------------------------------------

        const employeeResult =
            await client.query(
                `
                INSERT INTO employees (
                    user_id,
                    department_id,
                    employee_code,
                    name,
                    email,
                    joining_date,
                    status
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7
                )
                RETURNING
                    id,
                    user_id,
                    department_id,
                    employee_code,
                    name,
                    email,
                    joining_date,
                    status,
                    created_at;
                `,
                [
                    user.id,
                    department_id,
                    cleanEmployeeCode,
                    cleanName,
                    cleanEmail,
                    joining_date,
                    status
                ]
            );

        const employee =
            employeeResult.rows[0];

        // ------------------------------------------------------
        // Commit
        // ------------------------------------------------------

        await client.query("COMMIT");

        // ------------------------------------------------------
        // Return Employee
        // ------------------------------------------------------

        return res.status(201).json({
            success: true,
            message:
                "Employee created successfully",
            data: {
                ...employee,
                department:
                    departmentResult.rows[0]
                        ? undefined
                        : null
            }
        });

    } catch (error) {
        await client.query(
            "ROLLBACK"
        );

        console.error(
            "Create employee error:",
            error
        );

        // PostgreSQL unique constraint
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message:
                    "Employee email or employee code already exists"
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Failed to create employee"
        });

    } finally {
        client.release();
    }
};

// ============================================================
// Update Employee
// ============================================================

const updateEmployee = async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;

        const {
            employee_code,
            name,
            email,
            password,
            department_id,
            joining_date,
            status
        } = req.body;

        if (
            !id ||
            Number.isNaN(Number(id))
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee ID"
            });
        }

        // ------------------------------------------------------
        // Find Employee
        // ------------------------------------------------------

        const employeeResult =
            await client.query(
                `
                SELECT
                    id,
                    user_id,
                    employee_code,
                    name,
                    email,
                    department_id,
                    joining_date,
                    status
                FROM employees
                WHERE id = $1;
                `,
                [id]
            );

        if (
            employeeResult.rows.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const existing =
            employeeResult.rows[0];

        // ------------------------------------------------------
        // Prepare Values
        // ------------------------------------------------------

        const updatedCode =
            employee_code !== undefined
                ? employee_code.trim()
                : existing.employee_code;

        const updatedName =
            name !== undefined
                ? name.trim()
                : existing.name;

        const updatedEmail =
            email !== undefined
                ? email.trim().toLowerCase()
                : existing.email;

        const updatedDepartment =
            department_id !== undefined
                ? department_id
                : existing.department_id;

        const updatedJoiningDate =
            joining_date !== undefined
                ? joining_date
                : existing.joining_date;

        const updatedStatus =
            status !== undefined
                ? status
                : existing.status;

        // ------------------------------------------------------
        // Validation
        // ------------------------------------------------------

        if (
            !updatedCode ||
            !updatedName ||
            !updatedEmail ||
            !updatedDepartment ||
            !updatedJoiningDate
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Employee code, name, email, department and joining date are required"
            });
        }

        if (
            !["active", "inactive"].includes(
                updatedStatus
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Status must be active or inactive"
            });
        }

        // ------------------------------------------------------
        // Check Department
        // ------------------------------------------------------

        const departmentResult =
            await client.query(
                `
                SELECT id, name
                FROM departments
                WHERE id = $1;
                `,
                [updatedDepartment]
            );

        if (
            departmentResult.rows.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Department not found"
            });
        }

        // ------------------------------------------------------
        // Check Duplicate Email
        // ------------------------------------------------------

        const emailResult =
            await client.query(
                `
                SELECT id
                FROM users
                WHERE LOWER(email) = LOWER($1)
                AND id <> $2;
                `,
                [
                    updatedEmail,
                    existing.user_id
                ]
            );

        if (emailResult.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Email is already registered"
            });
        }

        // ------------------------------------------------------
        // Check Duplicate Employee Code
        // ------------------------------------------------------

        const codeResult =
            await client.query(
                `
                SELECT id
                FROM employees
                WHERE employee_code = $1
                AND id <> $2;
                `,
                [
                    updatedCode,
                    id
                ]
            );

        if (codeResult.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Employee code already exists"
            });
        }

        // ------------------------------------------------------
        // Start Transaction
        // ------------------------------------------------------

        await client.query("BEGIN");

        // ------------------------------------------------------
        // Update User
        // ------------------------------------------------------

        if (password) {
            if (password.length < 6) {
                await client.query(
                    "ROLLBACK"
                );

                return res.status(400).json({
                    success: false,
                    message:
                        "Password must be at least 6 characters"
                });
            }

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );

            await client.query(
                `
                UPDATE users
                SET
                    email = $1,
                    password = $2
                WHERE id = $3;
                `,
                [
                    updatedEmail,
                    hashedPassword,
                    existing.user_id
                ]
            );

        } else {
            await client.query(
                `
                UPDATE users
                SET email = $1
                WHERE id = $2;
                `,
                [
                    updatedEmail,
                    existing.user_id
                ]
            );
        }

        // ------------------------------------------------------
        // Update Employee
        // ------------------------------------------------------

        const updatedResult =
            await client.query(
                `
                UPDATE employees
                SET
                    employee_code = $1,
                    name = $2,
                    email = $3,
                    department_id = $4,
                    joining_date = $5,
                    status = $6
                WHERE id = $7
                RETURNING
                    id,
                    user_id,
                    department_id,
                    employee_code,
                    name,
                    email,
                    joining_date,
                    status,
                    created_at;
                `,
                [
                    updatedCode,
                    updatedName,
                    updatedEmail,
                    updatedDepartment,
                    updatedJoiningDate,
                    updatedStatus,
                    id
                ]
            );

        await client.query("COMMIT");

        // ------------------------------------------------------
        // Response
        // ------------------------------------------------------

        return res.status(200).json({
            success: true,
            message:
                "Employee updated successfully",
            data: {
                ...updatedResult.rows[0],
                department:
                    departmentResult.rows[0].name
            }
        });

    } catch (error) {
        await client.query(
            "ROLLBACK"
        );

        console.error(
            "Update employee error:",
            error
        );

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message:
                    "Employee email or employee code already exists"
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Failed to update employee"
        });

    } finally {
        client.release();
    }
};

// ============================================================
// Delete Employee
// ============================================================

const deleteEmployee = async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;

        if (
            !id ||
            Number.isNaN(Number(id))
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee ID"
            });
        }

        // ------------------------------------------------------
        // Find Employee
        // ------------------------------------------------------

        const employeeResult =
            await client.query(
                `
                SELECT
                    id,
                    user_id,
                    name
                FROM employees
                WHERE id = $1;
                `,
                [id]
            );

        if (
            employeeResult.rows.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const employee =
            employeeResult.rows[0];

        // ------------------------------------------------------
        // Transaction
        // ------------------------------------------------------

        await client.query("BEGIN");

        // ------------------------------------------------------
        // Delete Employee
        // ------------------------------------------------------
        // attendance has ON DELETE CASCADE,
        // so employee attendance records
        // will also be removed.

        await client.query(
            `
            DELETE FROM employees
            WHERE id = $1;
            `,
            [id]
        );

        // ------------------------------------------------------
        // Delete User
        // ------------------------------------------------------

        await client.query(
            `
            DELETE FROM users
            WHERE id = $1;
            `,
            [employee.user_id]
        );

        await client.query("COMMIT");

        return res.status(200).json({
            success: true,
            message:
                "Employee deleted successfully"
        });

    } catch (error) {
        await client.query(
            "ROLLBACK"
        );

        console.error(
            "Delete employee error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to delete employee"
        });

    } finally {
        client.release();
    }
};

// ============================================================
// Export
// ============================================================

module.exports = {
    getEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee
};
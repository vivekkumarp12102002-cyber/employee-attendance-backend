const pool = require("../db/postgres");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ============================================================
// Login
// ============================================================

const login = async (req, res) => {
    try {
        const {
            email,
            password
        } = req.body;

        // ------------------------------------------------------
        // Validation
        // ------------------------------------------------------

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message:
                    "Email and password are required"
            });
        }

        const cleanEmail =
            email.trim().toLowerCase();

        // ------------------------------------------------------
        // Find User
        // ------------------------------------------------------

        const userResult =
            await pool.query(
                `
                SELECT
                    id,
                    email,
                    password,
                    role
                FROM users
                WHERE LOWER(email) = LOWER($1);
                `,
                [cleanEmail]
            );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message:
                    "Invalid email or password"
            });
        }

        const user =
            userResult.rows[0];

        // ------------------------------------------------------
        // Password Check
        // ------------------------------------------------------

        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message:
                    "Invalid email or password"
            });
        }

        // ------------------------------------------------------
        // Employee Data
        // ------------------------------------------------------

        let employee = null;

        if (user.role === "employee") {

            const employeeResult =
                await pool.query(
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

                    WHERE e.user_id = $1;
                    `,
                    [user.id]
                );

            // Employee record missing
            if (
                employeeResult.rows.length === 0
            ) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Employee record not found"
                });
            }

            employee =
                employeeResult.rows[0];

            // --------------------------------------------------
            // Inactive Employee
            // --------------------------------------------------

            if (
                employee.status !== "active"
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Your employee account is inactive. Please contact admin."
                });
            }
        }

        // ------------------------------------------------------
        // JWT Payload
        // ------------------------------------------------------

        const tokenPayload = {
            userId: user.id,
            email: user.email,
            role: user.role
        };

        // Employee ID only for employee
        if (employee) {
            tokenPayload.employeeId =
                employee.id;
        }

        // ------------------------------------------------------
        // JWT Token
        // ------------------------------------------------------

        const token =
            jwt.sign(
                tokenPayload,
                process.env.JWT_SECRET,
                {
                    expiresIn: "1d"
                }
            );

        // ------------------------------------------------------
        // Response
        // ------------------------------------------------------

        return res.status(200).json({
            success: true,
            message:
                "Login successful",

            token,

            user: {
                id: user.id,
                email: user.email,
                role: user.role
            },

            employee
        });

    } catch (error) {
        console.error(
            "Login error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Login failed"
        });
    }
};

// ============================================================
// Export
// ============================================================

module.exports = {
    login
};
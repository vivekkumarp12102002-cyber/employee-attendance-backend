const pool = require("../db/postgres");

/*
|--------------------------------------------------------------------------
| Get Monthly Attendance Report
|--------------------------------------------------------------------------
| Endpoint:
| GET /api/reports/monthly?month=YYYY-MM
|
| Example:
| /api/reports/monthly?month=2026-10
|--------------------------------------------------------------------------
*/

const getMonthlyReport = async (req, res) => {
    try {
        const { month } = req.query;

        // ---------------------------------------------------------
        // Validate month
        // ---------------------------------------------------------
        if (!month) {
            return res.status(400).json({
                success: false,
                message: "Month is required. Use YYYY-MM format."
            });
        }

        if (!/^\d{4}-\d{2}$/.test(month)) {
            return res.status(400).json({
                success: false,
                message: "Invalid month format. Use YYYY-MM."
            });
        }

        const [year, monthNumber] = month.split("-").map(Number);

        if (
            monthNumber < 1 ||
            monthNumber > 12
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid month. Month must be between 01 and 12."
            });
        }

        // ---------------------------------------------------------
        // Start date and end date
        // ---------------------------------------------------------

        const startDate = `${year}-${String(monthNumber).padStart(2, "0")}-01`;

        const nextMonthDate = new Date(
            Date.UTC(year, monthNumber, 1)
        );

        const endDate =
            `${nextMonthDate.getUTCFullYear()}-${String(
                nextMonthDate.getUTCMonth() + 1
            ).padStart(2, "0")}-01`;

        // ---------------------------------------------------------
        // Monthly report query
        // ---------------------------------------------------------

        const result = await pool.query(
            `
            SELECT
                e.id AS employee_id,
                e.employee_code,
                e.name,
                e.email,
                d.id AS department_id,
                d.name AS department,

                COUNT(a.id) FILTER (
                    WHERE a.status = 'present'
                ) AS present_days,

                COUNT(a.id) FILTER (
                    WHERE a.status = 'absent'
                ) AS absent_days,

                COUNT(a.id) FILTER (
                    WHERE a.status = 'late'
                ) AS late_days,

                COUNT(a.id) FILTER (
                    WHERE a.status = 'half_day'
                ) AS half_day_days,

                COUNT(a.id) AS total_attendance_records

            FROM employees e

            LEFT JOIN departments d
                ON e.department_id = d.id

            LEFT JOIN attendance a
                ON a.employee_id = e.id
                AND a.attendance_date >= $1
                AND a.attendance_date < $2

            GROUP BY
                e.id,
                e.employee_code,
                e.name,
                e.email,
                d.id,
                d.name

            ORDER BY
                e.name ASC;
            `,
            [startDate, endDate]
        );

        // ---------------------------------------------------------
        // Overall summary
        // ---------------------------------------------------------

        const summary = result.rows.reduce(
            (acc, employee) => {
                acc.employees += 1;

                acc.present_days += Number(
                    employee.present_days || 0
                );

                acc.absent_days += Number(
                    employee.absent_days || 0
                );

                acc.late_days += Number(
                    employee.late_days || 0
                );

                acc.half_day_days += Number(
                    employee.half_day_days || 0
                );

                return acc;
            },
            {
                employees: 0,
                present_days: 0,
                absent_days: 0,
                late_days: 0,
                half_day_days: 0
            }
        );

        // ---------------------------------------------------------
        // Response
        // ---------------------------------------------------------

        return res.status(200).json({
            success: true,

            month,

            startDate,

            endDate,

            summary,

            count: result.rows.length,

            data: result.rows.map((employee) => ({
                employee_id: employee.employee_id,

                employee_code:
                    employee.employee_code,

                name:
                    employee.name,

                email:
                    employee.email,

                department_id:
                    employee.department_id,

                department:
                    employee.department || "N/A",

                present_days:
                    Number(employee.present_days || 0),

                absent_days:
                    Number(employee.absent_days || 0),

                late_days:
                    Number(employee.late_days || 0),

                half_day_days:
                    Number(employee.half_day_days || 0),

                total_attendance_records:
                    Number(
                        employee.total_attendance_records || 0
                    )
            }))
        });

    } catch (error) {
        console.error(
            "Get monthly report error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch monthly attendance report"
        });
    }
};

module.exports = {
    getMonthlyReport
};
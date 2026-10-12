const pool = require("../db/postgres");

// ============================================================
// Get Attendance Dashboard
// ============================================================

const getAttendanceDashboard = async (req, res) => {
    try {
        // ------------------------------------------------------
        // Get today's date and day
        // ------------------------------------------------------

        const dateResult = await pool.query(`
            SELECT
                CURRENT_DATE AS today,
                TRIM(
                    TO_CHAR(
                        CURRENT_DATE,
                        'Day'
                    )
                ) AS day_name;
        `);

        const today = dateResult.rows[0].today;
        const dayName = dateResult.rows[0].day_name;

        const isSunday =
            dayName.toLowerCase() === "sunday";

        // ------------------------------------------------------
        // Total Employees
        // ------------------------------------------------------

        const employeeResult = await pool.query(`
            SELECT
                COUNT(*) AS total_employees
            FROM employees
            WHERE status = 'active';
        `);

        const totalEmployees =
            Number(
                employeeResult.rows[0]
                    .total_employees || 0
            );

        // ------------------------------------------------------
        // Today's Attendance
        // ------------------------------------------------------
        //
        // LEFT JOIN is important.
        //
        // Agar employee ne attendance record
        // nahi banaya hai, tab bhi employee
        // dashboard mein show hoga.
        //
        // Sunday par Weekly Off derive hoga.
        // ------------------------------------------------------

        const attendanceResult =
            await pool.query(
                `
                SELECT
                    e.id AS employee_id,
                    e.employee_code,
                    e.name,
                    e.email,

                    e.department_id,
                    d.name AS department,

                    e.status AS employee_status,

                    a.id AS attendance_id,
                    a.attendance_date,
                    a.check_in,
                    a.check_out,
                    a.status AS attendance_status,
                    a.notes

                FROM employees e

                LEFT JOIN departments d
                    ON e.department_id = d.id

                LEFT JOIN attendance a
                    ON a.employee_id = e.id
                    AND a.attendance_date = $1

                WHERE e.status = 'active'

                ORDER BY
                    e.name ASC;
                `,
                [today]
            );

        // ------------------------------------------------------
        // Determine Status
        // ------------------------------------------------------

        const attendanceData =
            attendanceResult.rows.map(
                (employee) => {

                    let status =
                        employee.attendance_status;

                    // --------------------------------------------------
                    // Sunday
                    // --------------------------------------------------

                    if (isSunday) {
                        status = "weekly_off";
                    }

                    // --------------------------------------------------
                    // No attendance record
                    // --------------------------------------------------

                    if (
                        !employee.attendance_id &&
                        !isSunday
                    ) {
                        status = "absent";
                    }

                    return {
                        employee_id:
                            employee.employee_id,

                        employee_code:
                            employee.employee_code,

                        name:
                            employee.name,

                        email:
                            employee.email,

                        department_id:
                            employee.department_id,

                        department:
                            employee.department ||
                            "N/A",

                        attendance_id:
                            employee.attendance_id,

                        attendance_date:
                            employee.attendance_date ||
                            today,

                        check_in:
                            employee.check_in,

                        check_out:
                            employee.check_out,

                        status:
                            status || "absent",

                        notes:
                            employee.notes || ""
                    };
                }
            );

        // ------------------------------------------------------
        // Summary
        // ------------------------------------------------------

        let present = 0;
        let absent = 0;
        let late = 0;
        let halfDay = 0;
        let weeklyOff = 0;

        attendanceData.forEach(
            (employee) => {

                switch (employee.status) {

                    case "present":
                        present += 1;
                        break;

                    case "absent":
                        absent += 1;
                        break;

                    case "late":
                        late += 1;
                        break;

                    case "half_day":
                        halfDay += 1;
                        break;

                    case "weekly_off":
                        weeklyOff += 1;
                        break;

                    default:
                        break;
                }
            }
        );

        // ------------------------------------------------------
        // Working employees
        // ------------------------------------------------------

        const workingEmployees =
            present +
            late +
            halfDay;

        // ------------------------------------------------------
        // Response
        // ------------------------------------------------------

        return res.status(200).json({
            success: true,

            date: today,

            day_of_week: dayName,

            is_sunday: isSunday,

            summary: {
                total_employees:
                    totalEmployees,

                present,

                absent,

                late,

                half_day:
                    halfDay,

                weekly_off:
                    weeklyOff,

                working:
                    workingEmployees
            },

            count:
                attendanceData.length,

            data:
                attendanceData
        });

    } catch (error) {
        console.error(
            "Dashboard error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch attendance dashboard"
        });
    }
};

// ============================================================
// Export
// ============================================================

module.exports = {
    getAttendanceDashboard
};
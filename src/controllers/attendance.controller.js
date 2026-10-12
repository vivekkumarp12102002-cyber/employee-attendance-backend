
const pool = require("../db/postgres");
const Holidays = require("date-holidays");

// ============================================================
// Holiday Helper
// ============================================================

const getGujaratHoliday = (dateString) => {
    try {
        // PostgreSQL Date object ya string ko YYYY-MM-DD mein convert karo.
        let normalizedDate;

        if (
            dateString instanceof Date &&
            !Number.isNaN(dateString.getTime())
        ) {
            normalizedDate = dateString.toISOString().slice(0, 10);
        } else if (typeof dateString === "string") {
            normalizedDate = dateString.slice(0, 10);
        } else {
            console.error("Invalid holiday date:", dateString);
            return null;
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
            console.error("Invalid holiday date format:", normalizedDate);
            return null;
        }

        const year = Number(normalizedDate.slice(0, 4));
        const hd = new Holidays("IN", "GJ");
        const holidays = hd.getHolidays(year);

        const holiday = holidays.find((item) => {
            const holidayDate = item.date.slice(0, 10);
            const isSameDate = holidayDate === normalizedDate;
            const validType =
                item.type === "public" ||
                item.type === "bank";

            return isSameDate && validType;
        });

        return holiday || null;
    } catch (error) {
        console.error("Holiday check error:", error);
        return null;
    }
};

// ============================================================
// Date Information Helper
// ============================================================

const getDateInformation = (dateString) => {
    const holiday = getGujaratHoliday(dateString);

    const date = new Date(`${dateString}T00:00:00`);

    const dayName = date.toLocaleDateString("en-US", {
        weekday: "long",
    });

    const isSunday = dayName.toLowerCase() === "sunday";

    return {
        date: dateString,
        dayName,
        isSunday,
        isHoliday: Boolean(holiday),
        holidayName: holiday?.name || "",
        holidayType: holiday?.type || "",
        holidayNote: holiday?.note || "",
    };
};

// ============================================================
// Check In
// ============================================================

const checkIn = async (req, res) => {
    try {
        const employeeId = req.user?.employeeId;

        if (!employeeId) {
            return res.status(403).json({
                success: false,
                message: "Employee account is required",
            });
        }

        // Get today's date and current time from PostgreSQL.
        const dateResult = await pool.query(`
            SELECT
                CURRENT_DATE AS today,
                CURRENT_TIME AS current_time,
                TRIM(TO_CHAR(CURRENT_DATE, 'Day')) AS day_name;
        `);

        const today = dateResult.rows[0].today;
        const currentTime = dateResult.rows[0].current_time;
        const dayName = dateResult.rows[0].day_name;

        // Sunday check.
        const isSunday = dayName.toLowerCase() === "sunday";

        if (isSunday) {
            return res.status(400).json({
                success: false,
                message:
                    "Today is Sunday. Attendance is not required because it is Weekly Off.",
                status: "weekly_off",
                date: today,
            });
        }

        // Holiday check.
        const holiday = getGujaratHoliday(today);

        if (holiday) {
            return res.status(400).json({
                success: false,
                message: `Today is ${holiday.name}. Attendance is not required because today is a holiday.`,
                status: "holiday",
                date: today,
                holiday_name: holiday.name,
                holiday_type: holiday.type,
            });
        }

        // Check employee.
        const employeeResult = await pool.query(
            `
                SELECT
                    id,
                    employee_code,
                    name,
                    email,
                    status
                FROM employees
                WHERE id = $1;
            `,
            [employeeId]
        );

        if (employeeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }

        const employee = employeeResult.rows[0];

        if (employee.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Employee account is inactive",
            });
        }

        // Check existing attendance.
        const existingResult = await pool.query(
            `
                SELECT
                    id,
                    attendance_date,
                    check_in,
                    check_out,
                    status,
                    notes
                FROM attendance
                WHERE employee_id = $1
                  AND attendance_date = $2;
            `,
            [employeeId, today]
        );

        if (existingResult.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: "You have already checked in today.",
                data: existingResult.rows[0],
            });
        }

        // Late logic.
        const lateResult = await pool.query(`
            SELECT CURRENT_TIME > TIME '09:00:00' AS is_late;
        `);

        const isLate = lateResult.rows[0].is_late;
        const attendanceStatus = isLate ? "late" : "present";

        const notes = isLate
            ? "Checked in late"
            : "Checked in on time";

        // Insert attendance.
        const attendanceResult = await pool.query(
            `
                INSERT INTO attendance (
                    employee_id,
                    attendance_date,
                    check_in,
                    status,
                    notes
                )
                VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)
                RETURNING
                    id,
                    employee_id,
                    attendance_date,
                    check_in,
                    check_out,
                    status,
                    notes,
                    created_at;
            `,
            [employeeId, today, attendanceStatus, notes]
        );

        return res.status(201).json({
            success: true,
            message: isLate
                ? "Check-in successful. You are marked late."
                : "Check-in successful.",
            data: attendanceResult.rows[0],
        });
    } catch (error) {
        console.error("Check-in error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to check in",
        });
    }
};

// ============================================================
// Check Out
// ============================================================

const checkOut = async (req, res) => {
    try {
        const employeeId = req.user?.employeeId;

        if (!employeeId) {
            return res.status(403).json({
                success: false,
                message: "Employee account is required",
            });
        }

        const dateResult = await pool.query(`
            SELECT CURRENT_DATE AS today;
        `);

        const today = dateResult.rows[0].today;

        const attendanceResult = await pool.query(
            `
                SELECT
                    id,
                    employee_id,
                    attendance_date,
                    check_in,
                    check_out,
                    status,
                    notes
                FROM attendance
                WHERE employee_id = $1
                  AND attendance_date = $2;
            `,
            [employeeId, today]
        );

        if (attendanceResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "You have not checked in today.",
            });
        }

        const attendance = attendanceResult.rows[0];

        if (!attendance.check_in) {
            return res.status(400).json({
                success: false,
                message: "Check-in record not found.",
            });
        }

        if (attendance.check_out) {
            return res.status(400).json({
                success: false,
                message: "You have already checked out today.",
                data: attendance,
            });
        }

        const updateResult = await pool.query(
            `
                UPDATE attendance
                SET check_out = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING
                    id,
                    employee_id,
                    attendance_date,
                    check_in,
                    check_out,
                    status,
                    notes,
                    created_at;
            `,
            [attendance.id]
        );

        return res.status(200).json({
            success: true,
            message: "Check-out successful.",
            data: updateResult.rows[0],
        });
    } catch (error) {
        console.error("Check-out error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to check out",
        });
    }
};

 // ============================================================
 // Get Attendance - Admin
 // ============================================================

const getAttendance = async (req, res) => {
    try {
        const { date, department_id, status } = req.query;

        const conditions = [];
        const values = [];
        let parameterIndex = 1;

        if (date) {
            conditions.push(
                `a.attendance_date = $${parameterIndex}`
            );
            values.push(date);
            parameterIndex++;
        }

        if (department_id) {
            conditions.push(
                `e.department_id = $${parameterIndex}`
            );
            values.push(department_id);
            parameterIndex++;
        }

        if (status) {
            conditions.push(
                `a.status = $${parameterIndex}`
            );
            values.push(status);
            parameterIndex++;
        }

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";

        const query = `
            SELECT
                a.id,
                a.employee_id,
                a.attendance_date,
                a.check_in,
                a.check_out,
                a.status,
                a.notes,
                a.created_at,
                e.employee_code,
                e.name,
                e.email,
                e.department_id,
                d.name AS department,
                CASE
                    WHEN a.check_in IS NOT NULL
                     AND a.check_out IS NOT NULL
                    THEN EXTRACT(
                        EPOCH FROM (a.check_out - a.check_in)
                    ) / 3600
                    ELSE 0
                END AS working_hours
            FROM attendance a
            INNER JOIN employees e
                ON a.employee_id = e.id
            LEFT JOIN departments d
                ON e.department_id = d.id
            ${whereClause}
            ORDER BY a.attendance_date DESC, e.name ASC;
        `;

        const result = await pool.query(query, values);

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows,
        });
    } catch (error) {
        console.error("Get attendance error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch attendance",
        });
    }
};

// ============================================================
// Get Today's Attendance - Admin
// ============================================================

const getTodayAttendance = async (req, res) => {
    try {
        const dateResult = await pool.query(`
            SELECT
                CURRENT_DATE AS today,
                TRIM(TO_CHAR(CURRENT_DATE, 'Day')) AS day_name;
        `);

        const today = dateResult.rows[0].today;
        const dayName = dateResult.rows[0].day_name;
        const isSunday = dayName.toLowerCase() === "sunday";

        // Fixed holiday helper handles PostgreSQL Date objects.
        const holiday = getGujaratHoliday(today);
        const isHoliday = Boolean(holiday);

        const result = await pool.query(
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
                    a.notes,
                    CASE
                        WHEN a.check_in IS NOT NULL
                         AND a.check_out IS NOT NULL
                        THEN EXTRACT(
                            EPOCH FROM (a.check_out - a.check_in)
                        ) / 3600
                        ELSE 0
                    END AS working_hours
                FROM employees e
                LEFT JOIN departments d
                    ON e.department_id = d.id
                LEFT JOIN attendance a
                    ON a.employee_id = e.id
                   AND a.attendance_date = $1
                WHERE e.status = 'active'
                ORDER BY e.name ASC;
            `,
            [today]
        );

        const attendanceData = result.rows.map((employee) => {
            let currentStatus = employee.attendance_status;

            // Holiday → Weekly off → Attendance → Absent
            if (isHoliday) {
                currentStatus = "holiday";
            } else if (isSunday) {
                currentStatus = "weekly_off";
            } else if (!employee.attendance_id) {
                currentStatus = "absent";
            }

            return {
                employee_id: employee.employee_id,
                employee_code: employee.employee_code,
                name: employee.name,
                email: employee.email,
                department_id: employee.department_id,
                department: employee.department || "N/A",
                employee_status: employee.employee_status,
                attendance_id: employee.attendance_id,
                attendance_date: employee.attendance_date || today,
                check_in: employee.check_in,
                check_out: employee.check_out,
                working_hours: Number(employee.working_hours || 0),
                status: currentStatus || "absent",
                notes: employee.notes || "",
                holiday_name: isHoliday ? holiday.name : "",
                holiday_type: isHoliday ? holiday.type : "",
            };
        });

        let present = 0;
        let absent = 0;
        let late = 0;
        let halfDay = 0;
        let holidayCount = 0;
        let weeklyOff = 0;

        attendanceData.forEach((employee) => {
            switch (employee.status) {
                case "present":
                    present++;
                    break;
                case "absent":
                    absent++;
                    break;
                case "late":
                    late++;
                    break;
                case "half_day":
                    halfDay++;
                    break;
                case "holiday":
                    holidayCount++;
                    break;
                case "weekly_off":
                    weeklyOff++;
                    break;
                default:
                    break;
            }
        });

        return res.status(200).json({
            success: true,
            date: today,
            day_of_week: dayName,
            is_sunday: isSunday,
            is_holiday: isHoliday,
            holiday_name: holiday?.name || "",
            holiday_type: holiday?.type || "",
            holiday_note: holiday?.note || "",
            summary: {
                total_employees: attendanceData.length,
                present,
                absent,
                late,
                half_day: halfDay,
                holiday: holidayCount,
                weekly_off: weeklyOff,
            },
            count: attendanceData.length,
            data: attendanceData,
        });
    } catch (error) {
        console.error("Today's attendance error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch today's attendance",
        });
    }
};

 // ============================================================
 // Get Employee Attendance
 // ============================================================

const getEmployeeAttendance = async (req, res) => {
    try {
        const requestedEmployeeId = Number(req.params.employeeId);
        const loggedInEmployeeId = Number(req.user?.employeeId);
        const isAdmin = req.user?.role === "admin";

        if (!isAdmin && requestedEmployeeId !== loggedInEmployeeId) {
            return res.status(403).json({
                success: false,
                message: "You can only view your own attendance",
            });
        }

        if (!requestedEmployeeId) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee ID",
            });
        }

        const result = await pool.query(
            `
                SELECT
                    a.id,
                    a.employee_id,
                    a.attendance_date,
                    a.check_in,
                    a.check_out,
                    a.status,
                    a.notes,
                    a.created_at,
                    e.employee_code,
                    e.name,
                    e.email,
                    d.name AS department,
                    CASE
                        WHEN a.check_in IS NOT NULL
                         AND a.check_out IS NOT NULL
                        THEN EXTRACT(
                            EPOCH FROM (a.check_out - a.check_in)
                        ) / 3600
                        ELSE 0
                    END AS working_hours
                FROM attendance a
                INNER JOIN employees e
                    ON a.employee_id = e.id
                LEFT JOIN departments d
                    ON e.department_id = d.id
                WHERE a.employee_id = $1
                ORDER BY a.attendance_date DESC;
            `,
            [requestedEmployeeId]
        );

        return res.status(200).json({
            success: true,
            employee_id: requestedEmployeeId,
            count: result.rows.length,
            data: result.rows,
        });
    } catch (error) {
        console.error("Employee attendance error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch employee attendance",
        });
    }
};

// ============================================================
// Employee Attendance Summary
// ============================================================

const getEmployeeAttendanceSummary = async (req, res) => {
    try {
        const requestedEmployeeId = Number(req.params.employeeId);
        const loggedInEmployeeId = Number(req.user?.employeeId);
        const isAdmin = req.user?.role === "admin";

        if (!isAdmin && requestedEmployeeId !== loggedInEmployeeId) {
            return res.status(403).json({
                success: false,
                message: "You can only view your own attendance summary",
            });
        }

        if (!requestedEmployeeId) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee ID",
            });
        }

        const result = await pool.query(
            `
                SELECT
                    COUNT(*) AS total_records,
                    COUNT(*) FILTER (
                        WHERE status = 'present'
                    ) AS present_days,
                    COUNT(*) FILTER (
                        WHERE status = 'absent'
                    ) AS absent_days,
                    COUNT(*) FILTER (
                        WHERE status = 'late'
                    ) AS late_days,
                    COUNT(*) FILTER (
                        WHERE status = 'half_day'
                    ) AS half_day_days,
                    COUNT(*) FILTER (
                        WHERE check_in IS NOT NULL
                    ) AS checked_in_days,
                    COUNT(*) FILTER (
                        WHERE check_out IS NOT NULL
                    ) AS checked_out_days
                FROM attendance
                WHERE employee_id = $1;
            `,
            [requestedEmployeeId]
        );

        return res.status(200).json({
            success: true,
            employee_id: requestedEmployeeId,
            summary: result.rows[0],
        });
    } catch (error) {
        console.error("Attendance summary error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch attendance summary",
        });
    }
};

const getEmployeeMonthlySummary = async (req, res) => {
    try {
        const requestedEmployeeId = Number(req.params.employeeId);
        const loggedInEmployeeId = Number(req.user?.employeeId);
        const isAdmin = req.user?.role === "admin";

        // Employee can access only their own report
        if (!isAdmin && requestedEmployeeId !== loggedInEmployeeId) {
            return res.status(403).json({
                success: false,
                message: "You can only view your own monthly summary",
            });
        }

        if (!requestedEmployeeId) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee ID",
            });
        }

        // Get requested month in YYYY-MM format
        let month = req.query.month;

        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
            const now = new Date();
            month =
                `${now.getFullYear()}-${String(
                    now.getMonth() + 1
                ).padStart(2, "0")}`;
        }

        const [year, monthNumber] = month.split("-").map(Number);

        if (monthNumber < 1 || monthNumber > 12) {
            return res.status(400).json({
                success: false,
                message: "Invalid month. Use YYYY-MM format.",
            });
        }

        const startDate = `${month}-01`;

        const nextMonth = new Date(year, monthNumber, 1);
        const endDate =
            `${nextMonth.getFullYear()}-${String(
                nextMonth.getMonth() + 1
            ).padStart(2, "0")}-01`;

        // Get employee information
        const employeeResult = await pool.query(
            `
                SELECT
                    e.id,
                    e.employee_code,
                    e.name,
                    e.email,
                    e.joining_date,
                    e.status,
                    e.department_id,
                    d.name AS department
                FROM employees e
                LEFT JOIN departments d
                    ON e.department_id = d.id
                WHERE e.id = $1;
            `,
            [requestedEmployeeId]
        );

        if (employeeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }

        // Get attendance records for the selected month
        const attendanceResult = await pool.query(
            `
                SELECT
                    a.id,
                    a.attendance_date,
                    a.check_in,
                    a.check_out,
                    a.status,
                    a.notes,
                    CASE
                        WHEN a.check_in IS NOT NULL
                         AND a.check_out IS NOT NULL
                        THEN ROUND(
                            (
                                EXTRACT(
                                    EPOCH FROM (
                                        a.check_out - a.check_in
                                    )
                                ) / 3600
                            )::numeric,
                            2
                        )
                        ELSE 0
                    END AS working_hours
                FROM attendance a
                WHERE a.employee_id = $1
                  AND a.attendance_date >= $2::date
                  AND a.attendance_date < $3::date
                ORDER BY a.attendance_date ASC;
            `,
            [requestedEmployeeId, startDate, endDate]
        );

        // Get Gujarat public and bank holidays
        const hd = new Holidays("IN", "GJ");
        const holidays = hd.getHolidays(year);

        const monthHolidays = holidays
            .filter((holiday) => {
                const holidayDate = holiday.date.slice(0, 10);

                return (
                    holidayDate >= startDate &&
                    holidayDate < endDate &&
                    (
                        holiday.type === "public" ||
                        holiday.type === "bank"
                    )
                );
            })
            .map((holiday, index) => ({
                id: index + 1,
                holiday_name: holiday.name,
                holiday_date: holiday.date.slice(0, 10),
                holiday_type: holiday.type,
                description: holiday.note || "",
            }));

        // Calculate calendar days, Sundays and working days
        const totalDays = new Date(year, monthNumber, 0).getDate();
        let weeklyOffDays = 0;
        let holidayDays = 0;

        const holidayDates = new Set(
            monthHolidays.map((holiday) => holiday.holiday_date)
        );

        for (let day = 1; day <= totalDays; day++) {
            const date = new Date(year, monthNumber - 1, day);
            const dateString =
                `${year}-${String(monthNumber).padStart(2, "0")}-${String(
                    day
                ).padStart(2, "0")}`;

            if (date.getDay() === 0) {
                weeklyOffDays++;
            } else if (holidayDates.has(dateString)) {
                holidayDays++;
            }
        }

        const workingDays = totalDays - weeklyOffDays - holidayDays;

        // Calculate attendance statistics
        const attendance = attendanceResult.rows;

        const presentDays = attendance.filter(
            (row) => row.status === "present"
        ).length;

        const absentDays = attendance.filter(
            (row) => row.status === "absent"
        ).length;

        const lateDays = attendance.filter(
            (row) => row.status === "late"
        ).length;

        const halfDayDays = attendance.filter(
            (row) => row.status === "half_day"
        ).length;

        const checkedInDays = attendance.filter(
            (row) => row.check_in !== null
        ).length;

        const checkedOutDays = attendance.filter(
            (row) => row.check_out !== null
        ).length;

        const totalWorkingHours = attendance.reduce(
            (total, row) => total + Number(row.working_hours || 0),
            0
        );

        return res.status(200).json({
            success: true,
            month,
            startDate,
            endDate,
            employee: employeeResult.rows[0],
            summary: {
                total_days: totalDays,
                working_days: workingDays,
                weekly_off_days: weeklyOffDays,
                holiday_days: holidayDays,
                present_days: presentDays,
                absent_days: absentDays,
                late_days: lateDays,
                half_day_days: halfDayDays,
                checked_in_days: checkedInDays,
                checked_out_days: checkedOutDays,
                total_working_hours: Number(
                    totalWorkingHours.toFixed(2)
                ),
            },
            holidays: monthHolidays,
            attendance,
        });
    } catch (error) {
        console.error("Monthly summary error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch monthly attendance summary",
        });
    }
};

module.exports = {
    checkIn,
    checkOut,
    getAttendance,
    getTodayAttendance,
    getEmployeeAttendance,
    getEmployeeAttendanceSummary,
    getEmployeeMonthlySummary,
};

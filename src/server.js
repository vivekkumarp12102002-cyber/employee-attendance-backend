const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

// ============================================================
// Middleware
// ============================================================

app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// Routes
// ============================================================

const authRoutes = require("./routes/auth.routes");
const departmentRoutes = require("./routes/department.routes");
const employeeRoutes = require("./routes/employee.routes");
const attendanceRoutes = require("./routes/attendance.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const reportRoutes = require("./routes/report.routes");
const holidayRoutes = require("./routes/holiday.routes");

// ============================================================
// API Routes
// ============================================================

app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/departments",
    departmentRoutes
);

app.use(
    "/api/employees",
    employeeRoutes
);

app.use(
    "/api/attendance",
    attendanceRoutes
);

app.use(
    "/api/dashboard",
    dashboardRoutes
);

app.use(
    "/api/reports",
    reportRoutes
);

app.use(
    "/api/holidays",
    holidayRoutes
);

// ============================================================
// Health Check
// ============================================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Employee Attendance Management System API is running"
    });
});

// ============================================================
// 404 Handler
// ============================================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found"
    });
});

// ============================================================
// Global Error Handler
// ============================================================

app.use((err, req, res, next) => {
    console.error("Global error:", err);

    res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

// ============================================================
// Start Server
// ============================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(
        `Server running on http://localhost:${PORT}`
    );
});
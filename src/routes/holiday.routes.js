const express = require("express");

const {
    getHolidays
} = require("../controllers/holiday.controller");

const {
    authenticateToken
} = require("../middleware/auth.middleware");

const router = express.Router();


// ======================================================
// GET HOLIDAYS
// ======================================================

router.get(
    "/",
    authenticateToken,
    getHolidays
);


// ======================================================
// EXPORT
// ======================================================

module.exports = router;
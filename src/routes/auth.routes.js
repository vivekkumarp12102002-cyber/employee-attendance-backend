const express = require("express");

const {
    login
} = require("../controllers/auth.controller");

const router = express.Router();

// ============================================================
// Login
// ============================================================

router.post(
    "/login",
    login
);

module.exports = router;
const pool = require("../db/postgres");


// ======================================================
// GET HOLIDAYS
// YEAR OPTIONAL
// ======================================================

const getHolidays = async (req, res) => {

    try {

        const { year } = req.query;


        // ------------------------------------------------
        // YEAR VALIDATION
        // ------------------------------------------------

        if (
            year &&
            !/^\d{4}$/.test(year)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid year. Use YYYY format."

            });

        }


        // ==================================================
        // HOLIDAYS QUERY
        // ==================================================

        let query = `
            SELECT
                id,
                holiday_name,
                holiday_date,
                holiday_type,
                description,
                created_at

            FROM holidays
        `;


        const values = [];


        // ------------------------------------------------
        // YEAR FILTER
        // ------------------------------------------------

        if (year) {

            values.push(year);

            query += `
                WHERE EXTRACT(
                    YEAR FROM holiday_date
                ) = $1
            `;

        }


        // ------------------------------------------------
        // ORDER
        // ------------------------------------------------

        query += `
            ORDER BY holiday_date ASC;
        `;


        const result =
            await pool.query(
                query,
                values
            );


        // ==================================================
        // RESPONSE
        // ==================================================

        return res.status(200).json({

            success: true,

            data: result.rows

        });


    } catch (error) {

        console.error(
            "Get holidays error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch holidays"

        });

    }

};


// ======================================================
// EXPORT
// ======================================================

module.exports = {
    getHolidays
};  
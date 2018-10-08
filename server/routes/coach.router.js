const express = require('express');
const pool = require('../modules/pool');
const router = express.Router();

/**
 * GET route template
 */
router.get('/all', (req, res) => {
    const query = `SELECT "email", "status_type" FROM "person" JOIN "account_status" ON "status_id" = "account_status"."id" WHERE "role" = 'coach';`;
    pool.query(query).then((result) => {
        console.log(result.rows);
        res.send(result.rows);
    }).catch((error) => {
        console.log('ERROR getting players:', error);
        res.sendStatus(500);
    })

});

/**
 * POST route template
 */
router.post('/', (req, res) => {

});

module.exports = router;
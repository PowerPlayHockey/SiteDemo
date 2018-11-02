const express = require('express');
// const { rejectUnauthenticated } = require('../modules/authentication-middleware');
const encryptLib = require('../modules/encryption');
const pool = require('../modules/pool');

const router = express.Router();

const moment = require('moment');

const nodemailer = require("nodemailer");

const Chance = require('chance');
const chance = new Chance();

//function to send check if user is signed up 
router.get('/:emailAddress', (req, res) => {
        console.log('check for email:', req.params.emailAddress);

        const email = req.params.emailAddress;
        console.log('email', email);

        const queryText = `SELECT "personid" FROM person WHERE "email" = $1;`;

        pool.query(queryText, [email])
            .then((results) => {
                console.log('results', results.rows.length);
                if (results.rows.length >= 1) {
                    //call function to send email
                    resetPersonInviteCode(email);
                    res.sendStatus(200);
                }
                else {
                    res.sendStatus(404);
                }
            })
            .catch((error) => {
                console.log('error finding email:', error);
                res.sendStatus(404);
            });
});

//function to update invite code in person table of database 
//and log activity 
//and change account status to pending until password is reset
resetPersonInviteCode = (email) => {
  

        //limit inivite code to alphanumeric to avoid url problems
        let resetPasswordCode = chance.string({ pool: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' });

        //create expiration date code for invite
        let expireDate = new Date();

        expireDate = moment(expireDate).format('MMDDYYYY');

        expireDate = expireDate.replace(/\//g, '');

        resetPasswordCode = resetPasswordCode + expireDate;


        const infoForEmail = {
            email: email,
            resetPasswordCode: resetPasswordCode
        };

        console.log('infoForEmail', infoForEmail);

        //ACTIVITY LOG
        // const activityType = 'password reset link sent';
        // const activityTime = new Date();

        (async () => {

            const client = await pool.connect();

            try {
                let queryText = `UPDATE person SET "invite" = $1 WHERE "email" = $2 RETURNING "personid";`;

                let values = [resetPasswordCode, email];

                const personResult = await client.query(queryText, values);

                let personId = personResult.rows[0].id;

                //ACTIVITY LOG  person id will need to be added as a foreign key
                // queryText = `INSERT INTO activity_log(time, activity_type)
                //                 VALUES ($1, $2) RETURNING "id";`;

                // values = [activityTime, activityType];

                // const activityLogResult = await client.query(queryText, values);

                // let activityLogId = activityLogResult.rows[0].id;

                //send reset password code in an email
                await sendPasswordResetEmail(infoForEmail);

                await client.query('COMMIT');
            }
            catch (error) {
                console.log('ROLLBACK', error);
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        })().catch((error) => {
            console.log('CATCH', error);

        });
}

//function to send email with password reset link
sendPasswordResetEmail = (infoForEmail) => {

        console.log('in sendPasswordResetEmail')
        console.log(infoForEmail);

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com', //do I need to change this line?
            port: 465,
            secure: true,
            auth: {
                type: 'OAuth2',
                user: process.env.my_gmail_email,
                clientId: process.env.my_oauth_client_id,
                clientSecret: process.env.my_oauth_client_secret,
                refreshToken: process.env.my_oauth_refresh_token,
                accessToken: process.env.my_oauth_access_token,
                expires: 1527200298318 + 3600
            }
        });

        const resetPasswordCode = infoForEmail.resetPasswordCode;

        //create url string for page for link to 
        //where person can set or reset password
        const websiteUrl = process.env.set_password_page;

        const resetPasswordUrlAnchor = `<a target="_blank" href="${websiteUrl}${resetPasswordCode}">Reset Password</a>`;

        const homePageAnchor = process.env.set_home_page;

        const emailHtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
                <html xmlns="http://www.w3.org/1999/xhtml">
                <head>
                    <title>PPR Hockey Invite</title>
                    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
                    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0 " />
                    <link href="https://fonts.googleapis.com/css?family=Audiowide|Roboto:300,300i,400,400i,500,500i,700,700i" rel="stylesheet">
                    <style>
                        *{
                            box-sizing: border-box;
                        }
                        body{
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                        }
                         header{
                            display: flex;
                            flex-direction: row;
                            align-items: center;
                            justify-content: center;
                            background-color: #F0133E;
                            color: #fff;
                            width: 100vw;
                            padding: 20px;
                            font-family: 'Audiowide', sans-serif;
                        }
        
                        h1{
                            height: 100%;
                            padding-top: 40px;
                        }

                        a img{
                            width: 200px;
                            height: 200px;
                        }

                        main{
                            font-family: 'Roboto', sans-serif;
                            font-size: 20px;
                        }
                    </style>
                </head>
                <body>
                    <header>
                        <a href="${homePageAnchor}">
                            <img src="https://drive.google.com/uc?export=view&id=1w_MFiI3Y8M3hDV2nKx_2XyDr8olDI18y" alt="ppr hockey logo"/>
                        </a>
                        <h1>PASSWORD RESET</h1>
                    </header>
                    <main>
                        <div>
                            <p>
                                You've received this email to reset your Power Play Recruiting account password.
                                Click the link below to reset your password.
                            </p>
                            ${resetPasswordUrlAnchor}
                        </div>
                    </main>
                </body>
            </html>`;

        const mail = {
            from: "polarishockey@gmail.com",
            to: infoForEmail.email,
            subject: "Power Play Recruiting reset password request",
            text: 'Reset password.' + infoForEmail.name,
            html: emailHtml
        }

        transporter.sendMail(mail, function (error, info) {
            if (error) {
                console.log('error sending mail:', error);
            }
            else {
                //see https://nodemailer.com/usage
                console.log("info.messageId: " + info.messageId);
                console.log("info.envelope: " + info.envelope);
                console.log("info.accepted: " + info.accepted);
                console.log("info.rejected: " + info.rejected);
                console.log("info.pending: " + info.pending);
                console.log("info.response: " + info.response);
            }
            transporter.close();
        });
   
}

//post route for new password / resetting password
router.put('/setPassword', (req, res) => {
        console.log('in set setPassword put route');
        console.log('password info:', req.body);
        const passwordInfo = req.body;
        const inviteCode = passwordInfo.inviteCode;

        const newInviteCode = chance.string({ pool: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' });

        const password = encryptLib.encryptPassword(passwordInfo.password);

        (async () => {

            const client = await pool.connect();

            try {

                let queryText = `SELECT "status_id", "role" FROM person WHERE "invite" = $1;`;

                let values = [inviteCode];

                let statusResult = await client.query(queryText, values);

                let statusId = statusResult.rows[0].status_id;

                let personRole = statusResult.rows[0].role;

                //if person is a coach and status of coach is pending change to active
                if (personRole === 'coach' && statusId === 4) {

                    let newStatusId = 1;

                    let newStatusReason = 'activated account';

                    queryText = `UPDATE person SET "password" = $1, "invite" = $2, "status_id" = $3,
                                "status_reason" = $4 WHERE "invite" = $5;`;

                    values = [password, newInviteCode, newStatusId, newStatusReason, inviteCode];

                    await client.query(queryText, values);
                }
                else {
                    queryText = `UPDATE person SET "password" = $1, "invite" = $2 WHERE "invite" = $3;`;

                    values = [password, newInviteCode, inviteCode];

                    await client.query(queryText, values);
                }


                res.sendStatus(201);
            }
            catch (error) {
                console.log('ROLLBACK', error);
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        })().catch((error) => {
            console.log('CATCH', error);
            res.sendStatus(500);
        });
    
   
});

module.exports = router;
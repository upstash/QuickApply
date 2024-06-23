import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';
import dotenv from 'dotenv';
dotenv.config();

const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    credentials: {
        private_key: process.env.GOOGLE_PRIVATE_KEY,
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
    },
});

async function writeToSheet(values) {
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const emptyRow = await findFirstEmptyRow(sheets, spreadsheetId, 'A');

    const range = `Sheet1!A${emptyRow}`;
    const valueInputOption = 'USER_ENTERED';

    const resource = { values };

    try {
        const res = await sheets.spreadsheets.values.update({
            spreadsheetId, range, valueInputOption, resource
        })
        return res;
    } catch (error) {
        console.error('error', error);
    }
}
async function findFirstEmptyRow(sheets, sheetId, column) {
    const range = `${column}1:${column}`;
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
    });
    const values = response.data.values;
    let emptyRow = 1;
    if (values) {
        emptyRow = values.findIndex(row => !row[0]) + 1;
        if (emptyRow === 0) {
            emptyRow = values.length + 1;
        }
    }
    return emptyRow;
}



export const uploader = async (data) => {
    try {
        const uuid = data.uuid;
        const answers = data.answers;
        const questions = data.questions;
        const email_receiver = data.email_receiver;
        const user_email = data.user_email;
        const user_content = data.user_emailcontent;
        console.log(uuid);
        let list_to_write = [];
        list_to_write.push(uuid);
        let newTextItems = answers.split(';');
        let combinedList = list_to_write.concat(newTextItems);
        if (process.env.USE_SHEETS.toLowerCase() === 'true') {
            const writer = await writeToSheet([combinedList]);
        }
        var transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE,
            auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASSWORD,
            }
        });
        console.log([combinedList]);

        var mailOptions1 = {
            from: process.env.EMAIL,
            to: email_receiver,
            subject: `${uuid}`,
            text: questions,
        };

        var mailOptions2 = {
            from: process.env.EMAIL,
            to: user_email,
            subject: `Your application is submitted with ID: ${uuid}`,
            text: user_content,
        };

        transporter.sendMail(mailOptions1, function (error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log('Email1 sent: ' + info.response);
            }
        });
        transporter.sendMail(mailOptions2, function (error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log('Email2 sent: ' + info.response);
            }
        });

        return NextResponse.json({ Message: "Success", status: 201 });
    } catch (error) {
        console.log("Error occurred ", error);
        return NextResponse.json({ Message: "Failed", status: 500 });
    }
}

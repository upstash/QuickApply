import { NextResponse } from 'next/server';
import { google } from 'googleapis';
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


export async function POST(req, res) {
    if (req.method === 'POST') {
        try {
            const data = await req.json();
            const uuid = data.uuid;
            const answers = data.answers;
            let list_to_write = [];
            list_to_write.push(uuid);
            let newTextItems = answers.split(';');
            let combinedList = list_to_write.concat(newTextItems);
            if (process.env.USE_SHEETS.toLowerCase() === 'true') {
                const writer = await writeToSheet([combinedList]);
            }
            return NextResponse.json({ Message: "Success", status: 201 });
        } catch (error) {
            console.log("Error occurred ", error);
            return NextResponse.json({ Message: "Failed", status: 500 });
        }
    } else {
        return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 })
    }
}
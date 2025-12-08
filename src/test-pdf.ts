const pdfParse = require('pdf-parse');
import * as fs from 'fs';
import * as path from 'path';

async function test() {
    console.log('Type of pdfParse:', typeof pdfParse);
    console.log('pdfParse value:', pdfParse);

    try {
        // Create a dummy buffer since we don't have a real PDF handy easily, 
        // or we can just check if it's a function first.
        if (typeof pdfParse === 'function') {
            console.log('pdfParse is a function');
        } else {
            console.log('pdfParse is NOT a function');
        }
    } catch (e) {
        console.error(e);
    }
}

test();

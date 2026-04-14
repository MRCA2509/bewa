const xlsx = require('xlsx');
const path = require('path');

const filePath = 'C:\\Users\\User\\Downloads\\file_contoh_dari_waybill_incoming.xlsx';

try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, {header: 1}); // Get raw rows
    
    console.log('--- HEADERS (ROW 1) ---');
    console.log(data[0]);
    console.log('--- SAMPLE DATA (ROW 2) ---');
    console.log(data[1]);
} catch (e) {
    console.error('Gagal membaca file:', e.message);
}

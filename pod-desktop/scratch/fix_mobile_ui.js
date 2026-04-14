const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\User\\Pictures\\bewa\\pod-desktop\\public\\index.html';
let content = fs.readFileSync(filePath, 'utf8');

// Target string (using a more unique part of the line)
const target1 = `<p class="text-sm font-semibold text-slate-600 mt-1">\${t.penerima && t.penerima !== 'null' ? t.penerima : '<span class="italic text-slate-400">Nama Kosong / Belum Scan</span>'}</p>`;
const replacement1 = `<p class="text-sm font-bold text-slate-700 mt-1">\${t.penerima && t.penerima !== 'null' && t.penerima !== 'undefined' ? t.penerima : '<span class="italic text-slate-400">Penerima: (Belum Terdata)</span>'}</p>`;

const target2 = `<p class="text-xs text-slate-400 mt-0.5 font-bold uppercase tracking-widest">\${t.drop_point || t.kecamatan_penerima || ''}</p>`;
const replacement2 = `<p class="text-[10px] text-slate-400 mt-0.5 font-bold uppercase tracking-widest">\${t.drop_point || t.kecamatan_penerima || 'Wilayah Luar'}</p>`;

if (content.includes(target1) && content.includes(target2)) {
    content = content.replace(target1, replacement1);
    content = content.replace(target2, replacement2);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully updated public/index.html');
} else {
    console.log('Target strings not found. Checking for variations...');
    console.log('Content slice near target:', content.substring(content.indexOf('t.penerima'), content.indexOf('t.penerima') + 200));
}

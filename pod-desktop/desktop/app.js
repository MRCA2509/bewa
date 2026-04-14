let serverPort = 3000;
let currentUser = null;
let currentReviewWb = null;
let currentSubTab = 'validasi';
let mgmtPage = 1;
let currentTasks = [];
let currentZoom = 1;
let panX = 0, panY = 0;
let isDragging = false;
let startX = 0, startY = 0;
let lbContext = { isPOD: false, wb: '', img1: '', img2: '', spr: '' };
let paintStates = { 
    1: { color: 'red', size: 5, drawing: false, ctx: null, lastPos: null, fileName: '', history: [], redoStack: [] },
    2: { color: 'red', size: 5, drawing: false, ctx: null, lastPos: null, fileName: '', history: [], redoStack: [] }
};

function updateLightboxTransform() {
    const img = document.getElementById('lightbox-img');
    img.style.transform = `scale(${currentZoom}) translate(${panX}px, ${panY}px)`;
}

function handleWheel(e) {
    if (!document.getElementById('lightbox-modal').classList.contains('hidden')) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        currentZoom = Math.min(Math.max(0.5, currentZoom + delta), 8);
        updateLightboxTransform();
    }
}

function startDrag(e) {
    if (e.button !== 0) return; // Left click only
    isDragging = true;
    startX = e.clientX - panX * currentZoom;
    startY = e.clientY - panY * currentZoom;
    document.getElementById('lightbox-img').style.transition = 'none';
    document.getElementById('lightbox-modal').style.cursor = 'grabbing';
}

function doDrag(e) {
    if (!isDragging) return;
    panX = (e.clientX - startX) / currentZoom;
    panY = (e.clientY - startY) / currentZoom;
    updateLightboxTransform();
}

function endDrag() {
    isDragging = false;
    document.getElementById('lightbox-modal').style.cursor = 'default';
    document.getElementById('lightbox-img').style.transition = 'transform 0.1s ease-out';
}

function resetZoom() {
    currentZoom = 1; panX = 0; panY = 0;
    updateLightboxTransform();
}

function initPaint(id) {
    const canvas = document.getElementById('canvas' + id);
    const img = document.getElementById('view-img' + id);
    
    if (!img.complete) {
        img.onload = () => initPaint(id);
        return;
    }
    
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    canvas.style.width = img.clientWidth + 'px';
    canvas.style.height = img.clientHeight + 'px';
    canvas.style.left = img.offsetLeft + 'px';
    canvas.style.top = img.offsetTop + 'px';
    
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    paintStates[id].ctx = ctx;
    paintStates[id].history = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
    paintStates[id].redoStack = [];
    
    canvas.onmousedown = (e) => { 
        paintStates[id].drawing = true; 
        paintStates[id].lastPos = getPos(e, canvas); 
    };
    
    // Use a named function to remove listener if needed, but for now global is fine
    if (!window._paintInited) {
        window.addEventListener('mouseup', () => { 
            Object.keys(paintStates).forEach(sid => {
                if (paintStates[sid].drawing) {
                    saveHistory(sid);
                }
                paintStates[sid].drawing = false; 
            });
        });
        window._paintInited = true;
    }

    canvas.onmousemove = (e) => {
        if (!paintStates[id].drawing) return;
        const pos = getPos(e, canvas);
        ctx.beginPath();
        ctx.strokeStyle = paintStates[id].color;
        ctx.lineWidth = paintStates[id].size;
        ctx.moveTo(paintStates[id].lastPos.x, paintStates[id].lastPos.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        paintStates[id].lastPos = pos;
    };
}

function saveHistory(id) {
    const state = paintStates[id];
    const canvas = document.getElementById('canvas' + id);
    if (!state.ctx || !canvas) return;
    state.history.push(state.ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (state.history.length > 21) state.history.shift();
    state.redoStack = [];
}

function undo(id) {
    const state = paintStates[id];
    if (state.history.length > 1) {
        const current = state.history.pop();
        state.redoStack.push(current);
        const last = state.history[state.history.length - 1];
        state.ctx.putImageData(last, 0, 0);
    }
}

function redo(id) {
    const state = paintStates[id];
    if (state.redoStack.length > 0) {
        const next = state.redoStack.pop();
        state.history.push(next);
        state.ctx.putImageData(next, 0, 0);
    }
}

function clearCanvas(id) {
    const canvas = document.getElementById('canvas' + id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paintStates[id].history = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
    paintStates[id].redoStack = [];
}

function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { 
        x: (e.clientX - rect.left) * scaleX, 
        y: (e.clientY - rect.top) * scaleY 
    };
}

function setTool(id, color, el) {
    paintStates[id].color = color;
    if (el) {
        el.parentElement.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
    }
}

function setBrushSize(id, val) {
    paintStates[id].size = parseInt(val);
}

async function pickColor(id) {
    if (!window.EyeDropper) {
        alert("Fitur pipet warna tidak didukung di browser ini. Gunakan palet yang tersedia.");
        return;
    }
    const eyeDropper = new EyeDropper();
    try {
        const result = await eyeDropper.open();
        paintStates[id].color = result.sRGBHex;
        const tools = document.querySelector('.editor-toolbar .flex.gap-2');
        tools.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    } catch (e) { console.log("User cancelled color pick"); }
}

async function saveEditPermanent(id) {
    const btn = document.getElementById('btn-save-edit');
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = "Memproses...";
    btn.disabled = true;
    const img = document.getElementById('view-img' + id);
    const canvas = document.getElementById('canvas' + id);
    
    const composite = document.createElement('canvas');
    const compCtx = composite.getContext('2d');
    const tempImg = new Image();
    tempImg.crossOrigin = "anonymous";
    
    tempImg.onload = async () => {
        composite.width = tempImg.naturalWidth;
        composite.height = tempImg.naturalHeight;
        compCtx.drawImage(tempImg, 0, 0);
        const scaleX = composite.width / canvas.width;
        const scaleY = composite.height / canvas.height;
        compCtx.scale(scaleX, scaleY);
        compCtx.drawImage(canvas, 0, 0);
        const finalData = composite.toDataURL('image/jpeg', 0.9);
        try {
            const res = await axios.post(`http://localhost:${serverPort}/api/desktop/save-image`, {
                waybill_id: currentReviewWb,
                fileName: paintStates[id].fileName,
                imageData: finalData
            });
            if (res.data.success) {
                alert("Berhasil! Gambar telah diperbarui secara permanen.");
                const refUrl = new URL(img.src);
                refUrl.searchParams.set('t', new Date().getTime());
                img.src = refUrl.toString();
                clearCanvas(id);
                loadStats();
            } else { alert(res.data.message); }
        } catch (e) { alert("Gagal menyimpan editan."); }
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
    };
    tempImg.onerror = () => {
        alert("Terjadi kesalahan memuat gambar asli.");
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
    };
    const targetUrl = new URL(img.src);
    targetUrl.searchParams.set('t', new Date().getTime());
    tempImg.src = targetUrl.toString();
}

async function initConfig() {
    try {
        if (window.__TAURI__ && window.__TAURI__.core) {
            serverPort = await window.__TAURI__.core.invoke('get_server_port');
        }
    } catch (e) { /* tauri fallback */ }
    try {
        const res = await axios.get(`http://localhost:${serverPort}/api/desktop/config`);
        if (res.data.success) {
            document.getElementById('server-ip').textContent = "http://" + res.data.localIp + ":" + serverPort;
            document.getElementById('check-ui').children[0].style.width = '100%';
            const healthRes = await axios.get(`http://localhost:${serverPort}/api/desktop/health`);
            if (healthRes.data.health.localDb) {
                document.getElementById('check-db').children[0].style.width = '100%';
                setTimeout(() => {
                    document.getElementById('init-overlay').classList.add('opacity-0', 'pointer-events-none');
                    checkStoredSession();
                }, 1000);
            }
        }
    } catch (e) {
        document.getElementById('init-status-text').textContent = "FAILURE: Local Node Offline";
    }
}

function checkStoredSession() {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
        currentUser = JSON.parse(stored);
        showMainApp(currentUser);
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
}

async function handleLogin() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    if (!user || !pass) return;
    try {
        const res = await axios.post(`http://localhost:${serverPort}/api/desktop/login`, { username: user, password: pass });
        if (res.data.success) {
            currentUser = res.data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showMainApp(currentUser);
        } else { alert(res.data.message); }
    } catch (e) { alert("Autentikasi gagal."); }
}

async function showMainApp(user) {
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('user-display').textContent = `SESSION: ${user.name} (${user.role})`;
    if (user.role !== 'Master') {
        document.getElementById('dp-filter-container').classList.add('invisible');
        document.getElementById('mgmt-dp-filter-container').classList.add('hidden');
    }
    await loadDropPoints();
    loadStats();
    startAutoSync();
}

async function loadDropPoints() {
    try {
        const res = await axios.post(`http://localhost:${serverPort}/api/desktop/list-drop-points`);
        if (res.data.success) {
            const select = document.getElementById('drop-point-select');
            const mgmtSelect = document.getElementById('mgmt-dp-filter');
            const dps = res.data.data;
            const html = (currentUser.role === 'Master' ? '<option value="">Semua Wilayah</option>' : '') + 
                         dps.map(dp => `<option value="${dp}">${dp}</option>`).join('');
            select.innerHTML = html;
            mgmtSelect.innerHTML = html;
        }
    } catch (e) { console.error(e); }
}

function switchView(viewId) {
    document.querySelectorAll('.tab-view').forEach(el => {
        el.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => { if (el.classList.contains('opacity-0')) el.classList.add('hidden'); }, 300);
    });
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    const target = document.getElementById('view-' + viewId);
    target.classList.remove('hidden');
    setTimeout(() => { target.classList.remove('opacity-0', 'pointer-events-none'); }, 50);
    document.getElementById('btn-view-' + viewId).classList.add('active');
    if (viewId === 'dashboard') loadStats();
    if (viewId === 'management') loadOutstanding(1);
    if (viewId === 'logs') loadLogs();
}

async function loadLogs() {
    try {
        const res = await axios.get(`http://localhost:${serverPort}/api/desktop/logs`);
        if (res.data.success) {
            const list = document.getElementById('log-list');
            list.innerHTML = res.data.logs.map(log => `<p>[${log.created_at}] ${log.message}</p>`).join('');
        }
    } catch (e) { console.error(e); }
}

function switchSubTab(tab) {
    currentSubTab = tab;
    document.querySelectorAll('.sub-tab-btn').forEach(el => el.classList.remove('active', 'bg-white', 'text-slate-800', 'shadow-sm'));
    document.getElementById('sub-btn-' + tab).classList.add('active', 'bg-white', 'text-slate-800', 'shadow-sm');
    const isVal = (tab === 'validated');
    document.getElementById('th-aksi').style.display = isVal ? 'none' : 'table-cell';
    document.getElementById('btn-export-bundled').classList.toggle('hidden', !isVal);
    loadStats();
}

async function loadStats() {
    try {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        let dp = document.getElementById('drop-point-select').value;
        if (user.role === 'DP_ADMIN') dp = user.drop_point;
        if (dp === 'undefined' || dp === 'null') dp = '';
        const res = await axios.get(`http://localhost:${serverPort}/api/desktop/stats?dropPoint=${encodeURIComponent(dp)}`);
        const s = res.data.stats;
        document.getElementById('stat-total').textContent = s.total;
        document.getElementById('stat-pending').textContent = s.pending;
        document.getElementById('stat-completed').textContent = s.completed || 0;
        document.getElementById('stat-rejected').textContent = s.rejected || 0;
        const tbody = document.getElementById('table-body');
        const sprinters = (res.data && res.data.sprinters) ? res.data.sprinters : [];
        tbody.innerHTML = sprinters.map(spr => {
            const pb = spr.total_tasks > 0 ? (spr.completed_tasks / spr.total_tasks) * 100 : 0;
            return `<tr class="border-b-2 border-slate-50 hover:bg-blue-50/30 transition">
                <td class="p-8 pl-12 "><p class="font-black text-slate-900 tracking-tight text-lg">${spr.sprinter_name}</p><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${spr.sprinter_code}</p></td>
                <td class="p-8 text-center "><span class="px-6 py-2.5 bg-slate-100 rounded-2xl font-black text-[13px] text-slate-800">${spr.completed_tasks} <span class="text-slate-300 mx-1">/</span> <span class="text-slate-900">${spr.total_tasks}</span></span></td>
                <td class="p-8"><div class="flex items-center gap-6"><div class="flex-1 bg-slate-100 h-3 rounded-full overflow-hidden shrink-0"><div class="h-full bg-blue-600 shadow-sm" style="width: ${pb}%"></div></div><span class="text-[12px] font-black text-slate-900 w-12">${Math.round(pb)}%</span></div></td>
            </tr>`;
        }).join('');
        const tasks = currentSubTab === 'validasi' ? (res.data.completed_tasks || []) : (res.data.validated_tasks || []);
        const revBody = document.getElementById('review-body');
        const isVal = (currentSubTab === 'validated');
        if (tasks.length === 0) {
            revBody.innerHTML = '<tr><td colspan="5" class="p-20 text-center text-slate-300 font-black italic uppercase tracking-widest">Belum ada data unit.</td></tr>';
            return;
        }
        currentTasks = tasks;
        revBody.innerHTML = tasks.map((t, idx) => {
            return `<tr class="border-b border-gray-50 hover:bg-blue-50/20 transition group">
                <td class="p-6 pl-12">
                    <p class="font-black text-slate-800 tracking-tighter text-lg">${t.waybill_id}</p>
                    <span class="text-[9px] font-black text-blue-500 uppercase tracking-widest">${t.drop_point || '-'}</span>
                </td>
                <td class="p-6">
                    <p class="font-black text-slate-600">${t.sprinter_name}</p>
                </td>
                <td class="p-6 text-center">
                    <button onclick='openLightboxByIndex(${idx}, true)' class="p-3 bg-blue-50 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition shadow-sm">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    </button>
                </td>
                <td class="p-6 text-center">
                    <button onclick='openLightboxByIndex(${idx}, false)' class="p-3 bg-indigo-50 text-indigo-500 rounded-xl hover:bg-indigo-500 hover:text-white transition shadow-sm">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    </button>
                </td>
                ${!isVal ? `
                <td class="p-6 text-right pr-12">
                    <div class="flex items-center justify-end gap-2">
                        <button onclick="quickApprove('${t.waybill_id}')" class="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                        </button>
                        <button onclick="quickReject('${t.waybill_id}')" class="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-500 hover:text-white transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                </td>` : ''}
            </tr>`;
        }).join('');
    } catch (e) { console.error(e); }
}

async function loadOutstanding(page = 1) {
    mgmtPage = page;
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const search = document.getElementById('mgmt-search').value;
    let dp = document.getElementById('mgmt-dp-filter').value;
    if (user.role === 'DP_ADMIN') dp = user.drop_point;
    try {
        const res = await axios.get(`http://localhost:${serverPort}/api/desktop/outstanding?page=${page}&search=${search}&dropPoint=${encodeURIComponent(dp)}`);
        const tbody = document.getElementById('mgmt-table-body');
        const listData = (res.data && res.data.data) ? res.data.data : [];
        tbody.innerHTML = listData.map(t => `<tr class="border-b border-slate-100 hover:bg-blue-50/20 transition group">
            <td class="p-6 pl-14 bg-white group-hover:bg-transparent"><p class="font-black text-slate-900 text-lg tracking-tighter">${t.waybill_id}</p></td>
            <td class="p-6 text-xs font-black uppercase text-slate-700 font-bold">${t.sprinter_name || "-"}</td>
            <td class="p-6 text-sm font-bold text-slate-500 font-mono">${t.waktu_sampai || "-"}</td>
            <td class="p-6 text-center"><span class="inline-block px-5 py-2 bg-red-50 rounded-xl font-black text-[11px] text-red-600 border border-red-100">${t.umur_paket || 0} HARI</span></td>
        </tr>`).join("");
        document.getElementById('mgmt-pager-info').textContent = `${((page-1)*20)+1} - ${Math.min(page*20, res.data.total)} OF ${res.data.total} RECORDS`;
        document.getElementById('mgmt-prev-btn').disabled = page <= 1;
        document.getElementById('mgmt-next-btn').disabled = page >= res.data.totalPages;
    } catch (e) { console.error(e); }
}

function prevOutstanding() { if(mgmtPage > 1) loadOutstanding(mgmtPage-1); }
function nextOutstanding() { loadOutstanding(mgmtPage+1); }

function openReview(wb, img1, img2, spr) {
    currentReviewWb = wb;
    document.getElementById('review-wb-info').textContent = `WB: ${wb} | SPRINTER: ${spr}`;
    document.getElementById('view-img1').src = `http://localhost:${serverPort}/api/desktop/view-image?path=${encodeURIComponent(img1)}&t=${Date.now()}`;
    paintStates[1].fileName = img1;
    document.getElementById('review-modal').classList.remove('hidden');
    setTimeout(() => { if (document.getElementById('canvas1')) initPaint(1); }, 400);
}

function closeReview() { document.getElementById('review-modal').classList.add('hidden'); }

async function doApprove() {
    try { const res = await axios.post(`http://localhost:${serverPort}/api/desktop/approve`, { waybill_id: currentReviewWb }); if (res.data.success) { closeReview(); loadStats(); } } catch (e) { alert("Approve error."); }
}

async function doReject() {
    const reason = document.getElementById('reject-reason').value.trim();
    if (!reason) return alert("Harap isi alasan penolakan!");
    try { const res = await axios.post(`http://localhost:${serverPort}/api/desktop/reject`, { waybill_id: currentReviewWb, reason }); if (res.data.success) { closeReview(); loadStats(); } } catch (e) { alert("Reject error."); }
}

function openLightboxByIndex(idx, isPOD) {
    const t = currentTasks[idx];
    if (!t) return;
    const imgUrl = `http://localhost:${serverPort}/api/desktop/view-image?path=${encodeURIComponent(isPOD ? t.pod_image1 : t.pod_image2)}&t=${Date.now()}`;
    openLightbox(imgUrl, isPOD, t.waybill_id, t.pod_image1, t.pod_image2, t.sprinter_name);
}

function openLightbox(src, isPOD, wb, img1, img2, spr) {
    resetZoom();
    lbContext = { isPOD, wb, img1, img2, spr };
    document.getElementById('lightbox-img').src = src;
    const btnEdit = document.getElementById('btn-edit-floating');
    if (isPOD && currentSubTab === 'validasi') {
        btnEdit.style.display = 'flex';
    } else {
        btnEdit.style.display = 'none';
    }
    document.getElementById('lightbox-modal').classList.remove('hidden');
}

function doEditFromPreview(e) {
    if (e) e.stopPropagation();
    try {
        closeLightbox();
        openReview(lbContext.wb, lbContext.img1, lbContext.img2, lbContext.spr);
    } catch (err) {
        console.error("Failed to open review:", err);
        alert("Gagal membuka editor: " + err.message);
    }
}

function closeLightbox() { document.getElementById('lightbox-modal').classList.add('hidden'); }

async function quickApprove(wb) {
    if(!wb) return;
    try { const res = await axios.post(`http://localhost:${serverPort}/api/desktop/approve`, { waybill_id: wb }); if (res.data.success) { loadStats(); } } catch (e) { alert("Error Approve"); }
}

async function quickReject(wb) {
    const reason = prompt("Masukkan alasan penolakan:");
    if (!reason) return;
    try { const res = await axios.post(`http://localhost:${serverPort}/api/desktop/reject`, { waybill_id: wb, reason }); if (res.data.success) { loadStats(); } } catch (e) { alert("Error Reject"); }
}

function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = {
        success: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>',
        info: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
        error: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>'
    };
    toast.innerHTML = `
        <div class="toast-icon flex items-center justify-center">${icons[type]}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

async function handleDownload(url, filename) {
    showToast("Mempersiapkan File", "Mohon tunggu sebentar, sistem sedang memproses data...", "info");
    try {
        const res = await axios({
            url: url,
            method: 'GET',
            responseType: 'blob',
            headers: {
                'x-user-role': currentUser.role,
                'x-user-dp': currentUser.drop_point || ''
            }
        });
        const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
        showToast("Berhasil", "File telah berhasil disimpan ke folder download Anda.", "success");
    } catch (e) {
        console.error(e);
        showToast("Gagal", "Terjadi kesalahan saat mengunduh file. Harap coba lagi.", "error");
    }
}

function downloadOutstandingExcel() { 
    handleDownload(`http://localhost:${serverPort}/api/desktop/export-outstanding`, "Rekap_Outstanding.xlsx");
}

function downloadUnifiedValidated() { 
    handleDownload(`http://localhost:${serverPort}/api/desktop/export-bundled-validated`, "Paket_Data_Validasi.zip");
}

function downloadZip() { 
    const dp = document.getElementById('drop-point-select').value; 
    handleDownload(`http://localhost:${serverPort}/api/desktop/download-zip?dropPoint=${encodeURIComponent(dp)}`, "Arsip_POD_Fisik.zip");
}

function downloadValidatedExcel() { 
    handleDownload(`http://localhost:${serverPort}/api/desktop/export-validated`, "Laporan_Validated.xlsx");
}

async function handleExcelUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    const formData = new FormData(); formData.append('excel', file);
    try { 
        const res = await axios.post(`http://localhost:${serverPort}/api/desktop/import-excel`, formData, {
            headers: {
                'x-user-role': currentUser.role,
                'x-user-dp': currentUser.drop_point || ''
            }
        }); 
        if (res.data.success) { 
            alert(res.data.message); 
            loadStats(); 
            loadOutstanding(1); 
        } 
    } catch (e) { alert("Import error."); }
    event.target.value = '';
}

function startAutoSync() { 
    setInterval(() => { 
        const dp = document.getElementById('drop-point-select').value; 
        const currentView = document.querySelector('.nav-btn.active').id;
        axios.post(`http://localhost:${serverPort}/api/desktop/sync`, { dropPoint: dp })
            .then(() => {
                if (currentView === 'btn-view-dashboard') loadStats();
                if (currentView === 'btn-view-management') loadOutstanding(mgmtPage);
                if (currentView === 'btn-view-logs') loadLogs();
            })
            .catch(e => { /* Silently fail in background sync */ });
    }, 120000); 
}

async function resetDatabase() {
    const c1 = confirm("⚠️ PERINGATAN: Anda akan menghapus seluruh data paket di wilayah Anda. Lanjutkan?");
    if (!c1) return;
    const c2 = confirm("KONFIRMASI TERAKHIR: Data yang dihapus TIDAK dapat dikembalikan. Hapus sekarang?");
    if (!c2) return;
    try {
        const res = await axios.post(`http://localhost:${serverPort}/api/desktop/reset-data`, {}, {
            headers: {
                'x-user-role': currentUser.role,
                'x-user-dp': currentUser.drop_point || ''
            }
        });
        if (res.data.success) {
            alert(res.data.message);
            loadStats();
            loadOutstanding(1);
        }
    } catch (e) {
        alert("Gagal melakukan reset data.");
    }
}

function logout() { localStorage.removeItem('currentUser'); location.reload(); }

window.onload = initConfig;
window.handleWheel = handleWheel;
window.startDrag = startDrag;
window.doDrag = doDrag;
window.endDrag = endDrag;

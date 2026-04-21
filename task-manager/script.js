/* ─── State ─────────────────────────────────────────── */
let tasks = [];
let nextId = 1;
let currentView = 'all';
let currentSort = 'date';
let editId = null;
let deleteTargetId = null;
let alertsOpen = false;
let dismissedAlerts = new Set();

/* ─── Date picker ───────────────────────────────────── */
let dpYear, dpMonth, dpSelectedDate = '';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function dpInit(val) {
    const ref = val ? new Date(val + 'T00:00:00') : new Date();
    dpYear = ref.getFullYear();
    dpMonth = ref.getMonth();
    dpSelectedDate = val || '';
    renderDatePicker();
}

function toggleDatePicker(e) {
    e.stopPropagation();
    const popup = document.getElementById('date-picker-popup');
    const display = document.getElementById('date-display');
    const isOpen = popup.classList.contains('open');
    popup.classList.toggle('open', !isOpen);
    display.classList.toggle('open', !isOpen);
    if (!isOpen) dpInit(dpSelectedDate);
}

function closeDatePicker() {
    document.getElementById('date-picker-popup').classList.remove('open');
    document.getElementById('date-display').classList.remove('open');
}

function dpNav(dir) {
    dpMonth += dir;
    if (dpMonth > 11) { dpMonth = 0; dpYear++; }
    if (dpMonth < 0) { dpMonth = 11; dpYear--; }
    renderDatePicker();
}

function dpSelectDay(dateStr) {
    dpSelectedDate = dateStr;
    updateDateDisplay(dateStr);
    closeDatePicker();
}

function dpClear() {
    dpSelectedDate = '';
    updateDateDisplay('');
    closeDatePicker();
}

function updateDateDisplay(val) {
    const el = document.getElementById('date-display-text');
    if (!val) {
        el.textContent = 'Pick a date';
        el.className = 'placeholder';
    } else {
        const [y, m, d] = val.split('-');
        el.textContent = `${d}/${m}/${y}`;
        el.className = '';
    }
}

function renderDatePicker() {
    document.getElementById('dp-month-year').textContent = `${MONTHS[dpMonth]} ${dpYear}`;

    const td = today();
    const firstDay = new Date(dpYear, dpMonth, 1).getDay();
    const daysInMonth = new Date(dpYear, dpMonth + 1, 0).getDate();

    let html = DAYS.map(d => `<div class="dp-day-label">${d}</div>`).join('');
    for (let i = 0; i < firstDay; i++) html += `<div class="dp-day empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${dpYear}-${String(dpMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        let cls = 'dp-day';
        if (ds === td) cls += ' today-marker';
        if (ds === dpSelectedDate) cls += ' selected';
        else if (ds < td) cls += ' past';
        html += `<div class="${cls}" onclick="dpSelectDay('${ds}')">${d}</div>`;
    }
    document.getElementById('dp-grid').innerHTML = html;
}

/* ─── Helpers ───────────────────────────────────────── */
function today() { return new Date().toISOString().split('T')[0]; }

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ─── Navigation ────────────────────────────────────── */
function setView(v) {
    currentView = v;
    document.querySelectorAll('.nav-item').forEach(el =>
        el.classList.toggle('active', el.dataset.view === v)
    );
    renderTasks();
}

function setBnav(el) {
    document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
}

function setSort(s) {
    currentSort = s;
    document.querySelectorAll('.filter-tab').forEach(el =>
        el.classList.toggle('active', el.dataset.sort === s)
    );
    renderTasks();
}

/* ─── Smart alerts ──────────────────────────────────── */
function toggleAlerts() {
    alertsOpen = !alertsOpen;
    document.getElementById('alerts-panel').style.display = alertsOpen ? 'block' : 'none';
    document.getElementById('alerts-chevron').textContent = alertsOpen ? '▴' : '▾';
}

function computeAlerts() {
    const td = today();
    const out = [];

    const overdue = tasks.filter(t => !t.done && t.due && t.due < td);
    const dueToday = tasks.filter(t => !t.done && t.due === td);
    const dueSoon = tasks.filter(t => {
        if (t.done || !t.due) return false;
        return Math.round((new Date(t.due) - new Date(td)) / 86400000) === 1;
    });
    const highPending = tasks.filter(t => !t.done && t.priority === 'high');
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
    const pct = total ? Math.round(done / total * 100) : 0;

    if (overdue.length)
        out.push({
            id: 'overdue', dot: 'red',
            msg: `<strong>${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}</strong> — needs immediate attention`
        });

    dueToday.forEach(t =>
        out.push({ id: 'today-' + t.id, dot: 'amber', msg: `<strong>"${esc(t.title)}"</strong> is due today` })
    );

    dueSoon.forEach(t =>
        out.push({ id: 'soon-' + t.id, dot: 'amber', msg: `<strong>"${esc(t.title)}"</strong> is due tomorrow` })
    );

    if (highPending.length >= 3)
        out.push({
            id: 'high-pile', dot: 'red',
            msg: `<strong>${highPending.length} high-priority tasks</strong> still pending`
        });

    if (pct >= 80 && total > 0)
        out.push({
            id: 'progress-good', dot: 'green',
            msg: `Great progress! You're <strong>${pct}% done</strong> with your tasks`
        });

    if (total === 0)
        out.push({
            id: 'empty', dot: 'blue',
            msg: `No tasks yet — tap <strong>+ Add</strong> to get started`
        });

    return out.filter(a => !dismissedAlerts.has(a.id));
}

function renderAlerts() {
    const alerts = computeAlerts();
    const badge = document.getElementById('alert-count-badge');
    const label = document.getElementById('alerts-toggle-label');

    badge.style.display = alerts.length ? 'inline' : 'none';
    if (alerts.length) badge.textContent = alerts.length;
    label.textContent = alerts.length ? 'Smart alerts' : 'Smart alerts — all clear';

    const list = document.getElementById('alerts-list');
    if (!alerts.length) {
        list.innerHTML = `<div style="padding:10px 20px;font-size:12px;color:var(--muted);">No active alerts — you're all clear!</div>`;
        return;
    }
    list.innerHTML = alerts.map(a => `
      <div class="alert-item">
        <div class="alert-dot ${a.dot}"></div>
        <div class="alert-text">${a.msg}</div>
        <button class="alert-dismiss" onclick="dismissAlert('${a.id}')">✕</button>
      </div>`).join('');
}

function dismissAlert(id) { dismissedAlerts.add(id); renderAlerts(); }

/* ─── Add / Edit modal ──────────────────────────────── */
function openModal(id = null) {
    editId = id;
    document.getElementById('modal-title').textContent = id ? 'Edit task' : 'New task';
    const due = id ? (tasks.find(x => x.id === id)?.due || '') : '';
    if (id) {
        const t = tasks.find(x => x.id === id);
        document.getElementById('f-title').value = t.title;
        document.getElementById('f-desc').value = t.desc;
        document.getElementById('f-priority').value = t.priority;
        document.getElementById('f-cat').value = t.cat;
    } else {
        document.getElementById('f-title').value = '';
        document.getElementById('f-desc').value = '';
        document.getElementById('f-priority').value = 'medium';
        document.getElementById('f-cat').value = 'Work';
    }
    dpSelectedDate = due;
    updateDateDisplay(due);
    document.getElementById('modal').classList.add('open');
    setTimeout(() => document.getElementById('f-title').focus(), 80);
}

function closeModal() {
    document.getElementById('modal').classList.remove('open');
    closeDatePicker();
    editId = null;
}

function saveTask() {
    const title = document.getElementById('f-title').value.trim();
    if (!title) { document.getElementById('f-title').focus(); return; }
    const data = {
        title,
        desc: document.getElementById('f-desc').value.trim(),
        priority: document.getElementById('f-priority').value,
        cat: document.getElementById('f-cat').value,
        due: dpSelectedDate,
    };
    if (editId) {
        Object.assign(tasks.find(x => x.id === editId), data);
    } else {
        tasks.push({ id: nextId++, done: false, created: Date.now(), ...data });
    }
    closeModal();
    renderTasks();
}

/* ─── Delete confirmation ───────────────────────────── */
function askDelete(id) {
    deleteTargetId = id;
    const t = tasks.find(x => x.id === id);
    document.getElementById('confirm-task-name').textContent = t ? `"${t.title}"` : '';
    document.getElementById('confirm-modal').classList.add('open');
}

function closeConfirm() {
    document.getElementById('confirm-modal').classList.remove('open');
    deleteTargetId = null;
}

function confirmDelete() {
    if (deleteTargetId) tasks = tasks.filter(x => x.id !== deleteTargetId);
    closeConfirm();
    renderTasks();
}

/* ─── Toggle done ───────────────────────────────────── */
function toggleDone(id) {
    const t = tasks.find(x => x.id === id);
    if (t) { t.done = !t.done; dismissedAlerts.delete('progress-good'); renderTasks(); }
}

/* ─── Filter & sort ─────────────────────────────────── */
const priorityOrder = { high: 0, medium: 1, low: 2 };

function getFiltered() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const td = today();
    let list = tasks.filter(t => {
        if (q && !t.title.toLowerCase().includes(q) && !t.cat.toLowerCase().includes(q)) return false;
        if (currentView === 'done') return t.done;
        if (currentView === 'today') return t.due === td && !t.done;
        if (currentView === 'overdue') return t.due && t.due < td && !t.done;
        if (currentView === 'high') return t.priority === 'high' && !t.done;
        if (currentView === 'medium') return t.priority === 'medium' && !t.done;
        if (currentView === 'low') return t.priority === 'low' && !t.done;
        return true;
    });
    return [...list].sort((a, b) => {
        if (currentSort === 'priority') return priorityOrder[a.priority] - priorityOrder[b.priority];
        if (currentSort === 'alpha') return a.title.localeCompare(b.title);
        return (a.due || 'z') < (b.due || 'z') ? -1 : 1;
    });
}

function formatDue(due) {
    if (!due) return null;
    const td = today();
    if (due < td) return { label: 'Overdue', cls: 'overdue' };
    if (due === td) return { label: 'Today', cls: 'soon' };
    const diff = Math.round((new Date(due) - new Date(td)) / 86400000);
    if (diff === 1) return { label: 'Tomorrow', cls: 'soon' };
    const [y, m, d] = due.split('-');
    return { label: `${d}/${m}/${y}`, cls: '' };
}

/* ─── Render ────────────────────────────────────────── */
function renderTasks() {
    const td = today();
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
    const pct = total ? Math.round(done / total * 100) : 0;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-done').textContent = done;
    document.getElementById('stat-pct').textContent = pct + '%';
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-label').textContent = `${done} of ${total} done`;

    document.getElementById('badge-all').textContent = tasks.filter(t => !t.done).length;
    document.getElementById('badge-today').textContent = tasks.filter(t => t.due === td && !t.done).length;
    document.getElementById('badge-done').textContent = done;
    document.getElementById('badge-high').textContent = tasks.filter(t => t.priority === 'high' && !t.done).length;
    document.getElementById('badge-medium').textContent = tasks.filter(t => t.priority === 'medium' && !t.done).length;
    document.getElementById('badge-low').textContent = tasks.filter(t => t.priority === 'low' && !t.done).length;

    const overdueCount = tasks.filter(t => t.due && t.due < td && !t.done).length;
    const badgeOverdue = document.getElementById('badge-overdue');
    badgeOverdue.textContent = overdueCount;
    badgeOverdue.className = 'badge' + (overdueCount > 0 ? ' accent' : '');

    const mBadge = document.getElementById('mobile-overdue-badge');
    mBadge.style.display = overdueCount > 0 ? 'inline' : 'none';
    mBadge.textContent = overdueCount;

    renderAlerts();

    const list = getFiltered();
    const container = document.getElementById('task-list');

    if (!list.length) {
        container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">◎</div>
          <h3>No tasks here</h3>
          <p>Add a task or try a different filter.</p>
        </div>`;
        return;
    }

    const undone = list.filter(t => !t.done);
    const doneList = list.filter(t => t.done);

    let html = '';
    if (undone.length) html += renderGroup(undone);
    if (doneList.length && currentView !== 'done') {
        html += `<div class="section-header" style="margin-top:10px;"><div class="section-title">Completed</div><div class="section-line"></div></div>`;
        html += renderGroup(doneList);
    } else if (doneList.length) {
        html += renderGroup(doneList);
    }

    container.innerHTML = html;
}

function renderGroup(list) {
    return list.map(t => {
        const dueInfo = formatDue(t.due);
        return `
        <div class="task-card ${t.done ? 'done' : ''}">
          <div class="task-check ${t.done ? 'checked' : ''}" onclick="toggleDone(${t.id})"></div>
          <div class="task-body">
            <div class="task-title">${esc(t.title)}</div>
            <div class="task-meta">
              <span class="tag ${t.priority}">${t.priority}</span>
              <span class="tag cat">${esc(t.cat)}</span>
              ${dueInfo ? `<span class="due-date ${dueInfo.cls}">◷ ${dueInfo.label}</span>` : ''}
            </div>
          </div>
          <div class="task-actions">
            <button class="icon-btn"     onclick="openModal(${t.id})"  title="Edit">✎</button>
            <button class="icon-btn del" onclick="askDelete(${t.id})"  title="Delete">✕</button>
          </div>
        </div>`;
    }).join('');
}

/* ─── Event listeners ───────────────────────────────── */
document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeModal();
});

document.getElementById('confirm-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('confirm-modal')) closeConfirm();
});

document.addEventListener('click', e => {
    const popup = document.getElementById('date-picker-popup');
    const display = document.getElementById('date-display');
    if (popup.classList.contains('open') &&
        !popup.contains(e.target) &&
        !display.contains(e.target)) {
        closeDatePicker();
    }
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeConfirm(); closeDatePicker(); }
});

/* ─── Init ──────────────────────────────────────────── */
renderTasks();
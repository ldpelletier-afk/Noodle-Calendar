// --- CONFIGURATION ---
const ONE_HOUR_HEIGHT = 50;
const startHour = 7;
const endHour = 20;
const MAX_MONTH_BUBBLES = 2;
const STORAGE_KEY = 'calendarTasks';
const THEME_KEY = 'calendarTheme';
const BUDGET_KEY = 'calendarDailyBudget';
const DEFAULT_EFFORT = 3;
const DEFAULT_BUDGET = 10;
const EFFORT_LABELS = { 0: 'Free', 1: 'Trivial', 2: 'Light', 3: 'Moderate', 4: 'Heavy', 5: 'Draining' };

// --- STATE ---
let activeDate = new Date();
let currentView = 'week';
let appTasks = [];
let selectedDuration = 60;
let selectedEffort = DEFAULT_EFFORT;
let editingId = null;
let editingDuration = 60;
let editingEffort = DEFAULT_EFFORT;
let dailyBudget = parseInt(localStorage.getItem(BUDGET_KEY)) || DEFAULT_BUDGET;

// --- ELEMENTS ---
const $ = (id) => document.getElementById(id);
const taskInput = $('task-input');
const submitBtn = $('submit-btn');
const durationChips = $('duration-chips');
const todoListContainer = $('todo-list-container');
const taskCountEl = $('task-count');
const weekBody = $('week-body');
const monthBody = $('month-body');
const weekHeaderRow = $('week-header-row');
const dateLabel = $('current-date-label');
const btnPrev = $('btn-prev');
const btnNext = $('btn-next');
const btnToday = $('btn-today');
const btnTheme = $('btn-theme');
const btnWeek = $('btn-week');
const btnMonth = $('btn-month');
const btnExport = $('btn-export');
const btnImport = $('btn-import');
const importFile = $('import-file');
const tableWeek = $('week-view-table');
const tableMonth = $('month-view-table');

// Edit dialog
const editDialog = $('edit-dialog');
const editText = $('edit-text');
const editNotes = $('edit-notes');
const editCompleted = $('edit-completed');
const editDurationChips = $('edit-duration-chips');
const editEffortPicker = $('edit-effort-picker');
const editEffortHint = $('edit-effort-hint');
const editClose = $('edit-close');
const editCancel = $('edit-cancel');
const editSave = $('edit-save');
const editDelete = $('edit-delete');

// Effort / budget elements
const newEffortPicker = $('new-effort-picker');
const btnBudget = $('btn-budget');
const budgetLabel = $('budget-label');
const suggestDialog = $('suggest-dialog');
const suggestBody = $('suggest-body');
const suggestTitle = $('suggest-title');
const suggestClose = $('suggest-close');
const suggestDismiss = $('suggest-dismiss');

// --- HELPERS ---
function formatTime(hour) {
    const h = hour % 12 || 12;
    return `${h} ${hour >= 12 ? 'PM' : 'AM'}`;
}
function getISODate(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function hueFromText(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return h % 360;
}
function formatDuration(minutes) {
    if (minutes < 60) return `${minutes}m`;
    const h = minutes / 60;
    return Number.isInteger(h) ? `${h}h` : `${h}h`;
}

function normalizeTitle(text) {
    return (text || '').trim().toLowerCase();
}

// Count how many other tasks have the same title (case-insensitive).
// Ignoring the current task ID so editing doesn't self-count.
function habitCount(title, excludeId = null) {
    const key = normalizeTitle(title);
    if (!key) return 0;
    return appTasks.filter(t => t.id !== excludeId && normalizeTitle(t.text) === key).length;
}

// Suggested default effort for a new task: habitual tasks cost less.
function suggestDefaultEffort(title) {
    const n = habitCount(title);
    if (n >= 3) return 1;
    if (n >= 1) return 2;
    return DEFAULT_EFFORT;
}

function isHabit(title) { return habitCount(title) >= 2; }

// Sum of effort points on a given date across all tasks placed on the grid.
function taskEffort(t) {
    const n = parseInt(t.effort);
    return (n >= 0 && n <= 5) ? n : DEFAULT_EFFORT;
}

function effortForDate(dateISO) {
    return appTasks.reduce((sum, t) => {
        if (t.location !== 'grid' || t.date !== dateISO || t.completed) return sum;
        return sum + taskEffort(t);
    }, 0);
}

function budgetStatus(points) {
    if (points === 0) return 'empty';
    if (points <= dailyBudget * 0.6) return 'loaded';
    if (points <= dailyBudget) return 'busy';
    return 'over';
}

// Return the 7 dates of the currently-viewed week as ISO strings.
function currentWeekDates() {
    const start = getStartOfWeek(activeDate);
    const out = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        out.push(getISODate(d));
    }
    return out;
}

// --- DATA ---
function normalizeTask(t) {
    // Back-compat: legacy shape had t.location as object {type,date,time}
    if (t && t.location && typeof t.location === 'object') {
        return {
            id: t.id || generateId(),
            text: t.text || '',
            minutes: parseInt(t.minutes) || 60,
            location: t.location.type || 'sidebar',
            date: t.location.date || null,
            time: t.location.time === 'all-day' ? `${startHour}:00` : (t.location.time || null),
            notes: '',
            completed: false,
            effort: DEFAULT_EFFORT
        };
    }
    const rawEffort = parseInt(t.effort);
    return {
        id: t.id || generateId(),
        text: t.text || '',
        minutes: parseInt(t.minutes) || 60,
        location: t.location || 'sidebar',
        date: t.date || null,
        time: t.time || null,
        notes: t.notes || '',
        completed: Boolean(t.completed),
        effort: (rawEffort >= 0 && rawEffort <= 5) ? rawEffort : DEFAULT_EFFORT
    };
}

function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appTasks));
}
function loadTasks() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return;
    try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) appTasks = parsed.map(normalizeTask);
    } catch (e) {
        console.warn('Could not parse saved tasks', e);
    }
}

// --- THEME ---
function applyTheme(theme) {
    document.body.dataset.theme = theme;
    btnTheme.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem(THEME_KEY, theme);
}

// --- RENDER ---
function renderApp() {
    closePopover();
    if (currentView === 'week') {
        renderWeekView();
        tableWeek.classList.remove('hidden');
        tableMonth.classList.add('hidden');
        btnWeek.classList.add('active-view');
        btnMonth.classList.remove('active-view');
    } else {
        renderMonthView();
        tableMonth.classList.remove('hidden');
        tableWeek.classList.add('hidden');
        btnMonth.classList.add('active-view');
        btnWeek.classList.remove('active-view');
    }
    renderBubbles();
    updateNowLine();
}

function renderWeekView() {
    weekHeaderRow.innerHTML = '<th>Time</th>';
    weekBody.innerHTML = '';
    const startOfWeek = getStartOfWeek(activeDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const todayISO = getISODate(new Date());

    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    dateLabel.textContent = `${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getDate()} – ${monthNames[endOfWeek.getMonth()]} ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;

    const weekDates = [];
    const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const iso = getISODate(d);
        weekDates.push(iso);
        const th = document.createElement('th');
        th.innerHTML = `${dayNames[i]}<small>${d.getDate()}</small>`;
        if (iso === todayISO) th.classList.add('today-col');

        const points = effortForDate(iso);
        if (points > 0) {
            const badge = document.createElement('span');
            const status = budgetStatus(points);
            badge.className = `day-budget ${status}`;
            badge.textContent = `${points}/${dailyBudget}`;
            badge.title = `Effort: ${points} of ${dailyBudget} pts`;
            if (status === 'over' || status === 'busy') {
                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openSuggestions(iso);
                });
            }
            th.appendChild(document.createElement('br'));
            th.appendChild(badge);
        }
        weekHeaderRow.appendChild(th);
    }

    for (let h = startHour; h < endHour; h++) {
        const rowTop = document.createElement('tr');
        rowTop.className = 'hour-row';
        const timeCell = document.createElement('td');
        timeCell.textContent = formatTime(h);
        timeCell.rowSpan = 2;
        rowTop.appendChild(timeCell);
        for (let i = 0; i < 7; i++) {
            const cell = document.createElement('td');
            cell.dataset.date = weekDates[i];
            cell.dataset.time = `${h}:00`;
            if (weekDates[i] === todayISO) cell.classList.add('today-col');
            setupDropZone(cell);
            rowTop.appendChild(cell);
        }
        weekBody.appendChild(rowTop);

        const rowBottom = document.createElement('tr');
        rowBottom.className = 'half-hour-row';
        for (let i = 0; i < 7; i++) {
            const cell = document.createElement('td');
            cell.dataset.date = weekDates[i];
            cell.dataset.time = `${h}:30`;
            if (weekDates[i] === todayISO) cell.classList.add('today-col');
            setupDropZone(cell);
            rowBottom.appendChild(cell);
        }
        weekBody.appendChild(rowBottom);
    }
}

function renderMonthView() {
    monthBody.innerHTML = '';
    const year = activeDate.getFullYear();
    const month = activeDate.getMonth();
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    dateLabel.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayISO = getISODate(new Date());

    let dateCounter = 1;
    for (let row = 0; row < 6; row++) {
        const tr = document.createElement('tr');
        for (let col = 0; col < 7; col++) {
            const td = document.createElement('td');
            if ((row === 0 && col < firstDay) || dateCounter > daysInMonth) {
                // empty
            } else {
                const cellDate = new Date(year, month, dateCounter);
                const iso = getISODate(cellDate);
                td.dataset.date = iso;
                if (iso === todayISO) td.classList.add('today-col');

                const dayNum = document.createElement('span');
                dayNum.className = 'month-date-number';
                dayNum.textContent = dateCounter;
                td.appendChild(dayNum);

                setupDropZone(td);
                dateCounter++;
            }
            tr.appendChild(td);
        }
        monthBody.appendChild(tr);
        if (dateCounter > daysInMonth) break;
    }
}

// --- BUBBLE BUILDER ---
function buildBubble(task, { compact = false } = {}) {
    const bubble = document.createElement('li');
    bubble.className = 'task-bubble';
    if (task.completed) bubble.classList.add('completed');
    bubble.id = task.id;
    bubble.draggable = true;
    bubble.style.setProperty('--bubble-hue', hueFromText(task.text));

    // completion toggle dot
    const dot = document.createElement('span');
    dot.className = 'complete-dot';
    dot.title = task.completed ? 'Mark incomplete' : 'Mark complete';
    dot.addEventListener('click', (e) => {
        e.stopPropagation();
        task.completed = !task.completed;
        saveTasks();
        renderApp();
    });
    dot.addEventListener('mousedown', e => e.stopPropagation());
    bubble.appendChild(dot);

    const textSpan = document.createElement('span');
    textSpan.className = 'task-text';
    textSpan.textContent = task.text;
    if (isHabit(task.text)) {
        const hab = document.createElement('span');
        hab.className = 'habit-indicator';
        hab.textContent = '🔁';
        hab.title = 'Habitual task';
        textSpan.appendChild(hab);
    }
    if (task.notes) {
        const note = document.createElement('span');
        note.className = 'notes-indicator';
        note.textContent = '✎';
        note.title = task.notes;
        textSpan.appendChild(note);
    }
    bubble.appendChild(textSpan);

    const effort = taskEffort(task);
    const effortBadge = document.createElement('span');
    effortBadge.className = 'effort-badge';
    if (effort === 0) effortBadge.classList.add('zero');
    effortBadge.textContent = effort;
    effortBadge.title = `${EFFORT_LABELS[effort]} (${effort} pts)`;
    bubble.appendChild(effortBadge);

    if (!compact) {
        const tag = document.createElement('span');
        tag.className = 'duration-tag';
        tag.textContent = formatDuration(task.minutes);
        bubble.appendChild(tag);
    }

    const deleteBtn = document.createElement('span');
    deleteBtn.textContent = '×';
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = 'Delete task';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        appTasks = appTasks.filter(t => t.id !== task.id);
        saveTasks();
        renderApp();
    };
    deleteBtn.addEventListener('mousedown', e => e.stopPropagation());
    bubble.appendChild(deleteBtn);

    // Open edit dialog on click (not drag)
    bubble.addEventListener('click', (e) => {
        if (e.target === dot || e.target === deleteBtn) return;
        openEditDialog(task.id);
    });

    setupDraggable(bubble);
    return bubble;
}

// --- BUBBLE PLACEMENT ---
function renderBubbles() {
    todoListContainer.innerHTML = '';
    document.querySelectorAll('.task-bubble, .more-chip').forEach(el => el.remove());

    appTasks.forEach(task => {
        if (task.location === 'sidebar') {
            todoListContainer.appendChild(buildBubble(task));
        } else if (task.location === 'grid' && currentView === 'week') {
            const cell = tableWeek.querySelector(
                `td[data-date="${task.date}"][data-time="${task.time}"]`
            );
            if (cell) {
                const bubble = buildBubble(task);
                bubble.style.height = `${(ONE_HOUR_HEIGHT / 60) * task.minutes}px`;
                cell.appendChild(bubble);
            }
        }
    });

    if (currentView === 'month') {
        const byDate = new Map();
        appTasks.forEach(task => {
            if (task.location !== 'grid' || !task.date) return;
            if (!byDate.has(task.date)) byDate.set(task.date, []);
            byDate.get(task.date).push(task);
        });
        byDate.forEach((tasks, date) => {
            const cell = tableMonth.querySelector(`td[data-date="${date}"]`);
            if (!cell) return;
            const visible = tasks.slice(0, MAX_MONTH_BUBBLES);
            const hidden = tasks.slice(MAX_MONTH_BUBBLES);
            visible.forEach(t => cell.appendChild(buildBubble(t, { compact: true })));
            if (hidden.length > 0) {
                const chip = document.createElement('span');
                chip.className = 'more-chip';
                chip.textContent = `+${hidden.length} more`;
                chip.onclick = (e) => {
                    e.stopPropagation();
                    openMonthPopover(cell, tasks, date);
                };
                cell.appendChild(chip);
            }
        });
    }

    updateTaskCount();
}

function updateTaskCount() {
    const n = appTasks.filter(t => t.location === 'sidebar' && !t.completed).length;
    taskCountEl.textContent = n;
}

// --- MONTH POPOVER ---
let activePopover = null;
function closePopover() {
    if (activePopover) {
        activePopover.remove();
        activePopover = null;
    }
}
function openMonthPopover(cell, tasks, dateStr) {
    closePopover();
    const backdrop = document.createElement('div');
    backdrop.className = 'popover-backdrop';
    backdrop.onclick = closePopover;

    const pop = document.createElement('div');
    pop.className = 'month-popover';
    const title = document.createElement('h4');
    const d = new Date(dateStr + 'T00:00');
    title.textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    pop.appendChild(title);
    tasks.forEach(t => pop.appendChild(buildBubble(t, { compact: true })));

    document.body.appendChild(backdrop);
    document.body.appendChild(pop);

    const rect = cell.getBoundingClientRect();
    const popW = 260;
    let left = rect.left;
    if (left + popW > window.innerWidth - 10) left = window.innerWidth - popW - 10;
    pop.style.left = `${left}px`;
    pop.style.top = `${Math.min(rect.top, window.innerHeight - 300)}px`;

    activePopover = { remove: () => { pop.remove(); backdrop.remove(); } };
}

// --- CURRENT-TIME LINE ---
function updateNowLine() {
    document.querySelectorAll('.now-line').forEach(el => el.remove());
    if (currentView !== 'week') return;
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    if (hour < startHour || hour >= endHour) return;
    const hourRowCell = tableWeek.querySelector(`td.today-col[data-time="${hour}:00"]`);
    if (!hourRowCell) return;
    const offsetWithinHour = (minute / 60) * ONE_HOUR_HEIGHT;
    const line = document.createElement('div');
    line.className = 'now-line';
    line.style.top = `${offsetWithinHour}px`;
    hourRowCell.appendChild(line);
}

// --- EDIT DIALOG ---
function openEditDialog(id) {
    const task = appTasks.find(t => t.id === id);
    if (!task) return;
    editingId = id;
    editingDuration = task.minutes;
    editingEffort = taskEffort(task);
    editText.value = task.text;
    editNotes.value = task.notes || '';
    editCompleted.checked = Boolean(task.completed);
    editDurationChips.querySelectorAll('.duration-chip').forEach(c => {
        c.classList.toggle('active', parseInt(c.dataset.minutes) === task.minutes);
    });
    editEffortPicker.querySelectorAll('.effort-dot').forEach(d => {
        d.classList.toggle('active', parseInt(d.dataset.effort) === editingEffort);
    });
    const repeatN = habitCount(task.text, task.id);
    editEffortHint.textContent = repeatN >= 2
        ? `🔁 Habitual (seen ${repeatN + 1}× — habits usually cost less)`
        : `${EFFORT_LABELS[editingEffort]} · ${editingEffort} pt${editingEffort === 1 ? '' : 's'}`;
    if (editingEffort === 0) editEffortHint.textContent = `${EFFORT_LABELS[0]} · 0 pts`;
    editDialog.classList.remove('hidden');
    setTimeout(() => editText.focus(), 30);
}

function closeEditDialog() {
    editingId = null;
    editDialog.classList.add('hidden');
}

function saveEditDialog() {
    if (!editingId) return;
    const task = appTasks.find(t => t.id === editingId);
    if (!task) return closeEditDialog();
    const newText = editText.value.trim();
    if (newText) task.text = newText;
    task.notes = editNotes.value.trim();
    task.completed = editCompleted.checked;
    task.minutes = editingDuration;
    task.effort = editingEffort;
    saveTasks();
    renderApp();
    closeEditDialog();
    maybeAlertOverload(task.date);
}

editClose.addEventListener('click', closeEditDialog);
editCancel.addEventListener('click', closeEditDialog);
editSave.addEventListener('click', saveEditDialog);
editDelete.addEventListener('click', () => {
    if (!editingId) return;
    appTasks = appTasks.filter(t => t.id !== editingId);
    saveTasks();
    renderApp();
    closeEditDialog();
});
editDialog.addEventListener('click', (e) => {
    if (e.target === editDialog) closeEditDialog();
});
editText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEditDialog(); }
});
editDurationChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.duration-chip');
    if (!chip) return;
    editDurationChips.querySelectorAll('.duration-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    editingDuration = parseInt(chip.dataset.minutes);
});
editEffortPicker.addEventListener('click', (e) => {
    const dot = e.target.closest('.effort-dot');
    if (!dot) return;
    editEffortPicker.querySelectorAll('.effort-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
    editingEffort = parseInt(dot.dataset.effort);
    editEffortHint.textContent = `${EFFORT_LABELS[editingEffort]} · ${editingEffort} pt${editingEffort === 1 ? '' : 's'}`;
});
newEffortPicker.addEventListener('click', (e) => {
    const dot = e.target.closest('.effort-dot');
    if (!dot) return;
    newEffortPicker.querySelectorAll('.effort-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
    selectedEffort = parseInt(dot.dataset.effort);
});
taskInput.addEventListener('input', () => {
    // Auto-suggest effort when typing a known habit (only if user hasn't overridden)
    const suggested = suggestDefaultEffort(taskInput.value);
    const currentActive = newEffortPicker.querySelector('.effort-dot.active');
    if (currentActive && parseInt(currentActive.dataset.effort) === DEFAULT_EFFORT && suggested !== DEFAULT_EFFORT) {
        newEffortPicker.querySelectorAll('.effort-dot').forEach(d => {
            d.classList.toggle('active', parseInt(d.dataset.effort) === suggested);
        });
        selectedEffort = suggested;
    }
});

// --- ADD TASK ---
function addTask() {
    const text = taskInput.value.trim();
    if (!text) { taskInput.focus(); return; }
    appTasks.push({
        id: generateId(),
        text,
        minutes: selectedDuration,
        location: 'sidebar',
        date: null,
        time: null,
        notes: '',
        completed: false,
        effort: selectedEffort
    });
    taskInput.value = '';
    autosizeTextarea();
    taskInput.focus();
    saveTasks();
    renderBubbles();
}

// --- DRAG & DROP ---
let draggedItem = null;

function setupDraggable(element) {
    element.addEventListener('dragstart', () => {
        draggedItem = element;
        setTimeout(() => { element.style.opacity = '0.5'; }, 0);
    });
    element.addEventListener('dragend', () => {
        if (draggedItem) {
            setTimeout(() => { draggedItem.style.opacity = '1'; draggedItem = null; }, 0);
        }
    });
}

function setupDropZone(element) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        element.classList.add('drag-over');
    });
    element.addEventListener('dragleave', () => element.classList.remove('drag-over'));
    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.classList.remove('drag-over');
        if (!draggedItem) return;
        const task = appTasks.find(t => t.id === draggedItem.id);
        if (!task) return;
        let droppedDate = null;
        if (element.tagName === 'TD') {
            task.location = 'grid';
            task.date = element.dataset.date;
            droppedDate = task.date;
            if (currentView === 'week') task.time = element.dataset.time;
            else if (!task.time) task.time = `${startHour}:00`;
        } else if (element.id === 'todo-list-container') {
            task.location = 'sidebar';
            task.date = null;
            task.time = null;
        }
        saveTasks();
        renderApp();
        if (droppedDate) maybeAlertOverload(droppedDate);
    });
}

// --- IMPORT / EXPORT ---
function exportTasks() {
    const payload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        tasks: appTasks
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noodle-calendar-${getISODate(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function importTasks(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const incoming = Array.isArray(data) ? data : data.tasks;
            if (!Array.isArray(incoming)) throw new Error('Invalid file format');
            const normalized = incoming.map(normalizeTask);
            const replace = confirm(
                `Import ${normalized.length} tasks?\n\n` +
                `OK = replace current tasks\nCancel = merge (keep both)`
            );
            if (replace) {
                appTasks = normalized;
            } else {
                const existingIds = new Set(appTasks.map(t => t.id));
                normalized.forEach(t => {
                    if (existingIds.has(t.id)) t.id = generateId();
                    appTasks.push(t);
                });
            }
            saveTasks();
            renderApp();
        } catch (err) {
            alert('Import failed: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// --- INPUT AUTOSIZE ---
function autosizeTextarea() {
    taskInput.style.height = 'auto';
    taskInput.style.height = Math.min(taskInput.scrollHeight, 160) + 'px';
}

// --- EVENTS ---
submitBtn.addEventListener('click', addTask);
taskInput.addEventListener('input', autosizeTextarea);
taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addTask(); }
});

durationChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.duration-chip');
    if (!chip) return;
    durationChips.querySelectorAll('.duration-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedDuration = parseInt(chip.dataset.minutes);
});

btnNext.addEventListener('click', () => {
    if (currentView === 'week') activeDate.setDate(activeDate.getDate() + 7);
    else activeDate.setMonth(activeDate.getMonth() + 1);
    renderApp();
});
btnPrev.addEventListener('click', () => {
    if (currentView === 'week') activeDate.setDate(activeDate.getDate() - 7);
    else activeDate.setMonth(activeDate.getMonth() - 1);
    renderApp();
});
btnToday.addEventListener('click', () => { activeDate = new Date(); renderApp(); });
btnWeek.addEventListener('click', () => { currentView = 'week'; renderApp(); });
btnMonth.addEventListener('click', () => { currentView = 'month'; renderApp(); });

btnTheme.addEventListener('click', () => {
    const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
});

btnExport.addEventListener('click', exportTasks);
btnImport.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importTasks(file);
    importFile.value = '';
});

// --- SUGGESTIONS ---
function openSuggestions(dateISO) {
    const tasksOnDay = appTasks
        .filter(t => t.location === 'grid' && t.date === dateISO && !t.completed)
        .slice()
        .sort((a, b) => taskEffort(b) - taskEffort(a));
    const total = effortForDate(dateISO);
    const over = total - dailyBudget;

    // Spare capacity per day in the current week (skip the overloaded one and the past)
    const todayISO = getISODate(new Date());
    const alternatives = currentWeekDates()
        .filter(iso => iso !== dateISO && iso >= todayISO)
        .map(iso => ({ iso, used: effortForDate(iso), free: dailyBudget - effortForDate(iso) }))
        .filter(x => x.free > 0)
        .sort((a, b) => b.free - a.free);

    const prettyDate = new Date(dateISO + 'T00:00').toLocaleDateString(undefined, {
        weekday: 'long', month: 'short', day: 'numeric'
    });
    suggestTitle.textContent = over > 0
        ? `${prettyDate} is ${over} pts over`
        : `${prettyDate} — balance check`;
    suggestBody.innerHTML = '';

    if (over > 0) {
        const summary = document.createElement('div');
        summary.className = 'suggest-summary';
        summary.textContent = `Using ${total}/${dailyBudget} pts. Consider moving the heaviest task below to a lighter day.`;
        suggestBody.appendChild(summary);
    }

    const section = document.createElement('div');
    section.className = 'suggest-section';
    const heading = document.createElement('h5');
    heading.textContent = over > 0 ? 'Tasks on this day (heaviest first)' : 'Tasks on this day';
    section.appendChild(heading);

    tasksOnDay.forEach(task => {
        const row = document.createElement('div');
        row.className = 'suggest-row';

        const label = document.createElement('span');
        label.className = 'task-label';
        label.textContent = task.text;
        row.appendChild(label);

        const pts = document.createElement('span');
        pts.className = 'pts';
        pts.textContent = `${taskEffort(task)} pts · ${formatDuration(task.minutes)}`;
        row.appendChild(pts);

        // Pick best alternative day where this task fits without overflowing
        const fit = alternatives.find(a => a.used + taskEffort(task) <= dailyBudget);
        if (fit) {
            const moveBtn = document.createElement('button');
            moveBtn.className = 'move-btn';
            const niceDay = new Date(fit.iso + 'T00:00')
                .toLocaleDateString(undefined, { weekday: 'short' });
            moveBtn.textContent = `→ ${niceDay} (${fit.used}/${dailyBudget})`;
            moveBtn.title = `Move to ${niceDay}`;
            moveBtn.onclick = () => {
                task.date = fit.iso;
                saveTasks();
                closeSuggestDialog();
                renderApp();
            };
            row.appendChild(moveBtn);
        }
        section.appendChild(row);
    });

    if (tasksOnDay.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'suggest-summary';
        empty.style.background = 'var(--surface-alt)';
        empty.style.border = '1px solid var(--border)';
        empty.textContent = 'Nothing scheduled here.';
        section.appendChild(empty);
    }

    suggestBody.appendChild(section);
    suggestDialog.classList.remove('hidden');
}

function closeSuggestDialog() {
    suggestDialog.classList.add('hidden');
}

function maybeAlertOverload(dateISO) {
    if (!dateISO) return;
    if (effortForDate(dateISO) > dailyBudget) openSuggestions(dateISO);
}

suggestClose.addEventListener('click', closeSuggestDialog);
suggestDismiss.addEventListener('click', closeSuggestDialog);
suggestDialog.addEventListener('click', (e) => {
    if (e.target === suggestDialog) closeSuggestDialog();
});

// --- BUDGET SETTING ---
function updateBudgetLabel() { budgetLabel.textContent = dailyBudget; }
btnBudget.addEventListener('click', () => {
    const input = prompt(
        `Daily effort budget (current: ${dailyBudget} pts)\n` +
        `How many points can you comfortably spend in one day?`,
        dailyBudget
    );
    if (input === null) return;
    const n = parseInt(input);
    if (!n || n < 1 || n > 50) return alert('Please enter a number between 1 and 50.');
    dailyBudget = n;
    localStorage.setItem(BUDGET_KEY, String(n));
    updateBudgetLabel();
    renderApp();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!editDialog.classList.contains('hidden')) closeEditDialog();
        else if (!suggestDialog.classList.contains('hidden')) closeSuggestDialog();
        else closePopover();
    }
});

// --- STARTUP ---
updateBudgetLabel();
applyTheme(localStorage.getItem(THEME_KEY) || 'light');
loadTasks();
renderApp();
setupDropZone(todoListContainer);
setInterval(updateNowLine, 60_000);

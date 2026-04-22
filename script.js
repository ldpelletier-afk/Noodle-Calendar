// --- CONFIGURATION ---
const ONE_HOUR_HEIGHT = 50;
const startHour = 7;
const endHour = 20;
const MAX_MONTH_BUBBLES = 2; // shown before "+N more"

// --- STATE ---
let activeDate = new Date();
let currentView = 'week';
let appTasks = [];
let selectedDuration = 60;
let nowLineTimer = null;

// --- ELEMENTS ---
const taskInput = document.getElementById('task-input');
const submitBtn = document.getElementById('submit-btn');
const durationChips = document.getElementById('duration-chips');
const todoListContainer = document.getElementById('todo-list-container');
const taskCountEl = document.getElementById('task-count');
const weekBody = document.getElementById('week-body');
const monthBody = document.getElementById('month-body');
const weekHeaderRow = document.getElementById('week-header-row');
const dateLabel = document.getElementById('current-date-label');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnToday = document.getElementById('btn-today');
const btnTheme = document.getElementById('btn-theme');
const btnWeek = document.getElementById('btn-week');
const btnMonth = document.getElementById('btn-month');
const tableWeek = document.getElementById('week-view-table');
const tableMonth = document.getElementById('month-view-table');

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

// Deterministic hue from task text, so the same task always keeps its color.
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

// --- DATA ---
function saveTasks() {
    localStorage.setItem('calendarTasks', JSON.stringify(appTasks));
}

function loadTasks() {
    const data = localStorage.getItem('calendarTasks');
    if (!data) return;
    const parsed = JSON.parse(data);
    appTasks = parsed.map(t => {
        if (!t.id) {
            return {
                id: generateId(),
                text: t.text,
                minutes: parseInt(t.minutes),
                location: t.location.type,
                date: t.location.date || null,
                time: t.location.time === 'all-day' ? `${startHour}:00` : (t.location.time || null)
            };
        }
        return t;
    });
}

// --- THEME ---
function applyTheme(theme) {
    document.body.dataset.theme = theme;
    btnTheme.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('calendarTheme', theme);
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
    bubble.id = task.id;
    bubble.draggable = true;
    bubble.style.setProperty('--bubble-hue', hueFromText(task.text));

    const textSpan = document.createElement('span');
    textSpan.className = 'task-text';
    textSpan.textContent = task.text;
    bubble.appendChild(textSpan);

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
        renderBubbles();
    };
    deleteBtn.addEventListener('mousedown', e => e.stopPropagation());
    bubble.appendChild(deleteBtn);

    setupDraggable(bubble);
    return bubble;
}

// --- BUBBLE PLACEMENT ---
function renderBubbles() {
    todoListContainer.innerHTML = '';
    document.querySelectorAll('.task-bubble, .more-chip').forEach(el => el.remove());

    // Sidebar + week grid: one bubble per task
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

    // Month view: group by date, cap at MAX_MONTH_BUBBLES with overflow chip
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
    const n = appTasks.filter(t => t.location === 'sidebar').length;
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
    const todayISO = getISODate(now);
    const todayCol = tableWeek.querySelector(`td.today-col[data-time="${startHour}:00"]`);
    if (!todayCol) return; // today not in current week

    const hour = now.getHours();
    const minute = now.getMinutes();
    if (hour < startHour || hour >= endHour) return;

    // Find the hour row for this hour to position relative to it
    const hourRowCell = tableWeek.querySelector(`td.today-col[data-time="${hour}:00"]`);
    if (!hourRowCell) return;

    const offsetWithinHour = (minute / 60) * ONE_HOUR_HEIGHT;
    const line = document.createElement('div');
    line.className = 'now-line';
    line.style.top = `${offsetWithinHour}px`;
    hourRowCell.appendChild(line);
}

// --- ADD TASK ---
function addTask() {
    const text = taskInput.value.trim();
    if (!text) {
        taskInput.focus();
        return;
    }
    appTasks.push({
        id: generateId(),
        text,
        minutes: selectedDuration,
        location: 'sidebar',
        date: null,
        time: null
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
            setTimeout(() => {
                draggedItem.style.opacity = '1';
                draggedItem = null;
            }, 0);
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

        if (element.tagName === 'TD') {
            task.location = 'grid';
            task.date = element.dataset.date;
            if (currentView === 'week') task.time = element.dataset.time;
            else if (!task.time) task.time = `${startHour}:00`;
        } else if (element.id === 'todo-list-container') {
            task.location = 'sidebar';
            task.date = null;
            task.time = null;
        }
        saveTasks();
        renderBubbles();
    });
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
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addTask();
    }
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

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePopover();
});

// --- STARTUP ---
applyTheme(localStorage.getItem('calendarTheme') || 'light');
loadTasks();
renderApp();
setupDropZone(todoListContainer);

// Refresh now-line every minute
nowLineTimer = setInterval(updateNowLine, 60_000);

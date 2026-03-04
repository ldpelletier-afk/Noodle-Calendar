// --- CONFIGURATION ---
const ONE_HOUR_HEIGHT = 50; 
const startHour = 7; 
const endHour = 20;

// --- STATE VARIABLES (Single Source of Truth) ---
let activeDate = new Date(); 
let currentView = 'week';    
let appTasks = []; // The Master Database of all tasks

// --- ELEMENTS ---
const taskInput = document.getElementById('task-input');
const durationSelect = document.getElementById('duration-select');
const submitBtn = document.getElementById('submit-btn');
const todoListContainer = document.getElementById('todo-list-container');
const weekBody = document.getElementById('week-body');
const monthBody = document.getElementById('month-body');
const weekHeaderRow = document.getElementById('week-header-row');
const dateLabel = document.getElementById('current-date-label');

const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnWeek = document.getElementById('btn-week');
const btnMonth = document.getElementById('btn-month');
const tableWeek = document.getElementById('week-view-table');
const tableMonth = document.getElementById('month-view-table');

// --- HELPER FUNCTIONS ---
function formatTime(hour) {
    const h = hour % 12 || 12; 
    return `${h}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
}

function getISODate(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; 
}

function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    d.setDate(diff);
    return d;
}

// Generate unique ID for tasks
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}


// --- DATA MANAGEMENT ---
function saveTasks() {
    localStorage.setItem('calendarTasks', JSON.stringify(appTasks));
}

function loadTasks() {
    const data = localStorage.getItem('calendarTasks');
    if (data) {
        const parsed = JSON.parse(data);
        
        // MIGRATION SCRIPT: Upgrades old data formats to the new strict object model
        appTasks = parsed.map(t => {
            if (!t.id) {
                // If it's an old task, map it to the new structure
                return {
                    id: generateId(),
                    text: t.text,
                    minutes: parseInt(t.minutes),
                    location: t.location.type,
                    date: t.location.date || null,
                    time: t.location.time === 'all-day' ? `${startHour}:00` : (t.location.time || null)
                };
            }
            return t; // Already new format
        });
    }
}


// --- VIEW RENDERING LOGIC ---
function renderApp() {
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
    
    renderBubbles(); // Place tasks on the newly drawn grid
}

function renderWeekView() {
    weekHeaderRow.innerHTML = '<th>Time</th>';
    weekBody.innerHTML = '';
    
    const startOfWeek = getStartOfWeek(activeDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    dateLabel.textContent = `${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${monthNames[endOfWeek.getMonth()]} ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;

    const weekDates = [];
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    
    for (let i = 0; i < 7; i++) {
        let currentDay = new Date(startOfWeek);
        currentDay.setDate(startOfWeek.getDate() + i);
        weekDates.push(getISODate(currentDay));
        
        const th = document.createElement('th');
        th.innerHTML = `${dayNames[i]}<br><small>${currentDay.getDate()}</small>`;
        weekHeaderRow.appendChild(th);
    }

    for (let h = startHour; h < endHour; h++) {
        const rowTop = document.createElement('tr');
        rowTop.className = 'hour-row';
        const timeCell = document.createElement('td');
        timeCell.textContent = formatTime(h);
        timeCell.rowSpan = 2; 
        timeCell.style.fontWeight = "bold";
        rowTop.appendChild(timeCell);

        for (let i = 0; i < 7; i++) {
            const cell = document.createElement('td');
            cell.dataset.date = weekDates[i]; 
            cell.dataset.time = `${h}:00`;
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
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    dateLabel.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let dateCounter = 1;
    
    for (let row = 0; row < 6; row++) {
        const tr = document.createElement('tr');
        for (let col = 0; col < 7; col++) {
            const td = document.createElement('td');
            
            if (row === 0 && col < firstDay) {
                // Empty
            } else if (dateCounter > daysInMonth) {
                // Empty
            } else {
                const cellDate = new Date(year, month, dateCounter);
                td.dataset.date = getISODate(cellDate);
                
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


// --- BUBBLE GENERATION AND PLACEMENT ---
function renderBubbles() {
    // 1. Wipe all existing bubbles off the screen
    todoListContainer.innerHTML = '';
    document.querySelectorAll('.task-bubble').forEach(b => b.remove());

    // 2. Re-draw them based on the Master Array
    appTasks.forEach(task => {
        const bubble = document.createElement('li');
        bubble.className = 'task-bubble';
        bubble.id = task.id; // Crucial hook for drag-and-drop
        bubble.draggable = true;
        
        const textNode = document.createTextNode(task.text);
        bubble.appendChild(textNode);
        
        const deleteBtn = document.createElement('span');
        deleteBtn.textContent = '×';
        deleteBtn.className = 'delete-btn';
        deleteBtn.onclick = function() { 
            // Delete from array, save, and redraw
            appTasks = appTasks.filter(t => t.id !== task.id);
            saveTasks(); 
            renderBubbles();
        };
        deleteBtn.addEventListener('mousedown', function(e){ e.stopPropagation(); });
        bubble.appendChild(deleteBtn);

        // Standard height assignment
        const heightPixels = (ONE_HOUR_HEIGHT / 60) * task.minutes;
        bubble.style.height = `${heightPixels}px`;
        setupDraggable(bubble);

        // 3. Place them in the DOM
        if (task.location === 'sidebar') {
            todoListContainer.appendChild(bubble);
        } else if (task.location === 'grid') {
            
            if (currentView === 'week') {
                const selector = `#week-view-table td[data-date="${task.date}"][data-time="${task.time}"]`;
                const targetCell = document.querySelector(selector);
                if (targetCell) targetCell.appendChild(bubble);
            } 
            else if (currentView === 'month') {
                const selector = `#month-view-table td[data-date="${task.date}"]`;
                const targetCell = document.querySelector(selector);
                if (targetCell) {
                     bubble.style.height = 'auto'; // Month view override
                     targetCell.appendChild(bubble);
                }
            }
        }
    });
}


// --- ADD NEW TASK ---
function addTask() {
    const text = taskInput.value.trim();
    if (!text) return alert("Please enter a task!");

    const durationMinutes = parseInt(durationSelect.value);
    
    // Add straight to Master Array
    appTasks.push({
        id: generateId(),
        text: text,
        minutes: durationMinutes,
        location: 'sidebar',
        date: null,
        time: null
    });

    taskInput.value = '';
    taskInput.focus();
    
    saveTasks(); 
    renderBubbles();
}

submitBtn.addEventListener('click', addTask);


// --- DRAG AND DROP LOGIC ---
let draggedItem = null;

function setupDraggable(element) {
    element.addEventListener('dragstart', function(e) {
        draggedItem = element;
        setTimeout(() => { element.style.opacity = '0.5'; }, 0);
    });

    element.addEventListener('dragend', function(e) {
        if(draggedItem) {
            setTimeout(() => { 
                draggedItem.style.opacity = '1'; 
                draggedItem = null; 
            }, 0);
        }
    });
}

function setupDropZone(element) {
    element.addEventListener('dragover', function(e) {
        e.preventDefault(); 
        element.classList.add('drag-over');
    });

    element.addEventListener('dragleave', function(e) {
        element.classList.remove('drag-over');
    });

    element.addEventListener('drop', function(e) {
        e.preventDefault();
        element.classList.remove('drag-over');

        if (draggedItem) {
            // Find the task in our database
            const taskId = draggedItem.id;
            const taskObj = appTasks.find(t => t.id === taskId);

            if (!taskObj) return;

            if (element.tagName === 'TD') {
                taskObj.location = 'grid';
                taskObj.date = element.dataset.date;
                
                if (currentView === 'week') {
                    taskObj.time = element.dataset.time;
                } else if (currentView === 'month') {
                    // If moving from sidebar to month, assign default time so it renders in week view later
                    if (!taskObj.time) {
                        taskObj.time = `${startHour}:00`; 
                    }
                }
            } else if (element.id === 'todo-list-container') {
                taskObj.location = 'sidebar';
                taskObj.date = null;
                taskObj.time = null;
            }
            
            saveTasks();
            renderBubbles(); // Redraws everything in the correct spot with correct styles
        }
    });
}

// --- NAVIGATION CONTROLS ---
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

btnWeek.addEventListener('click', () => { currentView = 'week'; renderApp(); });
btnMonth.addEventListener('click', () => { currentView = 'month'; renderApp(); });

// --- STARTUP SEQUENCE ---
loadTasks();    // Load DB
renderApp();    // Draw UI
setupDropZone(todoListContainer);
'use strict';

// === DOM-REFERENZEN ===
const taskInput         = document.getElementById('task-input');
const addButton         = document.getElementById('add-button');
const taskList          = document.getElementById('task-list');
const prioritySelect    = document.getElementById('priority-select');

// Modal-Elemente
const taskModal         = document.getElementById('task-modal');
const modalTaskTitle    = document.getElementById('modal-task-title');
const modalDeadlineInput = document.getElementById('modal-deadline-input');
const saveDetailsButton = document.getElementById('save-details-button');
const closeButton       = taskModal.querySelector('.close-button');
const modalNoteInput    = document.getElementById('modal-note-input');
const modalTimerInput   = document.getElementById('modal-timer-input');
const modalTimerDisplay = document.getElementById('modal-timer-display');
const startTimerButton  = document.getElementById('start-timer-button');

// Filter-Buttons
const filterAllButton       = document.getElementById('filter-all');
const filterOpenButton      = document.getElementById('filter-open');
const filterCompletedButton = document.getElementById('filter-completed');

// === GLOBALE STATE-VARIABLEN ===

let tasks = [];

let currentFilter = 'all';
let currentTaskIdInModal = null;
let globalTimerInterval = null;

const STORAGE_KEY = 'todoTasks';

// === INITIALISIERUNG ===

init();

function init() {
    addButton.addEventListener('click', handleAddTask);
    taskInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleAddTask();
        }
    });

    taskList.addEventListener('click', handleTaskListClick);

    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === taskModal) {
            closeModal();
        }
    });

    saveDetailsButton.addEventListener('click', saveDetails);
    startTimerButton.addEventListener('click', handleTimerButtonClick);

    filterAllButton.addEventListener('click', () => setFilter('all'));
    filterOpenButton.addEventListener('click', () => setFilter('open'));
    filterCompletedButton.addEventListener('click', () => setFilter('completed'));

    loadTasksFromStorage();
    startGlobalTimerLoop();

    window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY) {
            loadTasksFromStorage();
        }
    });

    requestNotificationPermission();
}

// === HANDLER: AUFGABEN HINZUFÜGEN ===

function handleAddTask() {
    const text = taskInput.value.trim();
    const priority = prioritySelect.value;

    if (!text) {
        alert('Bitte geben Sie eine Aufgabe ein!');
        return;
    }

    const newTask = {
        id: generateId(),
        text,
        completed: false,
        priority,
        note: '',
        deadline: null
    };

    tasks.push(newTask);
    taskInput.value = '';
    saveTasksToStorage();
    renderTasks();
}

// === EVENT-DELEGATION FÜR TASK-LISTE ===

function handleTaskListClick(event) {
    const listItem = event.target.closest('.task-item');
    if (!listItem) return;

    const taskId = listItem.dataset.id;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (event.target.classList.contains('status-toggle')) {
        toggleTaskCompleted(taskId);
        return;
    }

    if (event.target.classList.contains('delete-button')) {
        deleteTask(taskId);
        return;
    }

    openModalForTask(taskId);
}


// === MODAL-LOGIK ===

function openModalForTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    currentTaskIdInModal = taskId;
    modalTaskTitle.textContent = task.text;
    modalNoteInput.value = task.note || '';

    if (task.deadline) {
        const date = new Date(task.deadline);
        const offset = date.getTimezoneOffset() * 60000;
        const localISOTime = new Date(date.getTime() - offset).toISOString().slice(0, 16);
        
        modalDeadlineInput.value = localISOTime;
    } else {
        modalDeadlineInput.value = '';
    }

    // Aktualisiert Timer-Display und Button-Text
    updateModalTimerIfOpen(); 
    
    taskModal.style.display = 'block';
}

function closeModal() {
    taskModal.style.display = 'none';
    currentTaskIdInModal = null;
}

function saveDetails() {
    if (!currentTaskIdInModal) return;

    const task = tasks.find(t => t.id === currentTaskIdInModal);
    if (!task) return;

    task.note = modalNoteInput.value.trim();

    const dateVal = modalDeadlineInput.value;
    if (dateVal) {
        task.deadline = new Date(dateVal).getTime();
    } else {
        // HINWEIS: Deadline löschen, wenn Feld leer
        task.deadline = null; 
    }

    saveTasksToStorage();
    renderTasks();
    closeModal();
}

// === TIMER-LOGIK ===

function handleTimerButtonClick() {
    if (!currentTaskIdInModal) return;
    const task = tasks.find(t => t.id === currentTaskIdInModal);
    if (!task) return;

    if (task.deadline) {
        // Stoppen
        stopTimerForTask(task);
    } else {
        // Starten
        const minutes = parseInt(modalTimerInput.value, 10) || 0;
        if (minutes <= 0) {
            alert('Bitte eine positive Anzahl an Minuten eingeben.');
            return;
        }
        startTimerForTask(task, minutes);
    }

    saveTasksToStorage();
    renderTasks();
    
    // Timer-Anzeige und Button sofort aktualisieren
    updateModalTimerIfOpen();
}

function startTimerForTask(task, minutes) {
    const now = Date.now();
    task.deadline = now + minutes * 60 * 1000;
}

function stopTimerForTask(task) {
    task.deadline = null;
}

function startGlobalTimerLoop() {
    if (globalTimerInterval) {
        clearInterval(globalTimerInterval);
    }

    globalTimerInterval = setInterval(() => {
        const now = Date.now();
        let shouldSave = false;

        tasks.forEach(task => {
            if (!task.deadline) return;

            const timeLeftMs = task.deadline - now;

            if (timeLeftMs <= 0) {
                task.deadline = null;
                shouldSave = true;

                showNotification(task.text);
            }
        });

        if (shouldSave) {
            saveTasksToStorage();
        }

        updateAllTaskTimerDisplays();
        updateModalTimerIfOpen();
    }, 1000);
}

function getTimeLeftInSeconds(task) {
    if (!task.deadline) return 0;
    const diffMs = task.deadline - Date.now();
    return diffMs > 0 ? Math.floor(diffMs / 1000) : 0;
}

// === UI-UPDATE-FUNKTIONEN (Timer) ===

function updateModalTimerIfOpen() {
    if (!currentTaskIdInModal) return;
    const task = tasks.find(t => t.id === currentTaskIdInModal);
    if (!task) return;

    const seconds = getTimeLeftInSeconds(task);
    updateModalTimerDisplay(seconds);

    // Aktualisiert Button-Text und Timer-Eingabefeld
    if (task.deadline) {
        startTimerButton.textContent = 'Timer stoppen';
        modalTimerInput.disabled = true; // Timer-Minuten sperren, während er läuft
    } else {
        startTimerButton.textContent = 'Timer starten';
        modalTimerInput.disabled = false;
    }
}

function updateAllTaskTimerDisplays() {
    tasks.forEach(task => {
        const listItem = taskList.querySelector(`.task-item[data-id="${task.id}"]`);
        if (!listItem) return;

        const timerSpan = listItem.querySelector('.task-timer');
        if (!timerSpan) return;

        if (task.deadline) {
            timerSpan.textContent = getFuzzyDeadlineText(task.deadline);
            
            if (task.deadline < Date.now()) {
                timerSpan.style.color = '#d9534f';
            } else {
                timerSpan.style.color = '#007bff';
            }
        } else {
            timerSpan.textContent = '';
        }
    });
}

function updateModalTimerDisplay(seconds) {
    if (seconds > 0) {
        modalTimerDisplay.textContent = 'Verbleibend: ' + formatTimeForDisplay(seconds);
    } else {
        modalTimerDisplay.textContent = 'Timer inaktiv.';
    }
}

function formatTimeForDisplay(totalSeconds) {
    const hours   = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num) => String(num).padStart(2, '0');

    if (hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    } else {
        return `${pad(minutes)}:${pad(seconds)}`;
    }
}

// === BROWSER-NOTIFICATIONS ===

function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.warn("Dieser Browser unterstützt keine Desktop-Benachrichtigungen.");
        return;
    }

    if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('Benachrichtigungsberechtigung erteilt.');
            } else {
                console.warn('Benachrichtigungsberechtigung abgelehnt.');
            }
        });
    }
}

function showNotification(taskText) {
    if (Notification.permission === 'granted') {
        
        const options = {
            body: `Deine Aufgabe "${taskText}" ist jetzt fällig!`,
            icon: 'favicon.ico',
            tag: 'task-reminder-' + Date.now(),
            vibrate: [200, 100, 200]
        };

        const notification = new Notification('⏰ To-Do-Timer abgelaufen!', options);

        notification.onclick = function(event) {
            event.preventDefault();
            window.focus();
        };

    } else if (Notification.permission === 'denied') {
        console.warn('Benachrichtigung konnte nicht gesendet werden, da die Berechtigung verweigert wurde.');
    }
}

// === SPEICHERUNG (localStorage) ===

function saveTasksToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasksFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        tasks = [];
        renderTasks();
        return;
    }

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            tasks = [];
        } else {
            tasks = parsed.map((t) => ({
                id: t.id || generateId(),
                text: t.text || '',
                completed: !!t.completed,
                priority: t.priority || 'medium',
                note: t.note || '',
                deadline: typeof t.deadline === 'number' ? t.deadline : null
            }));
        }
    } catch (e) {
        console.error('Fehler beim Parsen von localStorage:', e);
        tasks = [];
    }

    renderTasks();
    updateAllTaskTimerDisplays();
}

// === RENDERING DER TASK-LISTE ===

function renderTasks() {
    taskList.innerHTML = '';

    tasks.forEach(task => {
        if (!shouldTaskBeVisible(task)) {
            return;
        }

        const listItem = document.createElement('li');
        listItem.classList.add('task-item', task.priority);
        if (task.completed) {
            listItem.classList.add('completed');
        }
        listItem.dataset.id = task.id;

        const toggleButton = document.createElement('button');
        toggleButton.classList.add('status-toggle');
        if (task.completed) {
            toggleButton.classList.add('completed');
        }
        toggleButton.dataset.action = 'toggle-status';
        
        const textSpan = document.createElement('span');
        textSpan.classList.add('task-text');
        textSpan.textContent = task.text;
        
        const timerSpan = document.createElement('span');
        timerSpan.classList.add('task-timer');
        
        const deleteButton = document.createElement('button');
        deleteButton.classList.add('delete-button');
        deleteButton.dataset.action = 'delete';
        deleteButton.textContent = 'Löschen';

        listItem.appendChild(toggleButton);
        listItem.appendChild(textSpan);
        listItem.appendChild(timerSpan);
        listItem.appendChild(deleteButton);
        

        taskList.appendChild(listItem);
    });

    updateAllTaskTimerDisplays();
}

function shouldTaskBeVisible(task) {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'open') return !task.completed;
    if (currentFilter === 'completed') return task.completed;
    return true;
}

// === FILTER ===

function setFilter(filterType) {
    currentFilter = filterType;

    filterAllButton.classList.remove('active');
    filterOpenButton.classList.remove('active');
    filterCompletedButton.classList.remove('active');

    if (filterType === 'all') {
        filterAllButton.classList.add('active');
    } else if (filterType === 'open') {
        filterOpenButton.classList.add('active');
    } else if (filterType === 'completed') {
        filterCompletedButton.classList.add('active');
    }

    renderTasks();
}

// === TASK-ÄNDERUNGEN (State-Operationen) ===

function deleteTask(taskId) {
    tasks = tasks.filter(t => t.id !== taskId);
    saveTasksToStorage();
    renderTasks();
}
function toggleTaskCompleted(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    task.completed = !task.completed;

    saveTasksToStorage();
    renderTasks();
}

// === HELFER ===

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function createStars(count = 150) {
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
        const star = document.createElement('div');
        star.classList.add('star');

        const top = Math.random() * 100;
        const left = Math.random() * 100;
        star.style.top = top + 'vh';
        star.style.left = left + 'vw';

        const size = 1 + Math.random() * 2;
        star.style.width = size + 'px';
        star.style.height = size + 'px';

        const duration = 2 + Math.random() * 4;
        const delay = Math.random() * 4;
        star.style.animationDuration = duration + 's';
        star.style.animationDelay = delay + 's';

        fragment.appendChild(star);
    }

    document.body.appendChild(fragment);
}

createStars();

function getFuzzyDeadlineText(deadlineTimestamp) {
    if (!deadlineTimestamp) return '';

    const now = Date.now();
    const diffMs = deadlineTimestamp - now;
    const isOverdue = diffMs < 0;
    
    const diffAbs = Math.abs(diffMs);
    
    const oneMinute = 60 * 1000;
    const oneHour   = 60 * oneMinute;
    const oneDay    = 24 * oneHour;
    const oneMonth  = 30 * oneDay;
    const oneYear   = 365 * oneDay;

    let text = '';

    if (diffAbs < oneMinute) {
        text = 'Jetzt';
    } else if (diffAbs < oneHour) {
        const mins = Math.ceil(diffAbs / oneMinute);
        text = `${mins} Min.`;
    } else if (diffAbs < oneDay) {
        const hours = Math.ceil(diffAbs / oneHour);
        text = `${hours} Std.`;
    } else if (diffAbs < oneMonth) {
        const days = Math.ceil(diffAbs / oneDay);
        text = `${days} Tag(en)`;
    } else if (diffAbs < oneYear) {
        const months = Math.round(diffAbs / oneMonth);
        text = `ca. ${months} Monat(en)`;
    } else {
        const years = Math.round(diffAbs / oneYear);
        text = `ca. ${years} Jahr(en)`;
    }

    if (isOverdue) {
        return `Überfällig seit ${text}`;
    } else {
        return `in ${text}`;
    }
}
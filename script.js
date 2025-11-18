'use strict';

// === DOM-REFERENZEN ===
const taskInput         = document.getElementById('task-input');
const addButton         = document.getElementById('add-button');
const taskList          = document.getElementById('task-list');
const prioritySelect    = document.getElementById('priority-select');

// Modal-Elemente
const taskModal         = document.getElementById('task-modal');
const modalTaskTitle    = document.getElementById('modal-task-title');
const modalNoteInput    = document.getElementById('modal-note-input');
const modalTimerInput   = document.getElementById('modal-timer-input');
const modalTimerDisplay = document.getElementById('modal-timer-display');
const startTimerButton  = document.getElementById('start-timer-button');
const saveDetailsButton = document.getElementById('save-details-button');
const closeButton       = taskModal.querySelector('.close-button');

// Filter-Buttons
const filterAllButton       = document.getElementById('filter-all');
const filterOpenButton      = document.getElementById('filter-open');
const filterCompletedButton = document.getElementById('filter-completed');

// === GLOBALE STATE-VARIABLEN ===

/**
 * Aktuelle Aufgaben in Memory (Single Source of Truth).
 * Jede Aufgabe:
 * {
 *   id: string,
 *   text: string,
 *   completed: boolean,
 *   priority: 'low' | 'medium' | 'high',
 *   note: string,
 *   deadline: number | null   // Timestamp in ms, wann der Timer abläuft
 * }
 */
let tasks = [];

let currentFilter = 'all';          // 'all' | 'open' | 'completed'
let currentTaskIdInModal = null;    // id der Task, die gerade im Modal bearbeitet wird

let globalTimerInterval = null;     // Ein Intervall, das alle Timer aktualisiert

const STORAGE_KEY = 'todoTasks';

// === INITIALISIERUNG ===

init();

function init() {
    // Events für Eingabe & Add-Button
    addButton.addEventListener('click', handleAddTask);
    taskInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleAddTask();
        }
    });

    // Event Delegation für die Task-Liste
    taskList.addEventListener('click', handleTaskListClick);

    // Modal-Events
    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === taskModal) {
            closeModal();
        }
    });

    saveDetailsButton.addEventListener('click', saveDetails);
    startTimerButton.addEventListener('click', handleTimerButtonClick);

    // Filter-Buttons
    filterAllButton.addEventListener('click', () => setFilter('all'));
    filterOpenButton.addEventListener('click', () => setFilter('open'));
    filterCompletedButton.addEventListener('click', () => setFilter('completed'));

    // localStorage laden
    loadTasksFromStorage();

    // Timer-Intervall starten
    startGlobalTimerLoop();

    // Auf Änderungen aus anderen Tabs reagieren
    window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY) {
            loadTasksFromStorage();
        }
    });
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

/**
 * Zentrale Click-Logik für die gesamte Task-Liste.
 * Differenziert anhand von Klassen:
 * - .delete-button  → löschen
 * - .task-text      → erledigt toggeln
 * - sonst           → Modal öffnen
 */
function handleTaskListClick(event) {
    const listItem = event.target.closest('.task-item');
    if (!listItem) return;

    const taskId = listItem.dataset.id;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // ➜ NEU: Status-Button links neben "Löschen"
    if (event.target.classList.contains('status-toggle')) {
        toggleTaskCompleted(taskId);  // erledigt/offen umschalten
        return;
    }

    // Löschen-Button
    if (event.target.classList.contains('delete-button')) {
        deleteTask(taskId);
        return;
    }

    // Klick irgendwo sonst auf das Listenelement → Modal öffnen
    openModalForTask(taskId);
}


// === MODAL-LOGIK ===

function openModalForTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    currentTaskIdInModal = taskId;

    modalTaskTitle.textContent = task.text;
    modalNoteInput.value = task.note || '';

    const timeLeftSeconds = getTimeLeftInSeconds(task);
    updateModalTimerDisplay(timeLeftSeconds);

    modalTimerInput.value = timeLeftSeconds > 0 ? Math.ceil(timeLeftSeconds / 60) : 5;

    if (task.deadline) {
        startTimerButton.textContent = 'Timer stoppen';
    } else {
        startTimerButton.textContent = 'Timer starten';
    }

    taskModal.style.display = 'block';
}

function closeModal() {
    taskModal.style.display = 'none';
    currentTaskIdInModal = null;
}

/**
 * Speichert Notizen und ggf. andere Daten aus dem Modal.
 */
function saveDetails() {
    if (!currentTaskIdInModal) return;

    const task = tasks.find(t => t.id === currentTaskIdInModal);
    if (!task) return;

    task.note = modalNoteInput.value.trim();
    saveTasksToStorage();
    closeModal();
}

// === TIMER-LOGIK ===

/**
 * Wird geklickt, wenn der Timer-Button im Modal gedrückt wird.
 * - Wenn kein Timer aktiv → startet Timer
 * - Wenn Timer aktiv → stoppt Timer
 */
function handleTimerButtonClick() {
    if (!currentTaskIdInModal) return;
    const task = tasks.find(t => t.id === currentTaskIdInModal);
    if (!task) return;

    if (task.deadline) {
        // Timer stoppen
        stopTimerForTask(task);
    } else {
        // Timer starten
        const minutes = parseInt(modalTimerInput.value, 10) || 0;
        if (minutes <= 0) {
            alert('Bitte eine positive Anzahl an Minuten eingeben.');
            return;
        }
        startTimerForTask(task, minutes);
    }

    saveTasksToStorage();
    renderTasks();
    // Modal-View updaten
    const timeLeftSeconds = getTimeLeftInSeconds(task);
    updateModalTimerDisplay(timeLeftSeconds);
    startTimerButton.textContent = task.deadline ? 'Timer stoppen' : 'Timer starten';
}

/**
 * Startet Timer für eine bestimmte Task (setzt ein Deadline-Timestamp).
 */
function startTimerForTask(task, minutes) {
    const now = Date.now();
    task.deadline = now + minutes * 60 * 1000;
}

/**
 * Stoppt Timer für eine bestimmte Task.
 */
function stopTimerForTask(task) {
    task.deadline = null;
}

/**
 * Startet ein zentrales Interval, das alle 1s alle Timer aktualisiert.
 * Läuft nur einmal pro Tab.
 */
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
                // Timer abgelaufen
                task.deadline = null;
                shouldSave = true;

                // Alert nur in diesem Tab
                alert(`Timer für Aufgabe "${task.text}" ist abgelaufen!`);
            }
        });

        if (shouldSave) {
            saveTasksToStorage();
        }

        // UI aktualisieren
        updateAllTaskTimerDisplays();
        updateModalTimerIfOpen();
    }, 1000);
}

/**
 * Gibt verbleibende Zeit in Sekunden zurück, oder 0 wenn kein Timer.
 */
function getTimeLeftInSeconds(task) {
    if (!task.deadline) return 0;
    const diffMs = task.deadline - Date.now();
    return diffMs > 0 ? Math.floor(diffMs / 1000) : 0;
}

// === UI-UPDATE-FUNKTIONEN (Timer) ===

/**
 * Aktualisiert die Timer-Anzeige im Modal (falls offen).
 */
function updateModalTimerIfOpen() {
    if (!currentTaskIdInModal) return;
    const task = tasks.find(t => t.id === currentTaskIdInModal);
    if (!task) return;

    const seconds = getTimeLeftInSeconds(task);
    updateModalTimerDisplay(seconds);

    // Button-Text korrigieren
    startTimerButton.textContent = task.deadline ? 'Timer stoppen' : 'Timer starten';
}

/**
 * Aktualisiert die Timer-Anzeige aller Aufgaben in der Liste.
 */
function updateAllTaskTimerDisplays() {
    tasks.forEach(task => {
        const listItem = taskList.querySelector(`.task-item[data-id="${task.id}"]`);
        if (!listItem) return;

        const timerSpan = listItem.querySelector('.task-timer');
        if (!timerSpan) return;

        const seconds = getTimeLeftInSeconds(task);
        const text = formatTimeForDisplay(seconds);

        if (seconds > 0) {
            timerSpan.textContent = `${text}`;
        } else {
            timerSpan.textContent = '';
        }
    });
}

/**
 * Timeranzeige im Modal.
 */
function updateModalTimerDisplay(seconds) {
    if (seconds > 0) {
        modalTimerDisplay.textContent = 'Verbleibend: ' + formatTimeForDisplay(seconds);
    } else {
        modalTimerDisplay.textContent = 'Timer inaktiv.';
    }
}

/**
 * Formatiert Sekunden in "HH:MM:SS" oder "MM:SS".
 */
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

// === SPEICHERUNG (localStorage) ===

function saveTasksToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

/**
 * Lädt Tasks aus localStorage und rendert sie neu.
 * Ist tolerant gegenüber alten Strukturen (falls vorhanden).
 */
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
                // Deadline ist ein Timestamp oder null – alles andere wird null
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
    // Liste leeren
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
        
        // Text
        const textSpan = document.createElement('span');
        textSpan.classList.add('task-text');
        textSpan.textContent = task.text;
        
        // Timer
        const timerSpan = document.createElement('span');
        timerSpan.classList.add('task-timer');
        
        // Löschen
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

    // Direkt nach dem Rendern Timer-Anzeigen aktualisieren
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

    // Status umschalten
    task.completed = !task.completed;

    // Speichern & neu rendern (Filter werden dabei berücksichtigt)
    saveTasksToStorage();
    renderTasks();
}

// === HELFER ===

function generateId() {
    // Simple ID: Timestamp + Random
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

/**
 * Erzeugt zufällig verteilte Sterne im Hintergrund.
 * @param {number} count - Anzahl Sterne
 */
function createStars(count = 150) {
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
        const star = document.createElement('div');
        star.classList.add('star');

        // Zufällige Position im Viewport
        const top = Math.random() * 100;   // 0–100vh
        const left = Math.random() * 100;  // 0–100vw
        star.style.top = top + 'vh';
        star.style.left = left + 'vw';

        // Zufällige Größe
        const size = 1 + Math.random() * 2; // 1–3px
        star.style.width = size + 'px';
        star.style.height = size + 'px';

        // Zufällige Animationsdauer & Verzögerung
        const duration = 2 + Math.random() * 4; // 2–6s
        const delay = Math.random() * 4;        // 0–4s
        star.style.animationDuration = duration + 's';
        star.style.animationDelay = delay + 's';

        fragment.appendChild(star);
    }

    document.body.appendChild(fragment);
}

// Direkt beim Laden der Seite Sterne erzeugen
createStars();

const taskInput = document.getElementById('task-input');
const addButton = document.getElementById('add-button');
const taskList = document.getElementById('task-list');

addButton.addEventListener('click', addTask);
taskInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') { 
        addTask();
    }
});


function addTask() {
    const taskText = taskInput.value.trim();

    if (taskText === "") {
        alert("Bitte geben Sie eine Aufgabe ein!");
        return; 
    }

    const listItem = document.createElement('li');
    listItem.classList.add('task-item');

    const taskSpan = document.createElement('span');
    taskSpan.textContent = taskText;

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Löschen';

    deleteButton.addEventListener('click', function() {
        taskList.removeChild(listItem);
        saveTasks(); 
    });

    listItem.addEventListener('click', function() {
        listItem.classList.toggle('completed');
        saveTasks();
    });

    listItem.appendChild(taskSpan);
    listItem.appendChild(deleteButton);

    taskList.appendChild(listItem);

    taskInput.value = "";

    saveTasks();
}

function saveTasks() {
    const tasks = [];
    document.querySelectorAll('.task-item').forEach(item => {
        tasks.push({
            text: item.querySelector('span').textContent,
            completed: item.classList.contains('completed'),
            // ⬇️ Priorität speichern
            priority: item.dataset.priority 
        });
    });
    localStorage.setItem('todoTasks', JSON.stringify(tasks));
}

function loadTasks() {
    const storedTasks = localStorage.getItem('todoTasks');
    if (storedTasks) {
        const tasks = JSON.parse(storedTasks);
        
        tasks.forEach(task => {
            // ⬇️ createTaskElement mit Priorität und Status aufrufen
            createTaskElement(task.text, task.priority, task.completed); 
        });
    }
}
function createTaskElement(taskText, isCompleted) {
    const listItem = document.createElement('li');
    listItem.classList.add('task-item'); 
    if (isCompleted) {
        listItem.classList.add('completed');
    }

    const taskSpan = document.createElement('span');
    taskSpan.textContent = taskText;

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Löschen';

    deleteButton.addEventListener('click', function(event) {
        event.stopPropagation(); 
        taskList.removeChild(listItem);
        saveTasks(); 
    });

    listItem.addEventListener('click', function() {
        listItem.classList.toggle('completed'); 
        saveTasks();
    });

    listItem.appendChild(taskSpan);
    listItem.appendChild(deleteButton);
    taskList.appendChild(listItem);
}

loadTasks();

const prioritySelect = document.getElementById('priority-select');

function addTask() {
    const taskText = taskInput.value.trim();
    const selectedPriority = prioritySelect.value; 

    if (taskText === "") {
        alert("Bitte geben Sie eine Aufgabe ein!");
        return;
    }

    createTaskElement(taskText, selectedPriority, false); // false, weil die Aufgabe neu und nicht erledigt ist

    taskInput.value = "";
    saveTasks();
}


/**
 * @param {string} taskText - Der Text der Aufgabe.
 * @param {string} priority - Die Priorität ('high', 'medium', 'low').
 * @param {boolean} isCompleted - Status der Aufgabe.
 */
function createTaskElement(taskText, priority, isCompleted) {
    const listItem = document.createElement('li');
    listItem.classList.add('task-item');
    
    listItem.classList.add(priority); 
    
    listItem.dataset.priority = priority;
    
    if (isCompleted) {
        listItem.classList.add('completed');
    }

    const taskSpan = document.createElement('span');
    taskSpan.textContent = taskText;

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Löschen';

    deleteButton.addEventListener('click', function(event) {
        event.stopPropagation(); 
        taskList.removeChild(listItem);
        saveTasks(); 
        applyFilter();
    });

    listItem.addEventListener('click', function() {
        listItem.classList.toggle('completed'); 
        saveTasks();
        applyFilter();
    });

    listItem.appendChild(taskSpan);
    listItem.appendChild(deleteButton);
    taskList.appendChild(listItem);
}

const filterAllButton = document.getElementById('filter-all');
const filterOpenButton = document.getElementById('filter-open');
const filterCompletedButton = document.getElementById('filter-completed');

let currentFilter = 'all'; 

filterAllButton.addEventListener('click', () => setFilter('all'));
filterOpenButton.addEventListener('click', () => setFilter('open'));
filterCompletedButton.addEventListener('click', () => setFilter('completed'));

/**
 * @param {string} filterType - Der zu setzende Filter.
 */
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

    applyFilter();
}


function applyFilter() {
    document.querySelectorAll('.task-item').forEach(item => {
        const isCompleted = item.classList.contains('completed');
        let shouldShow = false;

        if (currentFilter === 'all') {
            shouldShow = true;
        } else if (currentFilter === 'open') {
            shouldShow = !isCompleted;
        } else if (currentFilter === 'completed') {
            shouldShow = isCompleted;
        }

        item.style.display = shouldShow ? 'flex' : 'none';
    });
}
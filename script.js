const addTaskBtn = document.getElementById('addTaskBtn');
const taskInput = document.getElementById('taskInput');
const containers = document.querySelectorAll('.task-container');

// 1. Load data from Local Storage on startup
document.addEventListener('DOMContentLoaded', loadTasks);

// 2. Add new Task Event Listener
addTaskBtn.addEventListener('click', () => {
    const taskText = taskInput.value;
    if (taskText.trim() === '') return; // Prevent empty tasks

    createTaskElement(taskText, 'todo-container');
    taskInput.value = '';
    saveTasks();
});

// Allow adding task with "Enter" key
taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTaskBtn.click();
});

// 3. Core Function: Create HTML for a Task (Updated for Edit)
function createTaskElement(text, containerId) {
    const div = document.createElement('div');
    div.classList.add('card');
    div.setAttribute('draggable', 'true');

    // A. Create the Span for Text
    const taskTextSpan = document.createElement('span');
    taskTextSpan.classList.add('task-text');
    taskTextSpan.innerText = text;

    // Event: Save when user clicks away (blur)
    taskTextSpan.addEventListener('blur', () => {
        taskTextSpan.contentEditable = false;
        saveTasks();
    });

    // Event: Save when user presses Enter while editing
    taskTextSpan.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Stop new line
            taskTextSpan.blur(); // Trigger blur to save
        }
    });

    // B. Create Actions Container
    const actionsDiv = document.createElement('div');
    actionsDiv.classList.add('actions');

    // C. Create Edit Button
    const editBtn = document.createElement('button');
    editBtn.innerHTML = '✎'; // Pencil Symbol
    editBtn.classList.add('btn-sm', 'edit-btn');
    editBtn.title = "Edit Task";
    editBtn.addEventListener('click', () => {
        taskTextSpan.contentEditable = true;
        taskTextSpan.focus(); // Automatically put cursor in text
        
        // Move cursor to end of text (UX improvement)
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(taskTextSpan);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    });

    // D. Create Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '&#10006;'; // X Symbol
    deleteBtn.classList.add('btn-sm', 'delete-btn');
    deleteBtn.title = "Delete Task";
    deleteBtn.addEventListener('click', () => {
        div.remove();
        saveTasks();
    });

    // E. Assemble Card
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    div.appendChild(taskTextSpan);
    div.appendChild(actionsDiv);

    // F. Add Drag Events
    addDragEvents(div);

    // G. Append to DOM
    document.getElementById(containerId).appendChild(div);
}

// 4. Drag and Drop Logic
function addDragEvents(card) {
    card.addEventListener('dragstart', () => {
        card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        saveTasks(); // Save state after moving
    });
}

// Enable dropping in columns
containers.forEach(container => {
    container.addEventListener('dragover', (e) => {
        e.preventDefault(); // Necessary to allow dropping
        const afterElement = getDragAfterElement(container, e.clientY);
        const draggable = document.querySelector('.dragging');
        
        if (afterElement == null) {
            container.appendChild(draggable);
        } else {
            container.insertBefore(draggable, afterElement);
        }
    });
});

// Helper: Determine position relative to other cards
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// 5. Local Storage Functions (Updated to find .task-text)
function saveTasks() {
    const todo = [];
    const inprogress = [];
    const done = [];

    // Note: We access .innerText of the .task-text span specifically
    document.querySelectorAll('#todo-container .card').forEach(card => 
        todo.push(card.querySelector('.task-text').innerText)
    );
    document.querySelectorAll('#inprogress-container .card').forEach(card => 
        inprogress.push(card.querySelector('.task-text').innerText)
    );
    document.querySelectorAll('#done-container .card').forEach(card => 
        done.push(card.querySelector('.task-text').innerText)
    );

    const tasks = { todo, inprogress, done };
    localStorage.setItem('kanbanData', JSON.stringify(tasks));
}

function loadTasks() {
    const data = JSON.parse(localStorage.getItem('kanbanData'));
    if (!data) return;

    data.todo.forEach(text => createTaskElement(text, 'todo-container'));
    data.inprogress.forEach(text => createTaskElement(text, 'inprogress-container'));
    data.done.forEach(text => createTaskElement(text, 'done-container'));
}
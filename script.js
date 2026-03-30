// ==========================================
// 🧠 1. APP STATE & CONFIGURATION
// ==========================================
const API_URL = 'http://localhost:5000'; // Change this in production
const AppState = {
    token: localStorage.getItem('token'),
    username: localStorage.getItem('username'),
    currentBoardId: null,
    tasks: [],
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear()
};

// ==========================================
// 🛡️ 2. SECURITY & API UTILITIES
// ==========================================
// Why: Centralizes API calls and automatically injects the Authorization header.
async function apiFetch(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AppState.token}`
    };
    
    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    const response = await fetch(`${API_URL}${endpoint}`, config);
    if (response.status === 401 || response.status === 403) {
        logout(); // Token expired or invalid
    }
    return response;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = 'login.html';
}

// ==========================================
// 🚀 3. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (!AppState.token) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('userInfo').innerHTML = `Logged in as: <strong>${AppState.username}</strong>`;
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    setupTabs();
    setupDragAndDrop();
    loadBoards();
});

// ==========================================
// 📁 4. BOARD MANAGEMENT (Sidebar)
// ==========================================
async function loadBoards() {
    try {
        const res = await apiFetch('/boards');
        const boards = await res.json();
        
        const boardList = document.getElementById('board-list');
        boardList.innerHTML = '';

        if (boards.length > 0) {
            boards.forEach(board => {
                const li = document.createElement('li');
                li.className = 'board-item';
                li.innerText = board.name;
                li.onclick = () => selectBoard(board._id, board.name, li);
                boardList.appendChild(li);
            });
            // Auto-select the first board
            selectBoard(boards[0]._id, boards[0].name, boardList.firstElementChild);
        }
    } catch (error) {
        console.error("Error loading boards:", error);
    }
}

async function selectBoard(boardId, boardName, element) {
    AppState.currentBoardId = boardId;
    document.getElementById('currentBoardTitle').innerText = boardName;
    
    // NEW: Show the rename/delete buttons
    document.getElementById('boardActions').style.display = 'flex';
    
    // Update active class in sidebar
    document.querySelectorAll('.board-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    await loadTasks();
}

// Rename Board Action
document.getElementById('editBoardBtn').addEventListener('click', async () => {
    const currentName = document.getElementById('currentBoardTitle').innerText;
    const newName = prompt("Enter a new name for this board:", currentName);
    
    if (!newName || newName.trim() === '' || newName === currentName) return;

    try {
        await apiFetch(`/boards/${AppState.currentBoardId}`, 'PUT', { name: newName.trim() });
        await loadBoards(); // Refresh the sidebar and title
    } catch (error) {
        console.error("Error renaming board:", error);
        alert("Failed to rename board.");
    }
});

// Delete Board Action
document.getElementById('deleteBoardBtn').addEventListener('click', async () => {
    if (!confirm("⚠️ WARNING: Are you sure you want to delete this board AND all of its tasks? This action cannot be undone.")) return;

    try {
        const res = await apiFetch(`/boards/${AppState.currentBoardId}`, 'DELETE');
        
        if (!res.ok) {
            const errorData = await res.json();
            alert(errorData.message); // Will alert if trying to delete the last board
            return;
        }

        // Clear the current board state and reload (which auto-selects the first available board)
        AppState.currentBoardId = null;
        await loadBoards(); 
    } catch (error) {
        console.error("Error deleting board:", error);
        alert("Failed to delete board.");
    }
});

// Create New Board Action
document.getElementById('addBoardBtn').addEventListener('click', async () => {
    const boardName = prompt("Enter a name for your new project board:");
    
    // Cancel if user clicks 'Cancel' or enters an empty string
    if (!boardName || boardName.trim() === '') return;

    try {
        // Call our newly created backend route
        await apiFetch('/boards', 'POST', { name: boardName.trim() });
        
        // Refresh the sidebar to show the new board
        await loadBoards(); 
    } catch (error) {
        console.error("Error creating board:", error);
        alert("Failed to create the new board. Please try again.");
    }
});

// ==========================================
// 📝 5. TASK MANAGEMENT (CRUD)
// ==========================================
async function loadTasks() {
    if (!AppState.currentBoardId) return;

    try {
        const res = await apiFetch(`/boards/${AppState.currentBoardId}/tasks`);
        AppState.tasks = await res.json();
        renderKanban();
        renderAnalytics();
        renderCalendar();
    } catch (error) {
        console.error("Error loading tasks:", error);
    }
}

// Add Task Button
document.getElementById('addTaskBtn').addEventListener('click', async () => {
    const textInput = document.getElementById('taskInput');
    const deadlineInput = document.getElementById('taskDeadline');
    const text = textInput.value.trim();
    const deadline = deadlineInput.value || null;

    if (!text || !AppState.currentBoardId) return;

    try {
        await apiFetch('/tasks', 'POST', { text, boardId: AppState.currentBoardId, deadline });
        textInput.value = '';
        deadlineInput.value = '';
        await loadTasks(); // Refresh UI
    } catch (error) {
        console.error("Error adding task:", error);
    }
});

// Render Kanban UI
function renderKanban() {
    ['todo', 'inprogress', 'done'].forEach(status => {
        document.getElementById(`${status}-container`).innerHTML = '';
        document.getElementById(`badge-${status}`).innerText = '0';
    });

    AppState.tasks.forEach(task => {
        const container = document.getElementById(`${task.status}-container`);
        if (!container) return;

        const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done';
        
        const div = document.createElement('div');
        div.className = `card ${task.status} ${isOverdue ? 'overdue' : ''}`;        div.setAttribute('draggable', 'true');
        div.dataset.id = task._id;

        let deadlineHtml = '';
        if (task.deadline) {
            const dateStr = new Date(task.deadline).toLocaleDateString();
            deadlineHtml = `<span class="task-deadline ${isOverdue ? 'overdue-text' : ''}">📅 ${dateStr}</span>`;
        }

        div.innerHTML = `
            <div class="card-header">
                <span class="task-text">${task.text}</span>
                <div class="actions">
                    <button class="btn-sm edit-btn" onclick="editTask('${task._id}')" title="Edit">&#9998;</button>
                    <button class="btn-sm delete-btn" onclick="deleteTask('${task._id}')" title="Delete">&#10006;</button>
                </div>
            </div>
            ${deadlineHtml}
        `;

        addDragEvents(div);
        container.appendChild(div);
    });

    // Update Badges
    ['todo', 'inprogress', 'done'].forEach(status => {
        const count = AppState.tasks.filter(t => t.status === status).length;
        document.getElementById(`badge-${status}`).innerText = count;
    });
}

async function deleteTask(taskId) {
    if(!confirm("Are you sure you want to delete this task?")) return;
    try {
        await apiFetch(`/tasks/${taskId}`, 'DELETE');
        await loadTasks();
    } catch (error) {
        console.error("Error deleting task:", error);
    }
}

async function editTask(taskId) {
    // 1. Find the task in our local state
    const task = AppState.tasks.find(t => t._id === taskId);
    if (!task) return;

    // 2. Prompt the user with the current text
    const newText = prompt("Edit task description:", task.text);
    
    // 3. Cancel if they close the prompt, submit empty text, or didn't change anything
    if (newText === null || newText.trim() === '' || newText === task.text) return;

    try {
        // 4. Optimistic UI Update: Change it locally and re-render instantly
        task.text = newText.trim();
        renderKanban();
        renderCalendar();

        // 5. Background DB Sync: Send the update to MongoDB
        await apiFetch(`/tasks/${taskId}`, 'PUT', { text: task.text });
    } catch (error) {
        console.error("Error updating task:", error);
        alert("Failed to save your edit. Reverting...");
        await loadTasks(); // Revert the UI if the server fails
    }
}

// ==========================================
// 🖱️ 6. DRAG AND DROP & STATUS UPDATE
// ==========================================
function addDragEvents(card) {
    card.addEventListener('dragstart', () => card.classList.add('dragging'));
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
}

function setupDragAndDrop() {
    const containers = document.querySelectorAll('.task-container');
    
    containers.forEach(container => {
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const draggable = document.querySelector('.dragging');
            container.appendChild(draggable);
        });

        // Why: When the drop finishes, we read the new container's dataset status 
        // and fire an API call to update MongoDB instantly.
        container.addEventListener('drop', async e => {
            const draggable = document.querySelector('.dragging');
            if (!draggable) return;

            const newStatus = container.dataset.status;
            const taskId = draggable.dataset.id;
            
            // Optimistic UI update
            const task = AppState.tasks.find(t => t._id === taskId);
            if (task && task.status !== newStatus) {
                task.status = newStatus;
                renderKanban(); 
                renderAnalytics(); 
                renderCalendar(); // 🟢 NEW: Tell the calendar to update instantly!
                
                // Background DB sync
                try {
                    await apiFetch(`/tasks/${taskId}`, 'PUT', { status: newStatus });
                } catch (error) {
                    console.error("Failed to sync drop:", error);
                    await loadTasks(); // Revert on failure
                }
            }
        });
    });
}

// ==========================================
// 👁️ 7. VIEW NAVIGATION (Tabs)
// ==========================================
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.view-section').forEach(view => view.style.display = 'none');
            document.getElementById(tab.dataset.target).style.display = 'flex';
        });
    });
}

// ==========================================
// 📊 8. ANALYTICS RENDERER
// ==========================================
function renderAnalytics() {
    const total = AppState.tasks.length;
    const todo = AppState.tasks.filter(t => t.status === 'todo').length;
    const inprogress = AppState.tasks.filter(t => t.status === 'inprogress').length;
    const done = AppState.tasks.filter(t => t.status === 'done').length;
    const overdue = AppState.tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'done').length;

    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-todo').innerText = todo;
    document.getElementById('stat-inprogress').innerText = inprogress;
    document.getElementById('stat-done').innerText = done;
    document.getElementById('stat-overdue').innerText = overdue;
}

// ==========================================
// 📅 9. CALENDAR RENDERER
// ==========================================
function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthYear = document.getElementById('calendarMonthYear');
    grid.innerHTML = '';

    const date = new Date(AppState.currentYear, AppState.currentMonth, 1);
    const monthName = date.toLocaleString('default', { month: 'long' });
    monthYear.innerText = `${monthName} ${AppState.currentYear}`;

    const firstDayIndex = date.getDay();
    const daysInMonth = new Date(AppState.currentYear, AppState.currentMonth + 1, 0).getDate();

    // Empty slots for days before the 1st
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyDiv = document.createElement('div');
        grid.appendChild(emptyDiv);
    }

    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.innerHTML = `<div class="day-num">${i}</div>`;

        // Find tasks for this day
        const dayTasks = AppState.tasks.filter(t => {
            if (!t.deadline) return false;
            const tDate = new Date(t.deadline);
            return tDate.getDate() === i && tDate.getMonth() === AppState.currentMonth && tDate.getFullYear() === AppState.currentYear;
        });

        dayTasks.forEach(t => {
            const isOverdue = new Date(t.deadline) < new Date() && t.status !== 'done';
            const taskDiv = document.createElement('div');
            taskDiv.className = `calendar-task ${t.status} ${isOverdue ? 'overdue' : ''}`;
            taskDiv.innerText = t.text;
            taskDiv.title = `Status: ${t.status}`;
            dayDiv.appendChild(taskDiv);
        });

        grid.appendChild(dayDiv);
    }
}

// Calendar Navigation
document.getElementById('prevMonth').addEventListener('click', () => {
    AppState.currentMonth--;
    if (AppState.currentMonth < 0) { AppState.currentMonth = 11; AppState.currentYear--; }
    renderCalendar();
});
document.getElementById('nextMonth').addEventListener('click', () => {
    AppState.currentMonth++;
    if (AppState.currentMonth > 11) { AppState.currentMonth = 0; AppState.currentYear++; }
    renderCalendar();
});

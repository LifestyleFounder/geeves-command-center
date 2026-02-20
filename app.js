/**
 * GEEVES COMMAND CENTER - Main Application
 * ========================================
 * Unified dashboard for Dan Harrison / LFG
 */

// ===========================================
// STATE MANAGEMENT
// ===========================================

const state = {
    currentTab: 'business',
    tasks: [],
    activities: [],
    docs: [],
    notes: [],
    schedules: [],
    content: null,
    youtube: null,
    instagram: null,
    status: null,
    business: null,
    selectedTask: null,
    selectedDoc: null
};

// ===========================================
// INITIALIZATION
// ===========================================

document.addEventListener('DOMContentLoaded', async () => {
    // Load cross-device settings from KV before anything else
    await UserSettings.loadAll();
    initNavigation();
    loadAllData();
    initDragAndDrop();
    setDefaultDates();
    // Initialize Knowledge Hub sub-tab actions
    switchKHSubtab('kb');
});

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            switchTab(tab);
        });
    });
}

function switchTab(tabName) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabName);
    });
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabName);
    });
    
    // Update mobile title
    const titles = {
        business: 'Business',
        tracker: 'Performance',
        kanban: 'Projects',
        reports: 'Reports',
        'knowledge-hub': 'Knowledge Hub',
        content: 'Content Intel',
        youtube: 'YouTube',
        instagram: 'Instagram',
        'meta-ads': 'Meta Ads',
        multiplier: 'Content Multiplier'
    };
    document.getElementById('mobileTitle').textContent = titles[tabName] || tabName;
    
    state.currentTab = tabName;
    
    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = ['taskDue', 'igDate'];
    dateInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = today;
    });
}

// ===========================================
// TOGGLE SECTIONS
// ===========================================

function toggleSection(sectionId) {
    const content = document.getElementById(sectionId + 'Content');
    const icon = document.getElementById(sectionId + 'Icon');
    const section = content?.parentElement;
    
    if (!section) return;
    
    section.classList.toggle('collapsed');
    
    // Save state to localStorage
    const toggleStates = JSON.parse(localStorage.getItem('toggleStates') || '{}');
    toggleStates[sectionId] = section.classList.contains('collapsed');
    localStorage.setItem('toggleStates', JSON.stringify(toggleStates));
}

function initToggleSections() {
    // Restore saved toggle states
    const toggleStates = JSON.parse(localStorage.getItem('toggleStates') || '{}');
    Object.entries(toggleStates).forEach(([sectionId, isCollapsed]) => {
        if (isCollapsed) {
            const content = document.getElementById(sectionId + 'Content');
            const section = content?.parentElement;
            if (section) {
                section.classList.add('collapsed');
            }
        }
    });
}

// Initialize toggle sections on load
document.addEventListener('DOMContentLoaded', initToggleSections);

// ===========================================
// DATA LOADING
// ===========================================

async function loadAllData() {
    await Promise.all([
        loadTasks(),
        loadActivities(),
        loadDocs(),
        loadNotes(),
        loadSchedules(),
        loadContent(),
        loadYouTube(),
        loadInstagram(),
        loadStatus(),
        loadBusiness(),
        loadDocumentLibrary()
    ]);
}

async function loadJSON(path) {
    try {
        // Always try fetching fresh data first
        const response = await fetch(`data/${path}.json?t=${Date.now()}`);
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem(`geeves-${path}`, JSON.stringify(data));
            return data;
        }
    } catch (e) {
        console.log(`Fetch failed for ${path}, trying localStorage...`, e);
    }
    
    try {
        // Fall back to localStorage if fetch fails
        const cached = localStorage.getItem(`geeves-${path}`);
        if (cached) {
            console.log(`Loaded ${path} from localStorage`);
            return JSON.parse(cached);
        }
    } catch (e) {
        console.warn(`Could not load ${path}:`, e);
    }
    return null;
}

function saveJSON(path, data) {
    localStorage.setItem(`geeves-${path}`, JSON.stringify(data));
}

// ===========================================
// TASKS / KANBAN
// ===========================================

async function loadTasks() {
    const data = await loadJSON('tasks');
    if (data && data.tasks) {
        state.tasks = data.tasks;
        renderKanban();
    }
}

function renderKanban() {
    const columns = {
        inbox: document.querySelector('.column-tasks[data-status="inbox"]'),
        todo: document.querySelector('.column-tasks[data-status="todo"]'),
        progress: document.querySelector('.column-tasks[data-status="progress"]'),
        done: document.querySelector('.column-tasks[data-status="done"]')
    };
    
    // Clear columns
    Object.values(columns).forEach(col => col.innerHTML = '');
    
    // Count tasks per column
    const counts = { inbox: 0, todo: 0, progress: 0, done: 0 };
    
    // Sort tasks by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sortedTasks = [...state.tasks].sort((a, b) => 
        (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1)
    );
    
    sortedTasks.forEach(task => {
        const status = task.status === 'backlog' ? 'inbox' : task.status;
        const column = columns[status];
        if (!column) return;
        
        counts[status]++;
        
        const card = document.createElement('div');
        card.className = `task-card priority-${task.priority || 'medium'}`;
        card.draggable = true;
        card.dataset.id = task.id;
        
        const dueClass = isOverdue(task.due) ? 'overdue' : '';
        const dueText = task.due ? formatDate(task.due) : '';
        
        card.innerHTML = `
            <div class="task-title">${escapeHtml(task.title)}</div>
            ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
            <div class="task-meta">
                <div class="task-tags">
                    ${(task.tags || []).map(tag => `<span class="task-tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
                ${dueText ? `<span class="task-due ${dueClass}">${dueText}</span>` : ''}
            </div>
        `;
        
        card.addEventListener('click', () => openTaskDetail(task));
        column.appendChild(card);
    });
    
    // Update counts
    Object.keys(counts).forEach(status => {
        const countEl = document.querySelector(`.kanban-column[data-status="${status}"] .column-count`);
        if (countEl) countEl.textContent = counts[status];
    });
}

function openAddTaskModal() {
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDescription').value = '';
    document.getElementById('taskPriority').value = 'medium';
    document.getElementById('taskDue').value = new Date().toISOString().split('T')[0];
    document.getElementById('taskTags').value = '';
    openModal('addTaskModal');
}

function saveTask() {
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) {
        alert('Please enter a task title');
        return;
    }
    
    const task = {
        id: 'task-' + Date.now(),
        title: title,
        description: document.getElementById('taskDescription').value.trim(),
        priority: document.getElementById('taskPriority').value,
        status: 'inbox',
        due: document.getElementById('taskDue').value,
        tags: document.getElementById('taskTags').value.split(',').map(t => t.trim()).filter(Boolean),
        createdAt: new Date().toISOString()
    };
    
    state.tasks.unshift(task);
    saveTasks();
    renderKanban();
    closeModal();
    
    // Add to activity log
    addActivity('task', `Added new task: ${title}`, 'User added task via dashboard');
}

function saveTasks() {
    saveJSON('tasks', {
        lastUpdated: new Date().toISOString(),
        updatedBy: 'dashboard',
        tasks: state.tasks
    });
}

function openTaskDetail(task) {
    state.selectedTask = task;
    document.getElementById('taskDetailTitle').textContent = task.title;
    
    const body = document.getElementById('taskDetailBody');
    body.innerHTML = `
        <div class="form-group">
            <label>Status</label>
            <select id="taskDetailStatus" onchange="updateTaskStatus()">
                <option value="inbox" ${task.status === 'inbox' || task.status === 'backlog' ? 'selected' : ''}>📥 Inbox</option>
                <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>🔄 To Do</option>
                <option value="progress" ${task.status === 'progress' ? 'selected' : ''}>⚡ In Progress</option>
                <option value="done" ${task.status === 'done' ? 'selected' : ''}>✅ Done</option>
            </select>
        </div>
        <div class="form-group">
            <label>Priority</label>
            <select id="taskDetailPriority" onchange="updateTaskPriority()">
                <option value="low" ${task.priority === 'low' ? 'selected' : ''}>🟢 Low</option>
                <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>🟡 Medium</option>
                <option value="high" ${task.priority === 'high' ? 'selected' : ''}>🔴 High</option>
            </select>
        </div>
        <div class="form-group">
            <label>Description</label>
            <p style="color: #666; font-size: 14px;">${escapeHtml(task.description) || 'No description'}</p>
        </div>
        <div class="form-group">
            <label>Due Date</label>
            <p style="color: #666; font-size: 14px;">${task.due ? formatDate(task.due) : 'No due date'}</p>
        </div>
        <div class="form-group">
            <label>Tags</label>
            <div class="task-tags" style="margin-top: 4px;">
                ${(task.tags || []).map(tag => `<span class="task-tag">${escapeHtml(tag)}</span>`).join('') || '<span style="color: #999; font-size: 14px;">No tags</span>'}
            </div>
        </div>
        <div class="form-group">
            <label>Created</label>
            <p style="color: #666; font-size: 14px;">${formatDateTime(task.createdAt)}</p>
        </div>
        ${task.completedAt ? `
        <div class="form-group">
            <label>Completed</label>
            <p style="color: #666; font-size: 14px;">${formatDateTime(task.completedAt)}</p>
        </div>
        ` : ''}
    `;
    
    openModal('taskDetailModal');
}

function updateTaskStatus() {
    if (!state.selectedTask) return;
    const newStatus = document.getElementById('taskDetailStatus').value;
    state.selectedTask.status = newStatus;
    if (newStatus === 'done' && !state.selectedTask.completedAt) {
        state.selectedTask.completedAt = new Date().toISOString();
    }
    saveTasks();
    renderKanban();
}

function updateTaskPriority() {
    if (!state.selectedTask) return;
    state.selectedTask.priority = document.getElementById('taskDetailPriority').value;
    saveTasks();
    renderKanban();
}

function deleteTask() {
    if (!state.selectedTask) return;
    if (!confirm('Delete this task?')) return;
    
    state.tasks = state.tasks.filter(t => t.id !== state.selectedTask.id);
    saveTasks();
    renderKanban();
    closeModal();
    state.selectedTask = null;
}

// ===========================================
// DRAG AND DROP
// ===========================================

function initDragAndDrop() {
    const columns = document.querySelectorAll('.column-tasks');
    
    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('task-card')) {
            e.target.classList.add('dragging');
            e.dataTransfer.setData('text/plain', e.target.dataset.id);
        }
    });
    
    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('task-card')) {
            e.target.classList.remove('dragging');
        }
        columns.forEach(col => col.classList.remove('drag-over'));
    });
    
    columns.forEach(column => {
        column.addEventListener('dragover', (e) => {
            e.preventDefault();
            column.classList.add('drag-over');
        });
        
        column.addEventListener('dragleave', () => {
            column.classList.remove('drag-over');
        });
        
        column.addEventListener('drop', (e) => {
            e.preventDefault();
            column.classList.remove('drag-over');
            
            const taskId = e.dataTransfer.getData('text/plain');
            const newStatus = column.dataset.status;
            
            const task = state.tasks.find(t => t.id === taskId);
            if (task) {
                task.status = newStatus;
                if (newStatus === 'done' && !task.completedAt) {
                    task.completedAt = new Date().toISOString();
                }
                saveTasks();
                renderKanban();
            }
        });
    });
}

// ===========================================
// ACTIVITY LOG
// ===========================================

async function loadActivities() {
    const data = await loadJSON('activity-log');
    if (data && data.entries) {
        state.activities = data.entries;
        renderActivity();
    }
}

function renderActivity() {
    const container = document.getElementById('activityList');
    const searchTerm = document.getElementById('activitySearch').value.toLowerCase();
    const filterType = document.getElementById('activityFilter').value;
    
    let filtered = state.activities;
    
    if (searchTerm) {
        filtered = filtered.filter(a => 
            a.action.toLowerCase().includes(searchTerm) ||
            (a.details && a.details.toLowerCase().includes(searchTerm))
        );
    }
    
    if (filterType !== 'all') {
        filtered = filtered.filter(a => a.type === filterType);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No activities found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(activity => `
        <div class="activity-item">
            <div class="activity-icon ${activity.type}">
                ${getActivityIcon(activity.type)}
            </div>
            <div class="activity-content">
                <div class="activity-action">${escapeHtml(activity.action)}</div>
                ${activity.details ? `<div class="activity-details">${escapeHtml(activity.details)}</div>` : ''}
            </div>
            <div class="activity-time">${formatRelativeTime(activity.timestamp)}</div>
        </div>
    `).join('');
}

function getActivityIcon(type) {
    const icons = {
        task: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
        research: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
        communication: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
        scheduled: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        system: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
    };
    return icons[type] || icons.system;
}

function filterActivity() {
    renderActivity();
}

function addActivity(type, action, details) {
    const activity = {
        id: 'act-' + Date.now(),
        timestamp: new Date().toISOString(),
        type: type,
        action: action,
        details: details,
        session: 'dashboard'
    };
    
    state.activities.unshift(activity);
    saveJSON('activity-log', {
        lastUpdated: new Date().toISOString(),
        entries: state.activities
    });
    renderActivity();
}

// ===========================================
// REPORTS TAB — sub-tab switching + doc lists
// ===========================================

function switchReportsSubtab(subtab) {
    document.querySelectorAll('.reports-subtab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subtab === subtab);
    });
    document.querySelectorAll('.reports-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === 'reportPanel-' + subtab);
    });
    // Render doc lists on first open
    if (subtab === 'memory') renderReportsDocs('memory', 'memoryDocList');
    if (subtab === 'report-docs') renderReportsDocs('reports', 'reportDocList');
}

function renderReportsDocs(category, containerId) {
    const container = document.getElementById(containerId);
    const docs = state.docs.filter(d => d.category === category);

    if (docs.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No documents found</p></div>';
        return;
    }

    docs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    container.innerHTML = docs.map(doc => `
        <div class="reports-doc-item" onclick="openReportDoc('${doc.path}')">
            <div class="reports-doc-title">${escapeHtml(doc.title)}</div>
            <div class="reports-doc-date">${doc.date || ''}</div>
        </div>
    `).join('');
}

function openReportDoc(path) {
    // Switch to Knowledge Hub > Docs and select the doc
    switchTab('knowledge-hub');
    switchKHSubtab('docs');
    selectDoc(path);
}

// ===========================================
// KNOWLEDGE HUB — sub-tab switching
// ===========================================

let currentKHSubtab = 'kb';

function switchKHSubtab(subtab) {
    currentKHSubtab = subtab;
    document.querySelectorAll('.kh-subtab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.khSubtab === subtab);
    });
    document.querySelectorAll('.kh-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === 'khPanel-' + subtab);
    });
    // Update header actions based on sub-tab
    const actions = document.getElementById('khActions');
    if (!actions) return;
    if (subtab === 'kb') {
        actions.innerHTML = `
            <button class="btn btn-secondary" onclick="syncFromNotion()" id="notionSyncBtn">🔄 Sync from Notion</button>
            <button class="btn btn-primary" onclick="openUploadDocModal()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Document
            </button>
        `;
    } else {
        actions.innerHTML = `
            <input type="text" class="search-input" id="docsSearch" placeholder="Search docs..." oninput="filterDocs()">
            <button class="btn btn-primary" onclick="createNewNote()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                New Note
            </button>
            <button class="btn btn-secondary btn-icon-only" onclick="toggleAllFolders()" title="Expand/Collapse All">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
            </button>
        `;
    }
}

// Create a new folder in Docs with emoji picker
function createFolder() {
    // Show a small modal for folder name + icon
    const emojis = ['📁','📂','📝','📚','🔬','💡','🎯','💰','⚙️','🎨','📊','🗂️','📋','🏷️','🔖','💼','🧠','⭐','🔥','📎','🏠','🎵','📸','🌍','🔒','❤️','🚀','🎮','📱','💻'];
    const overlay = document.createElement('div');
    overlay.className = 'folder-modal-overlay';
    overlay.innerHTML = `
        <div class="folder-modal">
            <h3>New Folder</h3>
            <input type="text" class="folder-name-input" id="newFolderName" placeholder="Folder name..." autofocus>
            <div class="folder-emoji-label">Choose an icon:</div>
            <div class="folder-emoji-grid">
                ${emojis.map((e, i) => `<button class="folder-emoji-btn ${i === 0 ? 'selected' : ''}" data-emoji="${e}" onclick="pickFolderEmoji(this)">${e}</button>`).join('')}
            </div>
            <div class="folder-modal-actions">
                <button class="btn btn-secondary btn-sm" onclick="closeFolderModal()">Cancel</button>
                <button class="btn btn-primary btn-sm" onclick="saveFolderFromModal()">Create</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#newFolderName').focus();
    // Allow Enter to submit
    overlay.querySelector('#newFolderName').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveFolderFromModal();
        if (e.key === 'Escape') closeFolderModal();
    });
}

function pickFolderEmoji(btn) {
    document.querySelectorAll('.folder-emoji-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
}

function closeFolderModal() {
    const overlay = document.querySelector('.folder-modal-overlay');
    if (overlay) overlay.remove();
}

function saveFolderFromModal() {
    const nameInput = document.getElementById('newFolderName');
    const selectedEmoji = document.querySelector('.folder-emoji-btn.selected');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) { nameInput && nameInput.focus(); return; }

    const key = name.toLowerCase().replace(/\s+/g, '-');
    const emoji = selectedEmoji ? selectedEmoji.dataset.emoji : '📁';

    // Persist folder
    let customFolders = UserSettings.get('customFolders', []);
    if (!customFolders.includes(key)) {
        customFolders.push(key);
        UserSettings.set('customFolders', customFolders);
    }
    // Persist icon
    let customIcons = UserSettings.get('customFolderIcons', {});
    customIcons[key] = emoji;
    UserSettings.set('customFolderIcons', customIcons);

    docFolderState.expandedFolders.add(key);
    closeFolderModal();
    renderDocsTree();
    renderDocs();
}

// Change emoji on existing folder
function changeFolderEmoji(folderKey) {
    const emojis = ['📁','📂','📝','📚','🔬','💡','🎯','💰','⚙️','🎨','📊','🗂️','📋','🏷️','🔖','💼','🧠','⭐','🔥','📎','🏠','🎵','📸','🌍','🔒','❤️','🚀','🎮','📱','💻'];
    const currentIcons = UserSettings.get('customFolderIcons', {});
    const currentEmoji = currentIcons[folderKey] || getFolderIcon(folderKey);

    const overlay = document.createElement('div');
    overlay.className = 'folder-modal-overlay';
    overlay.innerHTML = `
        <div class="folder-modal">
            <h3>Change Icon for "${folderKey.charAt(0).toUpperCase() + folderKey.slice(1)}"</h3>
            <div class="folder-emoji-grid">
                ${emojis.map(e => `<button class="folder-emoji-btn ${e === currentEmoji ? 'selected' : ''}" data-emoji="${e}" onclick="pickFolderEmoji(this)">${e}</button>`).join('')}
            </div>
            <div class="folder-modal-actions">
                <button class="btn btn-secondary btn-sm" onclick="closeFolderModal()">Cancel</button>
                <button class="btn btn-primary btn-sm" onclick="saveChangedEmoji('${folderKey}')">Save</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFolderModal(); });
}

function saveChangedEmoji(folderKey) {
    const selectedEmoji = document.querySelector('.folder-emoji-btn.selected');
    if (!selectedEmoji) { closeFolderModal(); return; }

    let customIcons = UserSettings.get('customFolderIcons', {});
    customIcons[folderKey] = selectedEmoji.dataset.emoji;
    UserSettings.set('customFolderIcons', customIcons);

    closeFolderModal();
    renderDocsTree();
    renderDocs();
}

// Drag and drop between folders
function startDocDrag(event, docKey, isNote) {
    event.dataTransfer.setData('text/plain', JSON.stringify({ docKey, isNote }));
    event.dataTransfer.effectAllowed = 'move';
    // Highlight all folder headers as drop targets
    setTimeout(() => {
        document.querySelectorAll('.folder-header').forEach(el => el.classList.add('drop-target'));
    }, 0);
}

function dropOnFolder(event, targetFolder) {
    event.preventDefault();
    document.querySelectorAll('.folder-header').forEach(el => {
        el.classList.remove('drop-target');
        el.classList.remove('drag-over');
    });

    let data;
    try { data = JSON.parse(event.dataTransfer.getData('text/plain')); } catch { return; }
    const { docKey } = data;
    if (!docKey) return;

    let assignments = UserSettings.get('docFolderAssignments', {});

    // If moving back to the doc's original folder, remove the override
    if (data.isNote && targetFolder === 'notes') {
        delete assignments[docKey];
    } else if (!data.isNote) {
        // Check if moving back to original folder
        const doc = state.docs.find(d => d.path === docKey);
        if (doc) {
            const pathParts = doc.path.split('/').filter(Boolean);
            const originalFolder = pathParts.length > 1 ? pathParts[0] : 'root';
            if (targetFolder === originalFolder) {
                delete assignments[docKey];
            } else {
                assignments[docKey] = targetFolder;
            }
        } else {
            assignments[docKey] = targetFolder;
        }
    } else {
        assignments[docKey] = targetFolder;
    }

    UserSettings.set('docFolderAssignments', assignments);

    // Expand target folder
    docFolderState.expandedFolders.add(targetFolder);
    docFolderState.selectedFolder = targetFolder;

    renderDocsTree();
    renderDocs();
}

// Clean up drag highlights when drag ends
document.addEventListener('dragend', () => {
    document.querySelectorAll('.folder-header').forEach(el => {
        el.classList.remove('drop-target');
        el.classList.remove('drag-over');
    });
});

// ===========================================
// DOCS HUB
// ===========================================

let docFolderState = {
    selectedFolder: null,
    expandedFolders: new Set(['notes', 'research'])
};

async function loadDocs() {
    // Load docs index
    const data = await loadJSON('docs-index');
    if (data && data.docs) {
        state.docs = data.docs;
    }
    
    // Load local notes
    await loadLocalNotes();
    
    renderDocsTree();
    renderDocs();
}

function buildFolderTree(docs) {
    const tree = {};
    const assignments = UserSettings.get('docFolderAssignments', {});

    // Add local notes — each goes to its assigned folder (default: 'notes')
    const localNotes = getNotesForTree();
    localNotes.forEach(note => {
        const folder = note.category; // already respects assignments
        if (!tree[folder]) {
            tree[folder] = { name: folder, docs: [], icon: getFolderIcon(folder) };
        }
        tree[folder].docs.push(note);
    });

    docs.forEach(doc => {
        // Check for manual folder override
        const overrideFolder = assignments[doc.path];
        let folder;
        if (overrideFolder) {
            folder = overrideFolder;
        } else {
            const pathParts = doc.path.split('/').filter(Boolean);
            folder = pathParts.length > 1 ? pathParts[0] : 'root';
        }

        // Memory and Reports live in the Reports tab, skip them here
        if (folder === 'memory' || folder === 'reports') return;

        if (!tree[folder]) {
            tree[folder] = {
                name: folder,
                docs: [],
                icon: getFolderIcon(folder)
            };
        }
        tree[folder].docs.push(doc);
    });

    // Ensure 'notes' folder always exists
    if (!tree['notes']) {
        tree['notes'] = { name: 'notes', docs: [], icon: getFolderIcon('notes') };
    }

    // Add custom (empty) folders so they always appear
    const customFolders = UserSettings.get('customFolders', []);
    customFolders.forEach(key => {
        if (!tree[key]) {
            tree[key] = { name: key, docs: [], icon: getFolderIcon(key) };
        }
    });

    // Sort docs within each folder by date (newest first)
    Object.values(tree).forEach(folder => {
        folder.docs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    });

    return tree;
}

function getFolderIcon(folder) {
    const icons = {
        notes: '📝',
        research: '🔬',
        root: '📄'
    };
    if (icons[folder]) return icons[folder];
    // Check custom folder icons
    const customIcons = UserSettings.get('customFolderIcons', {});
    return customIcons[folder] || '📁';
}

function renderDocsTree() {
    const container = document.getElementById('docsTree');
    const searchEl = document.getElementById('docsSearch');
    const searchTerm = searchEl ? searchEl.value.toLowerCase() : '';
    
    let filteredDocs = state.docs;
    if (searchTerm) {
        filteredDocs = filteredDocs.filter(d => 
            d.title.toLowerCase().includes(searchTerm) ||
            d.path.toLowerCase().includes(searchTerm)
        );
    }
    
    const tree = buildFolderTree(filteredDocs);
    
    // Define folder order (notes first, custom folders in middle, root last)
    const customFolders = UserSettings.get('customFolders', []);
    const folderOrder = ['notes', 'research', ...customFolders, 'root'];
    const sortedFolders = Object.keys(tree).sort((a, b) => {
        const aIdx = folderOrder.indexOf(a);
        const bIdx = folderOrder.indexOf(b);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });
    
    if (sortedFolders.length === 0) {
        container.innerHTML = `
            <div class="empty-state small">
                <p>No folders found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = sortedFolders.map(folderKey => {
        const folder = tree[folderKey];
        const isExpanded = docFolderState.expandedFolders.has(folderKey);
        const isSelected = docFolderState.selectedFolder === folderKey;
        const displayName = folderKey === 'root' ? 'Other' : folderKey.charAt(0).toUpperCase() + folderKey.slice(1);

        return `
            <div class="folder-item ${isExpanded ? '' : 'collapsed'}">
                <div class="folder-header ${isSelected ? 'active' : ''}"
                     onclick="selectFolder('${folderKey}')"
                     ondragover="event.preventDefault(); this.classList.add('drag-over')"
                     ondragleave="this.classList.remove('drag-over')"
                     ondrop="dropOnFolder(event, '${folderKey}'); this.classList.remove('drag-over')">
                    <svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                    <span class="folder-name">${folder.icon} ${displayName}</span>
                    <span class="folder-count">${folder.docs.length}</span>
                    <button class="folder-emoji-change" onclick="changeFolderEmoji('${folderKey}'); event.stopPropagation();" title="Change icon">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
                        </svg>
                    </button>
                </div>
                <div class="folder-children">
                    ${folder.docs.map(doc => {
                        const docKey = doc.isNote ? doc.id : doc.path;
                        const isActive = state.selectedDoc && (state.selectedDoc.path === docKey || state.selectedDoc.id === docKey);
                        return `
                        <div class="folder-doc ${isActive ? 'active' : ''}"
                             draggable="true"
                             ondragstart="startDocDrag(event, '${docKey}', ${doc.isNote || false})"
                             onclick="selectDoc('${docKey}'); event.stopPropagation();">
                            <svg class="folder-doc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                            </svg>
                            <span>${escapeHtml(doc.title.replace(/^Daily Memory - /, '').replace(/^Content Intelligence Report - /, 'CI: '))}</span>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function selectFolder(folderKey) {
    // Toggle expanded state
    if (docFolderState.expandedFolders.has(folderKey)) {
        docFolderState.expandedFolders.delete(folderKey);
    } else {
        docFolderState.expandedFolders.add(folderKey);
    }
    
    // Set selected folder
    docFolderState.selectedFolder = folderKey;
    
    renderDocsTree();
    renderDocs();
}

function toggleAllFolders() {
    const tree = buildFolderTree(state.docs);
    const allFolders = Object.keys(tree);
    
    // If most are expanded, collapse all; otherwise expand all
    const expandedCount = allFolders.filter(f => docFolderState.expandedFolders.has(f)).length;
    
    if (expandedCount > allFolders.length / 2) {
        docFolderState.expandedFolders.clear();
    } else {
        allFolders.forEach(f => docFolderState.expandedFolders.add(f));
    }
    
    renderDocsTree();
}

function renderDocs() {
    const container = document.getElementById('docsList');
    const searchEl = document.getElementById('docsSearch');
    const searchTerm = searchEl ? searchEl.value.toLowerCase() : '';

    // Merge regular docs (excluding memory/reports) with notes
    const noteDocs = getNotesForTree();
    const regularDocs = state.docs.filter(d => {
        const pathParts = d.path.split('/').filter(Boolean);
        const folder = pathParts.length > 1 ? pathParts[0] : 'root';
        return folder !== 'memory' && folder !== 'reports';
    });
    let allDocs = [...noteDocs, ...regularDocs];

    // Filter by search
    if (searchTerm) {
        allDocs = allDocs.filter(d =>
            d.title.toLowerCase().includes(searchTerm) ||
            d.path.toLowerCase().includes(searchTerm)
        );
    }

    // Filter by selected folder
    if (docFolderState.selectedFolder) {
        const assignments = UserSettings.get('docFolderAssignments', {});
        allDocs = allDocs.filter(d => {
            if (d.isNote) return d.category === docFolderState.selectedFolder;
            const override = assignments[d.path];
            if (override) return override === docFolderState.selectedFolder;
            const pathParts = d.path.split('/').filter(Boolean);
            const folder = pathParts.length > 1 ? pathParts[0] : 'root';
            return folder === docFolderState.selectedFolder;
        });
    }

    // Sort by date
    allDocs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Get folder display name
    let headerText = 'All Documents';
    if (docFolderState.selectedFolder) {
        const name = docFolderState.selectedFolder === 'root' ? 'Other' :
            docFolderState.selectedFolder.charAt(0).toUpperCase() + docFolderState.selectedFolder.slice(1);
        headerText = `${getFolderIcon(docFolderState.selectedFolder)} ${name}`;
    }

    if (allDocs.length === 0) {
        container.innerHTML = `
            <div class="docs-list-header">${headerText}</div>
            <div class="empty-state small">
                <p>No documents found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="docs-list-header">${headerText} <span style="font-weight: normal; color: #999;">(${allDocs.length})</span></div>
        ${allDocs.map(doc => {
            const docPath = doc.isNote ? doc.id : doc.path;
            const isActive = state.selectedDoc && (state.selectedDoc.path === docPath || state.selectedDoc.id === docPath);
            return `
            <div class="doc-item ${isActive ? 'active' : ''}"
                 draggable="true"
                 ondragstart="startDocDrag(event, '${docPath}', ${doc.isNote || false})"
                 onclick="selectDoc('${docPath}')">
                <div class="doc-title">${escapeHtml(doc.title)}</div>
                <div class="doc-meta">
                    <span class="doc-category">${doc.category}</span>
                    <span>${doc.date}</span>
                </div>
            </div>
            `;
        }).join('')}
    `;
}

function filterDocs() {
    renderDocsTree();
    renderDocs();
}

// ===========================================
// LOCAL NOTES
// ===========================================

let notesState = {
    notes: [],
    editingNote: null,
    isNew: false
};

async function loadLocalNotes() {
    // Try Notion first, fall back to localStorage
    try {
        const notes = await NotionNotes.list();
        if (notes.length > 0) {
            const hidden = UserSettings.get('hiddenNotionNotes', []);
            notesState.notes = notes
                .filter(n => !hidden.includes(n.id))
                .map(n => ({
                    id: n.id,
                    title: n.title,
                    content: '', // loaded on demand when editing
                    createdAt: n.createdAt,
                    updatedAt: n.updatedAt,
                    source: 'notion',
                    notionUrl: n.url,
                }));
            notesState.notionReady = true;
            return;
        }
    } catch (e) {
        console.warn('[Notes] Notion unavailable, using localStorage', e.message);
    }
    // Fallback to localStorage
    const data = await loadJSON('local-notes');
    if (data && data.notes) {
        notesState.notes = data.notes;
    }
}

function saveLocalNotes() {
    // Only save to localStorage as fallback for non-Notion notes
    const localNotes = notesState.notes.filter(n => n.source !== 'notion');
    if (localNotes.length > 0) {
        saveJSON('local-notes', {
            lastUpdated: new Date().toISOString(),
            notes: localNotes,
        });
    }
}

function createNewNote() {
    notesState.editingNote = {
        id: 'note-' + Date.now(),
        title: '',
        content: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'notion',
    };
    notesState.isNew = true;
    showNoteEditor();
}

async function editNote(noteId) {
    const note = notesState.notes.find(n => n.id === noteId);
    if (!note) return;

    notesState.editingNote = { ...note };
    notesState.isNew = false;

    // Fetch full content from Notion if needed
    if (note.source === 'notion' && !note._contentLoaded) {
        const full = await NotionNotes.get(noteId);
        if (full) {
            notesState.editingNote.content = NotionNotes.textToHtml(full.content);
            // Cache it on the note object
            const idx = notesState.notes.findIndex(n => n.id === noteId);
            if (idx !== -1) {
                notesState.notes[idx]._contentLoaded = true;
                notesState.notes[idx].content = notesState.editingNote.content;
            }
        }
    }

    showNoteEditor();
}

function showNoteEditor() {
    const preview = document.getElementById('docsPreview');
    const editor = document.getElementById('noteEditor');
    const titleInput = document.getElementById('noteTitleInput');
    const contentEditor = document.getElementById('noteContentEditor');
    const deleteBtn = document.getElementById('deleteNoteBtn');
    const metaEl = document.getElementById('noteEditorMeta');
    
    preview.style.display = 'none';
    editor.style.display = 'flex';
    
    titleInput.value = notesState.editingNote.title || '';
    contentEditor.innerHTML = notesState.editingNote.content || '';
    
    deleteBtn.style.display = notesState.isNew ? 'none' : 'block';
    
    if (!notesState.isNew) {
        const updated = new Date(notesState.editingNote.updatedAt);
        metaEl.textContent = `Last edited: ${updated.toLocaleDateString()} ${updated.toLocaleTimeString()}`;
    } else {
        metaEl.textContent = 'New note';
    }
    
    titleInput.focus();
}

function hideNoteEditor() {
    const preview = document.getElementById('docsPreview');
    const editor = document.getElementById('noteEditor');
    
    editor.style.display = 'none';
    preview.style.display = 'block';
    
    notesState.editingNote = null;
    notesState.isNew = false;
}

function cancelNoteEdit() {
    hideNoteEditor();
    state.selectedDoc = null;
    renderDocsTree();
    renderDocs();
}

async function saveNote() {
    const titleInput = document.getElementById('noteTitleInput');
    const contentEditor = document.getElementById('noteContentEditor');

    const title = titleInput.value.trim() || 'Untitled Note';
    const htmlContent = contentEditor.innerHTML;
    const plainContent = NotionNotes.htmlToText(htmlContent);

    notesState.editingNote.title = title;
    notesState.editingNote.content = htmlContent;
    notesState.editingNote.updatedAt = new Date().toISOString();

    // Save to Notion
    if (notesState.isNew) {
        const created = await NotionNotes.create(title, plainContent);
        if (created) {
            notesState.editingNote.id = created.id;
            notesState.editingNote.source = 'notion';
            notesState.editingNote.notionUrl = created.url;
        }
        notesState.notes.unshift(notesState.editingNote);
    } else {
        if (notesState.editingNote.source === 'notion') {
            await NotionNotes.update(notesState.editingNote.id, { title, content: plainContent });
        }
        const idx = notesState.notes.findIndex(n => n.id === notesState.editingNote.id);
        if (idx !== -1) {
            notesState.notes[idx] = notesState.editingNote;
        }
    }

    saveLocalNotes();
    hideNoteEditor();

    renderDocsTree();
    renderDocs();

    selectDoc(notesState.editingNote.id);
}

async function deleteNote() {
    if (!notesState.editingNote || notesState.isNew) return;

    const isNotion = notesState.editingNote.source === 'notion';
    const msg = isNotion
        ? 'Remove this note from the Command Center?\n\n(The original will remain safe in Notion.)'
        : 'Delete this note?';
    if (!confirm(msg)) return;

    // Only remove from local view — never archive/delete from Notion
    notesState.notes = notesState.notes.filter(n => n.id !== notesState.editingNote.id);

    // Track hidden Notion notes so they don't reappear on next load
    if (isNotion) {
        let hidden = UserSettings.get('hiddenNotionNotes', []);
        if (!hidden.includes(notesState.editingNote.id)) {
            hidden.push(notesState.editingNote.id);
            UserSettings.set('hiddenNotionNotes', hidden);
        }
    }

    saveLocalNotes();
    hideNoteEditor();
    state.selectedDoc = null;
    renderDocsTree();
    renderDocs();
}

function deleteNoteFromPreview(noteId) {
    const note = notesState.notes.find(n => n.id === noteId);
    if (!note) return;

    const isNotion = note.source === 'notion';
    const msg = isNotion
        ? 'Remove this note from the Command Center?\n\n(The original will remain safe in Notion.)'
        : 'Delete this note?';
    if (!confirm(msg)) return;

    notesState.notes = notesState.notes.filter(n => n.id !== noteId);

    if (isNotion) {
        let hidden = UserSettings.get('hiddenNotionNotes', []);
        if (!hidden.includes(noteId)) {
            hidden.push(noteId);
            UserSettings.set('hiddenNotionNotes', hidden);
        }
    }

    saveLocalNotes();
    state.selectedDoc = null;
    document.getElementById('docsPreview').innerHTML = `<div class="empty-state"><p>Select a document to preview</p></div>`;
    renderDocsTree();
    renderDocs();
}

function formatText(command, value = null) {
    document.execCommand(command, false, value);
    document.getElementById('noteContentEditor').focus();
}

// Add notes to the folder tree
function getNotesForTree() {
    const assignments = UserSettings.get('docFolderAssignments', {});
    return notesState.notes.map(note => ({
        id: note.id,
        path: note.id,
        title: note.title,
        category: assignments[note.id] || 'notes',
        date: note.updatedAt.split('T')[0],
        isNote: true
    }));
}

async function selectDoc(path) {
    // Check if it's a local note
    const note = notesState.notes.find(n => n.id === path);
    if (note) {
        state.selectedDoc = { id: note.id, title: note.title, category: 'notes', date: note.updatedAt.split('T')[0], isNote: true };
        renderDocsTree();
        renderDocs();

        // Show note in preview (read-only view with edit button)
        const preview = document.getElementById('docsPreview');
        const editor = document.getElementById('noteEditor');

        editor.style.display = 'none';
        preview.style.display = 'block';

        // Fetch content from Notion if not yet loaded
        if (note.source === 'notion' && !note._contentLoaded) {
            preview.innerHTML = `<div class="markdown-content"><p><em>Loading note from Notion...</em></p></div>`;
            const full = await NotionNotes.get(note.id);
            if (full) {
                note.content = NotionNotes.textToHtml(full.content);
                note._contentLoaded = true;
            }
        }

        const notionBtn = note.source === 'notion' && note.notionUrl
            ? `<a href="${escapeHtml(note.notionUrl)}" target="_blank" class="btn btn-primary btn-sm">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    Edit in Notion
               </a>`
            : `<button class="btn btn-secondary btn-sm" onclick="editNote('${note.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit
               </button>`;

        preview.innerHTML = `
            <div class="markdown-content">
                <div class="note-preview-header">
                    <h1>${escapeHtml(note.title)}</h1>
                    <div class="note-preview-actions">
                        ${notionBtn}
                        <button class="btn btn-danger btn-sm" onclick="deleteNoteFromPreview('${note.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                            Remove
                        </button>
                    </div>
                </div>
                <p class="doc-meta-info">
                    <span class="doc-category">Note</span>
                    <span>Updated: ${new Date(note.updatedAt).toLocaleDateString()}</span>
                </p>
                <hr>
                <div class="note-preview-content">${note.content || '<em>Empty note</em>'}</div>
            </div>
        `;
        return;
    }
    
    // Regular doc
    const doc = state.docs.find(d => d.path === path);
    if (!doc) return;
    
    state.selectedDoc = doc;
    renderDocsTree();
    renderDocs();
    
    const preview = document.getElementById('docsPreview');
    const editor = document.getElementById('noteEditor');
    
    editor.style.display = 'none';
    preview.style.display = 'block';
    
    // If doc has a Notion URL, show link to open in Notion
    if (doc.notionUrl) {
        preview.innerHTML = `
            <div class="markdown-content">
                <h1>${escapeHtml(doc.title)}</h1>
                <p class="doc-meta-info">
                    <span class="doc-category">${escapeHtml(doc.category)}</span>
                    <span>${escapeHtml(doc.date)}</span>
                </p>
                <hr>
                <div class="notion-preview">
                    <div class="notion-icon">📝</div>
                    <p>This document is stored in Notion</p>
                    <a href="${escapeHtml(doc.notionUrl)}" target="_blank" class="btn btn-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                        Open in Notion
                    </a>
                </div>
            </div>
        `;
        return;
    }
    
    // Local file - show placeholder
    preview.innerHTML = `
        <div class="markdown-content">
            <h1>${escapeHtml(doc.title)}</h1>
            <p class="doc-meta-info">
                <span class="doc-category">${escapeHtml(doc.category)}</span>
                <span>${escapeHtml(doc.date)}</span>
            </p>
            <hr>
            <p>Local document preview coming soon.</p>
            <p>Path: <code>${escapeHtml(doc.path)}</code></p>
        </div>
    `;
}

// ===========================================
// QUICK NOTES
// ===========================================

async function loadNotes() {
    const data = await loadJSON('notes');
    if (data && data.notes) {
        state.notes = data.notes;
        renderNotes();
    }
}

function renderNotes() {
    const container = document.getElementById('notesList');
    const badge = document.getElementById('noteBadge');
    
    const pendingCount = state.notes.filter(n => !n.processed).length;
    badge.textContent = pendingCount;
    badge.classList.toggle('visible', pendingCount > 0);
    
    if (state.notes.length === 0) {
        container.innerHTML = `
            <div class="empty-state small">
                <p>No pending notes</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = state.notes.map(note => `
        <div class="note-item ${note.processed ? 'processed' : ''}">
            <div class="note-text">${escapeHtml(note.text)}</div>
            <div class="note-meta">
                <span class="note-status ${note.processed ? 'processed' : 'pending'}">
                    ${note.processed ? '✓ Processed' : '⏳ Pending'}
                </span>
                <span>${formatRelativeTime(note.createdAt)}</span>
            </div>
        </div>
    `).join('');
}

function addNote() {
    const input = document.getElementById('noteInput');
    const text = input.value.trim();
    
    if (!text) return;
    
    const note = {
        id: 'note-' + Date.now(),
        text: text,
        createdAt: new Date().toISOString(),
        processed: false
    };
    
    state.notes.unshift(note);
    saveJSON('notes', {
        lastUpdated: new Date().toISOString(),
        notes: state.notes
    });
    
    input.value = '';
    renderNotes();
    
    // Add to activity log
    addActivity('task', 'Added quick note', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
}

function toggleNotes() {
    document.getElementById('notesSidebar').classList.toggle('open');
}

// ===========================================
// CONTENT INTELLIGENCE
// ===========================================

async function loadContent() {
    const data = await loadJSON('content');
    if (data) {
        state.content = data;
        renderContent();
    }
}

function renderContent() {
    if (!state.content) return;
    
    // Update timestamp
    document.getElementById('contentLastUpdated').textContent = 
        `Last updated: ${formatDateTime(state.content.lastUpdated)}`;
    
    // Trends
    const hotTrends = document.getElementById('hotTrends');
    hotTrends.innerHTML = (state.content.trends?.hot || [])
        .map(t => `<span class="trend-tag">${escapeHtml(t)}</span>`).join('');
    
    const risingTrends = document.getElementById('risingTrends');
    risingTrends.innerHTML = (state.content.trends?.rising || [])
        .map(t => `<span class="trend-tag">${escapeHtml(t)}</span>`).join('');
    
    // Outliers
    const outlierList = document.getElementById('outlierList');
    outlierList.innerHTML = (state.content.outliers || []).map(o => `
        <div class="outlier-item">
            <div class="outlier-name">${escapeHtml(o.name)}</div>
            <div class="outlier-members">${escapeHtml(o.members)}</div>
            <div class="outlier-insight">${escapeHtml(o.insight)}</div>
        </div>
    `).join('');
    
    // YouTube Ideas
    const ytIdeas = document.getElementById('youtubeIdeas');
    ytIdeas.innerHTML = (state.content.youtubeIdeas || []).map(idea => `
        <div class="idea-card">
            <span class="idea-type">${escapeHtml(idea.type)}</span>
            <div class="idea-title">${escapeHtml(idea.title)}</div>
            <div class="idea-hook">"${escapeHtml(idea.hook)}"</div>
            <div class="idea-actions">
                <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${escapeHtml(idea.hook).replace(/'/g, "\\'")}')">
                    Copy Hook
                </button>
            </div>
        </div>
    `).join('');
    
    // Instagram Ideas
    const igIdeas = document.getElementById('instagramIdeas');
    igIdeas.innerHTML = (state.content.instagramIdeas || []).map(idea => `
        <div class="idea-card format-${idea.format.toLowerCase()}">
            <span class="idea-type">${escapeHtml(idea.format)}</span>
            <div class="idea-title">${escapeHtml(idea.concept)}</div>
            <div class="idea-hook">${escapeHtml(idea.hook)}</div>
            <div class="idea-actions">
                <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${escapeHtml(idea.concept).replace(/'/g, "\\'")}')">
                    Copy Idea
                </button>
            </div>
        </div>
    `).join('');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Show brief feedback
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = originalText, 1500);
    });
}

// ===========================================
// YOUTUBE
// ===========================================

async function loadYouTube() {
    const data = await loadJSON('youtube');
    if (data) {
        state.youtube = data;
    }
    
    // Restore API key from separate storage (survives file overwrites)
    const savedApiKey = localStorage.getItem('geeves-youtube-apikey');
    if (savedApiKey) {
        if (!state.youtube) state.youtube = {};
        if (!state.youtube.config) state.youtube.config = {};
        state.youtube.config.apiKey = savedApiKey;
    }
    
    renderYouTube();
}

function renderYouTube() {
    if (!state.youtube) return;
    
    const stats = state.youtube.manualStats || {};
    
    document.getElementById('ytSubs').textContent = formatNumber(stats.subscribers);
    document.getElementById('ytViews').textContent = formatNumber(stats.totalViews);
    document.getElementById('ytVideos').textContent = formatNumber(stats.totalVideos);
    document.getElementById('ytAvgViews').textContent = formatNumber(stats.avgViewsPerVideo);
    
    // Populate config if exists
    if (state.youtube.config) {
        document.getElementById('ytChannelId').value = state.youtube.config.channelId || '';
        document.getElementById('ytApiKey').value = state.youtube.config.apiKey || '';
    }
    
    // Render recent videos
    const videoList = document.getElementById('ytVideoList');
    const videos = state.youtube.recentVideos || [];
    
    if (videos.length > 0) {
        videoList.innerHTML = videos.map(video => {
            const stats = video.stats || {};
            return `
            <div class="yt-video-item" onclick="window.open('https://youtube.com/watch?v=${video.id}', '_blank')">
                <img class="yt-video-thumb" src="${video.thumbnail}" alt="${escapeHtml(video.title)}">
                <div class="yt-video-info">
                    <div class="yt-video-title">${escapeHtml(video.title)}</div>
                    <div class="yt-video-meta">
                        <span class="yt-video-date">${formatRelativeTime(video.publishedAt)}</span>
                    </div>
                    <div class="yt-video-stats">
                        <span class="yt-stat" title="Views">👁 ${formatCompactNumber(stats.views)}</span>
                        <span class="yt-stat" title="Likes">👍 ${formatCompactNumber(stats.likes)}</span>
                        <span class="yt-stat" title="Comments">💬 ${formatCompactNumber(stats.comments)}</span>
                    </div>
                </div>
            </div>
        `}).join('');
    } else if (state.youtube.config?.apiKey) {
        videoList.innerHTML = `
            <div class="empty-state">
                <p>No videos loaded yet</p>
                <button class="btn btn-primary btn-sm" onclick="fetchYouTubeData()">Fetch Videos</button>
            </div>
        `;
    }
}

// Format large numbers compactly (1.2K, 3.4M, etc)
function formatCompactNumber(num) {
    if (num === undefined || num === null) return '—';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function openYouTubeConfig() {
    openModal('ytConfigModal');
}

function saveYouTubeConfig() {
    const apiKey = document.getElementById('ytApiKey').value.trim();
    const channelId = document.getElementById('ytChannelId').value.trim();
    
    if (!apiKey || !channelId) {
        alert('Please enter both API Key and Channel ID');
        return;
    }
    
    if (!state.youtube) state.youtube = {};
    state.youtube.config = {
        apiKey: apiKey,
        channelId: channelId
    };
    
    // Store API key separately so it survives file overwrites
    localStorage.setItem('geeves-youtube-apikey', apiKey);
    
    saveJSON('youtube', state.youtube);
    closeModal();
    
    // Add activity
    addActivity('system', 'Updated YouTube configuration', 'API key and channel ID saved');
    
    // Fetch data immediately
    fetchYouTubeData();
}

async function fetchYouTubeData() {
    const config = state.youtube?.config;
    if (!config?.apiKey || !config?.channelId) {
        console.log('YouTube not configured');
        return;
    }
    
    const { apiKey, channelId } = config;
    
    try {
        // Fetch channel statistics
        const channelRes = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?` +
            `part=statistics,snippet&id=${channelId}&key=${apiKey}`
        );
        
        if (!channelRes.ok) {
            const err = await channelRes.json();
            throw new Error(err.error?.message || 'YouTube API error');
        }
        
        const channelData = await channelRes.json();
        
        if (!channelData.items || channelData.items.length === 0) {
            throw new Error('Channel not found. Check your Channel ID.');
        }
        
        const channel = channelData.items[0];
        const stats = channel.statistics;
        
        // Update state with channel stats
        state.youtube.manualStats = {
            subscribers: parseInt(stats.subscriberCount) || 0,
            totalViews: parseInt(stats.viewCount) || 0,
            totalVideos: parseInt(stats.videoCount) || 0,
            avgViewsPerVideo: stats.videoCount > 0 
                ? Math.round(parseInt(stats.viewCount) / parseInt(stats.videoCount)) 
                : 0
        };
        
        state.youtube.channelInfo = {
            title: channel.snippet.title,
            description: channel.snippet.description,
            thumbnail: channel.snippet.thumbnails?.default?.url
        };
        
        // Fetch recent videos (last 8)
        const videosRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&channelId=${channelId}&maxResults=8&order=date&type=video&key=${apiKey}`
        );
        
        if (videosRes.ok) {
            const videosData = await videosRes.json();
            const videoIds = videosData.items.map(v => v.id.videoId).join(',');
            
            // Fetch detailed stats for each video
            const statsRes = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?` +
                `part=statistics,contentDetails&id=${videoIds}&key=${apiKey}`
            );
            
            let videoStats = {};
            if (statsRes.ok) {
                const statsData = await statsRes.json();
                statsData.items.forEach(item => {
                    videoStats[item.id] = {
                        views: parseInt(item.statistics.viewCount) || 0,
                        likes: parseInt(item.statistics.likeCount) || 0,
                        comments: parseInt(item.statistics.commentCount) || 0,
                        duration: item.contentDetails.duration
                    };
                });
            }
            
            state.youtube.recentVideos = (videosData.items || []).map(v => ({
                id: v.id.videoId,
                title: v.snippet.title,
                description: v.snippet.description,
                thumbnail: v.snippet.thumbnails?.medium?.url,
                publishedAt: v.snippet.publishedAt,
                stats: videoStats[v.id.videoId] || {}
            }));
        }
        
        state.youtube.lastUpdated = new Date().toISOString();
        saveJSON('youtube', state.youtube);
        renderYouTube();
        
        addActivity('system', 'YouTube data refreshed', `${state.youtube.manualStats.subscribers.toLocaleString()} subscribers`);
        
    } catch (error) {
        console.error('YouTube fetch error:', error);
        alert('Failed to fetch YouTube data: ' + error.message);
    }
}

function refreshYouTube() {
    fetchYouTubeData();
}

// ===========================================
// INSTAGRAM
// ===========================================

async function loadInstagram() {
    const data = await loadJSON('instagram');
    if (data) {
        state.instagram = data;
        renderInstagram();
    }
}

function renderInstagram() {
    if (!state.instagram) return;
    
    const stats = state.instagram.currentStats || {};
    
    document.getElementById('igFollowers').textContent = formatNumber(stats.followers);
    document.getElementById('igFollowing').textContent = formatNumber(stats.following);
    document.getElementById('igPosts').textContent = formatNumber(stats.posts);
    document.getElementById('igEngagement').textContent = stats.engagementRate ? `${stats.engagementRate}%` : '--';
    
    // Render history
    const tbody = document.getElementById('igHistoryBody');
    const history = state.instagram.history || [];
    
    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">No data yet — add your first snapshot</td></tr>';
        return;
    }
    
    tbody.innerHTML = history.map(row => `
        <tr>
            <td>${row.date}</td>
            <td>${formatNumber(row.followers)}</td>
            <td>${formatNumber(row.following)}</td>
            <td>${formatNumber(row.posts)}</td>
            <td>${formatNumber(row.avgLikes)}</td>
            <td>${row.engagementRate}%</td>
        </tr>
    `).join('');
}

function openIgSnapshotModal() {
    document.getElementById('igDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('igInputFollowers').value = '';
    document.getElementById('igInputFollowing').value = '';
    document.getElementById('igInputPosts').value = '';
    document.getElementById('igInputLikes').value = '';
    openModal('igSnapshotModal');
}

function saveIgSnapshot() {
    const date = document.getElementById('igDate').value;
    const followers = parseInt(document.getElementById('igInputFollowers').value) || 0;
    const following = parseInt(document.getElementById('igInputFollowing').value) || 0;
    const posts = parseInt(document.getElementById('igInputPosts').value) || 0;
    const avgLikes = parseInt(document.getElementById('igInputLikes').value) || 0;
    
    if (!date || !followers) {
        alert('Please enter at least date and followers');
        return;
    }
    
    const engagementRate = followers > 0 ? ((avgLikes / followers) * 100).toFixed(2) : 0;
    
    const snapshot = {
        date: date,
        followers: followers,
        following: following,
        posts: posts,
        avgLikes: avgLikes,
        engagementRate: parseFloat(engagementRate)
    };
    
    if (!state.instagram) state.instagram = { history: [] };
    if (!state.instagram.history) state.instagram.history = [];
    
    // Add to history (avoid duplicates by date)
    state.instagram.history = state.instagram.history.filter(h => h.date !== date);
    state.instagram.history.unshift(snapshot);
    state.instagram.history.sort((a, b) => b.date.localeCompare(a.date));
    
    // Update current stats
    state.instagram.currentStats = {
        ...snapshot,
        snapshotDate: date
    };
    
    state.instagram.lastUpdated = new Date().toISOString();
    
    saveJSON('instagram', state.instagram);
    renderInstagram();
    closeModal();
    
    addActivity('task', 'Added Instagram snapshot', `${followers} followers, ${engagementRate}% engagement`);
}

// ===========================================
// SCHEDULES
// ===========================================

async function loadSchedules() {
    const data = await loadJSON('schedules');
    if (data && data.schedules) {
        state.schedules = data.schedules;
        renderSchedules();
    }
}

function renderSchedules() {
    const container = document.getElementById('schedulesList');
    
    document.getElementById('schedulesLastUpdated').textContent = 
        `Last updated: ${formatDateTime(state.schedules[0]?.lastRun || new Date().toISOString())}`;
    
    if (state.schedules.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No scheduled tasks configured</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = state.schedules.map(schedule => `
        <div class="schedule-card">
            <div class="schedule-header">
                <span class="schedule-name">${escapeHtml(schedule.name)}</span>
                <span class="schedule-status ${schedule.lastStatus || 'success'}">
                    ${getStatusIcon(schedule.lastStatus)}
                    ${schedule.enabled ? 'Active' : 'Disabled'}
                </span>
            </div>
            <div class="schedule-description">${escapeHtml(schedule.description)}</div>
            <div class="schedule-meta">
                <div class="schedule-meta-item">
                    <strong>Schedule:</strong> ${escapeHtml(schedule.humanSchedule)}
                </div>
                <div class="schedule-meta-item">
                    <strong>Last run:</strong> ${schedule.lastRun ? formatRelativeTime(schedule.lastRun) : 'Never'}
                </div>
                <div class="schedule-meta-item">
                    <strong>Next run:</strong> ${schedule.nextRun ? formatDateTime(schedule.nextRun) : 'N/A'}
                </div>
                <div class="schedule-meta-item">
                    <strong>Channel:</strong> ${escapeHtml(schedule.channel)}
                </div>
            </div>
        </div>
    `).join('');
}

function getStatusIcon(status) {
    const icons = {
        success: '✅',
        warning: '⚠️',
        error: '❌'
    };
    return icons[status] || icons.success;
}

// ===========================================
// STATUS
// ===========================================

async function loadStatus() {
    const data = await loadJSON('status');
    if (data) {
        state.status = data;
        renderStatus();
    }
}

function renderStatus() {
    if (!state.status) return;
    
    const indicator = document.getElementById('statusIndicator');
    const dot = indicator.querySelector('.status-dot');
    const text = indicator.querySelector('.status-text');
    
    // Update status
    dot.className = `status-dot ${state.status.status || 'idle'}`;
    
    const statusLabels = {
        idle: 'Idle',
        thinking: 'Thinking',
        working: 'Working',
        offline: 'Offline'
    };
    text.textContent = statusLabels[state.status.status] || 'Idle';
    
    // Update current task
    document.getElementById('currentTask').innerHTML = 
        `<span>${escapeHtml(state.status.currentTask || 'Waiting for instructions')}</span>`;
    
    // Update heartbeat
    document.getElementById('lastHeartbeat').querySelector('span').textContent = 
        state.status.lastHeartbeat ? formatRelativeTime(state.status.lastHeartbeat) : '--';
    
    // Update model
    document.getElementById('modelInUse').querySelector('span').textContent = 
        state.status.model || 'claude-opus-4.5';
}

// ===========================================
// BUSINESS DASHBOARD
// ===========================================

async function loadBusiness() {
    const data = await loadJSON('business');
    if (data) {
        state.business = data;
        renderBusiness();
    }
}

function renderBusiness() {
    if (!state.business) return;
    
    const b = state.business;
    
    const setIfExists = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    
    // Free Community
    if (b.free) {
        setIfExists('freeTotal', formatNumber(b.free.total || 0));
        setIfExists('freeLast30', formatNumber(b.free.last30Days || 0));
    }
    
    // Workshop Customers
    if (b.workshop) {
        setIfExists('workshopSales', formatNumber(b.workshop.sales || 0));
        setIfExists('workshopCash', formatNumber(b.workshop.cashCollected || 0));
    }
    
    // Premium Community
    if (b.premium) {
        setIfExists('premiumTotal', formatNumber(b.premium.total || 0));
        const premiumDiff = (b.premium.total || 0) - (b.premium.lastMonth || 0);
        const premiumChangeEl = document.getElementById('premiumChange');
        if (premiumChangeEl) {
            if (premiumDiff > 0) {
                premiumChangeEl.className = 'change-up';
                premiumChangeEl.textContent = premiumDiff;
            } else if (premiumDiff < 0) {
                premiumChangeEl.className = 'change-down';
                premiumChangeEl.textContent = Math.abs(premiumDiff);
            } else {
                premiumChangeEl.className = 'change-neutral';
                premiumChangeEl.textContent = '—';
            }
        }
    }
    
    // VIP Tier
    if (b.vip) {
        setIfExists('vipTotal', formatNumber(b.vip.total || 0));
        const vipDiff = (b.vip.total || 0) - (b.vip.lastMonth || 0);
        const vipChangeEl = document.getElementById('vipChange');
        if (vipChangeEl) {
            if (vipDiff > 0) {
                vipChangeEl.className = 'change-up';
                vipChangeEl.textContent = vipDiff;
            } else if (vipDiff < 0) {
                vipChangeEl.className = 'change-down';
                vipChangeEl.textContent = Math.abs(vipDiff);
            } else {
                vipChangeEl.className = 'change-neutral';
                vipChangeEl.textContent = '—';
            }
        }
    }
    
    // 1:1 Tier
    if (b.oneone) {
        const total = b.oneone.total || 0;
        const cap = b.oneone.cap || 12;
        setIfExists('oneoneTotal', total);
        setIfExists('oneoneSpots', cap - total);
    }
    
    // Applications
    if (b.applications) {
        setIfExists('appsTotal', formatNumber(b.applications.thisWeek || 0));
    }
    
    // Client Health
    if (b.clients) {
        const healthyCount = Array.isArray(b.clients.healthy) ? b.clients.healthy.length : b.clients.healthy;
        const warningCount = Array.isArray(b.clients.warning) ? b.clients.warning.length : b.clients.warning;
        const atRiskCount = Array.isArray(b.clients.atRisk) ? b.clients.atRisk.length : b.clients.atRisk;
        
        document.getElementById('clientsHealthy').textContent = healthyCount;
        document.getElementById('clientsWarning').textContent = warningCount;
        document.getElementById('clientsAtRisk').textContent = atRiskCount;
        
        const alertsContainer = document.getElementById('clientAlerts');
        if (b.clients.alerts && b.clients.alerts.length > 0) {
            alertsContainer.innerHTML = `
                <div class="alerts-header">Recent Activity</div>
                ${b.clients.alerts.map(alert => `
                    <div class="alert-item ${alert.type}">
                        <span class="alert-icon">${alert.icon}</span>
                        <span class="alert-text">${escapeHtml(alert.text)}</span>
                    </div>
                `).join('')}
            `;
        }
    }
    
    // Pipeline
    if (b.pipeline) {
        document.getElementById('pipelineLeads').textContent = b.pipeline.leads;
        document.getElementById('pipelineApps').textContent = b.pipeline.applications;
        document.getElementById('pipelineCalls').textContent = b.pipeline.calls;
        document.getElementById('pipelineClosed').textContent = b.pipeline.closed;
        document.getElementById('pipelineCPL').textContent = b.pipeline.cpl.toFixed(2);
        document.getElementById('pipelineAppRate').textContent = b.pipeline.appRate.toFixed(1);
    }
    
    // Schedule
    if (b.schedule) {
        if (b.schedule.today) {
            const todayBanner = document.querySelector('.today-banner');
            if (todayBanner) {
                todayBanner.innerHTML = `
                    <span class="today-day">${b.schedule.today.dayName}</span>
                    <span class="today-type ${b.schedule.today.dayType}">${b.schedule.today.dayType === 'light' ? 'Light Day' : 'Work Day'}</span>
                `;
            }
            
            const scheduleList = document.getElementById('scheduleList');
            if (scheduleList && b.schedule.today.events) {
                if (b.schedule.today.events.length === 0) {
                    scheduleList.innerHTML = `
                        <div class="schedule-item empty">
                            <span class="schedule-icon">☀️</span>
                            <span class="schedule-text">No calls today — enjoy!</span>
                        </div>
                    `;
                } else {
                    scheduleList.innerHTML = b.schedule.today.events.map(event => `
                        <div class="schedule-item">
                            <span class="schedule-time">${event.time}</span>
                            <span class="schedule-text">${escapeHtml(event.text)}</span>
                        </div>
                    `).join('');
                }
            }
        }
        
        if (b.schedule.upcoming && b.schedule.upcoming.length > 0) {
            document.getElementById('upcomingEvents').innerHTML = b.schedule.upcoming.map(event => `
                <div class="upcoming-item">
                    <div class="upcoming-dot"></div>
                    <div class="upcoming-content">
                        <span class="upcoming-event">${escapeHtml(event.event)}</span>
                        <span class="upcoming-date">${escapeHtml(event.date)}</span>
                    </div>
                </div>
            `).join('');
        }
    }
}

function toggleClientList(category) {
    const container = document.getElementById('clientListExpanded');
    const titleEl = document.getElementById('clientListTitle');
    const itemsEl = document.getElementById('clientListItems');
    
    if (!category || container.style.display !== 'none' && container.dataset.category === category) {
        container.style.display = 'none';
        container.dataset.category = '';
        return;
    }
    
    const b = state.business;
    if (!b || !b.clients) return;
    
    const titles = {
        healthy: 'Healthy Clients',
        warning: 'Clients to Watch',
        atRisk: 'At Risk Clients'
    };
    
    titleEl.textContent = titles[category] || 'Clients';
    
    const clients = b.clients[category] || [];
    
    if (Array.isArray(clients) && clients.length > 0) {
        itemsEl.innerHTML = clients.map(client => `
            <div class="client-list-item">
                <span class="client-status-dot ${category === 'atRisk' ? 'at-risk' : category}"></span>
                <span class="client-name">${escapeHtml(client.name)}</span>
                <span class="client-type">(${client.type})</span>
                ${client.note ? `<span class="client-note">— ${escapeHtml(client.note)}</span>` : ''}
            </div>
        `).join('');
    } else {
        itemsEl.innerHTML = '<div class="client-list-item">No clients in this category</div>';
    }
    
    container.style.display = 'block';
    container.dataset.category = category;
}

function openBusinessSettings() {
    // For now, just show an alert with instructions
    alert('To update business metrics, edit:\n/command-center/data/business.json\n\nOr tell Geeves to update the numbers!');
}

function openClientModal() {
    alert('Client management coming soon!\n\nFor now, edit:\n/command-center/data/business.json');
}

// ===========================================
// CHAT PANEL
// ===========================================

// Agent configs loaded from agents.json

let chatOpen = false;
let currentAgent = 'geeves';
let currentModel = 'auto';
let chatMessages = [];
let agentConfigs = {};
let isGenerating = false;
let currentThreadId = null;

const models = {
    'auto': { name: 'Auto', icon: '🔮', apiModel: null },
    'claude-opus-4': { name: 'Claude Opus 4', icon: '🟠', apiModel: 'claude-opus-4-20250514', provider: 'anthropic' },
    'claude-sonnet-4': { name: 'Claude Sonnet 4', icon: '🟠', apiModel: 'claude-sonnet-4-20250514', provider: 'anthropic' },
    'gpt-4o': { name: 'GPT-4o', icon: '🟢', apiModel: 'gpt-4o', provider: 'openai' },
    'gpt-4-turbo': { name: 'GPT-4 Turbo', icon: '🟢', apiModel: 'gpt-4-turbo-preview', provider: 'openai' }
};

// Load agent configs
async function loadAgentConfigs() {
    const data = await loadJSON('agents');
    if (data && data.agents) {
        data.agents.forEach(agent => {
            agentConfigs[agent.id] = agent;
        });
    }
}

// Initialize chat on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadAgentConfigs();
    loadChatSettings();
    ChatPersistence.init();
    if (ChatPersistence.isReady()) {
        await loadActiveThread(currentAgent);
    }
});

function toggleModelDropdown() {
    const dropdown = document.getElementById('modelDropdown');
    dropdown.classList.toggle('open');
}

function selectModel(modelId) {
    currentModel = modelId;
    const model = models[modelId];
    
    // Update button display
    document.getElementById('modelIcon').textContent = model.icon;
    document.getElementById('modelName').textContent = model.name;
    
    // Update selected state in dropdown
    document.querySelectorAll('.model-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.model === modelId);
    });
    
    // Close dropdown
    document.getElementById('modelDropdown').classList.remove('open');
    
    // Update indicator
    updateModelIndicator();
}

function updateModelIndicator() {
    const indicator = document.getElementById('chatModelIndicator');
    const model = models[currentModel];
    const agent = agentConfigs[currentAgent];
    
    if (currentModel === 'auto' && agent) {
        indicator.textContent = `Using: ${agent.defaultModel || 'claude-opus-4'}`;
    } else {
        indicator.textContent = `Using: ${model.name}`;
    }
}

// Close model dropdown when clicking outside
document.addEventListener('click', (e) => {
    const modelSelector = document.querySelector('.model-selector');
    if (modelSelector && !modelSelector.contains(e.target)) {
        document.getElementById('modelDropdown')?.classList.remove('open');
    }
});

// Chat Settings
function loadChatSettings() {
    const settings = JSON.parse(localStorage.getItem('chatSettings') || '{}');
    if (document.getElementById('openaiApiKey')) {
        document.getElementById('openaiApiKey').value = settings.openaiApiKey || '';
    }
    if (document.getElementById('anthropicApiKey')) {
        document.getElementById('anthropicApiKey').value = settings.anthropicApiKey || '';
    }
    if (document.getElementById('openclawUrl')) {
        document.getElementById('openclawUrl').value = settings.openclawUrl || '';
    }
}

function openChatSettings() {
    loadChatSettings();
    openModal('chatSettingsModal');
}

function saveChatSettings() {
    const settings = {
        openaiApiKey: document.getElementById('openaiApiKey').value.trim(),
        anthropicApiKey: document.getElementById('anthropicApiKey').value.trim(),
        openclawUrl: document.getElementById('openclawUrl').value.trim()
    };
    localStorage.setItem('chatSettings', JSON.stringify(settings));
    closeModal();
}

function getChatSettings() {
    return JSON.parse(localStorage.getItem('chatSettings') || '{}');
}

// Chat UI Functions
function handleChatKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
}

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function addMessageToChat(role, content, agentIcon = null) {
    const messagesContainer = document.getElementById('chatMessages');
    const welcome = document.getElementById('chatWelcome');
    
    if (welcome) {
        welcome.style.display = 'none';
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    
    const avatar = role === 'user' ? '👤' : (agentIcon || agentConfigs[currentAgent]?.icon || '🤖');
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">${formatMessageContent(content)}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    return messageDiv;
}

function addLoadingMessage() {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message assistant';
    messageDiv.id = 'loadingMessage';
    
    const agentIcon = agentConfigs[currentAgent]?.icon || '🤖';
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${agentIcon}</div>
        <div class="message-content">
            <div class="message-loading">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeLoadingMessage() {
    const loading = document.getElementById('loadingMessage');
    if (loading) loading.remove();
}

function formatMessageContent(content) {
    // Basic markdown-like formatting
    return content
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message || isGenerating) return;

    // Auto-create thread on first message if none exists
    if (!currentThreadId && ChatPersistence.isReady()) {
        const thread = await ChatPersistence.createThread(currentAgent, ChatPersistence.generateTitle(message));
        if (thread) {
            currentThreadId = thread.id;
            updateThreadSelector();
        }
    }

    // Add user message to chat
    addMessageToChat('user', message);
    chatMessages.push({ role: 'user', content: message });

    // Persist user message (fire-and-forget)
    if (currentThreadId && ChatPersistence.isReady()) {
        ChatPersistence.saveMessage(currentThreadId, 'user', message);
    }

    // Clear input
    input.value = '';
    input.style.height = 'auto';

    // Show loading
    isGenerating = true;
    document.getElementById('chatSendBtn').disabled = true;
    addLoadingMessage();

    try {
        const response = await callLLMAPI(message);
        removeLoadingMessage();
        addMessageToChat('assistant', response);
        chatMessages.push({ role: 'assistant', content: response });

        // Persist assistant message (fire-and-forget)
        if (currentThreadId && ChatPersistence.isReady()) {
            ChatPersistence.saveMessage(currentThreadId, 'assistant', response);
        }
    } catch (error) {
        removeLoadingMessage();
        addMessageToChat('assistant', `Error: ${error.message}. Check your API settings.`);
    } finally {
        isGenerating = false;
        document.getElementById('chatSendBtn').disabled = false;
    }
}

async function callLLMAPI(userMessage) {
    const settings = getChatSettings();
    const agent = agentConfigs[currentAgent] || {};
    
    // Determine which model to use
    let modelConfig;
    if (currentModel === 'auto') {
        const defaultModel = agent.defaultModel || 'claude-opus-4';
        modelConfig = models[defaultModel] || models['gpt-4o'];
    } else {
        modelConfig = models[currentModel];
    }
    
    const systemPrompt = agent.systemPrompt || 'You are a helpful assistant.';
    
    // Build messages array
    const messages = [
        { role: 'system', content: systemPrompt },
        ...chatMessages.slice(-10), // Keep last 10 messages for context
        { role: 'user', content: userMessage }
    ];
    
    if (modelConfig.provider === 'openai') {
        return await callOpenAI(messages, modelConfig.apiModel, settings.openaiApiKey);
    } else if (modelConfig.provider === 'anthropic') {
        // Use Cloudflare Worker proxy for Anthropic
        return await callAnthropicProxy(messages, modelConfig.apiModel);
    }
    
    throw new Error('No valid model configuration');
}

async function callOpenAI(messages, model, apiKey) {
    if (!apiKey) {
        throw new Error('OpenAI API key not configured');
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: 2048
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API error');
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

async function callAnthropicProxy(messages, model) {
    // Uses Cloudflare Worker proxy to call Anthropic API
    const PROXY_URL = 'https://anthropic-proxy.dan-a14.workers.dev';
    
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');
    
    const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 4096,
            system: systemMessage?.content || '',
            messages: otherMessages.map(m => ({
                role: m.role,
                content: m.content
            }))
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Anthropic API error');
    }
    
    const data = await response.json();
    return data.content?.[0]?.text || 'No response';
}

async function callAnthropic(messages, model, apiKey) {
    if (!apiKey) {
        throw new Error('Anthropic API key not configured. Use GPT models or set up OpenClaw.');
    }
    
    // Note: Anthropic doesn't allow direct browser calls (CORS)
    // This will fail from browser - need proxy or OpenClaw
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 2048,
            system: systemMessage?.content || '',
            messages: otherMessages.map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            }))
        })
    });
    
    if (!response.ok) {
        throw new Error('Anthropic API error (CORS may block browser calls - use OpenClaw)');
    }
    
    const data = await response.json();
    return data.content[0].text;
}

async function callOpenClaw(messages, model, openclawUrl) {
    // OpenClaw OpenAI-compatible HTTP endpoint
    const baseUrl = openclawUrl || '';
    const settings = getChatSettings();
    const token = settings.openclawToken || 'geeves-local-token-2026';
    
    try {
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'x-openclaw-agent-id': 'main'
            },
            body: JSON.stringify({
                model: 'openclaw',
                messages: messages
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenClaw error:', response.status, errorText);
            throw new Error('OpenClaw not responding');
        }
        
        const data = await response.json();
        // OpenAI format: choices[0].message.content
        return data.choices?.[0]?.message?.content || data.response || 'No response';
    } catch (error) {
        console.error('OpenClaw fetch error:', error);
        throw new Error('Cannot reach OpenClaw on your Mac. Make sure OpenClaw is running (openclaw gateway start) and you\'re accessing from your local network.. Check your API settings.');
    }
}

function toggleChat() {
    const panel = document.getElementById('chatPanel');
    const overlay = document.getElementById('chatOverlay');
    
    chatOpen = !chatOpen;
    
    if (chatOpen) {
        panel.classList.add('open');
        overlay.classList.add('open');
        updateChatUI();
        document.getElementById('chatInput')?.focus();
    } else {
        panel.classList.remove('open');
        overlay.classList.remove('open');
    }
}

function updateChatUI() {
    const agent = agentConfigs[currentAgent] || {
        name: 'Assistant',
        icon: '🤖',
        description: 'AI Assistant'
    };
    
    // Update agent info (preserve thread controls)
    const agentInfoEl = document.getElementById('chatAgentInfo');
    const nameEl = agentInfoEl.querySelector('.agent-name');
    const descEl = agentInfoEl.querySelector('.agent-desc');
    if (nameEl) nameEl.textContent = agent.name;
    if (descEl) descEl.textContent = agent.description;
    
    // Update welcome screen
    const welcomeIcon = document.getElementById('welcomeIcon');
    const welcomeTitle = document.getElementById('welcomeTitle');
    const welcomeDesc = document.getElementById('welcomeDesc');
    
    if (welcomeIcon) welcomeIcon.textContent = agent.icon;
    if (welcomeTitle) welcomeTitle.textContent = `Chat with ${agent.name}`;
    if (welcomeDesc) welcomeDesc.textContent = agent.description;
    
    // Update input placeholder
    const input = document.getElementById('chatInput');
    if (input) input.placeholder = `Message ${agent.name}...`;
    
    // Update model indicator
    updateModelIndicator();
}

async function switchAgent(agentId) {
    currentAgent = agentId;
    currentThreadId = null;
    chatMessages = [];

    // Reset chat UI to welcome screen
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        messagesContainer.innerHTML = `
            <div class="chat-welcome" id="chatWelcome">
                <div class="welcome-icon" id="welcomeIcon">🤖</div>
                <h3 id="welcomeTitle">Chat with Assistant</h3>
                <p id="welcomeDesc">AI Assistant</p>
            </div>
        `;
    }

    updateChatUI();

    // Load most recent thread for this agent
    if (ChatPersistence.isReady()) {
        await loadActiveThread(agentId);
    }
}

// ── Thread Management ────────────────────────────────

async function loadActiveThread(agentId) {
    const threads = await ChatPersistence.getThreadsForAgent(agentId);
    if (threads.length > 0) {
        await loadThread(threads[0].id);
    }
    updateThreadSelector();
}

async function loadThread(threadId) {
    const messages = await ChatPersistence.getMessages(threadId);
    currentThreadId = threadId;
    chatMessages = messages.map(m => ({ role: m.role, content: m.content }));
    renderChatMessages(chatMessages);
}

function renderChatMessages(msgs) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    if (msgs.length === 0) {
        // Show welcome screen
        const agent = agentConfigs[currentAgent] || { icon: '🤖', name: 'Assistant', description: 'AI Assistant' };
        container.innerHTML = `
            <div class="chat-welcome" id="chatWelcome">
                <div class="welcome-icon" id="welcomeIcon">${agent.icon}</div>
                <h3 id="welcomeTitle">Chat with ${agent.name}</h3>
                <p id="welcomeDesc">${agent.description}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    const agentIcon = agentConfigs[currentAgent]?.icon || '🤖';
    msgs.forEach(m => {
        const avatar = m.role === 'user' ? '👤' : agentIcon;
        const div = document.createElement('div');
        div.className = `chat-message ${m.role}`;
        div.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">${formatMessageContent(m.content)}</div>
        `;
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}

async function startNewThread() {
    currentThreadId = null;
    chatMessages = [];
    renderChatMessages([]);
    updateThreadSelector();
    document.getElementById('chatInput')?.focus();
}

function toggleThreadList() {
    const panel = document.getElementById('threadListPanel');
    if (!panel) return;
    const visible = panel.style.display !== 'none';
    panel.style.display = visible ? 'none' : 'block';
    if (!visible) updateThreadSelector();
}

async function updateThreadSelector() {
    const container = document.getElementById('threadListItems');
    if (!container) return;

    if (!ChatPersistence.isReady()) {
        container.innerHTML = '<div class="thread-list-empty">Persistence not connected</div>';
        return;
    }

    const threads = await ChatPersistence.getThreadsForAgent(currentAgent);
    if (threads.length === 0) {
        container.innerHTML = '<div class="thread-list-empty">No past threads</div>';
        return;
    }

    container.innerHTML = threads.map(t => {
        const active = t.id === currentThreadId ? ' active' : '';
        const date = new Date(t.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `
            <div class="thread-item${active}" onclick="selectThread('${t.id}')">
                <div class="thread-item-info">
                    <div class="thread-item-title">${escapeHTML(t.title)}</div>
                    <div class="thread-item-date">${date}</div>
                </div>
                <button class="thread-item-archive" onclick="event.stopPropagation(); archiveThreadUI('${t.id}')" title="Archive">✕</button>
            </div>
        `;
    }).join('');
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function selectThread(threadId) {
    await loadThread(threadId);
    updateThreadSelector();
    document.getElementById('threadListPanel').style.display = 'none';
}

async function archiveThreadUI(threadId) {
    await ChatPersistence.archiveThread(threadId);
    if (threadId === currentThreadId) {
        currentThreadId = null;
        chatMessages = [];
        renderChatMessages([]);
    }
    updateThreadSelector();
}

function openChatFullscreen() {
    const agent = agents[currentAgent];
    if (agent && agent.url) {
        window.open(agent.url, '_blank');
    } else {
        alert('Open the OpenClaw dashboard directly:\nhttp://127.0.0.1:18789');
    }
}

// ===========================================
// MODALS
// ===========================================

function openModal(modalId) {
    document.getElementById('modalOverlay').classList.add('open');
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
}

// Close modal on overlay click
document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// ===========================================
// SIDEBAR TOGGLE
// ===========================================

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, duration = 4000) {
    // Remove existing toast if any
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Auto-remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function formatNumber(num) {
    if (num === null || num === undefined) return '--';
    return new Intl.NumberFormat().format(num);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function formatRelativeTime(dateStr) {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(dateStr);
}

function isOverdue(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
}

// ===========================================
// GLOBAL FUNCTIONS (for onclick handlers)
// ===========================================

window.switchTab = switchTab;
window.openAddTaskModal = openAddTaskModal;
window.saveTask = saveTask;
window.openTaskDetail = openTaskDetail;
window.updateTaskStatus = updateTaskStatus;
window.updateTaskPriority = updateTaskPriority;
window.deleteTask = deleteTask;
window.filterActivity = filterActivity;
window.switchReportsSubtab = switchReportsSubtab;
window.openReportDoc = openReportDoc;
window.switchKHSubtab = switchKHSubtab;
window.createFolder = createFolder;
window.pickFolderEmoji = pickFolderEmoji;
window.closeFolderModal = closeFolderModal;
window.saveFolderFromModal = saveFolderFromModal;
window.changeFolderEmoji = changeFolderEmoji;
window.saveChangedEmoji = saveChangedEmoji;
window.startDocDrag = startDocDrag;
window.dropOnFolder = dropOnFolder;
window.filterDocs = filterDocs;
window.selectDoc = selectDoc;
window.selectFolder = selectFolder;
window.toggleAllFolders = toggleAllFolders;
window.createNewNote = createNewNote;
window.editNote = editNote;
window.saveNote = saveNote;
window.deleteNote = deleteNote;
window.deleteNoteFromPreview = deleteNoteFromPreview;
window.cancelNoteEdit = cancelNoteEdit;
window.formatText = formatText;
window.toggleModelDropdown = toggleModelDropdown;
window.selectModel = selectModel;
window.handleChatKeydown = handleChatKeydown;
window.autoResizeTextarea = autoResizeTextarea;
window.sendChatMessage = sendChatMessage;
window.openChatSettings = openChatSettings;
window.saveChatSettings = saveChatSettings;
window.addNote = addNote;
window.toggleNotes = toggleNotes;
window.copyToClipboard = copyToClipboard;
window.openYouTubeConfig = openYouTubeConfig;
window.saveYouTubeConfig = saveYouTubeConfig;
window.fetchYouTubeData = fetchYouTubeData;
window.refreshYouTube = refreshYouTube;
window.openIgSnapshotModal = openIgSnapshotModal;
window.saveIgSnapshot = saveIgSnapshot;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleSidebar = toggleSidebar;

// ===========================================
// DOCUMENT LIBRARY & @MENTIONS
// ===========================================

// Document library state
let documentLibrary = {
    documents: [],
    notionDocs: [],
    notionSync: {
        enabled: false,
        lastSync: null,
        databaseId: null
    }
};

// @mention state
let mentionState = {
    active: false,
    query: '',
    startPos: 0,
    selectedIndex: 0,
    matches: []
};

// Load document library
async function loadDocumentLibrary() {
    try {
        const data = await loadJSON('documents');
        if (data) {
            documentLibrary = data;
            renderDocumentLibrary();
        }
    } catch (e) {
        console.error('Failed to load document library:', e);
    }
}

// Save document library
function saveDocumentLibrary() {
    documentLibrary.lastUpdated = new Date().toISOString();
    saveJSON('documents', documentLibrary);
}

// Render document library in the Knowledge tab
function renderDocumentLibrary() {
    const container = document.getElementById('knowledgeList');
    if (!container) return;
    
    const allDocs = [
        ...documentLibrary.documents.map(d => ({ ...d, source: 'local' })),
        ...documentLibrary.notionDocs.map(d => ({ ...d, source: 'notion' }))
    ];
    
    if (allDocs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                <p>No documents yet</p>
                <button class="btn btn-primary btn-sm" onclick="openUploadDocModal()">Upload Document</button>
            </div>
        `;
        return;
    }
    
    // Group by category
    const categories = {};
    allDocs.forEach(doc => {
        const cat = doc.category || 'uncategorized';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(doc);
    });
    
    const categoryIcons = {
        brand: '🎨',
        strategy: '🎯',
        content: '📝',
        sales: '💰',
        operations: '⚙️',
        notion: '📔',
        uncategorized: '📄'
    };
    
    container.innerHTML = Object.entries(categories).map(([cat, docs]) => `
        <div class="knowledge-category">
            <div class="category-header">
                <span class="category-icon">${categoryIcons[cat] || '📄'}</span>
                <span class="category-name">${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                <span class="category-count">${docs.length}</span>
            </div>
            <div class="category-docs">
                ${docs.map(doc => `
                    <div class="knowledge-doc ${doc.source === 'notion' ? 'notion-doc' : ''}" 
                         data-id="${doc.id}" 
                         onclick="previewDocument('${doc.id}')">
                        <div class="doc-icon">${doc.source === 'notion' ? '📔' : '📄'}</div>
                        <div class="doc-info">
                            <div class="doc-name">${escapeHtml(doc.name)}</div>
                            <div class="doc-meta">
                                ${doc.tags ? doc.tags.slice(0, 3).map(t => `<span class="doc-tag">${t}</span>`).join('') : ''}
                            </div>
                        </div>
                        <div class="doc-actions">
                            <button class="btn-icon btn-xs" onclick="event.stopPropagation(); editDocument('${doc.id}')" title="Edit">✏️</button>
                            <button class="btn-icon btn-xs" onclick="event.stopPropagation(); deleteDocument('${doc.id}')" title="Delete">🗑️</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// Get all documents for @mention matching
function getAllMentionableItems() {
    const items = [];
    
    // Add local documents
    documentLibrary.documents.forEach(doc => {
        items.push({
            id: doc.id,
            type: 'doc',
            name: doc.name,
            displayName: `doc:${doc.name.toLowerCase().replace(/\s+/g, '-')}`,
            icon: '📄',
            content: doc.content
        });
    });
    
    // Add Notion documents
    documentLibrary.notionDocs.forEach(doc => {
        items.push({
            id: doc.id,
            type: 'notion',
            name: doc.name,
            displayName: `notion:${doc.name.toLowerCase().replace(/\s+/g, '-')}`,
            icon: '📔',
            content: doc.content
        });
    });
    
    // Add dynamic data sources
    items.push({
        id: 'metrics',
        type: 'data',
        name: 'Business Metrics',
        displayName: 'metrics',
        icon: '📊',
        getData: () => getBusinessMetricsContext()
    });
    
    items.push({
        id: 'tasks',
        type: 'data',
        name: 'Active Tasks',
        displayName: 'tasks',
        icon: '✅',
        getData: () => getTasksContext()
    });
    
    items.push({
        id: 'pipeline',
        type: 'data',
        name: 'Pipeline Status',
        displayName: 'pipeline',
        icon: '🔥',
        getData: () => getPipelineContext()
    });
    
    return items;
}

// Get business metrics as context string
function getBusinessMetricsContext() {
    const b = state.business || {};
    return `## Current Business Metrics
- VIP Clients: ${b.vipClients || 'N/A'}
- Premium Members: ${b.premiumMembers || 'N/A'}
- Free Community: ${b.freeMembers || 'N/A'}
- MRR: $${b.mrr || 'N/A'}
- Cash Collected (Month): $${b.cashCollected || 'N/A'}
- Pipeline Value: $${b.pipelineValue || 'N/A'}
`;
}

// Get active tasks as context string
function getTasksContext() {
    const activeTasks = state.tasks.filter(t => t.status !== 'done');
    if (activeTasks.length === 0) return '## Active Tasks\nNo active tasks.';
    
    return `## Active Tasks (${activeTasks.length})
${activeTasks.slice(0, 10).map(t => `- [${t.priority?.toUpperCase() || 'MED'}] ${t.title}${t.due ? ` (Due: ${t.due})` : ''}`).join('\n')}
${activeTasks.length > 10 ? `\n... and ${activeTasks.length - 10} more` : ''}
`;
}

// Get pipeline status as context string
function getPipelineContext() {
    const b = state.business || {};
    return `## Pipeline Status
- Free Community: ${b.freeMembers || 0} members (+${b.freeLast30 || 0} last 30 days)
- Workshop Sales: ${b.workshopSales || 0} sales ($${b.workshopCash || 0} collected)
- Premium: ${b.premiumMembers || 0} members
- VIP: ${b.vipClients || 0} clients
- 1:1 Spots: ${b.oneOneClients || 0}/12 filled
- Applications This Week: ${b.applicationsWeek || 0}
`;
}

// Initialize @mention autocomplete on chat input
function initMentionAutocomplete() {
    const input = document.getElementById('chatInput');
    if (!input) {
        console.log('Chat input not found, retrying in 500ms...');
        setTimeout(initMentionAutocomplete, 500);
        return;
    }
    
    // Create autocomplete dropdown in the chat-input-container
    const container = input.closest('.chat-input-container') || input.parentNode;
    let dropdown = document.getElementById('mentionDropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'mentionDropdown';
        dropdown.className = 'mention-dropdown';
        dropdown.style.display = 'none';
        container.appendChild(dropdown);
    }
    
    // Remove any existing listeners to avoid duplicates
    input.removeEventListener('input', handleMentionInput);
    input.removeEventListener('keydown', handleMentionKeydown);
    
    // Handle input for @mention detection
    input.addEventListener('input', handleMentionInput);
    input.addEventListener('keydown', handleMentionKeydown);
    input.addEventListener('blur', () => {
        // Delay hiding to allow click on dropdown
        setTimeout(() => hideMentionDropdown(), 250);
    });
    
    console.log('Mention autocomplete initialized');
}

function handleMentionInput(e) {
    const input = e.target;
    const text = input.value;
    const cursorPos = input.selectionStart;
    
    // Find @ symbol before cursor
    const textBeforeCursor = text.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    // Check if @ is valid (at start, after space, or after newline)
    if (lastAtIndex === -1) {
        hideMentionDropdown();
        return;
    }
    
    // @ must be at start or preceded by whitespace
    if (lastAtIndex > 0) {
        const charBefore = text[lastAtIndex - 1];
        if (charBefore !== ' ' && charBefore !== '\n' && charBefore !== '\t') {
            hideMentionDropdown();
            return;
        }
    }
    
    // Get query after @
    const query = textBeforeCursor.slice(lastAtIndex + 1).toLowerCase();
    
    // Don't show if there's a space in the query (completed mention)
    if (query.includes(' ')) {
        hideMentionDropdown();
        return;
    }
    
    mentionState.active = true;
    mentionState.query = query;
    mentionState.startPos = lastAtIndex;
    
    // Filter matches
    const allItems = getAllMentionableItems();
    mentionState.matches = allItems.filter(item => 
        item.displayName.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query)
    ).slice(0, 8);
    
    console.log('Mention query:', query, 'Matches:', mentionState.matches.length);
    
    if (mentionState.matches.length > 0) {
        mentionState.selectedIndex = 0;
        showMentionDropdown();
    } else {
        hideMentionDropdown();
    }
}

function handleMentionKeydown(e) {
    if (!mentionState.active) return;
    
    const dropdown = document.getElementById('mentionDropdown');
    if (!dropdown || dropdown.style.display === 'none') return;
    
    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            mentionState.selectedIndex = Math.min(
                mentionState.selectedIndex + 1,
                mentionState.matches.length - 1
            );
            renderMentionDropdown();
            break;
        case 'ArrowUp':
            e.preventDefault();
            mentionState.selectedIndex = Math.max(mentionState.selectedIndex - 1, 0);
            renderMentionDropdown();
            break;
        case 'Enter':
        case 'Tab':
            if (mentionState.matches.length > 0) {
                e.preventDefault();
                selectMention(mentionState.matches[mentionState.selectedIndex]);
            }
            break;
        case 'Escape':
            hideMentionDropdown();
            break;
    }
}

function showMentionDropdown() {
    const dropdown = document.getElementById('mentionDropdown');
    if (!dropdown) {
        console.log('Dropdown not found');
        return;
    }
    
    dropdown.style.display = 'block';
    renderMentionDropdown();
    console.log('Dropdown shown');
}

function hideMentionDropdown() {
    const dropdown = document.getElementById('mentionDropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    mentionState.active = false;
}

function renderMentionDropdown() {
    const dropdown = document.getElementById('mentionDropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = mentionState.matches.map((item, idx) => `
        <div class="mention-item ${idx === mentionState.selectedIndex ? 'selected' : ''}"
             data-item-id="${item.id}"
             onmousedown="event.preventDefault(); selectMentionById('${item.id}')"
             onmouseenter="mentionState.selectedIndex = ${idx}; renderMentionDropdown()">
            <span class="mention-icon">${item.icon}</span>
            <span class="mention-name">@${item.displayName}</span>
            <span class="mention-type">${item.type}</span>
        </div>
    `).join('');
}

function selectMentionById(itemId) {
    const item = getAllMentionableItems().find(i => i.id === itemId);
    if (item) {
        selectMention(item);
    }
}

function selectMention(item) {
    const input = document.getElementById('chatInput');
    if (!input || !item) return;
    
    const text = input.value;
    const before = text.slice(0, mentionState.startPos);
    const after = text.slice(input.selectionStart);
    
    input.value = before + '@' + item.displayName + ' ' + after;
    input.focus();
    
    // Move cursor after the mention
    const newPos = mentionState.startPos + item.displayName.length + 2;
    input.setSelectionRange(newPos, newPos);
    
    hideMentionDropdown();
}

// Extract @mentions from message and build context
function extractMentionsAndBuildContext(message) {
    const mentionRegex = /@([\w:-]+)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(message)) !== null) {
        mentions.push(match[1]);
    }
    
    if (mentions.length === 0) {
        return { cleanMessage: message, context: '' };
    }
    
    const allItems = getAllMentionableItems();
    const contextParts = [];
    
    mentions.forEach(mention => {
        const item = allItems.find(i => 
            i.displayName.toLowerCase() === mention.toLowerCase()
        );
        
        if (item) {
            if (item.getData) {
                contextParts.push(item.getData());
            } else if (item.content) {
                contextParts.push(`## ${item.name}\n${item.content}`);
            }
        }
    });
    
    const context = contextParts.length > 0 
        ? '\n\n---\n**Referenced Context:**\n' + contextParts.join('\n\n') + '\n---\n\n'
        : '';
    
    return { cleanMessage: message, context };
}

// Upload document modal
function openUploadDocModal() {
    openModal('uploadDocModal');
}

// Save uploaded document
async function saveUploadedDocument() {
    const name = document.getElementById('docName').value.trim();
    const category = document.getElementById('docCategory').value;
    const content = document.getElementById('docContent').value.trim();
    const tags = document.getElementById('docTags').value.split(',').map(t => t.trim()).filter(Boolean);
    
    if (!name || !content) {
        alert('Please provide a name and content');
        return;
    }
    
    const doc = {
        id: 'doc-' + Date.now(),
        name,
        type: 'local',
        category,
        content,
        tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    documentLibrary.documents.push(doc);
    saveDocumentLibrary();
    renderDocumentLibrary();
    closeModal();
    
    // Clear form
    document.getElementById('docName').value = '';
    document.getElementById('docContent').value = '';
    document.getElementById('docTags').value = '';
}

// Edit document
function editDocument(docId) {
    const doc = documentLibrary.documents.find(d => d.id === docId) ||
                documentLibrary.notionDocs.find(d => d.id === docId);
    
    if (!doc) return;
    
    document.getElementById('docName').value = doc.name;
    document.getElementById('docCategory').value = doc.category || 'uncategorized';
    document.getElementById('docContent').value = doc.content;
    document.getElementById('docTags').value = (doc.tags || []).join(', ');
    
    // Store editing state
    document.getElementById('uploadDocModal').dataset.editingId = docId;
    
    openModal('uploadDocModal');
}

// Delete document
function deleteDocument(docId) {
    if (!confirm('Delete this document?')) return;
    
    documentLibrary.documents = documentLibrary.documents.filter(d => d.id !== docId);
    documentLibrary.notionDocs = documentLibrary.notionDocs.filter(d => d.id !== docId);
    saveDocumentLibrary();
    renderDocumentLibrary();
}

// Preview document
function previewDocument(docId) {
    const doc = documentLibrary.documents.find(d => d.id === docId) ||
                documentLibrary.notionDocs.find(d => d.id === docId);
    
    if (!doc) return;
    
    const preview = document.getElementById('knowledgePreview');
    if (preview) {
        preview.innerHTML = `
            <div class="doc-preview-header">
                <h2>${escapeHtml(doc.name)}</h2>
                <div class="doc-preview-meta">
                    <span class="doc-category">${doc.category || 'uncategorized'}</span>
                    ${doc.tags ? doc.tags.map(t => `<span class="doc-tag">${t}</span>`).join('') : ''}
                </div>
            </div>
            <div class="doc-preview-content">
                ${formatMarkdown(doc.content)}
            </div>
            <div class="doc-preview-footer">
                <small>Use <code>@${doc.type === 'notion' ? 'notion' : 'doc'}:${doc.name.toLowerCase().replace(/\s+/g, '-')}</code> to reference in chat</small>
            </div>
        `;
    }
}

// Simple markdown formatter
function formatMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/^### (.*$)/gim, '<h4>$1</h4>')
        .replace(/^## (.*$)/gim, '<h3>$1</h3>')
        .replace(/^# (.*$)/gim, '<h2>$1</h2>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/\n/g, '<br>');
}

// ===========================================
// NOTION SYNC
// ===========================================

async function syncFromNotion() {
    const apiKey = localStorage.getItem('notionApiKey');
    if (!apiKey) {
        alert('Please configure your Notion API key in settings');
        return;
    }
    
    const databaseId = documentLibrary.notionSync.databaseId || '1b3ff8c6-2c63-4941-bad2-1876bd405333';
    const syncBtn = document.getElementById('notionSyncBtn');
    
    if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<span class="spinner"></span> Syncing...';
    }
    
    try {
        // Use proxy to avoid CORS
        const PROXY_URL = 'https://anthropic-proxy.dan-a14.workers.dev/notion';
        
        const response = await fetch(`${PROXY_URL}/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Notion-Token': apiKey
            },
            body: JSON.stringify({
                page_size: 100
            })
        });
        
        if (!response.ok) {
            throw new Error('Notion API error: ' + response.status);
        }
        
        const data = await response.json();
        
        // Process Notion pages
        documentLibrary.notionDocs = await Promise.all(
            data.results.map(async page => {
                const title = page.properties?.Name?.title?.[0]?.plain_text || 'Untitled';
                const category = page.properties?.Category?.select?.name || 'notion';
                
                // Fetch page content
                let content = '';
                try {
                    const blocksRes = await fetch(`${PROXY_URL}/blocks/${page.id}/children`, {
                        headers: { 'X-Notion-Token': apiKey }
                    });
                    if (blocksRes.ok) {
                        const blocks = await blocksRes.json();
                        content = extractNotionContent(blocks.results);
                    }
                } catch (e) {
                    console.error('Failed to fetch page content:', e);
                }
                
                return {
                    id: page.id,
                    name: title,
                    type: 'notion',
                    category: category.toLowerCase(),
                    content,
                    notionUrl: page.url,
                    tags: [],
                    lastSynced: new Date().toISOString()
                };
            })
        );
        
        documentLibrary.notionSync.lastSync = new Date().toISOString();
        documentLibrary.notionSync.enabled = true;
        saveDocumentLibrary();
        renderDocumentLibrary();
        updateNotionSyncStatus();
        
        alert(`Synced ${documentLibrary.notionDocs.length} documents from Notion`);
        
    } catch (error) {
        console.error('Notion sync failed:', error);
        alert('Notion sync failed: ' + error.message);
    } finally {
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.innerHTML = '🔄 Sync from Notion';
        }
    }
}

// Extract text content from Notion blocks
function extractNotionContent(blocks) {
    if (!blocks) return '';
    
    return blocks.map(block => {
        const type = block.type;
        const data = block[type];
        
        if (!data) return '';
        
        switch (type) {
            case 'paragraph':
            case 'heading_1':
            case 'heading_2':
            case 'heading_3':
            case 'bulleted_list_item':
            case 'numbered_list_item':
                const text = data.rich_text?.map(t => t.plain_text).join('') || '';
                if (type === 'heading_1') return `# ${text}`;
                if (type === 'heading_2') return `## ${text}`;
                if (type === 'heading_3') return `### ${text}`;
                if (type.includes('list_item')) return `- ${text}`;
                return text;
            case 'code':
                return '```\n' + (data.rich_text?.map(t => t.plain_text).join('') || '') + '\n```';
            default:
                return '';
        }
    }).filter(Boolean).join('\n\n');
}

function updateNotionSyncStatus() {
    const statusEl = document.getElementById('notionSyncStatus');
    if (statusEl && documentLibrary.notionSync.lastSync) {
        const lastSync = new Date(documentLibrary.notionSync.lastSync);
        statusEl.textContent = `Last synced: ${formatRelativeTime(lastSync)}`;
    }
}

function openNotionSettings() {
    const currentKey = localStorage.getItem('notionApiKey') || '';
    document.getElementById('notionApiKeyInput').value = currentKey;
    document.getElementById('notionDatabaseId').value = documentLibrary.notionSync.databaseId || '';
    openModal('notionSettingsModal');
}

function saveNotionSettings() {
    const apiKey = document.getElementById('notionApiKeyInput').value.trim();
    const databaseId = document.getElementById('notionDatabaseId').value.trim();
    
    if (apiKey) {
        localStorage.setItem('notionApiKey', apiKey);
    }
    
    if (databaseId) {
        documentLibrary.notionSync.databaseId = databaseId;
        saveDocumentLibrary();
    }
    
    closeModal();
}

// Override sendChatMessage to include context injection
const originalSendChatMessage = sendChatMessage;
window.sendChatMessage = async function() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message || isGenerating) return;
    
    // Extract mentions and build context
    const { cleanMessage, context } = extractMentionsAndBuildContext(message);
    
    // Add context to the message if present
    const enhancedMessage = context ? context + cleanMessage : cleanMessage;
    
    // Temporarily replace input value with enhanced message
    const originalValue = input.value;
    input.value = enhancedMessage;
    
    // Call original function (it reads from input)
    // Actually, let's reimplement to properly inject context
    
    // Add user message to chat (show original, not enhanced)
    addMessageToChat('user', message);
    chatMessages.push({ role: 'user', content: enhancedMessage });
    
    // Clear input
    input.value = '';
    input.style.height = 'auto';
    
    // Show loading
    isGenerating = true;
    document.getElementById('chatSendBtn').disabled = true;
    addLoadingMessage();
    
    try {
        const response = await callLLMAPI(enhancedMessage);
        removeLoadingMessage();
        addMessageToChat('assistant', response);
        chatMessages.push({ role: 'assistant', content: response });
    } catch (error) {
        removeLoadingMessage();
        addMessageToChat('assistant', `Error: ${error.message}. Check your API settings.`);
    } finally {
        isGenerating = false;
        document.getElementById('chatSendBtn').disabled = false;
    }
};

// Initialize document library on load
document.addEventListener('DOMContentLoaded', () => {
    loadDocumentLibrary();
    initMentionAutocomplete();
});

// Export new functions
window.loadDocumentLibrary = loadDocumentLibrary;
window.renderDocumentLibrary = renderDocumentLibrary;
window.openUploadDocModal = openUploadDocModal;
window.saveUploadedDocument = saveUploadedDocument;
window.editDocument = editDocument;
window.deleteDocument = deleteDocument;
window.previewDocument = previewDocument;
window.syncFromNotion = syncFromNotion;
window.openNotionSettings = openNotionSettings;
window.saveNotionSettings = saveNotionSettings;
window.selectMention = selectMention;
window.selectMentionById = selectMentionById;
window.getAllMentionableItems = getAllMentionableItems;

// ===========================================
// RESIZABLE GRID CARDS
// ===========================================

// Grid layout state
let gridLayout = {
    cards: {}
};

// Load saved grid layout
function loadGridLayout() {
    const saved = localStorage.getItem('geeves-grid-layout');
    if (saved) {
        try {
            gridLayout = JSON.parse(saved);
            applyGridLayout();
        } catch (e) {
            console.error('Failed to load grid layout:', e);
        }
    }
}

// Save grid layout
function saveGridLayout() {
    localStorage.setItem('geeves-grid-layout', JSON.stringify(gridLayout));
}

// Apply saved layout to cards
function applyGridLayout() {
    Object.entries(gridLayout.cards).forEach(([cardId, layout]) => {
        const card = document.querySelector(`[data-card="${cardId}"]`);
        if (card && layout) {
            if (layout.colSpan) card.style.gridColumn = `span ${layout.colSpan}`;
            if (layout.rowSpan) card.style.gridRow = `span ${layout.rowSpan}`;
            if (layout.order !== undefined) card.style.order = layout.order;
        }
    });
}

// Initialize resizable cards
function initResizableCards() {
    const cards = document.querySelectorAll('.resizable-card');
    
    cards.forEach(card => {
        const handles = card.querySelectorAll('.resize-handle');
        
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => startResize(e, card, handle));
        });
        
        // Drag to reorder
        const dragBtn = card.querySelector('.btn-drag');
        if (dragBtn) {
            dragBtn.addEventListener('mousedown', (e) => startDrag(e, card));
        }
    });
    
    loadGridLayout();
}

// Resize functionality
let resizing = null;

function startResize(e, card, handle) {
    e.preventDefault();
    
    const grid = card.parentElement;
    const gridRect = grid.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const computedStyle = getComputedStyle(grid);
    const colWidth = (gridRect.width - (11 * parseFloat(computedStyle.gap))) / 12;
    const rowHeight = 200; // minmax value
    
    resizing = {
        card,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: cardRect.width,
        startHeight: cardRect.height,
        colWidth,
        rowHeight,
        direction: handle.classList.contains('resize-handle-e') ? 'e' : 
                   handle.classList.contains('resize-handle-s') ? 's' : 'se'
    };
    
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
}

function doResize(e) {
    if (!resizing) return;
    
    const { card, startX, startY, startWidth, startHeight, colWidth, rowHeight, direction } = resizing;
    const cardId = card.dataset.card;
    
    if (!gridLayout.cards[cardId]) {
        gridLayout.cards[cardId] = {};
    }
    
    if (direction === 'e' || direction === 'se') {
        const deltaX = e.clientX - startX;
        const newWidth = startWidth + deltaX;
        const newColSpan = Math.max(2, Math.min(12, Math.round(newWidth / colWidth)));
        card.style.gridColumn = `span ${newColSpan}`;
        gridLayout.cards[cardId].colSpan = newColSpan;
    }
    
    if (direction === 's' || direction === 'se') {
        const deltaY = e.clientY - startY;
        const newHeight = startHeight + deltaY;
        const newRowSpan = Math.max(1, Math.min(4, Math.round(newHeight / rowHeight)));
        card.style.gridRow = `span ${newRowSpan}`;
        gridLayout.cards[cardId].rowSpan = newRowSpan;
    }
}

function stopResize() {
    if (resizing) {
        saveGridLayout();
        resizing = null;
    }
    document.removeEventListener('mousemove', doResize);
    document.removeEventListener('mouseup', stopResize);
}

// Drag to reorder
let dragging = null;

function startDrag(e, card) {
    e.preventDefault();
    
    dragging = {
        card,
        startX: e.clientX,
        startY: e.clientY
    };
    
    card.classList.add('dragging');
    
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
}

function doDrag(e) {
    if (!dragging) return;
    
    const { card } = dragging;
    const grid = card.parentElement;
    const cards = Array.from(grid.querySelectorAll('.resizable-card'));
    
    // Find card under mouse
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const targetCard = target?.closest('.resizable-card');
    
    cards.forEach(c => c.classList.remove('drop-target'));
    
    if (targetCard && targetCard !== card) {
        targetCard.classList.add('drop-target');
    }
}

function stopDrag(e) {
    if (!dragging) return;
    
    const { card } = dragging;
    const grid = card.parentElement;
    const cards = Array.from(grid.querySelectorAll('.resizable-card'));
    
    card.classList.remove('dragging');
    cards.forEach(c => c.classList.remove('drop-target'));
    
    // Find drop target
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const targetCard = target?.closest('.resizable-card');
    
    if (targetCard && targetCard !== card) {
        // Swap order
        const cardOrder = parseInt(getComputedStyle(card).order) || 0;
        const targetOrder = parseInt(getComputedStyle(targetCard).order) || 0;
        
        const cardId = card.dataset.card;
        const targetId = targetCard.dataset.card;
        
        // Update DOM order
        const cardIndex = cards.indexOf(card);
        const targetIndex = cards.indexOf(targetCard);
        
        if (cardIndex < targetIndex) {
            targetCard.after(card);
        } else {
            targetCard.before(card);
        }
        
        // Save order
        const newCards = Array.from(grid.querySelectorAll('.resizable-card'));
        newCards.forEach((c, i) => {
            const id = c.dataset.card;
            if (!gridLayout.cards[id]) gridLayout.cards[id] = {};
            gridLayout.cards[id].order = i;
            c.style.order = i;
        });
        
        saveGridLayout();
    }
    
    dragging = null;
    document.removeEventListener('mousemove', doDrag);
    document.removeEventListener('mouseup', stopDrag);
}

// ===========================================
// META ADS INTEGRATION
// ===========================================

let metaAdsData = {
    lastUpdated: null,
    summary: {
        spend: 0,
        leads: 0,
        cpl: 0,
        roas: 0,
        impressions: 0,
        revenue: 0
    },
    campaigns: []
};

// Load Meta Ads data
async function loadMetaAds() {
    // Try loading from localStorage first
    const saved = localStorage.getItem('geeves-meta-ads');
    if (saved) {
        try {
            metaAdsData = JSON.parse(saved);
            renderMetaAds();
        } catch (e) {
            console.error('Failed to load Meta Ads data:', e);
        }
    }
    
    // Try fetching from data file
    try {
        const response = await fetch(`data/meta-ads.json?t=${Date.now()}`);
        if (response.ok) {
            metaAdsData = await response.json();
            localStorage.setItem('geeves-meta-ads', JSON.stringify(metaAdsData));
            renderMetaAds();
        }
    } catch (e) {
        console.log('No meta-ads.json found, using localStorage');
    }
}

// Save Meta Ads data
function saveMetaAds() {
    localStorage.setItem('geeves-meta-ads', JSON.stringify(metaAdsData));
}

// Render Meta Ads data
function renderMetaAds() {
    const { summary, campaigns, adSets, lastUpdated } = metaAdsData;
    
    // Update summary stats
    const updateStat = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    
    updateStat('metaSpend', '$' + (summary.spend || 0).toLocaleString());
    updateStat('metaLeads', (summary.leads || 0).toLocaleString());
    updateStat('metaCPL', '$' + (summary.cpl || 0).toFixed(2));
    updateStat('metaROAS', (summary.roas || 0).toFixed(1) + 'x');
    updateStat('metaImpressions', formatCompactNumber(summary.impressions || 0));
    updateStat('metaRevenue', '$' + (summary.revenue || 0).toLocaleString());
    
    // Update last updated
    const lastUpdatedEl = document.getElementById('metaLastUpdated');
    if (lastUpdatedEl && lastUpdated) {
        lastUpdatedEl.textContent = 'Last updated: ' + formatRelativeTime(lastUpdated);
    }
    
    // Update campaigns table
    const campaignsBody = document.getElementById('metaCampaignsBody');
    if (campaignsBody) {
        if (campaigns && campaigns.length > 0) {
            campaignsBody.innerHTML = campaigns.map(c => `
                <tr>
                    <td><strong>${escapeHtml(c.name)}</strong></td>
                    <td><span class="status-badge ${c.status === 'ACTIVE' ? 'active' : 'paused'}">${c.status || 'Unknown'}</span></td>
                    <td>$${(c.spend || 0).toLocaleString()}</td>
                    <td>${formatCompactNumber(c.impressions || 0)}</td>
                    <td>${c.clicks || 0}</td>
                    <td>${c.impressions ? ((c.clicks / c.impressions) * 100).toFixed(2) + '%' : '—'}</td>
                    <td>${c.leads || 0}</td>
                    <td>$${c.leads ? (c.spend / c.leads).toFixed(2) : '—'}</td>
                </tr>
            `).join('');
        } else {
            campaignsBody.innerHTML = '<tr><td colspan="8" class="empty">No campaigns yet — connect Meta Ads or add data manually</td></tr>';
        }
    }
    
    // Update ad sets table
    const adSetsBody = document.getElementById('metaAdSetsBody');
    if (adSetsBody) {
        if (adSets && adSets.length > 0) {
            adSetsBody.innerHTML = adSets.map(a => `
                <tr>
                    <td>${escapeHtml(a.name)}</td>
                    <td>${escapeHtml(a.campaign || '')}</td>
                    <td>$${(a.spend || 0).toLocaleString()}</td>
                    <td>${a.leads || 0}</td>
                    <td>$${a.leads ? (a.spend / a.leads).toFixed(2) : '—'}</td>
                </tr>
            `).join('');
        } else {
            adSetsBody.innerHTML = '<tr><td colspan="5" class="empty">No ad set data</td></tr>';
        }
    }
}

// Quick add Meta data
function quickAddMetaData() {
    const spend = parseFloat(document.getElementById('quickAddSpend')?.value) || 0;
    const leads = parseInt(document.getElementById('quickAddLeads')?.value) || 0;
    const revenue = parseFloat(document.getElementById('quickAddRevenue')?.value) || 0;
    
    if (spend === 0 && leads === 0 && revenue === 0) {
        alert('Please enter at least one value');
        return;
    }
    
    // Add to existing totals
    metaAdsData.summary.spend = (metaAdsData.summary.spend || 0) + spend;
    metaAdsData.summary.leads = (metaAdsData.summary.leads || 0) + leads;
    metaAdsData.summary.revenue = (metaAdsData.summary.revenue || 0) + revenue;
    metaAdsData.summary.cpl = metaAdsData.summary.leads > 0 
        ? metaAdsData.summary.spend / metaAdsData.summary.leads 
        : 0;
    metaAdsData.summary.roas = metaAdsData.summary.spend > 0 
        ? metaAdsData.summary.revenue / metaAdsData.summary.spend 
        : 0;
    
    metaAdsData.lastUpdated = new Date().toISOString();
    saveMetaAds();
    renderMetaAds();
    
    // Clear inputs
    document.getElementById('quickAddSpend').value = '';
    document.getElementById('quickAddLeads').value = '';
    document.getElementById('quickAddRevenue').value = '';
    
    addActivity('system', 'Added Meta Ads data', `Spend: $${spend}, Leads: ${leads}, Revenue: $${revenue}`);
}

// Refresh Meta Ads (from API)
async function refreshMetaAds() {
    const token = localStorage.getItem('metaAccessToken');
    const adAccountId = localStorage.getItem('metaAdAccountId');
    
    if (!token || !adAccountId) {
        alert('Please configure Meta Ads API settings first');
        openMetaAdsSettings();
        return;
    }
    
    const btn = document.querySelector('[onclick="refreshMetaAds()"]');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳';
    }
    
    try {
        // Fetch insights from Meta API
        const fields = 'spend,impressions,reach,actions,action_values';
        const datePreset = 'last_7d';
        
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${adAccountId}/insights?` +
            `fields=${fields}&date_preset=${datePreset}&access_token=${token}`
        );
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Meta API error');
        }
        
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            const insights = data.data[0];
            
            // Parse actions for leads
            const leads = insights.actions?.find(a => a.action_type === 'lead')?.value || 0;
            const purchases = insights.action_values?.find(a => a.action_type === 'purchase')?.value || 0;
            
            metaAdsData.summary = {
                spend: parseFloat(insights.spend || 0),
                leads: parseInt(leads),
                cpl: leads > 0 ? parseFloat(insights.spend) / leads : 0,
                roas: insights.spend > 0 ? purchases / parseFloat(insights.spend) : 0,
                impressions: parseInt(insights.impressions || 0),
                revenue: parseFloat(purchases)
            };
            
            // Fetch campaign breakdown
            const campaignsRes = await fetch(
                `https://graph.facebook.com/v18.0/${adAccountId}/campaigns?` +
                `fields=name,insights{spend,actions}&date_preset=${datePreset}&access_token=${token}`
            );
            
            if (campaignsRes.ok) {
                const campaignsData = await campaignsRes.json();
                metaAdsData.campaigns = (campaignsData.data || []).map(c => ({
                    name: c.name,
                    spend: parseFloat(c.insights?.data?.[0]?.spend || 0),
                    leads: parseInt(c.insights?.data?.[0]?.actions?.find(a => a.action_type === 'lead')?.value || 0)
                })).filter(c => c.spend > 0);
            }
            
            metaAdsData.lastUpdated = new Date().toISOString();
            saveMetaAds();
            renderMetaAds();
        }
        
    } catch (error) {
        console.error('Meta Ads refresh failed:', error);
        alert('Failed to refresh: ' + error.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '🔄';
        }
    }
}

// Open Meta Ads settings
function openMetaAdsSettings() {
    document.getElementById('metaAccessToken').value = localStorage.getItem('metaAccessToken') || '';
    document.getElementById('metaAdAccountId').value = localStorage.getItem('metaAdAccountId') || '';
    openModal('metaAdsSettingsModal');
}

// Switch Meta settings tab
function switchMetaTab(tab) {
    document.querySelectorAll('.tabs-mini .tab-mini').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tabs-mini .tab-mini[onclick*="${tab}"]`).classList.add('active');
    
    document.getElementById('metaTabApi').style.display = tab === 'api' ? 'block' : 'none';
    document.getElementById('metaTabManual').style.display = tab === 'manual' ? 'block' : 'none';
}

// Save Meta Ads settings
function saveMetaAdsSettings() {
    // Check which tab is active
    const apiTab = document.getElementById('metaTabApi');
    
    if (apiTab.style.display !== 'none') {
        // API mode
        const token = document.getElementById('metaAccessToken').value.trim();
        const adAccountId = document.getElementById('metaAdAccountId').value.trim();
        
        if (token) localStorage.setItem('metaAccessToken', token);
        if (adAccountId) localStorage.setItem('metaAdAccountId', adAccountId);
        
        closeModal();
        
        if (token && adAccountId) {
            refreshMetaAds();
        }
    } else {
        // Manual mode
        const spend = parseFloat(document.getElementById('metaManualSpend').value) || 0;
        const leads = parseInt(document.getElementById('metaManualLeads').value) || 0;
        const revenue = parseFloat(document.getElementById('metaManualRevenue').value) || 0;
        const impressions = parseInt(document.getElementById('metaManualImpressions').value) || 0;
        const campaignsText = document.getElementById('metaManualCampaigns').value;
        
        metaAdsData.summary = {
            spend,
            leads,
            cpl: leads > 0 ? spend / leads : 0,
            roas: spend > 0 ? revenue / spend : 0,
            impressions,
            revenue
        };
        
        // Parse campaigns
        if (campaignsText) {
            metaAdsData.campaigns = campaignsText.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const parts = line.split(',').map(p => p.trim());
                    return {
                        name: parts[0] || 'Campaign',
                        spend: parseFloat(parts[1]) || 0,
                        leads: parseInt(parts[2]) || 0
                    };
                });
        }
        
        metaAdsData.lastUpdated = new Date().toISOString();
        saveMetaAds();
        renderMetaAds();
        closeModal();
    }
}

// ===========================================
// SORTABLE SIDEBAR NAVIGATION
// ===========================================

let sidebarOrder = [];

// Load saved sidebar order
function loadSidebarOrder() {
    const saved = localStorage.getItem('geeves-sidebar-order');
    if (saved) {
        try {
            sidebarOrder = JSON.parse(saved);
            applySidebarOrder();
        } catch (e) {
            console.error('Failed to load sidebar order:', e);
        }
    }
}

// Save sidebar order
function saveSidebarOrder() {
    const navList = document.getElementById('navList');
    if (!navList) return;
    
    sidebarOrder = Array.from(navList.querySelectorAll('.nav-item'))
        .map(item => item.dataset.tab);
    
    localStorage.setItem('geeves-sidebar-order', JSON.stringify(sidebarOrder));
}

// Apply saved order to sidebar
function applySidebarOrder() {
    const navList = document.getElementById('navList');
    if (!navList || sidebarOrder.length === 0) return;
    
    const items = Array.from(navList.querySelectorAll('.nav-item'));
    const itemMap = {};
    items.forEach(item => {
        itemMap[item.dataset.tab] = item;
    });
    
    // Reorder based on saved order
    sidebarOrder.forEach(tabId => {
        if (itemMap[tabId]) {
            navList.appendChild(itemMap[tabId]);
        }
    });
}

// Initialize sortable sidebar
function initSortableSidebar() {
    const navList = document.getElementById('navList');
    if (!navList) return;
    
    let draggedItem = null;
    
    navList.addEventListener('dragstart', (e) => {
        if (!e.target.classList.contains('nav-item')) return;
        
        draggedItem = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', e.target.dataset.tab);
    });
    
    navList.addEventListener('dragend', (e) => {
        if (!e.target.classList.contains('nav-item')) return;
        
        e.target.classList.remove('dragging');
        document.querySelectorAll('.nav-item.drag-over, .nav-item.drag-over-below')
            .forEach(item => {
                item.classList.remove('drag-over', 'drag-over-below');
            });
        
        draggedItem = null;
        saveSidebarOrder();
    });
    
    navList.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const target = e.target.closest('.nav-item');
        if (!target || target === draggedItem) return;
        
        // Clear previous indicators
        document.querySelectorAll('.nav-item.drag-over, .nav-item.drag-over-below')
            .forEach(item => {
                item.classList.remove('drag-over', 'drag-over-below');
            });
        
        // Determine if dropping above or below
        const rect = target.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        
        if (e.clientY < midpoint) {
            target.classList.add('drag-over');
        } else {
            target.classList.add('drag-over-below');
        }
    });
    
    navList.addEventListener('dragleave', (e) => {
        const target = e.target.closest('.nav-item');
        if (target) {
            target.classList.remove('drag-over', 'drag-over-below');
        }
    });
    
    navList.addEventListener('drop', (e) => {
        e.preventDefault();
        
        const target = e.target.closest('.nav-item');
        if (!target || !draggedItem || target === draggedItem) return;
        
        const rect = target.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        
        if (e.clientY < midpoint) {
            // Insert before target
            target.parentNode.insertBefore(draggedItem, target);
        } else {
            // Insert after target
            target.parentNode.insertBefore(draggedItem, target.nextSibling);
        }
        
        target.classList.remove('drag-over', 'drag-over-below');
    });
    
    // Load saved order
    loadSidebarOrder();
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initResizableCards();
    loadMetaAds();
    initSortableSidebar();
});

// Export functions
window.initResizableCards = initResizableCards;
window.loadGridLayout = loadGridLayout;
window.saveGridLayout = saveGridLayout;
window.loadMetaAds = loadMetaAds;
window.refreshMetaAds = refreshMetaAds;
window.openMetaAdsSettings = openMetaAdsSettings;
window.switchMetaTab = switchMetaTab;
window.saveMetaAdsSettings = saveMetaAdsSettings;
window.quickAddMetaData = quickAddMetaData;

// ===========================================
// AD SWIPE FILE
// ===========================================

let adSwipesData = {
    lastUpdated: null,
    lastResearch: null,
    competitors: [],
    swipes: []
};

// Load ad swipes
async function loadAdSwipes() {
    try {
        const response = await fetch(`data/ad-swipes.json?t=${Date.now()}`);
        if (response.ok) {
            adSwipesData = await response.json();
            localStorage.setItem('geeves-ad-swipes', JSON.stringify(adSwipesData));
        }
    } catch (e) {
        const saved = localStorage.getItem('geeves-ad-swipes');
        if (saved) adSwipesData = JSON.parse(saved);
    }
    renderAdSwipes();
}

// Save ad swipes
function saveAdSwipes() {
    localStorage.setItem('geeves-ad-swipes', JSON.stringify(adSwipesData));
}

// Render ad swipes
function renderAdSwipes() {
    // Update last research date
    const lastResearchEl = document.getElementById('lastResearchDate');
    if (lastResearchEl && adSwipesData.lastResearch) {
        lastResearchEl.textContent = 'Last research: ' + formatRelativeTime(adSwipesData.lastResearch);
    }
    
    // Update competitors list in empty state
    const competitorsListEl = document.getElementById('competitorsList');
    if (competitorsListEl) {
        competitorsListEl.textContent = adSwipesData.competitors?.join(', ') || 'None set';
    }
    
    // Populate competitor filter
    const competitorFilter = document.getElementById('swipeFilterCompetitor');
    if (competitorFilter && adSwipesData.competitors) {
        const currentValue = competitorFilter.value;
        competitorFilter.innerHTML = '<option value="all">All Competitors</option>' +
            adSwipesData.competitors.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        competitorFilter.value = currentValue || 'all';
    }
    
    // Update count
    const countEl = document.getElementById('swipeCount');
    if (countEl) {
        countEl.textContent = `${adSwipesData.swipes?.length || 0} ads`;
    }
    
    // Render swipes grid
    const grid = document.getElementById('swipesGrid');
    const emptyState = document.getElementById('swipesEmpty');
    
    if (!adSwipesData.swipes || adSwipesData.swipes.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    // Get filtered swipes
    const filtered = getFilteredSwipes();
    
    grid.innerHTML = filtered.map(swipe => {
        // Determine media display
        let mediaContent;
        const categoryIcons = { 
            hook: '🪝', 
            offer: '🎁', 
            creative: '🎨', 
            copy: '✍️', 
            'social-proof': '👥', 
            retargeting: '🎯' 
        };
        
        // Only show actual image if we have a valid URL
        if (swipe.imageUrl && swipe.imageUrl.startsWith('http')) {
            mediaContent = `<img src="${swipe.imageUrl}" alt="${escapeHtml(swipe.headline || '')}" onerror="this.parentElement.innerHTML='<div class=\\'swipe-video-placeholder\\'>🖼️ Image</div>'">`;
        } else if (swipe.thumbnail && swipe.thumbnail.startsWith('http')) {
            mediaContent = `<img src="${swipe.thumbnail}" alt="${escapeHtml(swipe.headline || '')}" onerror="this.parentElement.innerHTML='<div class=\\'swipe-video-placeholder\\'>🖼️ Image</div>'">`;
        } else if (swipe.mediaType === 'video') {
            mediaContent = `<div class="swipe-video-placeholder">🎬 Video Ad</div>`;
        } else if (swipe.mediaType === 'carousel') {
            mediaContent = `<div class="swipe-video-placeholder">🎠 Carousel Ad</div>`;
        } else {
            // Default placeholder - show category icon with nice label
            const icon = categoryIcons[swipe.category] || '📢';
            const label = swipe.mediaType === 'image' ? 'Image Ad' : (swipe.mediaType || 'Ad');
            mediaContent = `<div class="swipe-video-placeholder">${icon} ${label}</div>`;
        }
        
        return `
        <div class="swipe-card" onclick="openSwipeDetail('${swipe.id}')">
            <div class="swipe-media">
                ${mediaContent}
                <span class="swipe-type-badge">${swipe.mediaType || 'image'}</span>
            </div>
            <div class="swipe-info">
                <div class="swipe-advertiser">${escapeHtml(swipe.advertiser)}</div>
                <div class="swipe-headline">${escapeHtml(swipe.headline || swipe.primaryText?.substring(0, 60) + '...' || 'No headline')}</div>
                <div class="swipe-meta">
                    <span class="swipe-category">${swipe.category || 'uncategorized'}</span>
                    <span class="swipe-date">${formatRelativeTime(swipe.foundDate)}</span>
                </div>
            </div>
            ${swipe.notes ? `<div class="swipe-notes">"${escapeHtml(swipe.notes.substring(0, 100))}${swipe.notes.length > 100 ? '...' : ''}"</div>` : ''}
        </div>
    `}).join('');
    
    // Update filtered count
    if (countEl) {
        countEl.textContent = `${filtered.length} of ${adSwipesData.swipes.length} ads`;
    }
}

// Filter swipes
function getFilteredSwipes() {
    const competitor = document.getElementById('swipeFilterCompetitor')?.value || 'all';
    const type = document.getElementById('swipeFilterType')?.value || 'all';
    const category = document.getElementById('swipeFilterCategory')?.value || 'all';
    
    return (adSwipesData.swipes || []).filter(swipe => {
        if (competitor !== 'all' && swipe.advertiser !== competitor) return false;
        if (type !== 'all' && swipe.mediaType !== type) return false;
        if (category !== 'all' && swipe.category !== category) return false;
        return true;
    });
}

function filterSwipes() {
    renderAdSwipes();
}

// Open competitor settings
function openCompetitorSettings() {
    const textarea = document.getElementById('competitorList');
    if (textarea) {
        textarea.value = (adSwipesData.competitors || []).join('\n');
    }
    openModal('competitorSettingsModal');
}

// Save competitors - copies to clipboard for Geeves to update
function saveCompetitors() {
    const textarea = document.getElementById('competitorList');
    if (textarea) {
        const competitors = textarea.value
            .split('\n')
            .map(c => c.trim())
            .filter(Boolean);
        
        // Update local state for immediate UI feedback
        adSwipesData.competitors = competitors;
        saveAdSwipes();
        renderAdSwipes();
        
        // Copy to clipboard so user can share with Geeves
        const clipboardText = `Update competitors to:\n${competitors.join('\n')}`;
        navigator.clipboard.writeText(clipboardText).then(() => {
            showToast('✅ Saved locally & copied to clipboard — paste to Geeves to sync permanently');
        }).catch(() => {
            showToast('✅ Saved locally — tell Geeves your new competitor list to sync');
        });
    }
    closeModal();
}

// Open swipe detail modal
function openSwipeDetail(swipeId) {
    const swipe = adSwipesData.swipes.find(s => s.id === swipeId);
    if (!swipe) return;
    
    // Populate modal
    document.getElementById('swipeDetailTitle').textContent = swipe.headline || 'Ad Details';
    document.getElementById('swipeDetailAdvertiser').textContent = swipe.advertiser || 'Unknown';
    document.getElementById('swipeDetailType').textContent = swipe.mediaType || 'image';
    document.getElementById('swipeDetailCategory').textContent = swipe.category || 'uncategorized';
    document.getElementById('swipeDetailHeadline').textContent = swipe.headline || 'No headline';
    document.getElementById('swipeDetailText').textContent = swipe.primaryText || 'No ad copy available';
    document.getElementById('swipeDetailCta').textContent = swipe.cta || 'No CTA';
    document.getElementById('swipeDetailWhy').textContent = swipe.whyItWorks || 'Analysis coming soon...';
    document.getElementById('swipeDetailNotes').textContent = swipe.notes || 'No notes yet';
    
    // Show transcript if available (video ads)
    const transcriptSection = document.getElementById('swipeTranscriptSection');
    const transcriptEl = document.getElementById('swipeDetailTranscript');
    if (swipe.transcript && swipe.transcript.trim()) {
        transcriptEl.textContent = swipe.transcript;
        transcriptSection.style.display = 'block';
    } else {
        transcriptSection.style.display = 'none';
    }
    
    // Set link
    const link = document.getElementById('swipeDetailLink');
    if (swipe.adsLibraryUrl) {
        link.href = swipe.adsLibraryUrl;
        link.style.display = 'inline-flex';
    } else {
        link.style.display = 'none';
    }
    
    openModal('swipeDetailModal');
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    loadAdSwipes();
});

// Export functions
window.loadAdSwipes = loadAdSwipes;
window.renderAdSwipes = renderAdSwipes;
window.filterSwipes = filterSwipes;
window.openCompetitorSettings = openCompetitorSettings;
window.saveCompetitors = saveCompetitors;
window.openSwipeDetail = openSwipeDetail;
window.toggleSection = toggleSection;
window.initSortableSidebar = initSortableSidebar;
window.loadSidebarOrder = loadSidebarOrder;
window.saveSidebarOrder = saveSidebarOrder;

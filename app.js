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

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadAllData();
    initDragAndDrop();
    setDefaultDates();
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
        kanban: 'Kanban',
        activity: 'Activity',
        docs: 'Docs Hub',
        content: 'Content Intel',
        youtube: 'YouTube',
        instagram: 'Instagram',
        schedules: 'Schedules'
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
        loadBusiness()
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
// DOCS HUB
// ===========================================

let docFolderState = {
    selectedFolder: null,
    expandedFolders: new Set(['research', 'memory', 'reports'])
};

async function loadDocs() {
    const data = await loadJSON('docs-index');
    if (data && data.docs) {
        state.docs = data.docs;
        renderDocsTree();
        renderDocs();
    }
}

function buildFolderTree(docs) {
    const tree = {};
    
    docs.forEach(doc => {
        // Extract folder from path (e.g., "/research/file.md" -> "research")
        const pathParts = doc.path.split('/').filter(Boolean);
        const folder = pathParts.length > 1 ? pathParts[0] : 'root';
        
        if (!tree[folder]) {
            tree[folder] = {
                name: folder,
                docs: [],
                icon: getFolderIcon(folder)
            };
        }
        tree[folder].docs.push(doc);
    });
    
    // Sort docs within each folder by date (newest first)
    Object.values(tree).forEach(folder => {
        folder.docs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    });
    
    return tree;
}

function getFolderIcon(folder) {
    const icons = {
        research: '🔬',
        memory: '🧠',
        reports: '📊',
        root: '📄'
    };
    return icons[folder] || '📁';
}

function renderDocsTree() {
    const container = document.getElementById('docsTree');
    const searchTerm = document.getElementById('docsSearch').value.toLowerCase();
    
    let filteredDocs = state.docs;
    if (searchTerm) {
        filteredDocs = filteredDocs.filter(d => 
            d.title.toLowerCase().includes(searchTerm) ||
            d.path.toLowerCase().includes(searchTerm)
        );
    }
    
    const tree = buildFolderTree(filteredDocs);
    
    // Define folder order
    const folderOrder = ['research', 'memory', 'reports', 'root'];
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
                <div class="folder-header ${isSelected ? 'active' : ''}" onclick="selectFolder('${folderKey}')">
                    <svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                    <span class="folder-name">${folder.icon} ${displayName}</span>
                    <span class="folder-count">${folder.docs.length}</span>
                </div>
                <div class="folder-children">
                    ${folder.docs.map(doc => `
                        <div class="folder-doc ${state.selectedDoc?.path === doc.path ? 'active' : ''}" onclick="selectDoc('${doc.path}'); event.stopPropagation();">
                            <svg class="folder-doc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                            </svg>
                            <span>${escapeHtml(doc.title.replace(/^Daily Memory - /, '').replace(/^Content Intelligence Report - /, 'CI: '))}</span>
                        </div>
                    `).join('')}
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
    const searchTerm = document.getElementById('docsSearch').value.toLowerCase();
    
    let filtered = state.docs;
    
    // Filter by search
    if (searchTerm) {
        filtered = filtered.filter(d => 
            d.title.toLowerCase().includes(searchTerm) ||
            d.path.toLowerCase().includes(searchTerm)
        );
    }
    
    // Filter by selected folder
    if (docFolderState.selectedFolder) {
        filtered = filtered.filter(d => {
            const pathParts = d.path.split('/').filter(Boolean);
            const folder = pathParts.length > 1 ? pathParts[0] : 'root';
            return folder === docFolderState.selectedFolder;
        });
    }
    
    // Sort by date
    filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    
    // Get folder display name
    let headerText = 'All Documents';
    if (docFolderState.selectedFolder) {
        const name = docFolderState.selectedFolder === 'root' ? 'Other' : 
            docFolderState.selectedFolder.charAt(0).toUpperCase() + docFolderState.selectedFolder.slice(1);
        headerText = `${getFolderIcon(docFolderState.selectedFolder)} ${name}`;
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="docs-list-header">${headerText}</div>
            <div class="empty-state small">
                <p>No documents found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="docs-list-header">${headerText} <span style="font-weight: normal; color: #999;">(${filtered.length})</span></div>
        ${filtered.map(doc => `
            <div class="doc-item ${state.selectedDoc?.path === doc.path ? 'active' : ''}" onclick="selectDoc('${doc.path}')">
                <div class="doc-title">${escapeHtml(doc.title)}</div>
                <div class="doc-meta">
                    <span class="doc-category">${doc.category}</span>
                    <span>${doc.date}</span>
                </div>
            </div>
        `).join('')}
    `;
}

function filterDocs() {
    renderDocsTree();
    renderDocs();
}

function selectDoc(path) {
    const doc = state.docs.find(d => d.path === path);
    if (!doc) return;
    
    state.selectedDoc = doc;
    renderDocsTree();
    renderDocs();
    
    const preview = document.getElementById('docsPreview');
    
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
        renderYouTube();
    }
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
    }
}

function openYouTubeConfig() {
    openModal('ytConfigModal');
}

function saveYouTubeConfig() {
    const apiKey = document.getElementById('ytApiKey').value.trim();
    const channelId = document.getElementById('ytChannelId').value.trim();
    
    if (!state.youtube) state.youtube = {};
    state.youtube.config = {
        apiKey: apiKey,
        channelId: channelId
    };
    
    saveJSON('youtube', state.youtube);
    closeModal();
    
    // Add activity
    addActivity('system', 'Updated YouTube configuration', 'API key and channel ID saved');
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
    
    // 1:1 Clients
    if (b.oneone) {
        const oneonePercent = ((b.oneone.current / b.oneone.goal) * 100).toFixed(1);
        const oneoneSpots = b.oneone.goal - b.oneone.current;
        document.getElementById('oneoneCurrent').textContent = b.oneone.current;
        document.getElementById('oneoneGoal').textContent = b.oneone.goal;
        document.getElementById('oneonePercent').textContent = oneonePercent;
        document.getElementById('oneoneProgress').style.width = `${oneonePercent}%`;
        document.getElementById('oneoneSpots').textContent = oneoneSpots;
    }
    
    // VIP Clients
    if (b.vip) {
        const vipPercent = ((b.vip.current / b.vip.goal) * 100).toFixed(1);
        const vipSpots = b.vip.goal - b.vip.current;
        document.getElementById('vipCurrent').textContent = b.vip.current;
        document.getElementById('vipGoal').textContent = b.vip.goal;
        document.getElementById('vipPercent').textContent = vipPercent;
        document.getElementById('vipProgress').style.width = `${vipPercent}%`;
        document.getElementById('vipSpots').textContent = vipSpots;
    }
    
    // MRR Tracker
    if (b.mrr) {
        const mrrPercent = ((b.mrr.current / b.mrr.goal) * 100).toFixed(1);
        const mrrGap = b.mrr.goal - b.mrr.current;
        
        document.getElementById('mrrCurrent').textContent = formatNumber(b.mrr.current);
        document.getElementById('mrrGoal').textContent = formatNumber(b.mrr.goal);
        document.getElementById('mrrGap').textContent = formatNumber(mrrGap);
        document.getElementById('mrrProgress').style.width = `${mrrPercent}%`;
    }
    
    // Cash Collected
    if (b.cash) {
        document.getElementById('cashCurrent').textContent = formatNumber(b.cash.collectedThisMonth);
        document.getElementById('cashTarget').textContent = `Target: $${formatNumber(b.cash.targetThisMonth)}`;
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

const agents = {
    geeves: {
        name: 'Geeves',
        desc: 'Your EA — strategy, ops, research, everything',
        url: 'http://127.0.0.1:18789/?token=geeves-local-token-2026'
    },
    copy: {
        name: 'Copy',
        desc: 'Copywriting expert — hooks, emails, sales copy',
        url: null, // Will be configured later
        placeholder: true
    },
    close: {
        name: 'Close Bot', 
        desc: 'DM sales — Close By Chat methodology',
        url: null,
        placeholder: true
    },
    workshop: {
        name: 'Workshop',
        desc: 'Sales pages & workshop scripts',
        url: null,
        placeholder: true
    },
    content: {
        name: 'Content',
        desc: 'Social posts, video scripts, platform-specific',
        url: null,
        placeholder: true
    }
};

let chatOpen = false;
let currentAgent = 'geeves';
let chatLoaded = false;

function toggleChat() {
    const panel = document.getElementById('chatPanel');
    const overlay = document.getElementById('chatOverlay');
    
    chatOpen = !chatOpen;
    
    if (chatOpen) {
        panel.classList.add('open');
        overlay.classList.add('open');
        
        // Load chat iframe if not already loaded
        if (!chatLoaded) {
            loadChatIframe(currentAgent);
        }
    } else {
        panel.classList.remove('open');
        overlay.classList.remove('open');
    }
}

function loadChatIframe(agentId) {
    const agent = agents[agentId];
    const iframe = document.getElementById('chatIframe');
    const loading = document.getElementById('chatLoading');
    
    if (!agent) return;
    
    // Update agent info
    document.getElementById('chatAgentInfo').innerHTML = `
        <span class="agent-name">${agent.name}</span>
        <span class="agent-desc">${agent.desc}</span>
    `;
    
    if (agent.placeholder) {
        // Show placeholder for agents not yet configured
        loading.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🚧</div>
                <h3 style="margin-bottom: 8px;">${agent.name} Agent</h3>
                <p style="color: var(--text-tertiary); margin-bottom: 16px;">${agent.desc}</p>
                <p style="font-size: 13px; color: var(--text-tertiary);">
                    This specialized agent is coming soon!<br>
                    Ask Geeves to set it up for you.
                </p>
            </div>
        `;
        loading.classList.remove('hidden');
        iframe.src = 'about:blank';
        return;
    }
    
    if (agent.url) {
        loading.classList.remove('hidden');
        iframe.src = agent.url;
        
        iframe.onload = () => {
            loading.classList.add('hidden');
            chatLoaded = true;
        };
    }
}

function switchAgent(agentId) {
    currentAgent = agentId;
    chatLoaded = false;
    loadChatIframe(agentId);
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
window.filterDocs = filterDocs;
window.selectDoc = selectDoc;
window.selectFolder = selectFolder;
window.toggleAllFolders = toggleAllFolders;
window.addNote = addNote;
window.toggleNotes = toggleNotes;
window.copyToClipboard = copyToClipboard;
window.openYouTubeConfig = openYouTubeConfig;
window.saveYouTubeConfig = saveYouTubeConfig;
window.openIgSnapshotModal = openIgSnapshotModal;
window.saveIgSnapshot = saveIgSnapshot;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleSidebar = toggleSidebar;

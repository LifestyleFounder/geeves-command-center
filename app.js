/**
 * GEEVES COMMAND CENTER - Main Application
 * ========================================
 * Unified dashboard for Dan Harrison / LFG
 */

// Proxy Instagram CDN images through Cloudflare Worker to bypass CORS
function proxyImg(url) {
    if (!url || !url.includes('cdninstagram.com') && !url.includes('instagram.')) return url;
    return 'https://anthropic-proxy.dan-a14.workers.dev/img-proxy?url=' + encodeURIComponent(url);
}

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
        'ai-employees': 'AI Employees',
        reports: 'Reports',
        'knowledge-hub': 'Knowledge Hub',
        content: 'Content Intel',
        youtube: 'YouTube',
        instagram: 'Instagram',
        'meta-ads': 'Meta Ads',
        multiplier: 'Content Multiplier',
        competitors: 'Competitors',
        'vip-clients': 'VIP Clients',
        'google-tasks': 'Tasks'
    };
    document.getElementById('mobileTitle').textContent = titles[tabName] || tabName;
    
    state.currentTab = tabName;
    
    // Load VIP data on tab switch
    if (tabName === 'vip-clients' && typeof loadVIPClients === 'function') {
        loadVIPClients();
    }
    
    // Load competitor data on tab switch
    if (tabName === 'competitors' && typeof loadCompetitorData === 'function') {
        loadCompetitorData();
    }
    
    // Load Meta Ads data on tab switch
    if (tabName === 'meta-ads' && typeof loadMetaAds === 'function') {
        loadMetaAds();
    }
    
    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = ['taskDue'];
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
        initAgentHub(),
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
// AGENT HUB
// ===========================================

let agentHubData = { agents: [] };

async function initAgentHub() {
    const data = await loadJSON('agents');
    if (data && data.agents) {
        agentHubData = data;
        renderAgentCards();
    }
}

function renderAgentCards() {
    const container = document.getElementById('agentCardsGrid');
    if (!container) return;

    if (agentHubData.agents.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No agents configured</p></div>';
        return;
    }

    container.innerHTML = agentHubData.agents.map(agent => {
        const statusClass = agent.status === 'online' ? 'online' : agent.status === 'idle' ? 'idle' : 'offline';
        const statusLabel = agent.status.charAt(0).toUpperCase() + agent.status.slice(1);
        const lastActive = agent.lastActive ? formatRelativeTime(agent.lastActive) : 'Never';
        const currentTask = agent.currentTask || 'No active task';
        const capsHtml = (agent.capabilities || []).map(c => `<span class="agent-cap-pill">${escapeHtml(c)}</span>`).join('');

        return `
        <div class="agent-card" onclick="toggleAgentDetail('${agent.id}')">
            <div class="agent-card-header">
                <div class="agent-avatar">${agent.emoji}</div>
                <div class="agent-info">
                    <div class="agent-name-row">
                        <span class="agent-name">${escapeHtml(agent.name)}</span>
                        <span class="agent-status-dot ${statusClass}" title="${statusLabel}"></span>
                    </div>
                    <div class="agent-role">${escapeHtml(agent.role)}</div>
                </div>
            </div>
            <div class="agent-card-body">
                <div class="agent-meta-row">
                    <span class="agent-meta-label">Machine</span>
                    <span class="agent-meta-value">${escapeHtml(agent.machine)}</span>
                </div>
                <div class="agent-meta-row">
                    <span class="agent-meta-label">Current Task</span>
                    <span class="agent-meta-value ${!agent.currentTask ? 'muted' : ''}">${escapeHtml(currentTask)}</span>
                </div>
                <div class="agent-meta-row">
                    <span class="agent-meta-label">Tasks Done</span>
                    <span class="agent-meta-value">${agent.tasksCompleted}</span>
                </div>
                <div class="agent-meta-row">
                    <span class="agent-meta-label">Last Active</span>
                    <span class="agent-meta-value">${lastActive}</span>
                </div>
                ${capsHtml ? `<div class="agent-caps">${capsHtml}</div>` : ''}
            </div>
            <div class="agent-detail" id="agentDetail-${agent.id}" style="display:none;">
                <div class="agent-detail-header">Recent Activity</div>
                ${agent.recentActivity && agent.recentActivity.length > 0
                    ? `<div class="agent-timeline">${agent.recentActivity.slice(0, 10).map(a => {
                        const statusIcon = a.status === 'done' ? '✅' : a.status === 'in-progress' ? '⏳' : '❌';
                        const time = new Date(a.time);
                        const timeStr = time.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                        return `<div class="agent-timeline-item">
                            <span class="agent-timeline-icon">${statusIcon}</span>
                            <span class="agent-timeline-action">${escapeHtml(a.action)}</span>
                            <span class="agent-timeline-time">${timeStr}</span>
                        </div>`;
                    }).join('')}</div>`
                    : '<div class="agent-no-activity">No recent activity</div>'}
            </div>
        </div>`;
    }).join('');
}

function toggleAgentDetail(agentId) {
    const detail = document.getElementById('agentDetail-' + agentId);
    if (!detail) return;
    detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
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
    const folderParents = UserSettings.get('folderParents', {});
    customFolders.forEach(key => {
        if (!tree[key]) {
            tree[key] = { name: key, docs: [], icon: getFolderIcon(key) };
        }
        // Mark parent relationship
        if (folderParents[key]) {
            tree[key].parent = folderParents[key];
        }
    });
    
    // Build subfolder arrays
    Object.keys(tree).forEach(key => {
        tree[key].subfolders = [];
    });
    Object.keys(tree).forEach(key => {
        const parent = tree[key].parent;
        if (parent && tree[parent]) {
            tree[parent].subfolders = tree[parent].subfolders || [];
            tree[parent].subfolders.push(key);
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
    // Only show top-level folders (those without a parent)
    const topLevelFolders = Object.keys(tree).filter(k => !tree[k].parent).sort((a, b) => {
        const aIdx = folderOrder.indexOf(a);
        const bIdx = folderOrder.indexOf(b);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });
    const sortedFolders = topLevelFolders;
    
    if (sortedFolders.length === 0) {
        container.innerHTML = `
            <div class="empty-state small">
                <p>No folders found</p>
            </div>
        `;
        return;
    }
    
    // Helper to render a doc item
    function renderDocItem(doc) {
        const docKey = doc.isNote ? doc.id : doc.path;
        const isActive = state.selectedDoc && (state.selectedDoc.path === docKey || state.selectedDoc.id === docKey);
        return `
            <div class="kh-doc ${isActive ? 'active' : ''}"
                 draggable="true"
                 ondragstart="startDocDrag(event, '${docKey}', ${doc.isNote || false})"
                 onclick="selectDoc('${docKey}'); event.stopPropagation();">
                <div class="kh-doc-icon">${doc.isNote ? '📝' : '📄'}</div>
                <div class="kh-doc-info">
                    <div class="kh-doc-name">${escapeHtml(doc.title.replace(/^Daily Memory - /, '').replace(/^Content Intelligence Report - /, 'CI: '))}</div>
                    ${doc.date ? `<div class="kh-doc-date">${doc.date}</div>` : ''}
                </div>
            </div>`;
    }

    // Helper to render a folder section (used for both top-level and subfolders)
    function renderFolderSection(folderKey, folder, isSubfolder) {
        const isExpanded = docFolderState.expandedFolders.has(folderKey);
        const displayName = folderKey === 'root' ? 'Other' : folderKey.charAt(0).toUpperCase() + folderKey.slice(1);
        const totalDocs = folder.docs.length + (folder.subfolders || []).reduce((n, sk) => n + (tree[sk]?.docs.length || 0), 0);

        return `
            <div class="kh-category ${isExpanded ? 'expanded' : 'collapsed'} ${isSubfolder ? 'kh-subcategory' : ''}">
                <div class="kh-cat-header"
                     onclick="selectFolder('${folderKey}')"
                     ondragover="event.preventDefault(); this.classList.add('drag-over')"
                     ondragleave="this.classList.remove('drag-over')"
                     ondrop="dropOnFolder(event, '${folderKey}'); this.classList.remove('drag-over')">
                    <svg class="kh-cat-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                    <span class="kh-cat-icon">${folder.icon}</span>
                    <span class="kh-cat-name">${displayName}</span>
                    <span class="kh-cat-count">${totalDocs}</span>
                    <div class="kh-cat-actions">
                        <button class="kh-cat-btn" onclick="createSubFolder('${folderKey}'); event.stopPropagation();" title="Add subfolder">+</button>
                        <button class="kh-cat-btn danger" onclick="deleteFolder('${folderKey}'); event.stopPropagation();" title="Delete">✕</button>
                    </div>
                </div>
                <div class="kh-cat-body">
                    ${folder.docs.map(renderDocItem).join('')}
                    ${(folder.subfolders || []).map(subKey => {
                        const sub = tree[subKey];
                        return sub ? renderFolderSection(subKey, sub, true) : '';
                    }).join('')}
                </div>
            </div>`;
    }

    container.innerHTML = sortedFolders.map(folderKey => 
        renderFolderSection(folderKey, tree[folderKey], false)
    ).join('');
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
    if (!container) return; // docs list removed from UI — tree handles display
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

        // Always fetch latest content from Notion
        if (note.source === 'notion') {
            preview.innerHTML = `<div class="markdown-content"><p><em>Loading note from Notion...</em></p></div>`;
            const full = await NotionNotes.get(note.id);
            if (full) {
                note.content = NotionNotes.textToHtml(full.content);
                note._contentLoaded = true;
            }
        }

        const editBtn = `<button class="btn btn-secondary btn-sm" onclick="editNote('${note.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit
               </button>`;
        const notionBtn = note.source === 'notion' && note.notionUrl
            ? `<a href="${escapeHtml(note.notionUrl)}" target="_blank" class="btn btn-primary btn-sm">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    Open in Notion
               </a>`
            : '';

        preview.innerHTML = `
            <div class="markdown-content">
                <div class="note-preview-header">
                    <h1>${escapeHtml(note.title)}</h1>
                    <div class="note-preview-actions">
                        ${editBtn}
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
// INSTAGRAM — Creator Tracker
// ===========================================

let igCreators = [];
let igLatestSnapshots = [];
let igRecentPosts = [];
let igTopPostsCache = [];
let currentIGSubtab = 'feed';

async function loadInstagram() {
    CreatorScraper.init();
    if (!CreatorScraper.isReady()) return;
    // Load data in parallel
    const [creators, snapshots, posts] = await Promise.all([
        CreatorScraper.getCreators(),
        CreatorScraper.getLatestSnapshots(),
        CreatorScraper.getRecentPosts(30)
    ]);
    igCreators = creators;
    igLatestSnapshots = snapshots;
    igRecentPosts = posts;
    renderInstagram();
}

function renderInstagram() {
    renderIGFeed();
    renderIGCreators();
    populateIGCreatorFilter();
}

function switchIGSubtab(subtab) {
    currentIGSubtab = subtab;
    document.querySelectorAll('.ig-subtab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.igSubtab === subtab);
    });
    document.querySelectorAll('.ig-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === 'igPanel-' + subtab);
    });
    if (subtab === 'top-posts' && igTopPostsCache.length === 0) {
        renderIGTopPosts();
    }
}

// ── Feed ──────────────────────────────────────

function renderIGFeed() {
    const grid = document.getElementById('igFeedGrid');
    if (!igRecentPosts.length) {
        grid.innerHTML = '<div class="empty-state"><p>No posts yet. Add creators and run the scraper to see their feed here.</p></div>';
        return;
    }
    grid.innerHTML = igRecentPosts.map(post => {
        const creator = post.ig_creators || {};
        const caption = post.caption ? escapeHtml(post.caption).substring(0, 100) + (post.caption.length > 100 ? '...' : '') : '';
        const postedDate = post.posted_at ? new Date(post.posted_at).toLocaleDateString() : '';
        return `
            <div class="ig-post-card" onclick="showPostDetail('${post.id}')">
                ${post.thumbnail_url
                    ? `<div class="ig-post-thumb" style="background-image:url('${proxyImg(post.thumbnail_url)}')"></div>`
                    : `<div class="ig-post-thumb ig-post-thumb-empty">${post.post_type === 'Video' ? '🎬' : '📷'}</div>`
                }
                <div class="ig-post-info">
                    <div class="ig-post-creator">@${escapeHtml(creator.username || '?')}</div>
                    <div class="ig-post-caption">${caption}</div>
                    <div class="ig-post-stats">
                        <span>❤️ ${formatNumber(post.likes)}</span>
                        <span>💬 ${formatNumber(post.comments)}</span>
                        ${post.views ? `<span>👁 ${formatNumber(post.views)}</span>` : ''}
                    </div>
                    <div class="ig-post-date">${postedDate}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ── Creators ──────────────────────────────────

function renderIGCreators() {
    const tbody = document.getElementById('igCreatorsBody');
    if (!igCreators.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No creators tracked yet. Click "Add Creator" to start.</td></tr>';
        return;
    }
    // Build lookup: creator_id → snapshot
    const snapMap = {};
    igLatestSnapshots.forEach(s => { snapMap[s.creator_id] = s; });

    tbody.innerHTML = igCreators.map(c => {
        const snap = snapMap[c.id] || {};
        const scraped = snap.scraped_at ? new Date(snap.scraped_at).toLocaleDateString() : 'Never';
        return `
            <tr>
                <td>
                    <div style="display:flex;align-items:center;gap:8px">
                        ${c.profile_pic_url
                            ? `<img src="${c.profile_pic_url}" class="ig-avatar" alt="">`
                            : `<div class="ig-avatar ig-avatar-placeholder">📷</div>`
                        }
                        <div>
                            <strong>@${escapeHtml(c.username)}</strong>
                            ${c.full_name ? `<br><small style="color:var(--text-secondary)">${escapeHtml(c.full_name)}</small>` : ''}
                        </div>
                    </div>
                </td>
                <td>${formatNumber(snap.followers)}</td>
                <td>${formatNumber(snap.following)}</td>
                <td>${formatNumber(snap.posts_count)}</td>
                <td>${snap.engagement_rate != null ? snap.engagement_rate + '%' : '--'}</td>
                <td>${formatNumber(snap.avg_likes)}</td>
                <td>${scraped}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="removeIGCreator('${c.id}', '${escapeHtml(c.username)}')" title="Remove">✕</button>
                </td>
            </tr>
        `;
    }).join('');
}

function populateIGCreatorFilter() {
    const select = document.getElementById('igTopCreatorFilter');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">All Creators</option>' +
        igCreators.map(c => `<option value="${c.id}">${escapeHtml(c.username)}</option>`).join('');
    select.value = current;
}

// ── Top Posts ─────────────────────────────────

async function renderIGTopPosts() {
    const tbody = document.getElementById('igTopPostsBody');
    tbody.innerHTML = '<tr><td colspan="8" class="empty">Loading...</td></tr>';
    const creatorId = document.getElementById('igTopCreatorFilter')?.value || undefined;
    const sortBy = document.getElementById('igTopSortBy')?.value || 'likes';
    const posts = await CreatorScraper.getTopPosts({ creatorId: creatorId || undefined, sortBy, limit: 50 });
    igTopPostsCache = posts;
    if (!posts.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No posts yet.</td></tr>';
        return;
    }
    tbody.innerHTML = posts.map(post => {
        const creator = post.ig_creators || {};
        const caption = post.caption ? escapeHtml(post.caption).substring(0, 60) + (post.caption.length > 60 ? '...' : '') : '';
        const postedDate = post.posted_at ? new Date(post.posted_at).toLocaleDateString() : '';
        return `
            <tr class="clickable-row" onclick="showPostDetail('${post.id}')">
                <td>
                    ${post.thumbnail_url
                        ? `<img src="${proxyImg(post.thumbnail_url)}" class="ig-table-thumb" alt="">`
                        : `<span class="ig-table-thumb-empty">${post.post_type === 'Video' ? '🎬' : '📷'}</span>`
                    }
                </td>
                <td>@${escapeHtml(creator.username || '?')}</td>
                <td>${caption}</td>
                <td>${post.post_type || '--'}</td>
                <td>${formatNumber(post.likes)}</td>
                <td>${formatNumber(post.comments)}</td>
                <td>${formatNumber(post.views)}</td>
                <td>${postedDate}</td>
            </tr>
        `;
    }).join('');
}

// ── Add / Remove Creators ─────────────────────

function openAddCreatorModal() {
    document.getElementById('addCreatorUsername').value = '';
    openModal('addCreatorModal');
}

async function addIGCreator() {
    const input = document.getElementById('addCreatorUsername');
    const username = input.value.trim();
    if (!username) { alert('Please enter a username'); return; }
    const result = await CreatorScraper.addCreator(username);
    if (result) {
        closeModal();
        await loadInstagram();
        addActivity('task', 'Added IG creator', `@${username} added to tracking`);
    } else {
        alert('Failed to add creator. Check console for errors.');
    }
}

async function removeIGCreator(id, username) {
    if (!confirm(`Remove @${username} from tracking?`)) return;
    const ok = await CreatorScraper.removeCreator(id);
    if (ok) {
        await loadInstagram();
        addActivity('task', 'Removed IG creator', `@${username} removed from tracking`);
    }
}

// ── Post Detail Modal ─────────────────────────

async function showPostDetail(postId) {
    const body = document.getElementById('postDetailBody');
    body.innerHTML = '<p>Loading...</p>';
    openModal('postDetailModal');
    const post = await CreatorScraper.getPostById(postId);
    if (!post) { body.innerHTML = '<p>Post not found.</p>'; return; }
    const creator = post.ig_creators || {};
    const postedDate = post.posted_at ? new Date(post.posted_at).toLocaleString() : 'Unknown';
    body.innerHTML = `
        <div class="ig-detail-layout">
            ${post.thumbnail_url
                ? `<img src="${proxyImg(post.thumbnail_url)}" class="ig-detail-image" alt="">`
                : `<div class="ig-detail-image ig-detail-image-empty">${post.post_type === 'Video' ? '🎬' : '📷'}</div>`
            }
            <div class="ig-detail-meta">
                <div class="ig-detail-creator">@${escapeHtml(creator.username || '?')}${creator.full_name ? ' · ' + escapeHtml(creator.full_name) : ''}</div>
                <div class="ig-detail-stats">
                    <div class="ig-detail-stat"><span class="ig-detail-stat-val">${formatNumber(post.likes)}</span><span class="ig-detail-stat-label">Likes</span></div>
                    <div class="ig-detail-stat"><span class="ig-detail-stat-val">${formatNumber(post.comments)}</span><span class="ig-detail-stat-label">Comments</span></div>
                    ${post.views ? `<div class="ig-detail-stat"><span class="ig-detail-stat-val">${formatNumber(post.views)}</span><span class="ig-detail-stat-label">Views</span></div>` : ''}
                </div>
                <div class="ig-detail-type">${post.post_type || 'Post'} · ${postedDate}</div>
                ${post.caption ? `<div class="ig-detail-caption">${escapeHtml(post.caption)}</div>` : ''}
                ${post.post_url ? `<a href="${post.post_url}" target="_blank" rel="noopener" class="btn btn-secondary" style="margin-top:12px">View on Instagram</a>` : ''}
            </div>
        </div>
    `;
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
function deleteFolder(folderKey) {
    const builtIn = ['notes', 'research', 'root'];
    if (builtIn.includes(folderKey)) {
        if (typeof showToast === 'function') showToast('Cannot delete built-in folders');
        return;
    }
    
    if (!confirm(`Delete folder "${folderKey}"? Documents inside will move to "Other".`)) return;
    
    // Remove from custom folders
    let customFolders = UserSettings.get('customFolders', []);
    customFolders = customFolders.filter(f => f !== folderKey);
    UserSettings.set('customFolders', customFolders);
    
    // Move docs assigned to this folder back to root
    const assignments = UserSettings.get('docFolderAssignments', {});
    for (const [docPath, folder] of Object.entries(assignments)) {
        if (folder === folderKey) delete assignments[docPath];
    }
    UserSettings.set('docFolderAssignments', assignments);
    
    // Remove custom icon
    const icons = UserSettings.get('folderIcons', {});
    delete icons[folderKey];
    UserSettings.set('folderIcons', icons);
    
    // Clear selection if this folder was selected
    if (docFolderState.selectedFolder === folderKey) {
        docFolderState.selectedFolder = null;
    }
    docFolderState.expandedFolders.delete(folderKey);
    
    renderDocsTree();
    if (typeof showToast === 'function') showToast('Folder deleted');
}

function createSubFolder(parentKey) {
    const emojis = ['📁','📂','📝','📚','🔬','💡','🎯','💰','⚙️','🎨','📊','🗂️','📋','🏷️','🔖','💼','🧠','⭐','🔥','📎'];
    const overlay = document.createElement('div');
    overlay.className = 'folder-modal-overlay';
    overlay.innerHTML = `
        <div class="folder-modal">
            <h3>New Subfolder in ${parentKey.charAt(0).toUpperCase() + parentKey.slice(1)}</h3>
            <input type="text" class="folder-name-input" id="newSubFolderName" placeholder="Subfolder name..." autofocus>
            <div class="folder-emoji-label">Choose an icon:</div>
            <div class="folder-emoji-grid">
                ${emojis.map((e, i) => `<button class="folder-emoji-btn ${i === 0 ? 'selected' : ''}" data-emoji="${e}" onclick="pickFolderEmoji(this)">${e}</button>`).join('')}
            </div>
            <div class="folder-modal-actions">
                <button class="btn btn-secondary btn-sm" onclick="closeFolderModal()">Cancel</button>
                <button class="btn btn-primary btn-sm" onclick="saveSubFolderFromModal('${parentKey}')">Create</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#newSubFolderName').focus();
    overlay.querySelector('#newSubFolderName').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveSubFolderFromModal(parentKey);
        if (e.key === 'Escape') closeFolderModal();
    });
}

function saveSubFolderFromModal(parentKey) {
    const nameInput = document.getElementById('newSubFolderName');
    const selectedEmoji = document.querySelector('.folder-emoji-btn.selected');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) { nameInput && nameInput.focus(); return; }

    const key = name.toLowerCase().replace(/\s+/g, '-');
    const emoji = selectedEmoji ? selectedEmoji.dataset.emoji : '📁';

    let customFolders = UserSettings.get('customFolders', []);
    if (!customFolders.includes(key)) {
        customFolders.push(key);
        UserSettings.set('customFolders', customFolders);
    }

    let customIcons = UserSettings.get('customFolderIcons', {});
    customIcons[key] = emoji;
    UserSettings.set('customFolderIcons', customIcons);

    // Store parent relationship
    let folderParents = UserSettings.get('folderParents', {});
    folderParents[key] = parentKey;
    UserSettings.set('folderParents', folderParents);

    docFolderState.expandedFolders.add(key);
    docFolderState.expandedFolders.add(parentKey);
    closeFolderModal();
    renderDocsTree();
}

window.createSubFolder = createSubFolder;
window.saveSubFolderFromModal = saveSubFolderFromModal;
window.deleteFolder = deleteFolder;
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
window.openAddCreatorModal = openAddCreatorModal;
window.addIGCreator = addIGCreator;
window.removeIGCreator = removeIGCreator;
window.switchIGSubtab = switchIGSubtab;
window.showPostDetail = showPostDetail;
window.renderIGTopPosts = renderIGTopPosts;
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
    
    // Track expanded state for KB categories
    if (!window._kbExpanded) window._kbExpanded = new Set(Object.keys(categories));
    // Auto-add new categories
    Object.keys(categories).forEach(k => { if (!window._kbExpanded.has(k) && window._kbExpanded.size < 20) window._kbExpanded.add(k); });
    
    container.innerHTML = Object.entries(categories).map(([cat, docs]) => {
        const isExpanded = window._kbExpanded.has(cat);
        return `
        <div class="knowledge-category ${isExpanded ? 'expanded' : 'collapsed'}">
            <div class="category-header" onclick="toggleKBCategory('${cat}')">
                <svg class="kh-cat-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <polyline points="6 9 12 15 18 9"/>
                </svg>
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
        </div>`;
    }).join('');
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

// Save uploaded document (handles both create and edit)
async function saveUploadedDocument() {
    const name = document.getElementById('docName').value.trim();
    const category = document.getElementById('docCategory').value;
    const content = document.getElementById('docContent').value.trim();
    const tags = document.getElementById('docTags').value.split(',').map(t => t.trim()).filter(Boolean);
    
    if (!name || !content) {
        alert('Please provide a name and content');
        return;
    }
    
    const modal = document.getElementById('uploadDocModal');
    const editingId = modal?.dataset.editingId;
    
    if (editingId) {
        // Update existing document
        let doc = documentLibrary.documents.find(d => d.id === editingId) ||
                  documentLibrary.notionDocs.find(d => d.id === editingId);
        if (doc) {
            doc.name = name;
            doc.category = category;
            doc.content = content;
            doc.tags = tags;
            doc.updatedAt = new Date().toISOString();
        }
        // Clear editing state
        delete modal.dataset.editingId;
    } else {
        // Create new document — push to Notion if API key is configured
        const apiKey = localStorage.getItem('notionApiKey');
        let notionPage = null;
        
        if (apiKey) {
            try {
                notionPage = await createNotionDoc(name, content, category);
            } catch (e) {
                console.error('Notion create failed:', e);
            }
        }
        
        if (notionPage) {
            // Created in Notion — add to notionDocs
            documentLibrary.notionDocs.push({
                id: notionPage.id,
                name,
                type: 'notion',
                category: category || 'uncategorized',
                content,
                tags,
                notionUrl: notionPage.url,
                lastSynced: new Date().toISOString()
            });
        } else {
            // Local-only fallback
            documentLibrary.documents.push({
                id: 'doc-' + Date.now(),
                name,
                type: 'local',
                category,
                content,
                tags,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
    }
    
    saveDocumentLibrary();
    renderDocumentLibrary();
    closeModal();
    if (typeof showToast === 'function') showToast(editingId ? 'Document updated ✓' : 'Document saved ✓');
    
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
                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
                    <h2>${escapeHtml(doc.name)}</h2>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="btn-sm" id="docEditToggle" onclick="toggleDocEditMode('${doc.id}')">✏️ Edit</button>
                        <button class="btn-sm btn-green" id="docSaveBtn" onclick="saveDocInline('${doc.id}')" style="display:none;">💾 Save</button>
                    </div>
                </div>
                <div class="doc-preview-meta">
                    <span class="doc-category">${doc.category || 'uncategorized'}</span>
                    ${doc.tags ? doc.tags.map(t => `<span class="doc-tag">${t}</span>`).join('') : ''}
                </div>
            </div>
            <div class="doc-preview-content" id="docPreviewContent">
                ${formatMarkdown(doc.content)}
            </div>
            <textarea class="doc-edit-area" id="docEditArea" style="display:none;">${escapeHtml(doc.content || '')}</textarea>
            <div class="doc-preview-footer">
                <small>Use <code>@${doc.type === 'notion' ? 'notion' : 'doc'}:${doc.name.toLowerCase().replace(/\s+/g, '-')}</code> to reference in chat</small>
            </div>
        `;
    }
}

function toggleDocEditMode(docId) {
    const contentEl = document.getElementById('docPreviewContent');
    const editArea = document.getElementById('docEditArea');
    const editBtn = document.getElementById('docEditToggle');
    const saveBtn = document.getElementById('docSaveBtn');
    
    if (editArea.style.display === 'none') {
        // Switch to edit mode
        contentEl.style.display = 'none';
        editArea.style.display = 'block';
        editBtn.textContent = '👁️ Preview';
        saveBtn.style.display = 'inline-flex';
        editArea.focus();
    } else {
        // Switch to preview mode
        contentEl.innerHTML = formatMarkdown(editArea.value);
        contentEl.style.display = 'block';
        editArea.style.display = 'none';
        editBtn.textContent = '✏️ Edit';
        saveBtn.style.display = 'none';
    }
}

async function saveDocInline(docId) {
    const editArea = document.getElementById('docEditArea');
    if (!editArea) return;
    
    const saveBtn = document.getElementById('docSaveBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Saving...'; }
    
    const newContent = editArea.value;
    let doc = documentLibrary.documents.find(d => d.id === docId) ||
              documentLibrary.notionDocs.find(d => d.id === docId);
    
    if (doc) {
        doc.content = newContent;
        doc.updatedAt = new Date().toISOString();
        
        // Push to Notion if it's a Notion doc
        if (doc.type === 'notion' && doc.id) {
            try {
                await updateNotionDoc(doc.id, newContent);
                doc.lastSynced = new Date().toISOString();
            } catch (e) {
                console.error('Notion update failed:', e);
                if (typeof showToast === 'function') showToast('⚠️ Saved locally but Notion sync failed');
            }
        }
        
        saveDocumentLibrary();
        
        // Update preview
        const contentEl = document.getElementById('docPreviewContent');
        if (contentEl) contentEl.innerHTML = formatMarkdown(newContent);
        
        // Switch back to preview mode
        contentEl.style.display = 'block';
        editArea.style.display = 'none';
        document.getElementById('docEditToggle').textContent = '✏️ Edit';
        if (saveBtn) { saveBtn.style.display = 'none'; saveBtn.disabled = false; saveBtn.textContent = '💾 Save'; }
        
        renderDocumentLibrary();
        if (typeof showToast === 'function') showToast('Document saved ✓');
    }
}

window.toggleDocEditMode = toggleDocEditMode;
window.saveDocInline = saveDocInline;

// Docs sidebar resize handle
(function initDocsResize() {
    const handle = document.getElementById('docsResizeHandle');
    if (!handle) return;
    const container = handle.closest('.docs-container');
    let startX, startWidth;
    
    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startX = e.clientX;
        startWidth = document.getElementById('docsSidebar').offsetWidth;
        handle.classList.add('dragging');
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', onStop);
    });
    
    function onDrag(e) {
        const newWidth = Math.max(180, Math.min(600, startWidth + (e.clientX - startX)));
        container.style.setProperty('--docs-sidebar-width', newWidth + 'px');
        container.style.gridTemplateColumns = `${newWidth}px 6px 1fr`;
    }
    
    function onStop() {
        handle.classList.remove('dragging');
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', onStop);
    }
})();

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

// Convert markdown text to Notion blocks
function markdownToNotionBlocks(text) {
    if (!text) return [];
    return text.split('\n').filter(line => line.trim()).map(line => {
        // Headings
        if (line.startsWith('### ')) return { object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: line.slice(4) } }] } };
        if (line.startsWith('## ')) return { object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: line.slice(3) } }] } };
        if (line.startsWith('# ')) return { object: 'block', type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] } };
        // Bullet list
        if (line.startsWith('- ')) return { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] } };
        // Paragraph
        return { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: line } }] } };
    });
}

// Create a new page in Notion Docs database
async function createNotionDoc(name, content, category) {
    const apiKey = localStorage.getItem('notionApiKey');
    if (!apiKey) throw new Error('Notion API key not configured');
    
    const PROXY_URL = 'https://anthropic-proxy.dan-a14.workers.dev/notion';
    const databaseId = documentLibrary.notionSync.databaseId || '1b3ff8c6-2c63-4941-bad2-1876bd405333';
    
    const properties = {
        Name: { title: [{ text: { content: name } }] }
    };
    if (category && category !== 'uncategorized') {
        properties.Category = { select: { name: category.charAt(0).toUpperCase() + category.slice(1) } };
    }
    
    const blocks = markdownToNotionBlocks(content);
    
    const res = await fetch(`${PROXY_URL}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Notion-Token': apiKey },
        body: JSON.stringify({
            parent: { database_id: databaseId },
            properties,
            children: blocks.slice(0, 100) // Notion limit: 100 blocks per request
        })
    });
    
    if (!res.ok) throw new Error('Notion create failed: ' + res.status);
    return await res.json();
}

// Update an existing Notion page's content (replace all blocks)
async function updateNotionDoc(pageId, content) {
    const apiKey = localStorage.getItem('notionApiKey');
    if (!apiKey) throw new Error('Notion API key not configured');
    
    const PROXY_URL = 'https://anthropic-proxy.dan-a14.workers.dev/notion';
    
    // First, get existing blocks to delete them
    const blocksRes = await fetch(`${PROXY_URL}/blocks/${pageId}/children?page_size=100`, {
        headers: { 'X-Notion-Token': apiKey }
    });
    
    if (blocksRes.ok) {
        const existing = await blocksRes.json();
        // Delete existing blocks
        for (const block of (existing.results || [])) {
            await fetch(`${PROXY_URL}/blocks/${block.id}`, {
                method: 'DELETE',
                headers: { 'X-Notion-Token': apiKey }
            });
        }
    }
    
    // Append new blocks
    const blocks = markdownToNotionBlocks(content);
    if (blocks.length > 0) {
        const appendRes = await fetch(`${PROXY_URL}/blocks/${pageId}/children`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-Notion-Token': apiKey },
            body: JSON.stringify({ children: blocks.slice(0, 100) })
        });
        if (!appendRes.ok) throw new Error('Notion append failed: ' + appendRes.status);
    }
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
function toggleKBCategory(cat) {
    if (!window._kbExpanded) window._kbExpanded = new Set();
    if (window._kbExpanded.has(cat)) {
        window._kbExpanded.delete(cat);
    } else {
        window._kbExpanded.add(cat);
    }
    renderDocumentLibrary();
}
window.toggleKBCategory = toggleKBCategory;
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

// Meta Ads time range state
let metaAdsRange = '7d';

// Load Meta Ads data from API
async function loadMetaAds(range) {
    if (range) metaAdsRange = range;

    // Update range button states
    document.querySelectorAll('.ma-range-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === metaAdsRange);
    });

    // Show loading state
    const updateStat = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    updateStat('metaLastUpdated', 'Loading...');

    const apiUrl = `/api/meta-ads?range=${metaAdsRange}&t=${Date.now()}`;

    try {
        const response = await fetch(apiUrl);
        if (response.ok) {
            const data = await response.json();
            
            // Extract appointments + applications from actions
            metaAdsData = {
                lastUpdated: data.updatedAt,
                summary: {
                    spend: data.totals.spend,
                    results: data.totals.results,
                    costPerResult: data.totals.costPerResult,
                    impressions: data.totals.impressions,
                    clicks: data.totals.clicks,
                    ctr: data.totals.ctr,
                    applications: data.totals.applications || 0,
                    costPerApplication: data.totals.costPerApplication || 0
                },
                campaigns: data.campaigns.map(c => ({
                    name: c.name,
                    status: c.spend > 0 ? 'ACTIVE' : 'PAUSED',
                    spend: c.spend,
                    impressions: c.impressions,
                    clicks: c.clicks,
                    ctr: c.ctr,
                    results: c.results,
                    resultType: c.resultType,
                    costPerResult: c.costPerResult,
                    applications: c.applications || 0
                })),
                daily: data.daily || [],
                range: data.range,
                since: data.since,
                until: data.until
            };
            renderMetaAds();
            return;
        }
    } catch (e) {
        console.log('Meta Ads API not available, falling back to static data');
    }
    
    // Fallback: try static data file
    try {
        const response = await fetch(`data/meta-ads.json?t=${Date.now()}`);
        if (response.ok) {
            metaAdsData = await response.json();
            renderMetaAds();
        }
    } catch (e) {
        console.log('No meta-ads.json found');
    }
}

// Save Meta Ads data
function saveMetaAds() {
    localStorage.setItem('geeves-meta-ads', JSON.stringify(metaAdsData));
}

// Chart instances for cleanup
let maSpendChartInstance = null;
let maLeadsChartInstance = null;

// Render Meta Ads data
function renderMetaAds() {
    const { summary, campaigns, daily, lastUpdated } = metaAdsData;
    
    const updateStat = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    
    const rangeLabel = metaAdsRange === 'today' ? 'Today' : metaAdsRange === '30d' ? '30d' : '7d';
    updateStat('metaSpendLabel', `Ad Spend (${rangeLabel})`);
    updateStat('metaSpend', '$' + (summary.spend || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}));
    updateStat('metaLeads', (summary.results || 0).toLocaleString());
    updateStat('metaCPL', summary.costPerResult > 0 ? '$' + summary.costPerResult.toFixed(2) : '$0');
    updateStat('metaImpressions', formatCompactNumber(summary.impressions || 0));
    updateStat('metaApplications', (summary.applications || 0).toLocaleString());
    updateStat('metaCostPerApp', summary.costPerApplication > 0 ? '$' + summary.costPerApplication.toFixed(2) : '$0');
    
    // Last updated
    const lastUpdatedEl = document.getElementById('metaLastUpdated');
    if (lastUpdatedEl && lastUpdated) {
        lastUpdatedEl.textContent = 'Last updated: Just now';
    }
    
    // Campaigns table
    const campaignsBody = document.getElementById('metaCampaignsBody');
    if (campaignsBody) {
        if (campaigns && campaigns.length > 0) {
            campaignsBody.innerHTML = campaigns.map(c => {
                return `<tr>
                    <td><strong>${escapeHtml(c.name)}</strong></td>
                    <td><span class="status-badge ${c.status === 'ACTIVE' ? 'active' : 'paused'}">${c.status}</span></td>
                    <td>$${(c.spend || 0).toFixed(2)}</td>
                    <td>${formatCompactNumber(c.impressions || 0)}</td>
                    <td>${(c.clicks || 0).toLocaleString()}</td>
                    <td>${c.ctr ? c.ctr.toFixed(2) + '%' : '—'}</td>
                    <td>${c.results || 0}</td>
                    <td>${c.costPerResult ? '$' + c.costPerResult.toFixed(2) : '—'}</td>
                    <td>${c.applications || 0}</td>
                    <td>${c.applications > 0 ? '$' + (c.spend / c.applications).toFixed(2) : '—'}</td>
                </tr>`;
            }).join('');
        } else {
            campaignsBody.innerHTML = '<tr><td colspan="10" class="empty">No campaign data</td></tr>';
        }
    }
    
    // Charts
    renderMetaCharts(daily);
}

function renderMetaCharts(daily) {
    if (!daily || daily.length === 0 || typeof Chart === 'undefined') return;
    
    const labels = daily.map(d => {
        const date = new Date(d.date + 'T12:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const spendData = daily.map(d => d.spend || 0);
    const leadsData = daily.map(d => d.results || d.leads || 0);
    const appsData = daily.map(d => d.applications || 0);

    // Destroy old charts
    if (maSpendChartInstance) { maSpendChartInstance.destroy(); maSpendChartInstance = null; }
    if (maLeadsChartInstance) { maLeadsChartInstance.destroy(); maLeadsChartInstance = null; }

    const spendCtx = document.getElementById('maSpendChart');
    const leadsCtx = document.getElementById('maLeadsChart');
    if (!spendCtx || !leadsCtx) return;

    maSpendChartInstance = new Chart(spendCtx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Daily Spend',
                data: spendData,
                borderColor: '#2d5016',
                backgroundColor: 'rgba(45,80,22,0.15)',
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#2d5016'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => '$' + v } },
                x: { grid: { display: false } }
            }
        }
    });

    maLeadsChartInstance = new Chart(leadsCtx, {
        data: {
            labels,
            datasets: [
                {
                    type: 'line',
                    label: 'Leads',
                    data: leadsData,
                    borderColor: '#2d5016',
                    backgroundColor: 'rgba(45,80,22,0.15)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#2d5016',
                    order: 1
                },
                {
                    type: 'bar',
                    label: 'Applications',
                    data: appsData,
                    backgroundColor: 'rgba(193,154,72,0.8)',
                    borderRadius: 4,
                    barPercentage: 0.4,
                    order: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } },
            scales: {
                y: { beginAtZero: true },
                x: { grid: { display: false } }
            }
        }
    });
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

// Refresh Meta Ads (from API) — now delegates to Vercel serverless
async function refreshMetaAds() {
    // Use Vercel serverless API (env vars handle auth)
    loadMetaAds();
    return;
    
    // Legacy code below (kept for reference)
    const token = localStorage.getItem('metaAccessToken');
    const adAccountId = localStorage.getItem('metaAdAccountId');
    
    if (!token || !adAccountId) {
        // No longer needed — Vercel handles auth via env vars
        loadMetaAds();
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
        loadMetaAds();
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

// Hardcoded default sidebar order — consistent across all devices
const DEFAULT_SIDEBAR_ORDER = [
    'google-tasks', 'business', 'meta-ads', 'competitors',
    'tracker', 'vip-clients', 'knowledge-hub', 'youtube',
    'agent-hub', 'reports'
];

// Tabs to hide completely
const HIDDEN_TABS = ['content', 'multiplier', 'instagram'];

let sidebarOrder = [];

// Load sidebar order (always use hardcoded default)
function loadSidebarOrder() {
    sidebarOrder = [...DEFAULT_SIDEBAR_ORDER];
    applySidebarOrder();
}

// Save sidebar order (no-op — using hardcoded order)
function saveSidebarOrder() {
    // Intentionally disabled — order is hardcoded in DEFAULT_SIDEBAR_ORDER
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

    // Hide tabs that should be removed
    HIDDEN_TABS.forEach(tabId => {
        if (itemMap[tabId]) {
            itemMap[tabId].style.display = 'none';
        }
    });
    
    // Reorder based on hardcoded order
    sidebarOrder.forEach(tabId => {
        if (itemMap[tabId]) {
            navList.appendChild(itemMap[tabId]);
        }
    });

    // Append any remaining visible tabs not in the order (future-proofing)
    items.forEach(item => {
        if (!sidebarOrder.includes(item.dataset.tab) && !HIDDEN_TABS.includes(item.dataset.tab)) {
            navList.appendChild(item);
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
            
            // Check if localStorage has newer competitor edits and merge them
            const competitorData = localStorage.getItem('geeves-ad-swipes-competitors');
            if (competitorData) {
                try {
                    const competitorInfo = JSON.parse(competitorData);
                    // Use localStorage competitors if they exist (indicating user edits)
                    if (competitorInfo.competitors && competitorInfo.competitors.length > 0) {
                        adSwipesData.competitors = competitorInfo.competitors;
                        // Re-save the merged data to localStorage
                        localStorage.setItem('geeves-ad-swipes', JSON.stringify(adSwipesData));
                    }
                } catch (e) {
                    console.log('Error parsing competitor data:', e);
                }
            }
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
    
    // Populate audience filter
    const audienceFilter = document.getElementById('swipeFilterAudience');
    if (audienceFilter && adSwipesData.swipes) {
        const currentValue = audienceFilter.value;
        const audiences = [...new Set(adSwipesData.swipes
            .map(s => s.targetAudience)
            .filter(Boolean)
            .map(audience => audience.split(/[,;]/)[0].trim()))] // Take first part if comma-separated
            .sort();
        
        audienceFilter.innerHTML = '<option value="all">All Audiences</option>' +
            audiences.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
        audienceFilter.value = currentValue || 'all';
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
                ${swipe.hookType ? `<span class="swipe-hook-badge hook-${swipe.hookType}">${swipe.hookType}</span>` : ''}
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
    const hookType = document.getElementById('swipeFilterHookType')?.value || 'all';
    const audience = document.getElementById('swipeFilterAudience')?.value || 'all';
    const category = document.getElementById('swipeFilterCategory')?.value || 'all';
    
    return (adSwipesData.swipes || []).filter(swipe => {
        if (competitor !== 'all' && swipe.advertiser !== competitor) return false;
        if (type !== 'all' && swipe.mediaType !== type) return false;
        if (hookType !== 'all' && swipe.hookType !== hookType) return false;
        if (audience !== 'all' && (!swipe.targetAudience || !swipe.targetAudience.toLowerCase().includes(audience.toLowerCase()))) return false;
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
        
        // Also save to separate localStorage key for persistence across reloads
        const competitorData = {
            competitors: competitors,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('geeves-ad-swipes-competitors', JSON.stringify(competitorData));
        
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
    document.getElementById('swipeDetailAudience').textContent = swipe.targetAudience || 'Audience analysis coming soon...';
    document.getElementById('swipeDetailFramework').textContent = swipe.hookFramework || 'Framework analysis coming soon...';
    document.getElementById('swipeDetailStructure').textContent = swipe.copyStructure || 'Structure analysis coming soon...';
    
    // Handle swipeable elements array
    const elementsEl = document.getElementById('swipeDetailElements');
    if (swipe.swipeElements && Array.isArray(swipe.swipeElements) && swipe.swipeElements.length > 0) {
        elementsEl.innerHTML = swipe.swipeElements.map(element => `<span class="element-tag">${element}</span>`).join('');
    } else {
        elementsEl.textContent = 'Element analysis coming soon...';
    }
    
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

// ═══════════════════════════════════════════════
// COMPETITORS TAB (IG Content Analysis)
// ═══════════════════════════════════════════════
const SUPABASE_URL = 'https://nzppfxttbqrgwjofxqfm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56cHBmeHR0YnFyZ3dqb2Z4cWZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYwMzc0NCwiZXhwIjoyMDg3MTc5NzQ0fQ.c09wGidcUfUPODNAGXdZEDBaZIdLcXew5ePzCN-zeKM';

let competitorData = {
    posts: [],
    creators: [],
    loaded: false,
    loading: false
};

async function supabaseFetch(table, query = '') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
    return res.json();
}

async function loadCompetitorData(force = false) {
    if (competitorData.loading) return;
    if (competitorData.loaded && !force) return;

    competitorData.loading = true;
    
    const grid = document.getElementById('compPostsGrid');
    if (grid) grid.innerHTML = '<div class="empty-state"><p>⏳ Loading competitor data...</p></div>';

    try {
        const [posts, creators] = await Promise.all([
            supabaseFetch('ig_posts', '?select=*&order=posted_at.desc.nullslast&limit=500'),
            supabaseFetch('ig_creators', '?select=*')
        ]);

        // Build creator lookup map (id → username)
        const creatorMap = {};
        (creators || []).forEach(c => { creatorMap[c.id] = c.username; });
        // Enrich posts with creator_username
        (posts || []).forEach(p => {
            if (!p.creator_username && p.creator_id) {
                p.creator_username = creatorMap[p.creator_id] || 'unknown';
            }
        });
        competitorData.posts = posts || [];
        competitorData.creators = creators || [];
        competitorData.creatorMap = creatorMap;
        competitorData.loaded = true;

        populateCompFilters();
        renderCompStats();
        renderCompetitorPosts();
        renderHookLibrary();
    } catch (err) {
        console.error('Competitor data load failed:', err);
        if (grid) grid.innerHTML = `<div class="empty-state"><p>❌ Failed to load data</p><small>${escapeHtml(err.message)}</small></div>`;
    } finally {
        competitorData.loading = false;
    }
}

function populateCompFilters() {
    const posts = competitorData.posts;
    const creators = competitorData.creators;

    // Creator dropdown
    const creatorSel = document.getElementById('compFilterCreator');
    if (!creatorSel) return; // Tab HTML not loaded yet
    const creatorNames = [...new Set(creators.map(c => c.username).concat(posts.map(p => p.creator_username)).filter(Boolean))].sort();
    creatorSel.innerHTML = '<option value="all">All Creators</option>' +
        creatorNames.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

    // Hook Structure
    const hookStructures = [...new Set(posts.map(p => p.hook_structure).filter(Boolean))].sort();
    const hsSel = document.getElementById('compFilterHookStructure');
    hsSel.innerHTML = '<option value="all">All Hook Structures</option>' +
        hookStructures.map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('');

    // Content Structure
    const contentStructures = [...new Set(posts.map(p => p.content_structure).filter(Boolean))].sort();
    const csSel = document.getElementById('compFilterContentStructure');
    csSel.innerHTML = '<option value="all">All Content Structures</option>' +
        contentStructures.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

    // Visual Format
    const visualFormats = [...new Set(posts.map(p => p.visual_format).filter(Boolean))].sort();
    const vfSel = document.getElementById('compFilterVisualFormat');
    vfSel.innerHTML = '<option value="all">All Visual Formats</option>' +
        visualFormats.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
}

function renderCompStats() {
    const posts = competitorData.posts;
    const creators = competitorData.creators;
    const $ = id => document.getElementById(id) || {};

    $('compTotalPosts').textContent = posts.length;
    $('compCreatorCount').textContent = creators.length || [...new Set(posts.map(p => p.creator_username))].length;

    const hookCounts = {};
    posts.forEach(p => { if (p.hook_structure) hookCounts[p.hook_structure] = (hookCounts[p.hook_structure] || 0) + 1; });
    const topHook = Object.entries(hookCounts).sort((a, b) => b[1] - a[1])[0];
    $('compTopHookStructure').textContent = topHook ? topHook[0] : '--';

    const contentCounts = {};
    posts.forEach(p => { if (p.content_structure) contentCounts[p.content_structure] = (contentCounts[p.content_structure] || 0) + 1; });
    const topContent = Object.entries(contentCounts).sort((a, b) => b[1] - a[1])[0];
    $('compTopContentStructure').textContent = topContent ? topContent[0] : '--';

    const viewPosts = posts.filter(p => p.views);
    const avgViews = viewPosts.length > 0 ? Math.round(viewPosts.reduce((s, p) => s + p.views, 0) / viewPosts.length) : 0;
    $('compAvgViews').textContent = formatCompactNumber(avgViews);
}

function getFilteredCompPosts() {
    let filtered = [...competitorData.posts];

    const creator = document.getElementById('compFilterCreator')?.value;
    const hookStructure = document.getElementById('compFilterHookStructure')?.value;
    const contentStructure = document.getElementById('compFilterContentStructure')?.value;
    const visualFormat = document.getElementById('compFilterVisualFormat')?.value;
    const sortBy = document.getElementById('compSortBy')?.value || 'posted_at';

    if (creator && creator !== 'all') filtered = filtered.filter(p => p.creator_username === creator);
    if (hookStructure && hookStructure !== 'all') filtered = filtered.filter(p => p.hook_structure === hookStructure);
    if (contentStructure && contentStructure !== 'all') filtered = filtered.filter(p => p.content_structure === contentStructure);
    if (visualFormat && visualFormat !== 'all') filtered = filtered.filter(p => p.visual_format === visualFormat);

    filtered.sort((a, b) => {
        if (sortBy === 'views') return (b.views || 0) - (a.views || 0);
        if (sortBy === 'likes') return (b.likes || 0) - (a.likes || 0);
        if (sortBy === 'comments') return (b.comments || 0) - (a.comments || 0);
        return (b.posted_at || '').localeCompare(a.posted_at || '');
    });

    return filtered;
}

function renderCompetitorPosts() {
    const grid = document.getElementById('compPostsGrid');
    const filtered = getFilteredCompPosts();

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No posts match your filters</p></div>';
        return;
    }

    grid.innerHTML = filtered.map(post => {
        return `
        <div class="comp-post-card">
            <!-- @username + date at top -->
            <div class="comp-post-header">
                <span class="comp-creator">@${escapeHtml(post.creator_username || 'unknown')}</span>
                <span class="comp-date">${post.posted_at ? formatDate(post.posted_at) : '--'}</span>
            </div>

            <!-- Thumbnail image - 4:5 aspect ratio -->
            <div class="comp-thumb-wrap">
                <img class="comp-thumb-img" src="${proxyImg(post.thumbnail_url)}" alt="" onerror="this.parentElement.style.display='none'">
            </div>

            <!-- Stats bar underneath image -->
            <div class="comp-stats-bar">
                <div class="comp-stat-item">
                    <span class="comp-stat-number">${formatCompactNumber(post.views)}</span>
                    <span class="comp-stat-label">views</span>
                </div>
                <div class="comp-stat-item">
                    <span class="comp-stat-number">${formatCompactNumber(post.likes)}</span>
                    <span class="comp-stat-label">likes</span>
                </div>
                <div class="comp-stat-item">
                    <span class="comp-stat-number">${formatCompactNumber(post.comments)}</span>
                    <span class="comp-stat-label">comments</span>
                </div>
            </div>

            <!-- Hook Framework (if exists) -->
            ${post.hook_framework ? `
            <div class="comp-hook-framework">
                <div class="comp-framework-text">"${escapeHtml(post.hook_framework)}"</div>
            </div>` : ''}

            <!-- Analysis fields below -->
            <div class="comp-analysis">
                ${post.hook_structure ? `<div class="comp-detail"><span class="comp-label">Hook Structure</span><span class="comp-value">${escapeHtml(post.hook_structure)}</span></div>` : ''}
                ${post.content_structure ? `<div class="comp-detail"><span class="comp-label">Content Structure</span><span class="comp-value">${escapeHtml(post.content_structure)}</span></div>` : ''}
                ${post.visual_format ? `<div class="comp-detail"><span class="comp-label">Visual Format</span><span class="comp-value">${escapeHtml(post.visual_format)}</span></div>` : ''}
                ${post.visual_hook ? `<div class="comp-detail"><span class="comp-label">Visual Hook</span><span class="comp-value">${escapeHtml(post.visual_hook)}</span></div>` : ''}
                ${post.text_hook ? `<div class="comp-detail"><span class="comp-label">Text Hook</span><span class="comp-value">${escapeHtml(post.text_hook)}</span></div>` : ''}
                ${post.spoken_hook ? `<div class="comp-detail"><span class="comp-label">Spoken Hook</span><span class="comp-value">${escapeHtml(post.spoken_hook)}</span></div>` : ''}
                ${post.topic ? `<div class="comp-detail"><span class="comp-label">Topic</span><span class="comp-value">${escapeHtml(post.topic)}</span></div>` : ''}
                ${post.summary ? `<div class="comp-detail"><span class="comp-label">Summary</span><span class="comp-value">${escapeHtml(post.summary)}</span></div>` : ''}
                ${post.cta ? `<div class="comp-detail"><span class="comp-label">CTA</span><span class="comp-value">${escapeHtml(post.cta)}</span></div>` : ''}
            </div>

            <!-- Badges -->
            <div class="comp-badges">
                ${post.hook_structure ? `<span class="comp-badge hook-structure">${escapeHtml(post.hook_structure)}</span>` : ''}
                ${post.content_structure ? `<span class="comp-badge content-structure">${escapeHtml(post.content_structure)}</span>` : ''}
                ${post.visual_format ? `<span class="comp-badge visual-format">${escapeHtml(post.visual_format)}</span>` : ''}
            </div>

            ${post.post_url ? `<a href="${escapeHtml(post.post_url)}" target="_blank" class="comp-link">View Original →</a>` : ''}
        </div>`;
    }).join('');
}

function renderHookLibrary() {
    const container = document.getElementById('compHookLibrary') || document.getElementById('compHooksContainer');
    const posts = competitorData.posts.filter(p => p.hook_framework);

    if (posts.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hook frameworks found yet</p></div>';
        return;
    }

    // Group by hook_structure
    const grouped = {};
    posts.forEach(p => {
        const key = p.hook_structure || 'Uncategorized';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(p);
    });

    // Sort groups by count
    const sortedGroups = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);

    container.innerHTML = sortedGroups.map(([structure, groupPosts]) => `
        <div class="hook-group">
            <div class="hook-group-header">
                <h3>${escapeHtml(structure)}</h3>
                <span class="hook-group-count">${groupPosts.length} hooks</span>
            </div>
            <div class="hook-group-items">
                ${groupPosts.map(p => `
                    <div class="hook-swipe-card">
                        <div class="hook-swipe-framework">"${escapeHtml(p.hook_framework)}"</div>
                        <div class="hook-swipe-meta">
                            <span class="hook-swipe-creator">@${escapeHtml(p.creator_username || 'unknown')}</span>
                            <span class="hook-swipe-stat">${formatCompactNumber(p.views)} views</span>
                            <span class="hook-swipe-stat">${formatCompactNumber(p.likes)} likes</span>
                            ${(p.topic_tag || p.topic) ? `<span class="hook-swipe-topic">${escapeHtml(p.topic_tag || p.topic)}</span>` : ''}
                        </div>
                        <div class="hook-swipe-actions">
                            <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${escapeHtml(p.hook_framework).replace(/'/g, "\\'")}'); this.textContent='Copied!'; setTimeout(()=>this.textContent='Copy',1500)">Copy</button>
                            ${p.post_url ? `<a href="${escapeHtml(p.post_url)}" target="_blank" class="btn btn-secondary btn-sm">View Original</a>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function switchCompView(view) {
    document.getElementById('compPostsView').style.display = view === 'posts' ? 'block' : 'none';
    document.getElementById('compHooksView').style.display = view === 'hooks' ? 'block' : 'none';
    document.getElementById('compViewPosts').classList.toggle('active', view === 'posts');
    document.getElementById('compViewHooks').classList.toggle('active', view === 'hooks');
}

async function addCreator() {
    const input = document.getElementById('compNewCreator');
    if (!input) return;
    const handle = (input.value || '').trim().replace(/^@/, '');
    if (!handle) { showToast('Enter an Instagram handle'); return; }
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/ig_creators`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation,resolution=merge-duplicates'
            },
            body: JSON.stringify({ username: handle, is_active: true })
        });
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
        input.value = '';
        showToast(`@${handle} added! They'll be scraped on the next run.`);
        loadCompetitorData(true);
        loadActiveCreators();
    } catch (err) {
        showToast(`Failed to add: ${err.message}`);
    }
}

async function deleteCreator(username) {
    if (!confirm(`Are you sure you want to remove @${username} from tracking?`)) return;
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/ig_creators?username=eq.${username}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ is_active: false })
        });
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
        
        showToast(`@${username} removed from tracking`);
        loadActiveCreators();
        loadCompetitorData(true);
    } catch (err) {
        showToast(`Failed to remove: ${err.message}`);
    }
}

async function loadActiveCreators() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/ig_creators?is_active=eq.true&order=username`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
        
        const creators = await res.json();
        renderActiveCreators(creators);
    } catch (err) {
        console.error('Failed to load active creators:', err);
    }
}

function renderActiveCreators(creators) {
    const container = document.getElementById('activeCreatorsList') || document.getElementById('manageCreatorsList');
    if (!container) return;
    
    if (!creators || creators.length === 0) {
        container.innerHTML = '<div class="creators-empty">No creators being tracked yet.</div>';
        return;
    }
    
    container.innerHTML = creators.map(creator => `
        <div class="creator-item">
            <span class="creator-handle">@${creator.username}</span>
            <button class="btn-delete" onclick="deleteCreator('${creator.username}')" title="Remove creator">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
    `).join('');
}

// showToast defined above (Forge's version at line ~2989)

function toggleManageCreators() {
    const panel = document.getElementById('manageCreatorsPanel');
    if (!panel) return;
    const isVisible = panel.style.display !== 'none';
    
    if (isVisible) {
        panel.style.display = 'none';
    } else {
        panel.style.display = 'block';
        loadActiveCreators();
    }
}

// Competitors tab hook handled in main switchTab function

// Also update the titles map
const origTitles = {
    business: 'Business',
    tracker: 'Performance',
    kanban: 'Projects',
    activity: 'Activity',
    knowledge: 'Knowledge',
    docs: 'Docs Hub',
    content: 'Content Intel',
    youtube: 'YouTube',
    instagram: 'Instagram',
    schedules: 'Schedules',
    'meta-ads': 'Meta Ads',
    competitors: 'Competitors',
    multiplier: 'Multiplier'
};

// ===========================================
// REPORTS & KNOWLEDGE HUB SUBTABS
// ===========================================

// Competitors tab hook handled in main switchTab function above

// Export competitor functions
window.loadCompetitorData = loadCompetitorData;
window.renderCompetitorPosts = renderCompetitorPosts;
window.switchCompView = switchCompView;
window.addCreator = addCreator;
window.deleteCreator = deleteCreator;
window.loadActiveCreators = loadActiveCreators;
window.toggleManageCreators = toggleManageCreators;

// ===========================================
// VIP CLIENT TRACKER (v2 — Inline Editing)
// ===========================================

const VIP_API = 'http://localhost:3847';

let vipState = {
    clients: [],
    lastSynced: null,
    loaded: false,
    sortField: 'name',
    sortAsc: true,
};

// ── Helpers ──────────────────────────────────

function vipCalcProgramEnd(client) {
    if (!client.joined || !client.programLength) return null;
    const months = parseInt(client.programLength) || 0;
    if (!months) return null;
    const d = new Date(client.joined + 'T00:00:00');
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
}

function vipEndClass(endDate) {
    if (!endDate) return '';
    const now = new Date();
    const end = new Date(endDate + 'T00:00:00');
    const diff = (end - now) / 86400000;
    if (diff < 0) return 'vip-end-past';
    if (diff <= 30) return 'vip-end-soon';
    return '';
}

function vipShowToast(msg, isError) {
    showToast((isError ? '❌ ' : '✅ ') + msg);
}

async function vipUpdateField(pageId, notionProp, value) {
    // Optimistic local update is done before calling this
    try {
        const res = await fetch(VIP_API + '/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageId, property: notionProp, value }),
        });
        if (!res.ok) throw new Error('API error');
        vipShowToast('Synced to Notion');
    } catch (e) {
        console.error('VIP update failed:', e);
        vipShowToast('Notion sync failed — saved locally', true);
    }
}

function vipSaveLocal() {
    const data = { lastSynced: vipState.lastSynced, clients: vipState.clients };
    localStorage.setItem('geeves-vip-clients', JSON.stringify(data));
}

// ── Load / Sync ──────────────────────────────

async function loadVIPClients() {
    // Try API server first (only on localhost — skip on HTTPS to avoid mixed-content block)
    if (!vipState.loaded && location.protocol === 'http:') {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(VIP_API + '/clients', { signal: controller.signal });
            clearTimeout(timeout);
            if (res.ok) {
                const data = await res.json();
                if (data && data.clients) {
                    vipState.clients = data.clients;
                    vipState.lastSynced = data.lastSynced;
                    vipState.loaded = true;
                }
            }
        } catch (e) {
            // API server not running, fall back
            console.log('VIP API unavailable, using static data:', e.message);
        }
    }
    // Fallback: static JSON file
    if (!vipState.loaded) {
        try {
            const data = await loadJSON('vip-clients');
            if (data && data.clients) {
                vipState.clients = data.clients;
                vipState.lastSynced = data.lastSynced;
                vipState.loaded = true;
            }
        } catch (e) {
            console.error('Failed to load VIP clients from static JSON:', e);
        }
    }
    try {
        populateVIPFilters();
        renderVIPStats();
        renderVIPTable();
    } catch (e) {
        console.error('VIP render error:', e);
    }
    if (vipState.lastSynced) {
        const el = document.getElementById('vipLastSynced');
        if (el) el.textContent = 'Last synced: ' + formatDateTime(vipState.lastSynced);
    }
}

async function syncVIPClients() {
    const btn = event.target.closest('button');
    btn.textContent = '⏳ Syncing...';
    btn.disabled = true;
    try {
        const res = await fetch(VIP_API + '/sync', { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            if (data && data.clients) {
                vipState.clients = data.clients;
                vipState.lastSynced = data.lastSynced;
                populateVIPFilters();
                renderVIPStats();
                renderVIPTable();
                if (data.lastSynced) {
                    document.getElementById('vipLastSynced').textContent = 'Last synced: ' + formatDateTime(data.lastSynced);
                }
                vipShowToast('Synced from Notion');
            }
        } else {
            throw new Error('sync failed');
        }
    } catch (e) {
        console.error('VIP sync error:', e);
        vipShowToast('Sync failed — is the VIP API server running?', true);
    } finally {
        btn.textContent = '🔄 Sync from Notion';
        btn.disabled = false;
    }
}

// ── Stats ────────────────────────────────────

function renderVIPStats() {
    const clients = vipState.clients;
    const active = clients.filter(c => c.status === 'Active').length;
    const atRisk = clients.filter(c => c.status === 'At Risk').length;
    const churned = clients.filter(c => c.status === 'Churned').length;
    const onboarding = clients.filter(c => c.status === 'Onboarding').length;
    const target = 72;

    let mrr = 0;
    clients.filter(c => c.status === 'Active' || c.status === 'Onboarding').forEach(c => {
        if (c.payment === '1k/month') mrr += 1000;
        else if (c.payment === '3k PIF/Year') mrr += 250;
        else if (c.payment === '+1') mrr += 1000;
        else mrr += 500;
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const newThisMonth = clients.filter(c => c.joined >= monthStart).length;

    document.getElementById('vipStatsGrid').innerHTML = `
        <div class="vip-stat-card"><div class="vip-stat-value" style="color:#22C55E">${active}</div><div class="vip-stat-label">Active VIPs</div><div class="vip-stat-sub">${Math.round(active/target*100)}% of ${target} target</div></div>
        <div class="vip-stat-card"><div class="vip-stat-value" style="color:var(--forest-green)">$${mrr.toLocaleString()}</div><div class="vip-stat-label">Est. MRR</div><div class="vip-stat-sub">from ${active + onboarding} clients</div></div>
        <div class="vip-stat-card"><div class="vip-stat-value" style="color:${atRisk > 0 ? '#F59E0B' : 'var(--charcoal)'}">${atRisk}</div><div class="vip-stat-label">At Risk</div><div class="vip-stat-sub">${atRisk > 0 ? '⚠️ needs attention' : 'all clear'}</div></div>
        <div class="vip-stat-card"><div class="vip-stat-value" style="color:#3B82F6">${newThisMonth}</div><div class="vip-stat-label">New This Month</div><div class="vip-stat-sub">${onboarding} onboarding</div></div>
        <div class="vip-stat-card"><div class="vip-stat-value" style="color:#EF4444">${churned}</div><div class="vip-stat-label">Churned</div><div class="vip-stat-sub">total lost</div></div>
        <div class="vip-stat-card"><div class="vip-stat-value">${clients.length}</div><div class="vip-stat-label">Total Clients</div><div class="vip-stat-sub">all statuses</div></div>
    `;
}

// ── Filters ──────────────────────────────────

function populateVIPFilters() {
    const programs = new Set();
    const payments = new Set();
    vipState.clients.forEach(c => {
        (c.program || []).forEach(p => programs.add(p));
        if (c.payment) payments.add(c.payment);
    });
    document.getElementById('vipProgramFilter').innerHTML = '<option value="all">All Programs</option>' +
        [...programs].sort().map(p => `<option value="${p}">${p}</option>`).join('');
    document.getElementById('vipPaymentFilter').innerHTML = '<option value="all">All Payments</option>' +
        [...payments].sort().map(p => `<option value="${p}">${p}</option>`).join('');
}

function getFilteredVIPClients() {
    const search = (document.getElementById('vipSearch')?.value || '').toLowerCase();
    const status = document.getElementById('vipStatusFilter')?.value || 'all';
    const program = document.getElementById('vipProgramFilter')?.value || 'all';
    const payment = document.getElementById('vipPaymentFilter')?.value || 'all';
    return vipState.clients.filter(c => {
        if (search && !c.name.toLowerCase().includes(search) && !(c.email||'').toLowerCase().includes(search)) return false;
        if (status !== 'all' && c.status !== status) return false;
        if (program !== 'all' && !(c.program || []).includes(program)) return false;
        if (payment !== 'all' && c.payment !== payment) return false;
        return true;
    });
}

function sortVIPTable(field) {
    if (vipState.sortField === field) vipState.sortAsc = !vipState.sortAsc;
    else { vipState.sortField = field; vipState.sortAsc = true; }
    renderVIPTable();
}

function filterVIPClients() { renderVIPTable(); }

// ── Table Render (with inline editable cells) ──

function renderVIPTable() {
    let clients = getFilteredVIPClients();
    const f = vipState.sortField;
    const dir = vipState.sortAsc ? 1 : -1;
    clients.sort((a, b) => {
        let va, vb;
        if (f === 'program') { va = (a.program||[]).join(','); vb = (b.program||[]).join(','); }
        else if (f === 'programEnd') { va = vipCalcProgramEnd(a) || 'zzzz'; vb = vipCalcProgramEnd(b) || 'zzzz'; }
        else { va = a[f] || ''; vb = b[f] || ''; }
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        return va < vb ? -dir : va > vb ? dir : 0;
    });

    const tbody = document.getElementById('vipTableBody');
    if (clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty">No clients match filters</td></tr>';
        return;
    }

    tbody.innerHTML = clients.map(c => {
        const statusClass = {'Active':'vip-badge-active','At Risk':'vip-badge-risk','Churned':'vip-badge-churned','Onboarding':'vip-badge-onboarding'}[c.status] || '';
        const programBadges = (c.program||[]).map(p => `<span class="vip-program-badge">${escapeHtml(p)}</span>`).join(' ');
        const todoBadges = (c.todo||[]).map(t => `<span class="vip-todo-badge">${escapeHtml(t)}</span>`).join(' ');
        const joinedFmt = c.joined ? new Date(c.joined+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '';
        const endDate = vipCalcProgramEnd(c);
        const endFmt = endDate ? new Date(endDate+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
        const endCls = vipEndClass(endDate);

        return `<tr class="vip-row">
            <td class="vip-name-cell" onclick="openVIPDetail('${c.id}')"><strong>${escapeHtml(c.name)}</strong></td>
            <td class="vip-editable" onclick="vipEditSelect(event,'${c.id}','status',['Active','At Risk','Churned','Onboarding'])"><span class="vip-status-badge ${statusClass}">${escapeHtml(c.status)}</span></td>
            <td class="vip-editable" onclick="vipEditMultiSelect(event,'${c.id}','program')">${programBadges || '<span class="vip-empty-cell">—</span>'}</td>
            <td class="vip-editable" onclick="vipEditSelect(event,'${c.id}','payment',['1k/month','3k PIF/Year','PIF','+1',''])">${escapeHtml(c.payment) || '<span class="vip-empty-cell">—</span>'}</td>
            <td class="vip-editable" onclick="vipEditText(event,'${c.id}','pif')">${escapeHtml(c.pif) || '<span class="vip-empty-cell">—</span>'}</td>
            <td>${joinedFmt}</td>
            <td>${escapeHtml(c.programLength) || '—'}</td>
            <td class="${endCls}">${endFmt}</td>
            <td class="vip-editable" onclick="vipEditText(event,'${c.id}','todo')">${todoBadges || '<span class="vip-empty-cell">—</span>'}</td>
            <td>${c.email ? `<a href="mailto:${escapeHtml(c.email)}" class="vip-email-link" onclick="event.stopPropagation()">${escapeHtml(c.email)}</a>` : ''}</td>
        </tr>`;
    }).join('');
}

// ── Inline Editing: Select Dropdown ──────────

function vipEditSelect(event, clientId, field, options) {
    event.stopPropagation();
    const td = event.currentTarget;
    if (td.querySelector('.vip-inline-select')) return; // Already editing

    const client = vipState.clients.find(c => c.id === clientId);
    if (!client) return;

    const currentVal = client[field] || '';
    const select = document.createElement('select');
    select.className = 'vip-inline-select';
    options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt || '(empty)';
        if (opt === currentVal) o.selected = true;
        select.appendChild(o);
    });

    td.innerHTML = '';
    td.appendChild(select);
    select.focus();

    const commit = () => {
        const newVal = select.value;
        if (newVal !== currentVal) {
            client[field] = newVal;
            vipSaveLocal();
            renderVIPStats();
            renderVIPTable();
            // Map field to Notion property name
            const notionMap = { status: 'Status', payment: 'Payment' };
            vipUpdateField(clientId, notionMap[field] || field, newVal);
        } else {
            renderVIPTable();
        }
    };
    select.addEventListener('change', commit);
    select.addEventListener('blur', () => { setTimeout(() => renderVIPTable(), 100); });
}

// ── Inline Editing: Text Input ───────────────

function vipEditText(event, clientId, field) {
    event.stopPropagation();
    const td = event.currentTarget;
    if (td.querySelector('.vip-inline-input')) return;

    const client = vipState.clients.find(c => c.id === clientId);
    if (!client) return;

    let currentVal;
    if (field === 'todo') {
        currentVal = (client.todo || []).join(', ');
    } else {
        currentVal = client[field] || '';
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'vip-inline-input';
    input.value = currentVal;

    td.innerHTML = '';
    td.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
        const newVal = input.value.trim();
        if (field === 'todo') {
            const arr = newVal ? newVal.split(',').map(s => s.trim()).filter(Boolean) : [];
            client.todo = arr;
            vipSaveLocal();
            renderVIPTable();
            vipUpdateField(clientId, 'TODO', arr);
        } else if (field === 'pif') {
            client.pif = newVal;
            vipSaveLocal();
            renderVIPTable();
            vipUpdateField(clientId, 'PIF', newVal);
        }
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') renderVIPTable(); });
    input.addEventListener('blur', commit);
}

// ── Inline Editing: Multi-Select (Program) ───

function vipEditMultiSelect(event, clientId, field) {
    event.stopPropagation();
    const td = event.currentTarget;
    if (td.querySelector('.vip-multi-dropdown')) return;

    const client = vipState.clients.find(c => c.id === clientId);
    if (!client) return;

    // Gather all known options
    const allOptions = new Set();
    vipState.clients.forEach(c => (c[field] || []).forEach(p => allOptions.add(p)));
    // Add some defaults
    ['Group VIP', '1:1', 'Inner Circle'].forEach(p => allOptions.add(p));

    const current = new Set(client[field] || []);
    const div = document.createElement('div');
    div.className = 'vip-multi-dropdown';

    [...allOptions].sort().forEach(opt => {
        const label = document.createElement('label');
        label.className = 'vip-multi-option';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = opt;
        cb.checked = current.has(opt);
        label.appendChild(cb);
        label.appendChild(document.createTextNode(' ' + opt));
        div.appendChild(label);
    });

    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn btn-sm btn-primary';
    doneBtn.textContent = 'Done';
    doneBtn.style.marginTop = '6px';
    doneBtn.style.width = '100%';
    div.appendChild(doneBtn);

    td.innerHTML = '';
    td.appendChild(div);

    doneBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const checked = [...div.querySelectorAll('input:checked')].map(cb => cb.value);
        client[field] = checked;
        vipSaveLocal();
        renderVIPTable();
        vipUpdateField(clientId, 'Program ', checked); // Note: space after "Program"
    });

    // Close on outside click
    const closeHandler = (e) => {
        if (!div.contains(e.target)) {
            document.removeEventListener('click', closeHandler, true);
            renderVIPTable();
        }
    };
    setTimeout(() => document.addEventListener('click', closeHandler, true), 0);
}

// ── Detail Modal (with inline editing) ───────

function openVIPDetail(id) {
    const c = vipState.clients.find(cl => cl.id === id);
    if (!c) return;

    const endDate = vipCalcProgramEnd(c);
    const endFmt = endDate ? new Date(endDate+'T00:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : '—';
    const endCls = vipEndClass(endDate);
    const statusClass = {'Active':'vip-badge-active','At Risk':'vip-badge-risk','Churned':'vip-badge-churned','Onboarding':'vip-badge-onboarding'}[c.status] || '';

    const statusOpts = ['Active','At Risk','Churned','Onboarding'].map(o =>
        `<option value="${o}" ${o === c.status ? 'selected' : ''}>${o}</option>`).join('');
    const paymentOpts = ['1k/month','3k PIF/Year','PIF','+1',''].map(o =>
        `<option value="${o}" ${o === c.payment ? 'selected' : ''}>${o || '(empty)'}</option>`).join('');
    const lengthOpts = ['12 Months','6 Months','3 Months',''].map(o =>
        `<option value="${o}" ${o === c.programLength ? 'selected' : ''}>${o || '(empty)'}</option>`).join('');

    // Program checkboxes
    const allPrograms = new Set();
    vipState.clients.forEach(cl => (cl.program || []).forEach(p => allPrograms.add(p)));
    ['Group VIP', '1:1', 'Inner Circle'].forEach(p => allPrograms.add(p));
    const programChecks = [...allPrograms].sort().map(p =>
        `<label class="vip-modal-check"><input type="checkbox" value="${escapeHtml(p)}" ${(c.program||[]).includes(p)?'checked':''}> ${escapeHtml(p)}</label>`
    ).join('');

    document.getElementById('vipDetailName').textContent = c.name;
    document.getElementById('vipDetailBody').innerHTML = `
        <div class="vip-detail-grid">
            <div class="form-group">
                <label>Status</label>
                <select class="vip-modal-select" id="vipModalStatus">${statusOpts}</select>
            </div>
            <div class="form-group">
                <label>Payment</label>
                <select class="vip-modal-select" id="vipModalPayment">${paymentOpts}</select>
            </div>
            <div class="form-group">
                <label>PIF Amount</label>
                <input type="text" class="vip-modal-input" id="vipModalPIF" value="${escapeHtml(c.pif||'')}">
            </div>
            <div class="form-group">
                <label>Program Length</label>
                <select class="vip-modal-select" id="vipModalLength">${lengthOpts}</select>
            </div>
            <div class="form-group">
                <label>Joined</label>
                <p style="margin:0;color:#666;font-size:14px">${c.joined ? new Date(c.joined+'T00:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : 'Unknown'}</p>
            </div>
            <div class="form-group">
                <label>Program End</label>
                <p style="margin:0;font-size:14px" class="${endCls}">${endFmt}</p>
            </div>
            <div class="form-group" style="grid-column:1/-1">
                <label>Program</label>
                <div class="vip-modal-checks">${programChecks}</div>
            </div>
            <div class="form-group" style="grid-column:1/-1">
                <label>TODO</label>
                <input type="text" class="vip-modal-input" id="vipModalTodo" value="${escapeHtml((c.todo||[]).join(', '))}" placeholder="Comma-separated">
            </div>
            <div class="form-group" style="grid-column:1/-1">
                <label>Email</label>
                <p style="margin:0;font-size:14px">${c.email ? `<a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>` : 'N/A'}</p>
            </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px;justify-content:space-between;align-items:center">
            ${c.notionUrl ? `<a href="${escapeHtml(c.notionUrl)}" target="_blank" class="btn btn-secondary btn-sm">Open in Notion ↗</a>` : '<span></span>'}
            <button class="btn btn-primary" onclick="vipSaveModal('${c.id}')">Save Changes</button>
        </div>
    `;
    openModal('vipDetailModal');
}

function vipSaveModal(clientId) {
    const c = vipState.clients.find(cl => cl.id === clientId);
    if (!c) return;

    const newStatus = document.getElementById('vipModalStatus').value;
    const newPayment = document.getElementById('vipModalPayment').value;
    const newPIF = document.getElementById('vipModalPIF').value.trim();
    const newLength = document.getElementById('vipModalLength').value;
    const newTodo = document.getElementById('vipModalTodo').value.trim().split(',').map(s=>s.trim()).filter(Boolean);
    const newProgram = [...document.querySelectorAll('.vip-modal-checks input:checked')].map(cb => cb.value);

    // Detect changes and update
    const changes = [];
    if (c.status !== newStatus) { c.status = newStatus; changes.push(['Status', newStatus]); }
    if (c.payment !== newPayment) { c.payment = newPayment; changes.push(['Payment', newPayment]); }
    if (c.pif !== newPIF) { c.pif = newPIF; changes.push(['PIF', newPIF]); }
    if (c.programLength !== newLength) { c.programLength = newLength; changes.push(['Program Length', newLength]); }
    if (JSON.stringify(c.todo) !== JSON.stringify(newTodo)) { c.todo = newTodo; changes.push(['TODO', newTodo]); }
    if (JSON.stringify(c.program) !== JSON.stringify(newProgram)) { c.program = newProgram; changes.push(['Program ', newProgram]); }

    if (changes.length > 0) {
        vipSaveLocal();
        renderVIPStats();
        renderVIPTable();
        // Send all changes to Notion
        changes.forEach(([prop, val]) => vipUpdateField(clientId, prop, val));
        vipShowToast(`Updated ${changes.length} field(s)`);
    }
    closeModal();
}

window.loadVIPClients = loadVIPClients;
window.syncVIPClients = syncVIPClients;
window.filterVIPClients = filterVIPClients;
window.sortVIPTable = sortVIPTable;
window.openVIPDetail = openVIPDetail;
window.vipEditSelect = vipEditSelect;
window.vipEditText = vipEditText;
window.vipEditMultiSelect = vipEditMultiSelect;
window.vipSaveModal = vipSaveModal;

// ═══════════════════════════════════════════════════
// GOOGLE TASKS INTEGRATION
// ═══════════════════════════════════════════════════

const TASKS_API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3848'
    : '/api';
let tasksData = [];
let tasksLists = [];
let currentTaskFilter = 'active';
let tasksInitialized = false;

async function initTasks() {
    if (tasksInitialized) return;
    tasksInitialized = true;
    
    try {
        // Check auth status
        const status = await fetch(`${TASKS_API}/status`).then(r => r.json());
        if (!status.authorized) {
            document.getElementById('tasksList').innerHTML = `
                <div class="tasks-empty">
                    <p>⚠️ Google Tasks not connected yet.</p>
                    <p><a href="${TASKS_API}/auth" target="_blank" style="color: var(--forest-green); font-weight: 600;">Click here to authorize</a></p>
                </div>`;
            return;
        }
        
        // Load task lists
        tasksLists = await fetch(`${TASKS_API}/lists`).then(r => r.json());
        const select = document.getElementById('tasksListSelect');
        select.innerHTML = tasksLists.map((l, i) => 
            `<option value="${l.id}" ${i === 0 ? 'selected' : ''}>${l.title}</option>`
        ).join('');
        
        await loadGTasks();
    } catch (e) {
        document.getElementById('tasksList').innerHTML = `
            <div class="tasks-empty">
                <p>❌ Cannot connect to Tasks server.</p>
                <p style="font-size:0.8rem; color:#999;">Make sure tasks-api-server.js is running on port 3848</p>
            </div>`;
    }
}

async function loadGTasks() {
    const listId = document.getElementById('tasksListSelect').value;
    if (!listId) return;
    
    try {
        const data = await fetch(`${TASKS_API}/tasks?list=${encodeURIComponent(listId)}&showCompleted=true&showHidden=true`).then(r => r.json());
        tasksData = data.tasks || [];
        renderGTasks();
    } catch (e) {
        console.error('Failed to load tasks:', e);
    }
}

function renderGTasks() {
    const container = document.getElementById('tasksList');
    
    let filtered = tasksData;
    if (currentTaskFilter === 'active') {
        filtered = tasksData.filter(t => t.status !== 'completed');
    } else if (currentTaskFilter === 'completed') {
        filtered = tasksData.filter(t => t.status === 'completed');
    }
    
    // Sort: active first by due date, then no date, then completed
    filtered.sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        if (a.due && b.due) return new Date(a.due) - new Date(b.due);
        if (a.due && !b.due) return -1;
        if (!a.due && b.due) return 1;
        return 0;
    });
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="tasks-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                <p>${currentTaskFilter === 'completed' ? 'No completed tasks' : currentTaskFilter === 'active' ? 'All clear! No tasks pending. 🎉' : 'No tasks yet'}</p>
            </div>`;
        return;
    }
    
    container.innerHTML = filtered.map(task => {
        const isCompleted = task.status === 'completed';
        const dueDate = task.due ? new Date(task.due) : null;
        const isOverdue = dueDate && !isCompleted && dueDate < new Date();
        const dueDateStr = dueDate ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        
        return `
            <div class="task-item ${isCompleted ? 'completed' : ''}" data-task-id="${task.id}">
                <div class="task-checkbox ${isCompleted ? 'checked' : ''}" 
                     onclick="toggleGTaskComplete('${task.id}', ${isCompleted})"></div>
                <div class="task-body">
                    <div class="task-title" ondblclick="editGTaskTitle(this, '${task.id}')">${escapeHtml(task.title || '')}</div>
                    <div class="task-meta">
                        ${(() => { const tm = task.notes?.match(/⏰\s*(\d{1,2}:\d{2})/); const cleanNotes = task.notes?.replace(/⏰\s*\d{1,2}:\d{2}\n?/, '').trim(); return (cleanNotes ? `<span class="task-notes">${escapeHtml(cleanNotes)}</span>` : '') + (dueDateStr ? `<span class="task-due ${isOverdue ? 'overdue' : ''}">${isOverdue ? '⚠️ ' : '📅 '}${dueDateStr}${tm ? ' · ' + tm[1] : ''}</span>` : (tm ? `<span class="task-due">⏰ ${tm[1]}</span>` : '')); })()}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="task-action-btn delete" onclick="deleteGTask('${task.id}')" title="Delete">🗑</button>
                </div>
            </div>`;
    }).join('');
}

function filterGTasks(filter) {
    currentTaskFilter = filter;
    document.querySelectorAll('.tasks-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderGTasks();
}

function showAddGTask() {
    document.getElementById('addTaskForm').style.display = 'flex';
    document.getElementById('newTaskTitle').focus();
}

function hideAddGTask() {
    document.getElementById('addTaskForm').style.display = 'none';
    document.getElementById('newTaskTitle').value = '';
    document.getElementById('newTaskNotes').value = '';
    document.getElementById('newTaskDue').value = '';
    const timeEl = document.getElementById('newTaskTime');
    if (timeEl) timeEl.value = '';
}

async function createGTask() {
    const title = document.getElementById('newTaskTitle').value.trim();
    if (!title) return;
    
    const notes = document.getElementById('newTaskNotes').value.trim();
    const dateVal = document.getElementById('newTaskDue').value;
    const timeVal = document.getElementById('newTaskTime')?.value;
    const listId = document.getElementById('tasksListSelect').value;
    
    let due = undefined;
    if (dateVal) {
        due = timeVal ? `${dateVal}T${timeVal}:00` : dateVal;
    }
    
    // Include time in notes if set
    let finalNotes = notes || undefined;
    if (timeVal && dateVal) {
        finalNotes = `⏰ ${timeVal}${notes ? '\n' + notes : ''}`;
    }
    
    try {
        await fetch(`${TASKS_API}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ list: listId, title, notes: finalNotes, due }),
        });
        
        hideAddGTask();
        await loadGTasks();
        if (typeof showToast === 'function') showToast('Task created ✓');
    } catch (e) {
        console.error('Failed to create task:', e);
    }
}

async function toggleGTaskComplete(taskId, isCurrentlyCompleted) {
    const listId = document.getElementById('tasksListSelect').value;
    const endpoint = isCurrentlyCompleted ? 'uncomplete' : 'complete';
    
    try {
        await fetch(`${TASKS_API}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ list: listId, taskId }),
        });
        
        await loadGTasks();
    } catch (e) {
        console.error('Failed to toggle task:', e);
    }
}

async function deleteGTask(taskId) {
    const listId = document.getElementById('tasksListSelect').value;
    
    try {
        await fetch(`${TASKS_API}/tasks?list=${encodeURIComponent(listId)}&taskId=${encodeURIComponent(taskId)}`, {
            method: 'DELETE',
        });
        
        await loadGTasks();
        if (typeof showToast === 'function') showToast('Task deleted');
    } catch (e) {
        console.error('Failed to delete task:', e);
    }
}

function editGTaskTitle(el, taskId) {
    const current = el.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.className = 'task-title-edit';
    
    input.onblur = () => saveGTaskTitle(input, el, taskId);
    input.onkeydown = (e) => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') { el.textContent = current; }
    };
    
    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();
}

async function saveGTaskTitle(input, el, taskId) {
    const newTitle = input.value.trim();
    if (!newTitle) {
        el.textContent = input.defaultValue;
        return;
    }
    
    el.textContent = newTitle;
    const listId = document.getElementById('tasksListSelect').value;
    
    try {
        await fetch(`${TASKS_API}/tasks`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ list: listId, taskId, title: newTitle }),
        });
    } catch (e) {
        console.error('Failed to update task:', e);
    }
}

// Hook into tab switching to init tasks when tab is selected
const _origSwitchTab = typeof switchTab === 'function' ? switchTab : null;
document.querySelectorAll('[data-tab="google-tasks"]').forEach(el => {
    el.addEventListener('click', () => {
        setTimeout(initTasks, 100);
    });
});

// ═══════════════════════════════════════════════════
// EMBEDDED TASKS (Business Dashboard)
// ═══════════════════════════════════════════════════

let bizTasksData = [];
let bizTasksInitialized = false;

async function initTasksBiz() {
    if (bizTasksInitialized) return;
    bizTasksInitialized = true;
    
    try {
        const status = await fetch(`${TASKS_API}/status`).then(r => r.json());
        if (!status.authorized) {
            document.getElementById('tasksListBiz').innerHTML = `
                <div class="tasks-empty">
                    <p><a href="${TASKS_API}/auth" target="_blank" style="color:var(--forest-green);font-weight:600;">Connect Google Tasks</a></p>
                </div>`;
            return;
        }
        
        const lists = await fetch(`${TASKS_API}/lists`).then(r => r.json());
        const select = document.getElementById('tasksListSelectBiz');
        select.innerHTML = lists.map((l, i) => 
            `<option value="${l.id}" ${i === 0 ? 'selected' : ''}>${l.title}</option>`
        ).join('');
        
        // Also populate the standalone tab select if it exists
        const standaloneSelect = document.getElementById('tasksListSelect');
        if (standaloneSelect) {
            standaloneSelect.innerHTML = select.innerHTML;
        }
        
        tasksLists = lists;
        await loadTasksBiz();
    } catch (e) {
        document.getElementById('tasksListBiz').innerHTML = `
            <div class="tasks-empty">
                <p style="font-size:0.8rem;color:#999;">Tasks server not running</p>
            </div>`;
    }
}

async function loadTasksBiz() {
    const listId = document.getElementById('tasksListSelectBiz').value;
    if (!listId) return;
    
    try {
        const data = await fetch(`${TASKS_API}/tasks?list=${encodeURIComponent(listId)}&showCompleted=true`).then(r => r.json());
        bizTasksData = (data.tasks || []).filter(t => t.title);
        renderTasksBiz();
    } catch (e) {
        console.error('Failed to load tasks:', e);
    }
}

function renderTasksBiz() {
    const container = document.getElementById('tasksListBiz');
    
    // Show active tasks only in the compact view
    const active = bizTasksData.filter(t => t.status !== 'completed');
    const completed = bizTasksData.filter(t => t.status === 'completed');
    
    // Sort by due date
    active.sort((a, b) => {
        if (a.due && b.due) return new Date(a.due) - new Date(b.due);
        if (a.due) return -1;
        if (b.due) return 1;
        return 0;
    });
    
    if (active.length === 0 && completed.length === 0) {
        container.innerHTML = `<div class="tasks-empty"><p>No tasks yet ✨</p></div>`;
        return;
    }
    
    const renderItem = (task) => {
        const isCompleted = task.status === 'completed';
        const due = task.due ? new Date(task.due) : null;
        const isOverdue = due && !isCompleted && due < new Date();
        const dueStr = due ? due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        
        return `<div class="task-item-biz ${isCompleted ? 'completed' : ''}">
            <div class="task-cb ${isCompleted ? 'checked' : ''}" 
                 onclick="toggleTaskBiz('${task.id}', ${isCompleted})"></div>
            <div class="task-body-biz">
                <div class="task-title-biz">${escapeHtml(task.title)}</div>
                ${dueStr ? `<div class="task-due-biz ${isOverdue ? 'overdue' : ''}">${isOverdue ? '⚠️ ' : ''}${dueStr}</div>` : ''}
            </div>
            <button class="task-del-biz" onclick="deleteTaskBiz('${task.id}')">✕</button>
        </div>`;
    };
    
    let html = active.map(renderItem).join('');
    
    if (completed.length > 0) {
        html += `<div style="font-size:0.75rem;color:#aaa;padding:0.5rem 0.5rem 0.25rem;margin-top:0.5rem;border-top:1px solid var(--border);">
            Completed (${completed.length})</div>`;
        html += completed.slice(0, 5).map(renderItem).join('');
        if (completed.length > 5) {
            html += `<div style="font-size:0.7rem;color:#ccc;padding:0.25rem 0.5rem;">+${completed.length - 5} more</div>`;
        }
    }
    
    container.innerHTML = html;
}

function showAddTaskBiz() {
    document.getElementById('addTaskFormBiz').style.display = 'flex';
    document.getElementById('newTaskTitleBiz').focus();
}

function hideAddTaskBiz() {
    document.getElementById('addTaskFormBiz').style.display = 'none';
    document.getElementById('newTaskTitleBiz').value = '';
    document.getElementById('newTaskDueBiz').value = '';
}

async function createTaskBiz() {
    const title = document.getElementById('newTaskTitleBiz').value.trim();
    if (!title) return;
    
    const due = document.getElementById('newTaskDueBiz').value;
    const listId = document.getElementById('tasksListSelectBiz').value;
    
    try {
        await fetch(`${TASKS_API}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ list: listId, title, due: due || undefined }),
        });
        hideAddTaskBiz();
        await loadTasksBiz();
        if (typeof showToast === 'function') showToast('Task added ✓');
    } catch (e) { console.error(e); }
}

async function toggleTaskBiz(taskId, isCompleted) {
    const listId = document.getElementById('tasksListSelectBiz').value;
    try {
        await fetch(`${TASKS_API}/${isCompleted ? 'uncomplete' : 'complete'}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ list: listId, taskId }),
        });
        await loadTasksBiz();
    } catch (e) { console.error(e); }
}

async function deleteTaskBiz(taskId) {
    const listId = document.getElementById('tasksListSelectBiz').value;
    try {
        await fetch(`${TASKS_API}/tasks?list=${encodeURIComponent(listId)}&taskId=${encodeURIComponent(taskId)}`, {
            method: 'DELETE',
        });
        await loadTasksBiz();
    } catch (e) { console.error(e); }
}

// Auto-init tasks when page loads (business tab is default)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initTasksBiz, 500);
});
// Also try immediately in case DOMContentLoaded already fired
setTimeout(initTasksBiz, 500);

// ═══════════════════════════════════════════════════
// CLIENT HEALTH — POWERED BY VIP DATA
// ═══════════════════════════════════════════════════

// VIP_API already declared above = 'http://localhost:3847';

async function initClientHealth() {
    let data = null;
    // Only try localhost API when running locally (avoid mixed content on HTTPS)
    if (location.protocol === 'http:') {
        try {
            const ctrl = new AbortController();
            setTimeout(() => ctrl.abort(), 3000);
            const res = await fetch(`${VIP_API}/clients`, { signal: ctrl.signal });
            if (res.ok) data = await res.json();
        } catch (e) { /* API not available */ }
    }
    // Fallback: static JSON file
    if (!data) {
        try {
            const res = await fetch('data/vip-clients.json?t=' + Date.now());
            if (res.ok) data = await res.json();
        } catch (e2) { /* no data */ }
    }
    if (data) {
        const clients = data.clients || data;
        renderClientHealth(clients);
    }
}

function renderClientHealth(clients) {
    const active = clients.filter(c => c.status === 'Active');
    const atRisk = clients.filter(c => c.status === 'At Risk');
    const onboarding = clients.filter(c => c.status === 'Onboarding');
    const churned = clients.filter(c => c.status === 'Churned');
    const total = clients.length;
    
    // Update total label
    const totalLabel = document.getElementById('clientsTotalLabel');
    if (totalLabel) totalLabel.textContent = `${active.length + onboarding.length} active`;
    
    // Ring SVG helper
    const circumference = 2 * Math.PI * 20; // radius 20
    function ring(value, max, color) {
        const pct = max > 0 ? value / max : 0;
        const offset = circumference - (pct * circumference);
        return `<div class="ch-ring">
            <svg viewBox="0 0 48 48">
                <circle class="ch-ring-bg" cx="24" cy="24" r="20"/>
                <circle class="ch-ring-fill" cx="24" cy="24" r="20" 
                    stroke="${color}" 
                    stroke-dasharray="${circumference}" 
                    stroke-dashoffset="${offset}"/>
            </svg>
            <span class="ch-ring-number">${value}</span>
        </div>`;
    }
    
    const grid = document.getElementById('clientHealthGrid');
    grid.innerHTML = `
        <div class="ch-stat">
            ${ring(active.length, 72, '#34C759')}
            <span class="ch-label">Active</span>
        </div>
        <div class="ch-stat">
            ${ring(onboarding.length, 5, '#007AFF')}
            <span class="ch-label">Onboarding</span>
        </div>
        <div class="ch-stat">
            ${ring(atRisk.length, 10, '#FF9F0A')}
            <span class="ch-label">At Risk</span>
        </div>
        <div class="ch-stat">
            ${ring(churned.length, 10, '#FF3B30')}
            <span class="ch-label">Churned</span>
        </div>
    `;
    
    // Build alerts from real data
    const alerts = document.getElementById('clientAlertsLive');
    let alertsHtml = '<div class="ca-header">Client Insights</div>';
    
    // At-risk clients
    atRisk.forEach(c => {
        alertsHtml += `<div class="ca-item">
            <div class="ca-dot yellow"></div>
            <div class="ca-text"><strong>${c.name}</strong> <span class="ca-sub">— At Risk · ${c.program || 'Unknown program'}</span></div>
        </div>`;
    });
    
    // Onboarding clients
    onboarding.forEach(c => {
        alertsHtml += `<div class="ca-item">
            <div class="ca-dot blue"></div>
            <div class="ca-text"><strong>${c.name}</strong> <span class="ca-sub">— Onboarding · ${c.program || 'New'}</span></div>
        </div>`;
    });
    
    // Recent churns
    churned.slice(0, 2).forEach(c => {
        alertsHtml += `<div class="ca-item">
            <div class="ca-dot red"></div>
            <div class="ca-text"><strong>${c.name}</strong> <span class="ca-sub">— Churned · ${c.program || ''}</span></div>
        </div>`;
    });
    
    // Target progress
    const pctToTarget = Math.round((active.length / 72) * 100);
    alertsHtml += `<div class="ca-item">
        <div class="ca-dot green"></div>
        <div class="ca-text"><strong>${pctToTarget}%</strong> <span class="ca-sub">to 72 VIP target · ${72 - active.length} spots to fill</span></div>
    </div>`;
    
    alerts.innerHTML = alertsHtml;
}

// Override createTaskBiz to include time
const _origCreateTaskBiz = createTaskBiz;
createTaskBiz = async function() {
    const title = document.getElementById('newTaskTitleBiz').value.trim();
    if (!title) return;
    
    const dateVal = document.getElementById('newTaskDueBiz').value;
    const timeVal = document.getElementById('newTaskTimeBiz')?.value;
    const listId = document.getElementById('tasksListSelectBiz').value;
    
    let due = undefined;
    if (dateVal) {
        due = timeVal ? `${dateVal}T${timeVal}:00` : dateVal;
    }
    
    // Include time in notes if set
    let notes = undefined;
    if (timeVal && dateVal) {
        notes = `⏰ ${timeVal}`;
    }
    
    try {
        await fetch(`${TASKS_API}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ list: listId, title, due, notes }),
        });
        hideAddTaskBiz();
        await loadTasksBiz();
        if (typeof showToast === 'function') showToast('Task added ✓');
    } catch (e) { console.error(e); }
};

// Update renderTasksBiz to show time
const _origRenderTasksBiz = renderTasksBiz;
renderTasksBiz = function() {
    const container = document.getElementById('tasksListBiz');
    
    const active = bizTasksData.filter(t => t.title && t.status !== 'completed');
    const completed = bizTasksData.filter(t => t.title && t.status === 'completed');
    
    active.sort((a, b) => {
        if (a.due && b.due) return new Date(a.due) - new Date(b.due);
        if (a.due) return -1;
        if (b.due) return 1;
        return 0;
    });
    
    if (active.length === 0 && completed.length === 0) {
        container.innerHTML = `<div class="tasks-empty"><p>All clear ✨</p></div>`;
        return;
    }
    
    const renderItem = (task) => {
        const isCompleted = task.status === 'completed';
        const due = task.due ? new Date(task.due) : null;
        const isOverdue = due && !isCompleted && due < new Date();
        const dueStr = due ? due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        
        // Extract time from notes if present
        const timeMatch = task.notes?.match(/⏰\s*(\d{1,2}:\d{2})/);
        const timeStr = timeMatch ? timeMatch[1] : '';
        
        return `<div class="task-item-biz ${isCompleted ? 'completed' : ''}">
            <div class="task-cb ${isCompleted ? 'checked' : ''}" 
                 onclick="toggleTaskBiz('${task.id}', ${isCompleted})"></div>
            <div class="task-body-biz">
                <div class="task-title-biz">${escapeHtml(task.title)}</div>
                ${dueStr || timeStr ? `<div class="task-due-biz ${isOverdue ? 'overdue' : ''}">
                    ${isOverdue ? '⚠️ ' : ''}${dueStr}${timeStr ? `<span class="task-time-biz">${timeStr}</span>` : ''}
                </div>` : ''}
            </div>
            <button class="task-del-biz" onclick="deleteTaskBiz('${task.id}')">✕</button>
        </div>`;
    };
    
    let html = active.map(renderItem).join('');
    
    if (completed.length > 0) {
        html += `<div style="font-size:0.65rem;font-weight:600;color:#86868b;text-transform:uppercase;letter-spacing:0.08em;padding:0.75rem 0.75rem 0.25rem;margin-top:0.5rem;border-top:1px solid rgba(0,0,0,0.04);">
            Done · ${completed.length}</div>`;
        html += completed.slice(0, 3).map(renderItem).join('');
        if (completed.length > 3) {
            html += `<div style="font-size:0.7rem;color:#86868b;padding:0.25rem 0.75rem;">+${completed.length - 3} more</div>`;
        }
    }
    
    container.innerHTML = html;
};

// Init client health on load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initClientHealth, 600);
});
setTimeout(initClientHealth, 600);

// ===========================================
// AI EMPLOYEES TAB - Claude-style Chat Interface
// ===========================================

const AIEmployees = (function() {
    let activeThreadId = null;
    let activeAgent = null;
    let activeModel = 'auto';
    let messages = [];
    let generating = false;
    let sidebarCollapsed = false;
    let initialized = false;
    let attachedFiles = [];

    function init() {
        if (initialized) return;
        initialized = true;
        renderAgentGrid();
        loadThreadList();
    }

    // ── Agent Grid (Welcome Screen) ──

    function renderAgentGrid() {
        const grid = document.getElementById('aieAgentGrid');
        const select = document.getElementById('aieAgentSelect');
        if (!grid) return;

        const agents = Object.values(agentConfigs).filter(a => a.systemPrompt);
        if (agents.length === 0) {
            grid.innerHTML = '<p style="color:#999">No agents with system prompts configured</p>';
            return;
        }

        grid.innerHTML = agents.map(a => `
            <div class="aie-agent-card" onclick="AIEmployees.startChat('${a.id}')" style="border-color: ${a.color || '#ddd'}">
                <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${a.color || 'var(--forest-green)'}"></div>
                <span class="aie-agent-card-emoji">${a.emoji || '🤖'}</span>
                <div class="aie-agent-card-name">${a.name}</div>
                <div class="aie-agent-card-role">${a.role || 'AI Assistant'}</div>
            </div>
        `).join('');

        // Also populate agent select dropdown
        if (select) {
            select.innerHTML = agents.map(a =>
                `<option value="${a.id}">${a.emoji || '🤖'} ${a.name}</option>`
            ).join('');
        }
    }

    // ── Thread List ──

    async function loadThreadList() {
        const container = document.getElementById('aieThreadList');
        if (!container || !ChatPersistence.isReady()) return;

        // Get threads for ALL agents
        const agents = Object.values(agentConfigs).filter(a => a.systemPrompt);
        let allThreads = [];
        for (const agent of agents) {
            const threads = await ChatPersistence.getThreadsForAgent(agent.id);
            allThreads.push(...threads.map(t => ({ ...t, agentEmoji: agent.emoji || '🤖', agentName: agent.name })));
        }

        allThreads.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

        if (allThreads.length === 0) {
            container.innerHTML = '<div class="aie-thread-empty">No conversations yet</div>';
            return;
        }

        // Group by time
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today - 86400000);
        const weekAgo = new Date(today - 7 * 86400000);

        const groups = { 'Today': [], 'Yesterday': [], 'This Week': [], 'Older': [] };
        allThreads.forEach(t => {
            const d = new Date(t.updated_at);
            if (d >= today) groups['Today'].push(t);
            else if (d >= yesterday) groups['Yesterday'].push(t);
            else if (d >= weekAgo) groups['This Week'].push(t);
            else groups['Older'].push(t);
        });

        let html = '';
        for (const [label, threads] of Object.entries(groups)) {
            if (threads.length === 0) continue;
            html += `<div class="aie-thread-group-label">${label}</div>`;
            html += threads.map(t => {
                const isActive = t.id === activeThreadId;
                return `<div class="aie-thread-item${isActive ? ' active' : ''}" onclick="AIEmployees.openThread('${t.id}', '${t.agent_id}')">
                    <span class="aie-thread-item-emoji">${t.agentEmoji}</span>
                    <div class="aie-thread-item-info">
                        <div class="aie-thread-item-title">${escapeHTML(t.title)}</div>
                        <div class="aie-thread-item-date">${t.agentName} · ${formatTimeAgo(t.updated_at)}</div>
                    </div>
                    <button class="aie-thread-item-delete" onclick="event.stopPropagation(); AIEmployees.deleteThread('${t.id}')" title="Delete">✕</button>
                </div>`;
            }).join('');
        }

        container.innerHTML = html;
    }

    function formatTimeAgo(dateStr) {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = (now - d) / 1000;
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff/60) + 'm ago';
        if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // ── Start/Open Chat ──

    async function startChat(agentId) {
        activeAgent = agentId;
        activeThreadId = null;
        messages = [];

        const agent = agentConfigs[agentId];
        showChatView(agent);
        renderMessages();
        document.getElementById('aieInput')?.focus();
    }

    async function openThread(threadId, agentId) {
        activeAgent = agentId;
        activeThreadId = threadId;
        const agent = agentConfigs[agentId];

        showChatView(agent);

        const msgs = await ChatPersistence.getMessages(threadId);
        messages = msgs.map(m => ({ role: m.role, content: m.content }));
        renderMessages();
        loadThreadList();
    }

    function showChatView(agent) {
        document.getElementById('aieWelcome').style.display = 'none';
        document.getElementById('aieMessages').style.display = 'flex';
        document.getElementById('aieChatHeader').style.display = 'flex';

        document.getElementById('aieChatEmoji').textContent = agent?.emoji || '🤖';
        document.getElementById('aieChatAgentName').textContent = agent?.name || 'Assistant';
        document.getElementById('aieAgentSelect').value = activeAgent;
        document.getElementById('aieInput').placeholder = `Message ${agent?.name || 'assistant'}...`;
    }

    function showWelcomeView() {
        document.getElementById('aieWelcome').style.display = 'flex';
        document.getElementById('aieMessages').style.display = 'none';
        document.getElementById('aieChatHeader').style.display = 'none';
    }

    // ── Render Messages ──

    function renderMessages() {
        const container = document.getElementById('aieMessages');
        if (!container) return;

        if (messages.length === 0) {
            container.innerHTML = '';
            return;
        }

        const agent = agentConfigs[activeAgent] || { emoji: '🤖', name: 'Assistant' };
        let html = '';
        let lastRole = null;

        messages.forEach((m, i) => {
            const isUser = m.role === 'user';
            let labelHtml = '';
            if (!isUser && lastRole !== 'assistant' && i > 0) {
                // Show agent label when switching from user to assistant
            }
            if (i === 0 && !isUser) {
                labelHtml = `<div class="aie-msg-agent-label">${agent.emoji} ${agent.name}</div>`;
            }

            html += `<div class="aie-msg ${m.role}">
                <div class="aie-msg-avatar">${isUser ? '👤' : agent.emoji}</div>
                <div>
                    ${labelHtml}
                    <div class="aie-msg-bubble">${formatMessageContent(m.content)}</div>
                </div>
            </div>`;
            lastRole = m.role;
        });

        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    }

    function addLoadingMsg() {
        const container = document.getElementById('aieMessages');
        const agent = agentConfigs[activeAgent] || { emoji: '🤖' };
        const div = document.createElement('div');
        div.className = 'aie-msg assistant';
        div.id = 'aieLoadingMsg';
        div.innerHTML = `
            <div class="aie-msg-avatar">${agent.emoji}</div>
            <div><div class="aie-msg-bubble"><div class="aie-msg-loading"><span></span><span></span><span></span></div></div></div>
        `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    function removeLoadingMsg() {
        document.getElementById('aieLoadingMsg')?.remove();
    }

    // ── Send Message ──

    async function send() {
        const input = document.getElementById('aieInput');
        const message = input.value.trim();
        if (!message || generating) return;

        // If no agent selected, default to first available
        if (!activeAgent) {
            const agents = Object.values(agentConfigs).filter(a => a.systemPrompt);
            if (agents.length > 0) {
                activeAgent = agents[0].id;
                showChatView(agentConfigs[activeAgent]);
            } else return;
        }

        // Create thread if needed
        if (!activeThreadId && ChatPersistence.isReady()) {
            const thread = await ChatPersistence.createThread(activeAgent, ChatPersistence.generateTitle(message));
            if (thread) {
                activeThreadId = thread.id;
                loadThreadList();
            }
        }

        // Add user message (with file context if any)
        const fullMessage = buildMessageWithFiles(message);
        messages.push({ role: 'user', content: fullMessage });
        renderMessages();

        if (activeThreadId && ChatPersistence.isReady()) {
            ChatPersistence.saveMessage(activeThreadId, 'user', fullMessage);
        }

        input.value = '';
        input.style.height = 'auto';
        generating = true;
        document.getElementById('aieSendBtn').disabled = true;
        addLoadingMsg();

        try {
            const response = await callAPI(fullMessage);
            removeLoadingMsg();
            messages.push({ role: 'assistant', content: response });
            renderMessages();

            if (activeThreadId && ChatPersistence.isReady()) {
                ChatPersistence.saveMessage(activeThreadId, 'assistant', response);
            }
        } catch (err) {
            removeLoadingMsg();
            messages.push({ role: 'assistant', content: `Error: ${err.message}` });
            renderMessages();
        } finally {
            generating = false;
            document.getElementById('aieSendBtn').disabled = false;
            loadThreadList();
        }
    }

    async function callAPI(userMessage) {
        const settings = getChatSettings();
        const agent = agentConfigs[activeAgent] || {};
        
        let modelConfig;
        if (activeModel === 'auto') {
            const defaultModel = agent.defaultModel || 'claude-opus-4';
            modelConfig = models[defaultModel] || models['claude-opus-4'];
        } else {
            modelConfig = models[activeModel];
        }

        const systemPrompt = agent.systemPrompt || 'You are a helpful assistant.';
        const apiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-10),
            { role: 'user', content: userMessage }
        ];

        if (modelConfig.provider === 'openai') {
            return await callOpenAI(apiMessages, modelConfig.apiModel, settings.openaiApiKey);
        } else if (modelConfig.provider === 'anthropic') {
            return await callAnthropicProxy(apiMessages, modelConfig.apiModel);
        }
        throw new Error('No valid model configuration');
    }

    // ── UI Helpers ──

    function handleKey(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            send();
        }
    }

    function autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    function newChat() {
        activeThreadId = null;
        activeAgent = null;
        messages = [];
        showWelcomeView();
        loadThreadList();
    }

    function switchAgent(agentId) {
        activeAgent = agentId;
        const agent = agentConfigs[agentId];
        document.getElementById('aieChatEmoji').textContent = agent?.emoji || '🤖';
        document.getElementById('aieChatAgentName').textContent = agent?.name || 'Assistant';
        document.getElementById('aieInput').placeholder = `Message ${agent?.name || 'assistant'}...`;
    }

    function switchModel(modelId) {
        activeModel = modelId;
    }

    function toggleSidebar() {
        sidebarCollapsed = !sidebarCollapsed;
        document.getElementById('aieSidebar')?.classList.toggle('collapsed', sidebarCollapsed);
    }

    async function deleteThread(threadId) {
        await ChatPersistence.archiveThread(threadId);
        if (threadId === activeThreadId) {
            newChat();
        }
        loadThreadList();
    }

    // ── File Attachment ──

    function attachFile() {
        const input = document.getElementById('aieFileInput');
        if (input) input.click();
    }

    function handleFiles(fileList) {
        const maxSize = 100 * 1024; // 100KB
        const maxFiles = 3;
        for (const file of fileList) {
            if (attachedFiles.length >= maxFiles) {
                alert('Maximum 3 files allowed');
                break;
            }
            if (file.size > maxSize) {
                alert(`File "${file.name}" is too large (max 100KB)`);
                continue;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                attachedFiles.push({ name: file.name, content: e.target.result });
                renderFileChips();
            };
            reader.readAsText(file);
        }
        // Reset input so same file can be re-selected
        document.getElementById('aieFileInput').value = '';
    }

    function removeFile(index) {
        attachedFiles.splice(index, 1);
        renderFileChips();
    }

    function renderFileChips() {
        const container = document.getElementById('aieFileChips');
        if (!container) return;
        if (attachedFiles.length === 0) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }
        container.style.display = 'flex';
        container.innerHTML = attachedFiles.map((f, i) =>
            `<span class="aie-file-chip">📎 ${escapeHTML(f.name)}<button class="aie-file-chip-remove" onclick="AIEmployees.removeFile(${i})">✕</button></span>`
        ).join('');
    }

    function buildMessageWithFiles(message) {
        if (attachedFiles.length === 0) return message;
        const fileParts = attachedFiles.map(f => '```' + f.name + '\n' + f.content + '\n```').join('\n\n');
        attachedFiles = [];
        renderFileChips();
        return fileParts + '\n\n' + message;
    }

    return {
        init, startChat, openThread, newChat, send, handleKey, autoResize,
        switchAgent, switchModel, toggleSidebar, deleteThread, loadThreadList,
        attachFile, handleFiles, removeFile
    };
})();

// Initialize AI Employees when tab is clicked
document.querySelectorAll('[data-tab="ai-employees"]').forEach(el => {
    el.addEventListener('click', () => setTimeout(() => AIEmployees.init(), 100));
});

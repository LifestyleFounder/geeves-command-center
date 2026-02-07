# Geeves Command Center 🤖

The unified dashboard for Dan Harrison / LFG operations.

**Version:** 1.0  
**Created:** February 6, 2026  
**Inspired by:** Nate's Klouse Dashboard

---

## 🚀 Quick Start

### Local Development

Simply open `index.html` in a browser:

```bash
cd /Users/Geeves/.openclaw/workspace/command-center
open index.html
```

Or start a local server for better functionality:

```bash
# Python 3
python3 -m http.server 8000

# Node.js (npx)
npx serve

# Then visit: http://localhost:8000
```

### Serving from Mac mini

To serve this dashboard on your local network:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

Then access from any device on the same network at:
```
http://<mac-mini-ip>:8000
```

---

## 📁 File Structure

```
command-center/
├── index.html          # Main dashboard (single page app)
├── styles.css          # All styles (LFG brand colors)
├── app.js              # Application logic
├── README.md           # This file
└── data/
    ├── tasks.json         # Kanban board tasks
    ├── activity-log.json  # Activity log entries
    ├── notes.json         # Quick notes for Geeves
    ├── content.json       # Content Intelligence data
    ├── youtube.json       # YouTube config & stats
    ├── instagram.json     # Instagram snapshots
    ├── schedules.json     # Cron job schedules
    ├── status.json        # Geeves status info
    └── docs-index.json    # Index of markdown docs
```

---

## 🎨 Features

### 1. Status Panel (Top Bar)
- Real-time status indicator: 🟢 Idle | 🟡 Thinking | 🔵 Working | 🔴 Offline
- Current task display
- Last heartbeat time
- Model in use (claude-opus-4.5)

### 2. Kanban Board
- Four columns: Inbox → To Do → In Progress → Done
- Drag and drop support
- Priority labels (High/Medium/Low)
- Due date tracking
- Click to view/edit task details

### 3. Activity Log
- Timestamped entries of all Geeves actions
- Filterable by type (task, research, communication, scheduled, system)
- Searchable
- Color-coded by activity type

### 4. Docs Hub
- List of all markdown files from `/research/` and `/memory/`
- Search and filter functionality
- Click to preview (full rendering coming soon)

### 5. Quick Notes (Sidebar)
- Drop notes for Geeves to process
- Shows pending vs processed status
- Accessible from status bar icon

### 6. Content Intelligence
- Trend Radar: Hot and Rising topics
- Outlier Communities to study
- YouTube video ideas (10 ideas with hooks)
- Instagram content ideas (Reels & Carousels)
- Copy-to-clipboard functionality

### 7. YouTube Analytics
- Channel stats (subscribers, views, videos)
- API configuration section
- Placeholder for video list (needs API)

### 8. Instagram Analytics
- Current stats with engagement rate
- Historical snapshots table
- Manual data entry form

### 9. Scheduled Tasks
- List of all cron jobs
- Next run / last run times
- Status indicators

---

## 🎨 Design System

### Colors (LFG Brand)
| Color | Hex | Usage |
|-------|-----|-------|
| Forest Green | `#2D5A3D` | Primary, active states |
| Gold | `#D4A84B` | Accents, rising trends |
| Warm White | `#FAF9F6` | Background |
| Charcoal | `#333333` | Text |

### Typography
- Font: Inter (with system fallbacks)
- Headers: 600-800 weight
- Body: 14-16px, 400-500 weight

---

## 💾 Data Persistence

Data is stored in two places:
1. **JSON files** in `data/` directory (source of truth)
2. **localStorage** (fast reads, synced from JSON)

To update data:
- Edit the JSON files directly, or
- Use the dashboard interface (writes to localStorage)

Geeves can update JSON files which will be picked up on refresh.

---

## 🔌 Integration Points

### For Geeves to Update

Geeves can update these files to reflect current state:

```javascript
// Update status
/command-center/data/status.json

// Add activity log entry
/command-center/data/activity-log.json

// Move tasks between columns
/command-center/data/tasks.json

// Mark notes as processed
/command-center/data/notes.json
```

### Expected Update Format

**Status Update:**
```json
{
  "lastUpdated": "2026-02-06T22:30:00Z",
  "status": "working",
  "currentTask": "Researching content trends...",
  "model": "claude-opus-4.5",
  "lastHeartbeat": "2026-02-06T22:00:00Z"
}
```

**Activity Entry:**
```json
{
  "id": "act-123",
  "timestamp": "2026-02-06T22:30:00Z",
  "type": "task",
  "action": "Completed research report",
  "details": "Content intelligence report generated",
  "session": "main"
}
```

---

## 📱 Mobile Support

The dashboard is fully responsive:
- Sidebar collapses to hamburger menu
- Stats grid stacks vertically
- Kanban columns scroll horizontally
- Quick notes accessible via top-right icon

---

## 🔧 Customization

### Adding New Tabs

1. Add nav item in `index.html`:
```html
<li class="nav-item" data-tab="newtab">
    <svg>...</svg>
    <span>New Tab</span>
</li>
```

2. Add content section:
```html
<section class="tab-content" id="newtab">
    <!-- Content here -->
</section>
```

3. Add title mapping in `app.js`:
```javascript
const titles = {
    // ...existing
    newtab: 'New Tab'
};
```

### Modifying Colors

Edit CSS variables in `styles.css`:
```css
:root {
    --forest-green: #2D5A3D;
    --gold: #D4A84B;
    /* etc */
}
```

---

## 🐛 Troubleshooting

### Data not loading?
- Check browser console for errors
- Verify JSON files are valid (use jsonlint.com)
- Clear localStorage: `localStorage.clear()` in console

### Drag and drop not working?
- Ensure JavaScript is enabled
- Try refreshing the page
- Works best in Chrome/Firefox/Safari

### Mobile issues?
- Force refresh (pull down)
- Clear cache if styles look wrong

---

## 📋 Future Enhancements

- [ ] YouTube API integration for real video stats
- [ ] Dark mode toggle
- [ ] Export to CSV functionality
- [ ] Keyboard shortcuts
- [ ] Real-time updates via WebSocket
- [ ] Full markdown rendering in Docs Hub
- [ ] Comment analysis when YouTube API connected

---

## 📄 License

Internal use only — Lifestyle Founders Group

---

*Built with ❤️ by Geeves for Dan*

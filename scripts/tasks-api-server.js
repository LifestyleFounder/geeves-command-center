#!/usr/bin/env node
/**
 * Google Tasks API Server — port 3848
 * 
 * First run: visit http://localhost:3848/auth to authorize
 * 
 * GET  /lists                    — all task lists
 * GET  /tasks?list=LISTID        — tasks in a list (default: first list)
 * POST /tasks                    — create task { list, title, notes, due }
 * PUT  /tasks                    — update task { list, taskId, title, notes, due, status }
 * POST /complete                 — complete task { list, taskId }
 * POST /uncomplete               — uncomplete task { list, taskId }
 * DELETE /tasks?list=X&taskId=Y  — delete task
 * GET  /auth                     — start OAuth flow
 * GET  /auth/callback            — OAuth callback
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 3848;
const TOKEN_FILE = path.join(__dirname, '.google-tasks-token.json');
const CREDS_FILE = path.join(process.env.HOME, '.config/gog/credentials.json');
const SCOPES = 'https://www.googleapis.com/auth/tasks';

let credentials = null;
let tokens = null;

// Load credentials
try {
  const raw = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
  credentials = raw.installed || raw.web;
} catch (e) {
  console.error('❌ Cannot read', CREDS_FILE);
  process.exit(1);
}

// Load saved tokens
try {
  if (fs.existsSync(TOKEN_FILE)) {
    tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    console.log('✅ Loaded saved tokens');
  }
} catch (e) {}

function saveTokens(t) {
  tokens = t;
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2));
  console.log('✅ Tokens saved');
}

// Refresh access token if expired
async function getAccessToken() {
  if (!tokens) return null;
  
  // Check if expired (with 60s buffer)
  if (tokens.expiry_date && Date.now() > tokens.expiry_date - 60000) {
    if (!tokens.refresh_token) return null;
    
    const body = new URLSearchParams({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    });
    
    const res = await fetchURL('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    
    if (res.access_token) {
      tokens.access_token = res.access_token;
      tokens.expiry_date = Date.now() + (res.expires_in * 1000);
      saveTokens(tokens);
    }
  }
  
  return tokens.access_token;
}

// Simple fetch wrapper
function fetchURL(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: opts.headers || {},
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// Google Tasks API call
async function tasksAPI(path, method = 'GET', body = null) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authorized. Visit /auth first.');
  
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  
  return fetchURL(`https://tasks.googleapis.com${path}`, opts);
}

// HTTP helpers
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, status, data) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
  });
}

// Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    return res.end();
  }
  
  try {
    // OAuth: start
    if (pathname === '/auth' && req.method === 'GET' && !url.searchParams.has('code')) {
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${credentials.client_id}` +
        `&redirect_uri=${encodeURIComponent(`http://localhost:${PORT}/auth`)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(SCOPES)}` +
        `&access_type=offline` +
        `&prompt=consent`;
      
      res.writeHead(302, { Location: authUrl });
      return res.end();
    }
    
    // OAuth: callback
    if (pathname === '/auth' && url.searchParams.has('code')) {
      const code = url.searchParams.get('code');
      
      const body = new URLSearchParams({
        code,
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        redirect_uri: `http://localhost:${PORT}/auth`,
        grant_type: 'authorization_code',
      });
      
      const tokenRes = await fetchURL('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      
      if (tokenRes.access_token) {
        tokenRes.expiry_date = Date.now() + (tokenRes.expires_in * 1000);
        saveTokens(tokenRes);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end('<h1>✅ Google Tasks authorized!</h1><p>You can close this tab and use the Command Center.</p>');
      } else {
        return json(res, 400, { error: 'Token exchange failed', details: tokenRes });
      }
    }
    
    // Status check
    if (pathname === '/status') {
      return json(res, 200, { authorized: !!tokens, hasRefresh: !!(tokens?.refresh_token) });
    }
    
    // GET /lists — all task lists
    if (pathname === '/lists' && req.method === 'GET') {
      const data = await tasksAPI('/tasks/v1/users/@me/lists?maxResults=100');
      return json(res, 200, data.items || []);
    }
    
    // GET /tasks — tasks in a list
    if (pathname === '/tasks' && req.method === 'GET') {
      let listId = url.searchParams.get('list');
      const showCompleted = url.searchParams.get('showCompleted') !== 'false';
      const showHidden = url.searchParams.get('showHidden') === 'true';
      
      // Default to first list
      if (!listId) {
        const lists = await tasksAPI('/tasks/v1/users/@me/lists?maxResults=1');
        listId = lists.items?.[0]?.id;
        if (!listId) return json(res, 404, { error: 'No task lists found' });
      }
      
      let apiPath = `/tasks/v1/lists/${encodeURIComponent(listId)}/tasks?maxResults=100&showCompleted=${showCompleted}&showHidden=${showHidden}`;
      const data = await tasksAPI(apiPath);
      return json(res, 200, { listId, tasks: data.items || [] });
    }
    
    // POST /tasks — create task
    if (pathname === '/tasks' && req.method === 'POST') {
      const body = await readBody(req);
      let listId = body.list;
      
      if (!listId) {
        const lists = await tasksAPI('/tasks/v1/users/@me/lists?maxResults=1');
        listId = lists.items?.[0]?.id;
      }
      
      const task = { title: body.title };
      if (body.notes) task.notes = body.notes;
      if (body.due) task.due = new Date(body.due).toISOString();
      
      const created = await tasksAPI(
        `/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`,
        'POST',
        task
      );
      return json(res, 201, created);
    }
    
    // PUT /tasks — update task
    if (pathname === '/tasks' && req.method === 'PUT') {
      const body = await readBody(req);
      const { list, taskId, title, notes, due, status } = body;
      
      if (!list || !taskId) return json(res, 400, { error: 'list and taskId required' });
      
      // Get existing task first
      const existing = await tasksAPI(
        `/tasks/v1/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(taskId)}`
      );
      
      const update = { ...existing };
      if (title !== undefined) update.title = title;
      if (notes !== undefined) update.notes = notes;
      if (due !== undefined) update.due = due ? new Date(due).toISOString() : null;
      if (status !== undefined) update.status = status;
      
      const updated = await tasksAPI(
        `/tasks/v1/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(taskId)}`,
        'PUT',
        update
      );
      return json(res, 200, updated);
    }
    
    // POST /complete — mark done
    if (pathname === '/complete' && req.method === 'POST') {
      const body = await readBody(req);
      const { list, taskId } = body;
      
      if (!list || !taskId) return json(res, 400, { error: 'list and taskId required' });
      
      const existing = await tasksAPI(
        `/tasks/v1/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(taskId)}`
      );
      existing.status = 'completed';
      
      const updated = await tasksAPI(
        `/tasks/v1/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(taskId)}`,
        'PUT',
        existing
      );
      return json(res, 200, updated);
    }
    
    // POST /uncomplete — mark needs action
    if (pathname === '/uncomplete' && req.method === 'POST') {
      const body = await readBody(req);
      const { list, taskId } = body;
      
      if (!list || !taskId) return json(res, 400, { error: 'list and taskId required' });
      
      const existing = await tasksAPI(
        `/tasks/v1/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(taskId)}`
      );
      existing.status = 'needsAction';
      delete existing.completed;
      
      const updated = await tasksAPI(
        `/tasks/v1/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(taskId)}`,
        'PUT',
        existing
      );
      return json(res, 200, updated);
    }
    
    // DELETE /tasks — delete task
    if (pathname === '/tasks' && req.method === 'DELETE') {
      const listId = url.searchParams.get('list');
      const taskId = url.searchParams.get('taskId');
      
      if (!listId || !taskId) return json(res, 400, { error: 'list and taskId required' });
      
      await tasksAPI(
        `/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
        'DELETE'
      );
      return json(res, 200, { ok: true });
    }
    
    json(res, 404, { error: 'Not found' });
    
  } catch (err) {
    console.error('Error:', err.message);
    json(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`🎯 Google Tasks API server on http://localhost:${PORT}`);
  if (!tokens) {
    console.log(`\n⚠️  Not authorized yet! Visit http://localhost:${PORT}/auth to connect Google Tasks.\n`);
  }
});

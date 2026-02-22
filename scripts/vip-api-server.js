#!/usr/bin/env node
/**
 * VIP Client API Server — port 3847
 * 
 * GET  /clients  — returns vip-clients.json
 * POST /update   — { pageId, property, value } → updates Notion + refreshes JSON
 * POST /sync     — re-syncs all from Notion
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3847;
const DATA_FILE = path.join(__dirname, '..', 'data', 'vip-clients.json');
const API_KEY = fs.readFileSync(path.join(process.env.HOME, '.config/notion/api_key'), 'utf8').trim();
const NOTION_VERSION = '2022-06-28';

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
            catch (e) { reject(new Error('Invalid JSON')); }
        });
        req.on('error', reject);
    });
}

function readData() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
        return { lastSynced: null, clients: [] };
    }
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/**
 * Build Notion property payload for a given property name + value
 */
function buildNotionProperty(property, value) {
    switch (property) {
        case 'Status':
        case 'Payment':
        case 'Program Length':
            if (!value || value === '') {
                return { [property]: { select: null } };
            }
            return { [property]: { select: { name: value } } };

        case 'PIF':
            return { [property]: { rich_text: [{ text: { content: value || '' } }] } };

        case 'Program ':  // Note: space after Program
        case 'TODO': {
            const items = Array.isArray(value) ? value : (value || '').split(',').map(s => s.trim()).filter(Boolean);
            return { [property]: { multi_select: items.map(name => ({ name })) } };
        }

        default:
            throw new Error(`Unknown property: ${property}`);
    }
}

async function updateNotion(pageId, property, value) {
    const properties = buildNotionProperty(property, value);

    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Notion update failed (${res.status}): ${err}`);
    }
    return res.json();
}

function runSync() {
    const syncScript = path.join(__dirname, 'sync-vip-clients.js');
    execSync(`node "${syncScript}"`, { stdio: 'inherit' });
}

const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        cors(res);
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    try {
        // GET /clients
        if (req.method === 'GET' && url.pathname === '/clients') {
            const data = readData();
            return json(res, 200, data);
        }

        // POST /update
        if (req.method === 'POST' && url.pathname === '/update') {
            const body = await readBody(req);
            const { pageId, property, value } = body;

            if (!pageId || !property) {
                return json(res, 400, { error: 'pageId and property required' });
            }

            // Optimistic: update local JSON immediately
            const data = readData();
            const client = data.clients.find(c => c.id === pageId);
            if (client) {
                // Map Notion property names to JSON field names
                const fieldMap = {
                    'Status': 'status',
                    'Payment': 'payment',
                    'PIF': 'pif',
                    'Program ': 'program',
                    'Program Length': 'programLength',
                    'TODO': 'todo',
                };
                const field = fieldMap[property];
                if (field) {
                    if (field === 'program' || field === 'todo') {
                        client[field] = Array.isArray(value) ? value : (value || '').split(',').map(s => s.trim()).filter(Boolean);
                    } else {
                        client[field] = value;
                    }
                    writeData(data);
                }
            }

            // Update Notion in background
            updateNotion(pageId, property, value)
                .then(() => console.log(`✅ Notion updated: ${pageId} → ${property} = ${JSON.stringify(value)}`))
                .catch(err => console.error(`❌ Notion update failed:`, err.message));

            return json(res, 200, { ok: true, message: 'Updated locally, syncing to Notion...' });
        }

        // POST /sync
        if (req.method === 'POST' && url.pathname === '/sync') {
            runSync();
            const data = readData();
            return json(res, 200, data);
        }

        // 404
        json(res, 404, { error: 'Not found' });
    } catch (err) {
        console.error('Server error:', err);
        json(res, 500, { error: err.message });
    }
});

server.listen(PORT, () => {
    console.log(`🚀 VIP API server running on http://localhost:${PORT}`);
    console.log(`   GET  /clients  — read client data`);
    console.log(`   POST /update   — update a client field`);
    console.log(`   POST /sync     — full re-sync from Notion`);
});

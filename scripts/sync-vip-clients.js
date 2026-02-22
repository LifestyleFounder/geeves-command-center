#!/usr/bin/env node
/**
 * Sync VIP Clients from Notion → vip-clients.json
 * Includes Notion page IDs for write-back support.
 */

const fs = require('fs');
const path = require('path');

const API_KEY = fs.readFileSync(path.join(process.env.HOME, '.config/notion/api_key'), 'utf8').trim();
const DATABASE_ID = '030dd315-0841-49f8-aee1-cf442d4a25e4';
const OUTPUT = path.join(__dirname, '..', 'data', 'vip-clients.json');

async function queryNotion(startCursor) {
    const body = { page_size: 100 };
    if (startCursor) body.start_cursor = startCursor;

    const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Notion API error ${res.status}: ${err}`);
    }
    return res.json();
}

function extractClient(page) {
    const p = page.properties;

    const getText = (prop) => {
        if (!prop) return '';
        if (prop.rich_text) return prop.rich_text.map(t => t.plain_text).join('');
        if (prop.title) return prop.title.map(t => t.plain_text).join('');
        return '';
    };

    const getSelect = (prop) => prop?.select?.name || '';
    const getMultiSelect = (prop) => (prop?.multi_select || []).map(s => s.name);
    const getDate = (prop) => prop?.date?.start || '';
    const getEmail = (prop) => prop?.email || '';

    // Build Notion URL from page id
    const pageId = page.id.replace(/-/g, '');
    const name = getText(p['Name'] || p['name']);
    const slug = name.replace(/\s+/g, '-');
    const notionUrl = `https://www.notion.so/${slug}-${pageId}`;

    return {
        id: page.id,
        name,
        status: getSelect(p['Status']),
        program: getMultiSelect(p['Program '] || p['Program']),  // Note space after "Program"
        payment: getSelect(p['Payment']),
        pif: getText(p['PIF']),
        joined: getDate(p['Joined']),
        programLength: getSelect(p['Program Length']),
        todo: getMultiSelect(p['TODO']),
        email: getEmail(p['Email']),
        notionUrl,
    };
}

async function main() {
    console.log('Syncing VIP clients from Notion...');
    let allPages = [];
    let cursor = undefined;
    let hasMore = true;

    while (hasMore) {
        const data = await queryNotion(cursor);
        allPages = allPages.concat(data.results);
        hasMore = data.has_more;
        cursor = data.next_cursor;
    }

    const clients = allPages.map(extractClient);
    clients.sort((a, b) => a.name.localeCompare(b.name));

    const output = {
        lastSynced: new Date().toISOString(),
        clients,
    };

    fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
    console.log(`Synced ${clients.length} clients → ${OUTPUT}`);
}

main().catch(err => {
    console.error('Sync failed:', err);
    process.exit(1);
});

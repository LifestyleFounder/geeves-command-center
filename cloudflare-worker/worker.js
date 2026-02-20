// Cloudflare Worker — Anthropic Proxy + Notion Notes CRUD
// Routes:
//   POST /                → Anthropic messages API proxy
//   GET  /notion-notes    → List all notes from Notion DB
//   GET  /notion-notes/:id → Get single note (page blocks)
//   POST /notion-notes    → Create note
//   PATCH /notion-notes/:id → Update note
//   DELETE /notion-notes/:id → Archive note

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const NOTION_DB_ID = '1b3ff8c6-2c63-4941-bad2-1876bd405333';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version',
  'Access-Control-Max-Age': '86400',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function notionHeaders(apiKey) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  };
}

// Convert plain text to Notion blocks
function textToBlocks(text) {
  if (!text) return [];
  return text.split('\n').map(line => {
    if (line.startsWith('# '))
      return { object: 'block', type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] } };
    if (line.startsWith('## '))
      return { object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: line.slice(3) } }] } };
    if (line.startsWith('### '))
      return { object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: line.slice(4) } }] } };
    if (line.startsWith('- '))
      return { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] } };
    return { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: line } }] } };
  });
}

// Convert Notion blocks to plain text
function blocksToText(blocks) {
  if (!blocks) return '';
  return blocks.map(b => {
    const type = b.type;
    const data = b[type];
    if (!data) return '';
    const text = data.rich_text?.map(t => t.plain_text).join('') || '';
    if (type === 'heading_1') return `# ${text}`;
    if (type === 'heading_2') return `## ${text}`;
    if (type === 'heading_3') return `### ${text}`;
    if (type === 'bulleted_list_item') return `- ${text}`;
    if (type === 'numbered_list_item') return `- ${text}`;
    if (type === 'code') return '```\n' + text + '\n```';
    return text;
  }).filter(l => l !== '').join('\n');
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ── Notion Notes routes ──────────────────────────
    if (path.startsWith('/notion-notes')) {
      const notionKey = env.NOTION_API_KEY;
      if (!notionKey) return json({ error: 'NOTION_API_KEY not configured' }, 500);

      const idMatch = path.match(/^\/notion-notes\/([a-f0-9-]+)$/);

      try {
        // LIST notes
        if (request.method === 'GET' && !idMatch) {
          const res = await fetch(`${NOTION_API}/databases/${NOTION_DB_ID}/query`, {
            method: 'POST',
            headers: notionHeaders(notionKey),
            body: JSON.stringify({
              page_size: 100,
              sorts: [{ property: 'Name', direction: 'ascending' }],
              filter: { property: 'Name', title: { is_not_empty: true } },
            }),
          });
          const data = await res.json();
          if (!res.ok) return json({ error: data.message || 'Notion error' }, res.status);

          const notes = data.results.map(page => ({
            id: page.id,
            title: page.properties?.Name?.title?.[0]?.plain_text || 'Untitled',
            createdAt: page.created_time,
            updatedAt: page.last_edited_time,
            url: page.url,
          }));
          return json({ notes });
        }

        // GET single note
        if (request.method === 'GET' && idMatch) {
          const pageId = idMatch[1];
          const [pageRes, blocksRes] = await Promise.all([
            fetch(`${NOTION_API}/pages/${pageId}`, { headers: notionHeaders(notionKey) }),
            fetch(`${NOTION_API}/blocks/${pageId}/children?page_size=200`, { headers: notionHeaders(notionKey) }),
          ]);
          const page = await pageRes.json();
          const blocks = await blocksRes.json();
          if (!pageRes.ok) return json({ error: page.message || 'Notion error' }, pageRes.status);

          return json({
            id: page.id,
            title: page.properties?.Name?.title?.[0]?.plain_text || 'Untitled',
            content: blocksToText(blocks.results),
            createdAt: page.created_time,
            updatedAt: page.last_edited_time,
            url: page.url,
          });
        }

        // CREATE note
        if (request.method === 'POST') {
          const { title, content } = await request.json();
          const res = await fetch(`${NOTION_API}/pages`, {
            method: 'POST',
            headers: notionHeaders(notionKey),
            body: JSON.stringify({
              parent: { database_id: NOTION_DB_ID },
              properties: {
                Name: { title: [{ text: { content: title || 'Untitled' } }] },
              },
              children: textToBlocks(content || ''),
            }),
          });
          const data = await res.json();
          if (!res.ok) return json({ error: data.message || 'Notion error' }, res.status);
          return json({
            id: data.id,
            title: data.properties?.Name?.title?.[0]?.plain_text || title,
            createdAt: data.created_time,
            updatedAt: data.last_edited_time,
            url: data.url,
          }, 201);
        }

        // UPDATE note
        if (request.method === 'PATCH' && idMatch) {
          const pageId = idMatch[1];
          const { title, content } = await request.json();

          // Update title
          if (title !== undefined) {
            const titleRes = await fetch(`${NOTION_API}/pages/${pageId}`, {
              method: 'PATCH',
              headers: notionHeaders(notionKey),
              body: JSON.stringify({
                properties: { Name: { title: [{ text: { content: title } }] } },
              }),
            });
            if (!titleRes.ok) {
              const err = await titleRes.json();
              return json({ error: err.message || 'Failed to update title' }, titleRes.status);
            }
          }

          // Replace content: delete old blocks, append new
          if (content !== undefined) {
            // Get existing blocks
            const existingRes = await fetch(`${NOTION_API}/blocks/${pageId}/children?page_size=200`, {
              headers: notionHeaders(notionKey),
            });
            const existing = await existingRes.json();

            // Delete each old block
            if (existing.results) {
              await Promise.all(existing.results.map(block =>
                fetch(`${NOTION_API}/blocks/${block.id}`, {
                  method: 'DELETE',
                  headers: notionHeaders(notionKey),
                })
              ));
            }

            // Append new blocks
            const newBlocks = textToBlocks(content);
            if (newBlocks.length > 0) {
              await fetch(`${NOTION_API}/blocks/${pageId}/children`, {
                method: 'PATCH',
                headers: notionHeaders(notionKey),
                body: JSON.stringify({ children: newBlocks }),
              });
            }
          }

          return json({ ok: true });
        }

        // DELETE (archive) note
        if (request.method === 'DELETE' && idMatch) {
          const pageId = idMatch[1];
          const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
            method: 'PATCH',
            headers: notionHeaders(notionKey),
            body: JSON.stringify({ archived: true }),
          });
          if (!res.ok) {
            const err = await res.json();
            return json({ error: err.message || 'Failed to archive' }, res.status);
          }
          return json({ ok: true });
        }

        return json({ error: 'Not found' }, 404);

      } catch (error) {
        return json({ error: error.message }, 500);
      }
    }

    // ── Anthropic proxy (original route: POST /) ─────
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS });
    }

    try {
      const body = await request.json();
      const apiKey = env.ANTHROPIC_API_KEY;
      if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    } catch (error) {
      return json({ error: error.message }, 500);
    }
  },
};

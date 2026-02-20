/**
 * Notion Notes Client — CRUD via Cloudflare Worker proxy
 * Loaded before app.js. Exposes global `NotionNotes` object.
 */
const NotionNotes = (function () {
    const PROXY_URL = 'https://anthropic-proxy.geeves.workers.dev/notion-notes';

    async function list() {
        try {
            const res = await fetch(PROXY_URL);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return data.notes || [];
        } catch (e) {
            console.error('[NotionNotes] list:', e.message);
            return [];
        }
    }

    async function get(id) {
        try {
            const res = await fetch(`${PROXY_URL}/${id}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            console.error('[NotionNotes] get:', e.message);
            return null;
        }
    }

    async function create(title, content) {
        try {
            const res = await fetch(PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            console.error('[NotionNotes] create:', e.message);
            return null;
        }
    }

    async function update(id, { title, content }) {
        try {
            const res = await fetch(`${PROXY_URL}/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            console.error('[NotionNotes] update:', e.message);
            return null;
        }
    }

    async function remove(id) {
        try {
            const res = await fetch(`${PROXY_URL}/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return true;
        } catch (e) {
            console.error('[NotionNotes] remove:', e.message);
            return false;
        }
    }

    // Convert HTML (from contenteditable) to plain text with markdown
    function htmlToText(html) {
        if (!html) return '';
        return html
            .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
            .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
            .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '### $1\n')
            .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
            .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
            .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
            .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
            .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
            .replace(/<ul[^>]*>|<\/ul>/gi, '')
            .replace(/<ol[^>]*>|<\/ol>/gi, '')
            .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<div[^>]*>/gi, '\n')
            .replace(/<\/div>/gi, '')
            .replace(/<p[^>]*>/gi, '')
            .replace(/<\/p>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&nbsp;/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    // Convert plain text/markdown to basic HTML for contenteditable
    function textToHtml(text) {
        if (!text) return '';
        return text
            .replace(/^### (.*$)/gim, '<h4>$1</h4>')
            .replace(/^## (.*$)/gim, '<h3>$1</h3>')
            .replace(/^# (.*$)/gim, '<h2>$1</h2>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
            .replace(/\n/g, '<br>');
    }

    return { list, get, create, update, remove, htmlToText, textToHtml };
})();

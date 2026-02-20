/**
 * User Settings — Cloudflare KV-backed persistence via Worker proxy
 * Replaces localStorage for cross-device settings.
 * Loaded before app.js. Exposes global `UserSettings` object.
 *
 * Keys stored:
 *   customFolders       — array of custom folder keys
 *   customFolderIcons   — { folderKey: emoji }
 *   docFolderAssignments — { docPath: folderKey }
 *   hiddenNotionNotes   — array of hidden Notion note IDs
 */
const UserSettings = (function () {
    const PROXY_URL = 'https://anthropic-proxy.dan-a14.workers.dev/settings';

    // In-memory cache so reads are instant after initial load
    let cache = {};
    let loaded = false;

    const SETTINGS_KEYS = ['customFolders', 'customFolderIcons', 'docFolderAssignments', 'hiddenNotionNotes'];

    async function loadAll() {
        try {
            const res = await fetch(PROXY_URL);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            cache = data.settings || {};
            loaded = true;

            // Migrate: if KV is empty but localStorage has data, push it up
            if (Object.keys(cache).length === 0) {
                await migrateFromLocalStorage();
            }
            console.log('[UserSettings] Loaded from KV');
        } catch (e) {
            console.warn('[UserSettings] loadAll failed, falling back to localStorage:', e.message);
            SETTINGS_KEYS.forEach(key => {
                const val = localStorage.getItem(key);
                if (val) {
                    try { cache[key] = JSON.parse(val); } catch { cache[key] = val; }
                }
            });
            loaded = true;
        }
    }

    async function migrateFromLocalStorage() {
        let migrated = false;
        for (const key of SETTINGS_KEYS) {
            const val = localStorage.getItem(key);
            if (val) {
                try {
                    const parsed = JSON.parse(val);
                    cache[key] = parsed;
                    await fetch(`${PROXY_URL}/${key}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ value: parsed }),
                    });
                    migrated = true;
                } catch {}
            }
        }
        if (migrated) console.log('[UserSettings] Migrated localStorage data to KV');
    }

    function get(key, defaultValue) {
        if (cache[key] !== undefined) return cache[key];
        // Fallback to localStorage during first load
        const local = localStorage.getItem(key);
        if (local) {
            try { return JSON.parse(local); } catch { return local; }
        }
        return defaultValue;
    }

    async function set(key, value) {
        cache[key] = value;
        // Write to localStorage immediately as backup
        localStorage.setItem(key, JSON.stringify(value));
        // Fire-and-forget to KV
        try {
            await fetch(`${PROXY_URL}/${key}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value }),
            });
        } catch (e) {
            console.warn('[UserSettings] set failed:', e.message);
        }
    }

    async function remove(key) {
        delete cache[key];
        localStorage.removeItem(key);
        try {
            await fetch(`${PROXY_URL}/${key}`, { method: 'DELETE' });
        } catch (e) {
            console.warn('[UserSettings] remove failed:', e.message);
        }
    }

    function isLoaded() { return loaded; }

    return { loadAll, get, set, remove, isLoaded };
})();

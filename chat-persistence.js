/**
 * Chat Persistence Module — Supabase-backed thread & message storage
 * Loaded before app.js. Exposes global `ChatPersistence` object.
 */
const ChatPersistence = (function () {
    const SUPABASE_URL = 'https://nzppfxttbqrgwjofxqfm.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_sV62e_R_dS3hviPSmOm3bQ_VrN1Pj4d';

    let sb = null;
    let ready = false;

    function init() {
        try {
            if (typeof supabase === 'undefined' || !supabase.createClient) {
                console.warn('[ChatPersistence] Supabase CDN not loaded — running without persistence');
                return;
            }
            sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            ready = true;
            console.log('[ChatPersistence] Initialized');
        } catch (e) {
            console.warn('[ChatPersistence] Init failed:', e.message);
        }
    }

    function isReady() {
        return ready && sb !== null;
    }

    // ── Threads ──────────────────────────────────────────

    async function getThreadsForAgent(agentId, includeArchived = false) {
        if (!isReady()) return [];
        let query = sb
            .from('chat_threads')
            .select('*')
            .eq('agent_id', agentId)
            .order('updated_at', { ascending: false });

        if (!includeArchived) {
            query = query.eq('is_archived', false);
        }

        const { data, error } = await query;
        if (error) { console.error('[ChatPersistence] getThreads:', error.message); return []; }
        return data || [];
    }

    async function createThread(agentId, title) {
        if (!isReady()) return null;
        const { data, error } = await sb
            .from('chat_threads')
            .insert({ agent_id: agentId, title: title || 'New conversation' })
            .select()
            .single();
        if (error) { console.error('[ChatPersistence] createThread:', error.message); return null; }
        return data;
    }

    async function updateThreadTitle(threadId, title) {
        if (!isReady()) return;
        await sb.from('chat_threads').update({ title }).eq('id', threadId);
    }

    async function archiveThread(threadId) {
        if (!isReady()) return;
        await sb.from('chat_threads').update({ is_archived: true }).eq('id', threadId);
    }

    // ── Messages ─────────────────────────────────────────

    async function getMessages(threadId) {
        if (!isReady()) return [];
        const { data, error } = await sb
            .from('chat_messages')
            .select('*')
            .eq('thread_id', threadId)
            .order('created_at', { ascending: true });
        if (error) { console.error('[ChatPersistence] getMessages:', error.message); return []; }
        return data || [];
    }

    async function saveMessage(threadId, role, content) {
        if (!isReady()) return null;
        const { data, error } = await sb
            .from('chat_messages')
            .insert({ thread_id: threadId, role, content })
            .select()
            .single();
        if (error) { console.error('[ChatPersistence] saveMessage:', error.message); return null; }
        return data;
    }

    // ── Helpers ──────────────────────────────────────────

    function generateTitle(firstMessage) {
        if (!firstMessage) return 'New conversation';
        const clean = firstMessage.replace(/\n/g, ' ').trim();
        if (clean.length <= 50) return clean;
        return clean.substring(0, 47) + '...';
    }

    return {
        init,
        isReady,
        getThreadsForAgent,
        createThread,
        updateThreadTitle,
        archiveThread,
        getMessages,
        saveMessage,
        generateTitle
    };
})();

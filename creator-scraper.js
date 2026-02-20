/**
 * Creator Scraper Module — Supabase-backed Instagram creator tracking
 * Loaded before app.js. Exposes global `CreatorScraper` object.
 */
const CreatorScraper = (function () {
    const SUPABASE_URL = 'https://nzppfxttbqrgwjofxqfm.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_sV62e_R_dS3hviPSmOm3bQ_VrN1Pj4d';

    let sb = null;
    let ready = false;

    function init() {
        try {
            if (typeof supabase === 'undefined' || !supabase.createClient) {
                console.warn('[CreatorScraper] Supabase CDN not loaded');
                return;
            }
            sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            ready = true;
            console.log('[CreatorScraper] Initialized');
        } catch (e) {
            console.warn('[CreatorScraper] Init failed:', e.message);
        }
    }

    function isReady() {
        return ready && sb !== null;
    }

    // ── Creators ──────────────────────────────────────

    async function getCreators() {
        if (!isReady()) return [];
        const { data, error } = await sb
            .from('ig_creators')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: true });
        if (error) { console.error('[CreatorScraper] getCreators:', error.message); return []; }
        return data || [];
    }

    async function addCreator(username) {
        if (!isReady()) return null;
        const clean = username.replace(/^@/, '').trim().toLowerCase();
        if (!clean) return null;
        const { data, error } = await sb
            .from('ig_creators')
            .upsert({ username: clean, is_active: true }, { onConflict: 'username' })
            .select()
            .single();
        if (error) { console.error('[CreatorScraper] addCreator:', error.message); return null; }
        return data;
    }

    async function removeCreator(id) {
        if (!isReady()) return false;
        const { error } = await sb
            .from('ig_creators')
            .update({ is_active: false })
            .eq('id', id);
        if (error) { console.error('[CreatorScraper] removeCreator:', error.message); return false; }
        return true;
    }

    // ── Snapshots ─────────────────────────────────────

    async function getSnapshots(creatorId, limit = 30) {
        if (!isReady()) return [];
        const { data, error } = await sb
            .from('ig_creator_snapshots')
            .select('*')
            .eq('creator_id', creatorId)
            .order('scraped_at', { ascending: false })
            .limit(limit);
        if (error) { console.error('[CreatorScraper] getSnapshots:', error.message); return []; }
        return data || [];
    }

    async function getLatestSnapshots() {
        if (!isReady()) return [];
        // Get latest snapshot per active creator via distinct on
        const { data, error } = await sb
            .from('ig_creator_snapshots')
            .select('*, ig_creators!inner(id, username, full_name, profile_pic_url, bio, is_active)')
            .eq('ig_creators.is_active', true)
            .order('creator_id')
            .order('scraped_at', { ascending: false });
        if (error) { console.error('[CreatorScraper] getLatestSnapshots:', error.message); return []; }
        // Deduplicate: keep only the first (most recent) snapshot per creator
        const seen = new Set();
        const latest = [];
        for (const row of (data || [])) {
            if (!seen.has(row.creator_id)) {
                seen.add(row.creator_id);
                latest.push(row);
            }
        }
        return latest;
    }

    // ── Posts ──────────────────────────────────────────

    async function getPosts(creatorId, limit = 20) {
        if (!isReady()) return [];
        const { data, error } = await sb
            .from('ig_posts')
            .select('*, ig_creators(username, full_name, profile_pic_url)')
            .eq('creator_id', creatorId)
            .order('posted_at', { ascending: false })
            .limit(limit);
        if (error) { console.error('[CreatorScraper] getPosts:', error.message); return []; }
        return data || [];
    }

    async function getTopPosts({ creatorId, limit = 50, sortBy = 'likes' } = {}) {
        if (!isReady()) return [];
        let query = sb
            .from('ig_posts')
            .select('*, ig_creators!inner(username, full_name, profile_pic_url, is_active)')
            .eq('ig_creators.is_active', true);
        if (creatorId) query = query.eq('creator_id', creatorId);
        query = query.order(sortBy, { ascending: false }).limit(limit);
        const { data, error } = await query;
        if (error) { console.error('[CreatorScraper] getTopPosts:', error.message); return []; }
        return data || [];
    }

    async function getRecentPosts(limit = 30) {
        if (!isReady()) return [];
        const { data, error } = await sb
            .from('ig_posts')
            .select('*, ig_creators!inner(username, full_name, profile_pic_url, is_active)')
            .eq('ig_creators.is_active', true)
            .order('posted_at', { ascending: false })
            .limit(limit);
        if (error) { console.error('[CreatorScraper] getRecentPosts:', error.message); return []; }
        return data || [];
    }

    async function getPostById(postId) {
        if (!isReady()) return null;
        const { data, error } = await sb
            .from('ig_posts')
            .select('*, ig_creators(username, full_name, profile_pic_url)')
            .eq('id', postId)
            .single();
        if (error) { console.error('[CreatorScraper] getPostById:', error.message); return null; }
        return data;
    }

    // ── Scrape Runs ───────────────────────────────────

    async function getScrapeRuns(limit = 10) {
        if (!isReady()) return [];
        const { data, error } = await sb
            .from('ig_scrape_runs')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(limit);
        if (error) { console.error('[CreatorScraper] getScrapeRuns:', error.message); return []; }
        return data || [];
    }

    // ── Public API ────────────────────────────────────

    return {
        init,
        isReady,
        getCreators,
        addCreator,
        removeCreator,
        getSnapshots,
        getLatestSnapshots,
        getPosts,
        getTopPosts,
        getRecentPosts,
        getPostById,
        getScrapeRuns
    };
})();

// Vercel Serverless: Meta Ads API proxy
// GET /api/meta-ads?range=7d|30d|today|yesterday

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID || 'act_285954345865882';

  if (!token) {
    return res.status(500).json({ error: 'META_ACCESS_TOKEN not configured' });
  }

  const range = req.query.range || '7d';
  // Use Pacific time for date calculations (Dan's timezone)
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  let since, until;

  const fmt = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  until = fmt(now);

  switch (range) {
    case 'today':
      since = until;
      break;
    case 'yesterday':
      const y = new Date(now); y.setDate(y.getDate() - 1);
      since = fmt(y);
      until = since;
      break;
    case '30d':
      const m = new Date(now); m.setDate(m.getDate() - 30);
      since = fmt(m);
      break;
    case '7d':
    default:
      const w = new Date(now); w.setDate(w.getDate() - 7);
      since = fmt(w);
      break;
  }

  try {
    const campaignUrl = `https://graph.facebook.com/v21.0/${accountId}/insights?` +
      `fields=campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type` +
      `&time_range={"since":"${since}","until":"${until}"}` +
      `&level=campaign&limit=25` +
      `&access_token=${token}`;

    const accountUrl = `https://graph.facebook.com/v21.0/${accountId}/insights?` +
      `fields=spend,impressions,clicks,ctr,actions,cost_per_action_type` +
      `&time_range={"since":"${since}","until":"${until}"}` +
      `&access_token=${token}`;

    const dailyUrl = `https://graph.facebook.com/v21.0/${accountId}/insights?` +
      `fields=spend,impressions,clicks,actions` +
      `&time_range={"since":"${since}","until":"${until}"}` +
      `&time_increment=1&limit=31` +
      `&access_token=${token}`;

    const [campaignRes, accountRes, dailyRes] = await Promise.all([
      fetch(campaignUrl),
      fetch(accountUrl),
      fetch(dailyUrl)
    ]);

    const campaigns = await campaignRes.json();
    const account = await accountRes.json();
    const daily = await dailyRes.json();

    // Helper: get action value by type
    const getAction = (actions, type) => {
      if (!actions) return 0;
      const a = actions.find(x => x.action_type === type);
      return a ? parseInt(a.value) : 0;
    };

    const getCost = (costActions, type) => {
      if (!costActions) return 0;
      const a = costActions.find(x => x.action_type === type);
      return a ? parseFloat(a.value) : 0;
    };

    // Extract primary result per campaign (matches what Ads Manager shows as "Results")
    // Priority: complete_registration > lead/fb_pixel_lead > messaging_conversation_started > link_click
    const extractPrimaryResult = (actions, costActions) => {
      if (!actions) return { results: 0, resultType: 'None', costPerResult: 0 };

      // Check registrations first (Skool campaign)
      const regs = getAction(actions, 'omni_complete_registration');
      if (regs > 0) {
        return { results: regs, resultType: 'Registrations', costPerResult: getCost(costActions, 'omni_complete_registration') };
      }

      // Check leads/fb_pixel_lead (Retargeting campaigns)
      const leads = getAction(actions, 'offsite_conversion.fb_pixel_lead') || getAction(actions, 'lead');
      if (leads > 0) {
        const cpr = getCost(costActions, 'offsite_conversion.fb_pixel_lead') || getCost(costActions, 'lead');
        return { results: leads, resultType: 'Leads', costPerResult: cpr };
      }

      // Check meta leads / messaging conversations (IG DM campaigns)
      const metaLeads = getAction(actions, 'onsite_conversion.messaging_conversation_started_7d');
      if (metaLeads > 0) {
        return { results: metaLeads, resultType: 'Meta Leads', costPerResult: getCost(costActions, 'onsite_conversion.messaging_conversation_started_7d') };
      }

      // Fallback: onsite_web_lead
      const webLeads = getAction(actions, 'onsite_web_lead');
      if (webLeads > 0) {
        return { results: webLeads, resultType: 'Leads', costPerResult: getCost(costActions, 'onsite_web_lead') };
      }

      return { results: 0, resultType: 'None', costPerResult: 0 };
    };

    // Applications = custom pixel event (submit application)
    const extractApplications = (actions) => getAction(actions, 'offsite_conversion.fb_pixel_custom');

    // For daily chart: total "results" across all types
    const extractDailyResults = (actions) => {
      if (!actions) return 0;
      const regs = getAction(actions, 'omni_complete_registration');
      const leads = getAction(actions, 'offsite_conversion.fb_pixel_lead') || getAction(actions, 'lead');
      const metaLeads = getAction(actions, 'onsite_conversion.messaging_conversation_started_7d');
      return regs + leads + metaLeads;
    };

    // Format campaign data
    const formattedCampaigns = (campaigns.data || []).map(c => {
      const primary = extractPrimaryResult(c.actions, c.cost_per_action_type);
      return {
        name: c.campaign_name,
        id: c.campaign_id,
        spend: parseFloat(c.spend || 0),
        impressions: parseInt(c.impressions || 0),
        clicks: parseInt(c.clicks || 0),
        ctr: parseFloat(c.ctr || 0),
        results: primary.results,
        resultType: primary.resultType,
        costPerResult: primary.costPerResult,
        applications: extractApplications(c.actions),
        actions: c.actions || []
      };
    });

    // Account totals
    const acctData = (account.data || [])[0] || {};
    const totalSpend = parseFloat(acctData.spend || 0);
    const totalResults = formattedCampaigns.reduce((sum, c) => sum + c.results, 0);
    const totalApplications = extractApplications(acctData.actions);

    // Daily data for charts
    const dailyData = (daily.data || []).map(d => ({
      date: d.date_start,
      spend: parseFloat(d.spend || 0),
      impressions: parseInt(d.impressions || 0),
      clicks: parseInt(d.clicks || 0),
      results: extractDailyResults(d.actions),
      applications: extractApplications(d.actions)
    }));

    res.status(200).json({
      range,
      since,
      until,
      totals: {
        spend: totalSpend,
        impressions: parseInt(acctData.impressions || 0),
        clicks: parseInt(acctData.clicks || 0),
        ctr: parseFloat(acctData.ctr || 0),
        results: totalResults,
        costPerResult: totalResults > 0 ? totalSpend / totalResults : 0,
        applications: totalApplications,
        costPerApplication: totalApplications > 0 ? totalSpend / totalApplications : 0
      },
      campaigns: formattedCampaigns,
      daily: dailyData,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Meta Ads API error:', err);
    res.status(500).json({ error: err.message });
  }
};

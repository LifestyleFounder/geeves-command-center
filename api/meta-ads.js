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
  const now = new Date();
  let since, until;

  // Calculate date range
  const fmt = d => d.toISOString().split('T')[0];
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
    // Campaign-level insights
    const campaignUrl = `https://graph.facebook.com/v21.0/${accountId}/insights?` +
      `fields=campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,cpm,actions,cost_per_action_type` +
      `&time_range={"since":"${since}","until":"${until}"}` +
      `&level=campaign&limit=25` +
      `&access_token=${token}`;

    // Account-level totals
    const accountUrl = `https://graph.facebook.com/v21.0/${accountId}/insights?` +
      `fields=spend,impressions,clicks,ctr,actions,cost_per_action_type` +
      `&time_range={"since":"${since}","until":"${until}"}` +
      `&access_token=${token}`;

    // Daily breakdown for charts
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

    // Extract lead counts from actions
    const extractLeads = (actions) => {
      if (!actions) return 0;
      const leadAction = actions.find(a =>
        a.action_type === 'lead' ||
        a.action_type === 'onsite_web_lead' ||
        a.action_type === 'offsite_conversion.fb_pixel_lead'
      );
      return leadAction ? parseInt(leadAction.value) : 0;
    };

    const extractRegistrations = (actions) => {
      if (!actions) return 0;
      const regAction = actions.find(a =>
        a.action_type === 'complete_registration' ||
        a.action_type === 'omni_complete_registration' ||
        a.action_type === 'offsite_conversion.fb_pixel_complete_registration'
      );
      return regAction ? parseInt(regAction.value) : 0;
    };

    const extractAppointments = (actions) => {
      if (!actions) return 0;
      const a = actions.find(x =>
        x.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
        x.action_type === 'offsite_conversion.fb_pixel_schedule' ||
        x.action_type === 'schedule'
      );
      return a ? parseInt(a.value) : 0;
    };

    const extractApplications = (actions) => {
      if (!actions) return 0;
      const a = actions.find(x =>
        x.action_type === 'initiate_checkout' ||
        x.action_type === 'omni_initiated_checkout' ||
        x.action_type === 'offsite_conversion.fb_pixel_initiate_checkout'
      );
      return a ? parseInt(a.value) : 0;
    };

    // Format campaign data
    const formattedCampaigns = (campaigns.data || []).map(c => ({
      name: c.campaign_name,
      id: c.campaign_id,
      spend: parseFloat(c.spend || 0),
      impressions: parseInt(c.impressions || 0),
      clicks: parseInt(c.clicks || 0),
      ctr: parseFloat(c.ctr || 0),
      cpc: parseFloat(c.cpc || 0),
      leads: extractLeads(c.actions),
      registrations: extractRegistrations(c.actions),
      cpl: extractLeads(c.actions) > 0 ? parseFloat(c.spend) / extractLeads(c.actions) : 0,
      actions: c.actions || []
    }));

    // Account totals
    const acctData = (account.data || [])[0] || {};
    const totalSpend = parseFloat(acctData.spend || 0);
    const totalLeads = extractLeads(acctData.actions);
    const totalRegistrations = extractRegistrations(acctData.actions);
    const totalAppointments = extractAppointments(acctData.actions);
    const totalApplications = extractApplications(acctData.actions);

    // Daily data for charts
    const dailyData = (daily.data || []).map(d => ({
      date: d.date_start,
      spend: parseFloat(d.spend || 0),
      impressions: parseInt(d.impressions || 0),
      clicks: parseInt(d.clicks || 0),
      leads: extractLeads(d.actions)
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
        leads: totalLeads,
        registrations: totalRegistrations,
        cpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
        appointments: totalAppointments,
        applications: totalApplications,
        cost_per_appointment: totalAppointments > 0 ? totalSpend / totalAppointments : 0
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

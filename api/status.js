const { cors, json } = require('./_google-tasks');
module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const hasRefresh = !!process.env.GOOGLE_REFRESH_TOKEN;
  json(res, 200, { authorized: hasRefresh, hasRefresh });
};

// Public settings, read from Vercel environment variables so nothing needs a code change at launch:
// CART_CA (the $CART mint), CART_WALLET (the coin's creator wallet = the ad wallet), CART_X, CART_TIKTOK.
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
module.exports = (req, res) => {
  const E = (k) => String(process.env[k] || '').trim();
  const ca = B58.test(E('CART_CA')) ? E('CART_CA') : '';
  const wallet = B58.test(E('CART_WALLET')) ? E('CART_WALLET') : '';
  const handle = (v) => v.replace(/^https?:\/\/(www\.)?(x|twitter|tiktok)\.com\//i, '').replace(/^@/, '').replace(/[^A-Za-z0-9_.]/g, '').slice(0, 30);
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.end(JSON.stringify({ ok: true, ca, wallet, x: handle(E('CART_X')), tiktok: handle(E('CART_TIKTOK')) }));
};

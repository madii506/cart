// The ad wallet, read live: SOL in the wallet, creator fees still waiting in pump.fun's vaults (bonding curve +
// PumpSwap, via the official SDK), and the SOL price. Nothing is estimated; a failed read comes back as null.
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const RPC = (process.env.RPC_URL || 'https://solana-rpc.publicnode.com').split(',')[0].trim();
const SOL_MINT = 'So11111111111111111111111111111111111111112';

function send(res, obj, cache) {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', cache || 'public, s-maxage=15, stale-while-revalidate=60');
  res.end(JSON.stringify(obj));
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

module.exports = async (req, res) => {
  const t0 = Date.now();
  const w = String(process.env.CART_WALLET || '').trim();
  if (!B58.test(w)) return send(res, { ok: true, set: false }, 'public, s-maxage=30');
  try {
    const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
    const pk = new PublicKey(w);
    const conn = new Connection(RPC, 'confirmed');
    const unclaimed = async () => {
      const P = require('@pump-fun/pump-sdk');
      const online = new P.OnlinePumpSdk(conn);
      const bn = await online.getCreatorVaultBalanceBothPrograms(pk);
      return Number(bn.toString()) / LAMPORTS_PER_SOL;
    };
    const price = async () => {
      const r = await fetch('https://lite-api.jup.ag/price/v3?ids=' + SOL_MINT, { headers: { accept: 'application/json' } });
      const j = await r.json();
      const p = j && j[SOL_MINT] && Number(j[SOL_MINT].usdPrice);
      return p > 0 ? p : null;
    };
    const [bal, unc, px, slot] = await Promise.allSettled([
      withTimeout(conn.getBalance(pk, 'confirmed'), 8000),
      withTimeout(unclaimed(), 9000),
      withTimeout(price(), 5000),
      withTimeout(conn.getSlot('confirmed'), 6000),
    ]);
    send(res, {
      ok: true, set: true, wallet: w,
      sol: bal.status === 'fulfilled' ? bal.value / LAMPORTS_PER_SOL : null,
      unclaimed: unc.status === 'fulfilled' ? unc.value : null,
      solUsd: px.status === 'fulfilled' ? px.value : null,
      slot: slot.status === 'fulfilled' ? slot.value : null,
      errors: [bal, unc, px].filter((x) => x.status === 'rejected').map((x) => String(x.reason && x.reason.message || x.reason).slice(0, 120)),
      ms: Date.now() - t0,
    });
  } catch (e) {
    send(res, { ok: false, set: true, wallet: w, error: String(e.message || e).slice(0, 200), ms: Date.now() - t0 }, 'no-store');
  }
};

// TEMPORARY: fixed-prompt photoreal frames for the For You feed, made once with FLUX through the Vercel AI Gateway
// (OIDC, no key) and cached by the CDN. Only the prompts below can be made. Removed once the frames are in the repo.
const SHOTS = {
  1: 'A fluffy orange tabby cat sitting inside a red supermarket shopping cart in a bright grocery store aisle, looking straight into the camera, colourful shelves softly blurred behind, shot on a phone, vertical video still, candid, natural light, photorealistic, no text, no logos',
  2: 'A young adult woman lying in bed at night scrolling her phone, her face lit by the cool glow of the screen, messy white sheets, warm fairy lights on the wall behind her, shot from above on a phone, vertical video still, candid, photorealistic, no text',
  3: 'Passenger seat point of view of a night drive through a big city, neon signs and street lights streaking past the windshield, a phone mounted on the dashboard, vertical video still, cinematic, photorealistic, no text, no logos',
  4: 'Top-down view of a bed covered in opened delivery boxes and shopping bags, two hands unboxing a small product from tissue paper, cozy bedroom, warm lamp light, vertical phone video still, photorealistic, no text, no logos, no brand names',
  5: 'A golden retriever wearing a red hoodie sitting in the passenger seat of a car, looking out of the window at sunset, shot on a phone, vertical video still, candid, photorealistic, no text',
  6: 'Close-up of chopsticks lifting steaming ramen noodles from a bowl at a late night street food stall, neon lights glowing in the background, vertical phone video still, photorealistic, no text, no logos',
  7: 'A skateboarder doing a kickflip in an empty parking lot at golden hour, low angle phone shot, slight motion blur, vertical video still, photorealistic, no text, no logos',
  8: 'A single empty red shopping cart standing in the middle of a long empty supermarket aisle at night, glowing pink and cyan neon light, glossy floor reflections, cinematic, vertical phone video still, photorealistic, no text, no logos, no brand names',
  9: 'A shopping cart overflowing with shiny gold coins in a dark parking lot at night under pink and cyan neon light, wet asphalt reflections, cinematic product shot, vertical, photorealistic, no text, no logos',
  10: 'Close-up of a hand holding a smartphone with a blank screen above a supermarket self-checkout scanner, pink and cyan neon reflections, shallow depth of field, vertical phone video still, photorealistic, no text, no logos',
};
let OIDC = null, made = 0;
const send = (res, code, obj) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(obj)); };
module.exports = async (req, res) => {
  const h = req.headers['x-vercel-oidc-token']; if (h) OIDC = h;
  const token = process.env.AI_GATEWAY_API_KEY || OIDC || process.env.VERCEL_OIDC_TOKEN || null;
  const n = Number(new URL(req.url, 'http://x').searchParams.get('n'));
  if (!SHOTS[n]) return send(res, 200, { ok: true, gateway: !!token, shots: Object.keys(SHOTS).length });
  if (!token) return send(res, 200, { ok: false, error: 'no gateway token' });
  if (++made > 40) return send(res, 429, { ok: false, error: 'limit' });
  const t0 = Date.now(), errors = [];
  const variants = [
    { size: '768x1344', bfl: {} },
    { bfl: { aspectRatio: '9:16' } },
    { bfl: { width: 768, height: 1344 } },
    { bfl: {} },
  ];
  for (const v of variants) {
    if (Date.now() - t0 > 45000) break;
    try {
      const body = { model: 'bfl/flux-2-pro', prompt: SHOTS[n], n: 1, response_format: 'b64_json',
        providerOptions: { blackForestLabs: Object.assign({ outputFormat: 'jpeg', safetyTolerance: 2 }, v.bfl) } };
      if (v.size) body.size = v.size;
      const r = await fetch('https://ai-gateway.vercel.sh/v1/images/generations', { method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify(body), signal: AbortSignal.timeout(Math.max(8000, 52000 - (Date.now() - t0))) });
      const j = await r.json().catch(() => null), d = j && j.data && j.data[0];
      if (d && d.b64_json) {
        const buf = Buffer.from(d.b64_json, 'base64');
        res.statusCode = 200; res.setHeader('content-type', 'image/jpeg');
        res.setHeader('x-variant', JSON.stringify(v)); res.setHeader('x-ms', String(Date.now() - t0));
        res.setHeader('cache-control', 'public, max-age=31536000, immutable');
        res.setHeader('vercel-cdn-cache-control', 'public, max-age=31536000');
        return res.end(buf);
      }
      errors.push(JSON.stringify(v) + ': ' + String((j && j.error && (j.error.message || j.error.type)) || r.status).slice(0, 180));
    } catch (e) { errors.push(JSON.stringify(v) + ': ' + String(e && e.message).slice(0, 120)); }
  }
  send(res, 200, { ok: false, errors, ms: Date.now() - t0 });
};

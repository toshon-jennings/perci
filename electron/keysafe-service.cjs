const KEYSAFE_ORIGIN = 'http://127.0.0.1:4100';
const KEYSAFE_HEALTH_URL = `${KEYSAFE_ORIGIN}/api/health`;

function validateKeySafeHealth(result, { nonce, version }) {
  if (!result?.ok) return { ok: false, reason: result?.status === 401 ? 'unauthorized-listener' : Number.isInteger(result?.status) ? 'unexpected-listener' : 'unreachable' };
  const data = result.data;
  if (!data || data.productId !== 'keysafe') return { ok: false, reason: 'wrong-product' };
  if (data.version !== version) return { ok: false, reason: 'wrong-version' };
  if (data.nonce !== nonce) return { ok: false, reason: 'wrong-launch' };
  return { ok: true, productId: data.productId, version: data.version };
}

module.exports = { KEYSAFE_HEALTH_URL, KEYSAFE_ORIGIN, validateKeySafeHealth };

const GUEST_POLICIES = Object.freeze([
  Object.freeze({
    id: 'keysafe',
    partition: 'persist:perci-localhost',
    origin: 'http://127.0.0.1:4100',
  }),
  Object.freeze({
    id: 'pxpipe',
    partition: 'persist:perci-pxpipe',
    origin: 'http://127.0.0.1:47821',
  }),
]);
const KEYSAFE_GUEST_USER_AGENT = 'Perci-KeySafe-Guest/1';

function originOf(rawUrl) {
  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
}

function policyForOrigin(rawUrl) {
  const origin = originOf(rawUrl);
  return GUEST_POLICIES.find(policy => policy.origin === origin) || null;
}

function validateAttachment({ src, partition, userAgent } = {}) {
  const sourcePolicy = policyForOrigin(src);
  const partitionPolicy = GUEST_POLICIES.find(policy => policy.partition === partition && policy.id === 'pxpipe');

  if (userAgent === KEYSAFE_GUEST_USER_AGENT && sourcePolicy?.id !== 'keysafe') {
    return { allowed: false, policy: GUEST_POLICIES[0], reason: 'KeySafe guest requires its registered origin' };
  }
  if (sourcePolicy?.id === 'keysafe' && userAgent !== KEYSAFE_GUEST_USER_AGENT) {
    return { allowed: false, policy: sourcePolicy, reason: 'KeySafe requires its dedicated guest' };
  }
  if (sourcePolicy && sourcePolicy.partition !== partition) {
    return { allowed: false, policy: sourcePolicy, reason: 'protected origin requires its registered partition' };
  }
  if (partitionPolicy && partitionPolicy.origin !== originOf(src)) {
    return { allowed: false, policy: partitionPolicy, reason: 'protected partition requires its registered origin' };
  }
  return { allowed: true, policy: sourcePolicy };
}

function isNavigationAllowed(policy, rawUrl) {
  return Boolean(policy && originOf(rawUrl) === policy.origin);
}

function isAllowedKeySafeDownload({ url, filename, mimeType } = {}) {
  if (!url?.startsWith('blob:') || originOf(url) !== 'http://127.0.0.1:4100') return false;
  return (/^keysafe-encrypted-\d{4}-\d{2}-\d{2}\.keysafe$/.test(filename) && mimeType === 'application/json')
    || (/^[a-z0-9-]+\.env$/.test(filename) && mimeType === 'text/plain');
}

module.exports = { GUEST_POLICIES, KEYSAFE_GUEST_USER_AGENT, isAllowedKeySafeDownload, isNavigationAllowed, originOf, policyForOrigin, validateAttachment };

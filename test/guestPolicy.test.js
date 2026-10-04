import { describe, expect, it } from 'vitest';
import guestPolicy from '../electron/guest-policy.cjs';

const { GUEST_POLICIES, KEYSAFE_GUEST_USER_AGENT, isAllowedKeySafeDownload, isNavigationAllowed, policyForOrigin, validateAttachment } = guestPolicy;

describe('protected guest policy', () => {
  it('registers exact KeySafe and pxpipe origins and partitions', () => {
    expect(GUEST_POLICIES).toEqual([
      expect.objectContaining({ id: 'keysafe', origin: 'http://127.0.0.1:4100', partition: 'persist:perci-localhost' }),
      expect.objectContaining({ id: 'pxpipe', origin: 'http://127.0.0.1:47821', partition: 'persist:perci-pxpipe' }),
    ]);
  });

  it('allows registered attachments and rejects partition substitution', () => {
    for (const policy of GUEST_POLICIES) {
      expect(validateAttachment({ src: `${policy.origin}/app`, partition: policy.partition, userAgent: policy.id === 'keysafe' ? KEYSAFE_GUEST_USER_AGENT : undefined })).toEqual({
        allowed: true,
        policy,
      });
      expect(validateAttachment({ src: policy.origin, partition: 'persist:attacker' })).toMatchObject({
        allowed: false,
        policy,
      });
    }
  });

  it('rejects generic localhost guests pointed at KeySafe', () => {
    expect(validateAttachment({ src: 'http://127.0.0.1:4100/', partition: 'persist:perci-localhost' })).toMatchObject({
      allowed: false,
      reason: 'KeySafe requires its dedicated guest',
    });
  });

  it('reserves the pxpipe partition for pxpipe', () => {
    expect(validateAttachment({
      src: 'http://127.0.0.1:9999',
      partition: 'persist:perci-pxpipe',
    })).toMatchObject({ allowed: false, policy: expect.objectContaining({ id: 'pxpipe' }) });
  });

  it('allows navigation only within the registered origin', () => {
    const policy = policyForOrigin('http://127.0.0.1:4100/vault');
    expect(isNavigationAllowed(policy, 'http://127.0.0.1:4100/settings')).toBe(true);
    expect(isNavigationAllowed(policy, 'http://localhost:4100/settings')).toBe(false);
    expect(isNavigationAllowed(policy, 'https://example.com/')).toBe(false);
    expect(isNavigationAllowed(policy, 'not a url')).toBe(false);
  });

  it('permits only expected local KeySafe exports', () => {
    expect(isAllowedKeySafeDownload({ url: 'blob:http://127.0.0.1:4100/fixture', filename: 'keysafe-encrypted-2026-10-03.keysafe', mimeType: 'application/json' })).toBe(true);
    expect(isAllowedKeySafeDownload({ url: 'blob:http://127.0.0.1:4100/fixture', filename: 'project.env', mimeType: 'text/plain' })).toBe(true);
    expect(isAllowedKeySafeDownload({ url: 'blob:https://example.com/fixture', filename: 'keysafe-encrypted-2026-10-03.keysafe', mimeType: 'application/json' })).toBe(false);
    expect(isAllowedKeySafeDownload({ url: 'blob:http://127.0.0.1:4100/fixture', filename: 'credentials.json', mimeType: 'application/json' })).toBe(false);
  });
});

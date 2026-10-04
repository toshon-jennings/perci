import { describe, expect, it } from 'vitest';
import keysafeService from '../electron/keysafe-service.cjs';

const { validateKeySafeHealth } = keysafeService;

const expected = { nonce: 'launch-nonce', version: '1.2.3' };

describe('KeySafe service identity', () => {
  it('accepts authenticated KeySafe identity for this launch', () => {
    expect(validateKeySafeHealth({ ok: true, data: { productId: 'keysafe', version: '1.2.3', nonce: 'launch-nonce' } }, expected))
      .toEqual({ ok: true, productId: 'keysafe', version: '1.2.3' });
  });

  it('rejects a healthy service with the wrong product identity', () => {
    expect(validateKeySafeHealth({ ok: true, data: { productId: 'other', version: '1.2.3', nonce: 'launch-nonce' } }, expected).ok).toBe(false);
  });

  it('rejects stale version or launch nonce', () => {
    expect(validateKeySafeHealth({ ok: true, data: { productId: 'keysafe', version: '1.2.2', nonce: 'launch-nonce' } }, expected).ok).toBe(false);
    expect(validateKeySafeHealth({ ok: true, data: { productId: 'keysafe', version: '1.2.3', nonce: 'old-launch' } }, expected).ok).toBe(false);
  });

  it('rejects unreachable and unauthorized responses', () => {
    expect(validateKeySafeHealth({ ok: false, status: 401 }, expected)).toEqual({ ok: false, reason: 'unauthorized-listener' });
    expect(validateKeySafeHealth({ ok: false, status: 404 }, expected)).toEqual({ ok: false, reason: 'unexpected-listener' });
    expect(validateKeySafeHealth({ ok: false }, expected)).toEqual({ ok: false, reason: 'unreachable' });
  });
});

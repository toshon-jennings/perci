import { describe, expect, it } from 'vitest';
import redaction from '../electron/redact-console.cjs';

const { redactSecrets } = redaction;

const fixtures = [
  'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature',
  'sk-proj-abcdefghijklmnopqrstuvwxyz',
  'sk-ant-abcdefghijklmnopqrstuvwxyz',
  'sk-or-abcdefghijklmnopqrstuvwxyz',
  'gsk_abcdefghijklmnopqrstuvwxyz',
  'AIzaSyabcdefghijklmnopqrstuvwxyz1234567',
  'ghp_abcdefghijklmnopqrstuvwxyz1234567890',
  'github_pat_abcdefghijklmnopqrstuvwxyz1234567890',
  'AKIAIOSFODNN7EXAMPLE',
  ['xoxb', '123456789012', 'abcdefghijklmnopqrstuvwx'].join('-'),
  ['sk', 'live', 'abcdefghijklmnopqrstuvwxyz'].join('_'),
  '-----BEGIN PRIVATE KEY-----\nfixture-body\n-----END PRIVATE KEY-----',
];

describe('log redaction', () => {
  it('redacts supported provider tokens and multiline private keys', () => {
    const output = JSON.stringify(redactSecrets(fixtures.join('\n')));
    for (const fixture of fixtures) expect(output).not.toContain(fixture);
  });

  it('redacts secrets in URLs, headers, and nested unknown-format fields', () => {
    const value = {
      url: 'https://example.test/path?api_key=custom-value-123&safe=yes',
      headers: { Authorization: 'Custom unknown-value-456' },
      nested: { password: 'multiline\nunknown-value-789', safe: 'kept' },
    };
    const output = JSON.stringify(redactSecrets(value));
    for (const secret of ['custom-value-123', 'unknown-value-456', 'unknown-value-789']) {
      expect(output).not.toContain(secret);
    }
    expect(output).toContain('kept');
  });

  it('normalizes errors without retaining message, stack, or request content', () => {
    const error = new Error('provider echoed attachment-body and sk-proj-secretsecret');
    const output = JSON.stringify(redactSecrets(error));
    expect(output).not.toContain('attachment-body');
    expect(output).not.toContain('secretsecret');
    expect(redactSecrets(error)).toEqual({ name: 'Error', category: 'Error' });
  });
});

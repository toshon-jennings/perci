import { describe, expect, it, vi } from 'vitest';
import modelBroker from '../electron/model-broker.cjs';

const { createModelBroker, validateRequest } = modelBroker;

describe('model broker', () => {
  it('streams chunks while keeping credentials inside the broker', async () => {
    const streamChat = vi.fn(async (_messages, onChunk, _model, options) => {
      expect(options.signal).toBeInstanceOf(AbortSignal);
      onChunk('hello', { isThinking: false });
      return 'done';
    });
    const credentialStore = {
      withCredential: vi.fn(async (_provider, callback) => callback('synthetic-secret')),
    };
    const broker = createModelBroker({
      credentialStore,
      loadFactory: async () => ({ getClient: (_provider, secret) => {
        expect(secret).toBe('synthetic-secret');
        return { streamChat };
      } }),
    });
    const emit = vi.fn();
    await expect(broker.stream({
      requestId: 'request-1',
      provider: 'openai',
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'hello' }],
    }, emit)).resolves.toEqual({ requestId: 'request-1', result: 'done' });
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ chunk: 'hello', requestId: 'request-1' }));
    expect(credentialStore.withCredential).toHaveBeenCalledWith('openai', expect.any(Function));
  });

  it('supports tool calls and aborts by request id', async () => {
    let capturedSignal;
    const broker = createModelBroker({
      credentialStore: { withCredential: async (_provider, callback) => callback('secret') },
      loadFactory: async () => ({
        getClient: () => ({
          streamChatWithTools: (_messages, _tools, _onChunk, _model, options) => new Promise((resolve, reject) => {
            capturedSignal = options.signal;
            options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
          }),
        }),
      }),
    });
    const pending = broker.stream({
      requestId: 'request-2',
      provider: 'anthropic',
      model: 'claude-test',
      messages: [{ role: 'user', content: 'hello' }],
      tools: [{ name: 'read' }],
    }, () => {});
    await vi.waitFor(() => expect(capturedSignal).toBeInstanceOf(AbortSignal));
    expect(broker.abort('request-2')).toBe(true);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects arbitrary providers, remote local endpoints, and oversized payloads', () => {
    expect(() => validateRequest({ provider: 'evil', model: 'x', messages: [{}] })).toThrow('Unsupported');
    expect(() => validateRequest({
      provider: 'lmstudio',
      model: 'x',
      messages: [{}],
      clientOptions: { lmStudioUrl: 'https://example.com' },
    })).toThrow('loopback');
    expect(() => validateRequest({
      provider: 'openai',
      model: 'x',
      messages: [{ role: 'user', content: 'x'.repeat(2 * 1024 * 1024) }],
    })).toThrow('too large');
  });
});

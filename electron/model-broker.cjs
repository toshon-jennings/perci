const { randomUUID } = require('crypto');

const PROVIDERS = new Set(['openai', 'groq', 'gemini', 'ollama', 'lmstudio', 'jan', 'openrouter', 'deepinfra', 'anthropic', 'mistral']);
const LOCAL_PROVIDERS = new Set(['ollama', 'lmstudio', 'jan']);
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;

function validateLoopbackUrl(rawUrl) {
  if (!rawUrl) return undefined;
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
    throw new Error('Local model endpoints must use loopback HTTP.');
  }
  return parsed.origin;
}

function validateRequest(request) {
  if (!request || typeof request !== 'object') throw new Error('Invalid model request.');
  if (!PROVIDERS.has(request.provider)) throw new Error('Unsupported model provider.');
  if (typeof request.model !== 'string' || request.model.length < 1 || request.model.length > 300) {
    throw new Error('Invalid model identifier.');
  }
  if (!Array.isArray(request.messages) || request.messages.length < 1 || request.messages.length > 200) {
    throw new Error('Model requests require between 1 and 200 messages.');
  }
  if (request.tools != null && (!Array.isArray(request.tools) || request.tools.length > 128)) {
    throw new Error('Invalid tool definition list.');
  }
  const serialized = JSON.stringify({ messages: request.messages, tools: request.tools || [] });
  if (Buffer.byteLength(serialized, 'utf8') > MAX_REQUEST_BYTES) throw new Error('Model request is too large.');

  return {
    requestId: typeof request.requestId === 'string' && request.requestId.length <= 100 ? request.requestId : randomUUID(),
    provider: request.provider,
    model: request.model,
    messages: request.messages,
    tools: request.tools || null,
    options: request.options && typeof request.options === 'object' ? request.options : {},
    clientOptions: {
      lmStudioUrl: validateLoopbackUrl(request.clientOptions?.lmStudioUrl),
      janUrl: validateLoopbackUrl(request.clientOptions?.janUrl),
    },
  };
}

function createModelBroker({ credentialStore, loadFactory, loadClientOptions = async () => ({}) } = {}) {
  if (!credentialStore?.withCredential || typeof loadFactory !== 'function') {
    throw new TypeError('Model broker requires a credential store and client factory loader.');
  }
  const active = new Map();

  async function stream(rawRequest, emit) {
    const request = validateRequest(rawRequest);
    if (active.has(request.requestId)) throw new Error('Duplicate model request identifier.');
    const controller = new AbortController();
    active.set(request.requestId, controller);

    const run = async apiKey => {
      const factory = await loadFactory();
      if (controller.signal.aborted) throw new DOMException('Model request aborted.', 'AbortError');
      const clientOptions = await loadClientOptions();
      if (controller.signal.aborted) throw new DOMException('Model request aborted.', 'AbortError');
      const client = factory.getClient(request.provider, apiKey, { ...request.clientOptions, ...clientOptions });
      const onChunk = (chunk, metadata) => emit({
        requestId: request.requestId,
        type: 'chunk',
        chunk,
        metadata: metadata && typeof metadata === 'object' ? metadata : {},
      });
      const options = { ...request.options, signal: controller.signal };
      if (request.tools) {
        return client.streamChatWithTools(request.messages, request.tools, onChunk, request.model, options);
      }
      return client.streamChat(request.messages, onChunk, request.model, options);
    };

    try {
      const result = LOCAL_PROVIDERS.has(request.provider)
        ? await run('')
        : await credentialStore.withCredential(request.provider, run);
      return { requestId: request.requestId, result };
    } finally {
      active.delete(request.requestId);
    }
  }

  function abort(requestId) {
    const controller = active.get(requestId);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  return { abort, stream };
}

module.exports = { LOCAL_PROVIDERS, PROVIDERS, createModelBroker, validateLoopbackUrl, validateRequest };

import { buildExplainPrompt, buildFollowUpPrompt } from './prompts.js';

// ── Anthropic ──────────────────────────────────────────────────────────────

async function streamAnthropic(text, settings, onChunk, onDone, onError, signal) {
  const prompt = buildExplainPrompt(text, settings.expertiseLevel);
  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.remoteModel || 'claude-opus-4-5',
        max_tokens: prompt.maxTokens,
        stream: true,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      }),
    });
  } catch (e) {
    if (e.name === 'AbortError') return; // stale request — silent
    onError('Network error: ' + e.message);
    return;
  }

  if (!response.ok) {
    if (response.status === 401) onError('Invalid API key — check Settings.');
    else if (response.status === 429) onError('Rate limit reached — try again in a moment.');
    else onError(`API error ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted) { reader.cancel(); return; }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            onChunk(parsed.delta.text);
          }
        } catch { /* skip malformed SSE line */ }
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') onError('Stream error: ' + e.message);
    return;
  }
  onDone();
}

async function fetchFollowUpsAnthropic(text, settings, signal) {
  const prompt = buildFollowUpPrompt(text, settings.expertiseLevel);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.remoteModel || 'claude-opus-4-5',
        max_tokens: prompt.maxTokens,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return parseFollowUps(data.content?.[0]?.text || '');
  } catch {
    return [];
  }
}

// ── Ollama ─────────────────────────────────────────────────────────────────

async function streamOllama(text, settings, onChunk, onDone, onError, signal) {
  const prompt = buildExplainPrompt(text, settings.expertiseLevel);
  const host = settings.ollamaHost || 'http://localhost:11434';
  let response;
  try {
    response = await fetch(`${host}/api/generate`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: settings.localModel || 'llama3.2',
        system: prompt.system,
        prompt: prompt.user,
        stream: true,
      }),
    });
  } catch (e) {
    if (e.name === 'AbortError') return;
    onError(`Cannot reach Ollama at ${host} — is it running?`);
    return;
  }

  if (!response.ok) {
    if (response.status === 403) {
      onError('Ollama blocked the request (403). Restart Ollama with: OLLAMA_ORIGINS=* ollama serve');
    } else {
      onError(`Ollama error ${response.status}`);
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let lineBuf = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted) { reader.cancel(); return; }
      lineBuf += decoder.decode(value, { stream: true });
      const lines = lineBuf.split('\n');
      lineBuf = lines.pop();
      for (const line of lines) {
        if (!line) continue;
        try {
          const data = JSON.parse(line);
          if (data.response) onChunk(data.response);
          if (data.done) onDone();
        } catch { /* skip */ }
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') onError('Stream error: ' + e.message);
    return;
  }
  onDone();
}

async function fetchFollowUpsOllama(text, settings, signal) {
  const prompt = buildFollowUpPrompt(text, settings.expertiseLevel);
  const host = settings.ollamaHost || 'http://localhost:11434';
  try {
    const response = await fetch(`${host}/api/generate`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: settings.localModel || 'llama3.2',
        system: prompt.system,
        prompt: prompt.user,
        stream: false,
      }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return parseFollowUps(data.response || '');
  } catch {
    return [];
  }
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function parseFollowUps(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\[[\s\S]*?\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return [];
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export function streamExplanation(text, settings, onChunk, onDone, onError, signal) {
  if (settings.aiMode === 'local') {
    return streamOllama(text, settings, onChunk, onDone, onError, signal);
  }
  return streamAnthropic(text, settings, onChunk, onDone, onError, signal);
}

export async function fetchFollowUps(text, settings, signal) {
  if (settings.aiMode === 'local') {
    return fetchFollowUpsOllama(text, settings, signal);
  }
  return fetchFollowUpsAnthropic(text, settings, signal);
}

export async function testConnection(settings) {
  if (settings.aiMode === 'local') {
    const host = settings.ollamaHost || 'http://localhost:11434';
    try {
      const r = await fetch(`${host}/api/tags`);
      if (r.ok) return { ok: true, message: 'Ollama is reachable.' };
      return { ok: false, message: `Ollama returned ${r.status}.` };
    } catch {
      return { ok: false, message: `Cannot reach Ollama at ${host}.` };
    }
  }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.remoteModel || 'claude-opus-4-5',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    if (r.status === 401) return { ok: false, message: 'Invalid API key.' };
    if (r.ok) return { ok: true, message: 'Claude API is reachable.' };
    return { ok: false, message: `API returned ${r.status}.` };
  } catch (e) {
    return { ok: false, message: 'Network error: ' + e.message };
  }
}

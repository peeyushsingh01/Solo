// Shared LLM helper. Files starting with "_" are not exposed as routes by Vercel.
// Provider order: OpenRouter free-model chain first, Anthropic as optional paid fallback.
const OR = process.env.OPENROUTER_API_KEY, AN = process.env.ANTHROPIC_API_KEY;
const FREE = 'openai/gpt-oss-120b:free,openrouter/free'; // free slugs rotate: verify at openrouter.ai/models
const list = (v) => (v || FREE).split(',').map(s => s.trim()).filter(Boolean);
const hits = new Map();

exports.CHAT_MODELS = list(process.env.CHAT_MODELS);
exports.PLAN_MODELS = list(process.env.PLAN_MODELS);
exports.hasKey = () => !!(OR || AN);

exports.limited = (req) => {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'anon', now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 60000);
  recent.push(now); hits.set(ip, recent);
  return recent.length > 15;
};

exports.parseJSON = (t) => {
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('no json');
  return JSON.parse(t.slice(a, b + 1));
};

async function post(url, headers, body, ms) {
  const ctrl = new AbortController(), to = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }); }
  finally { clearTimeout(to); }
}

// Tries each free model in order, then Anthropic if a key is set. Returns { text, model }.
exports.callLLM = async ({ system, user, models, maxTokens = 900, ms = 12000 }) => {
  if (OR) for (const model of models) {
    try {
      const r = await post('https://openrouter.ai/api/v1/chat/completions', { authorization: 'Bearer ' + OR, 'x-title': 'Solo Leveling System' },
        { model, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }, ms);
      if (!r.ok) continue;
      const j = await r.json(), t = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (t && t.includes('{')) return { text: t, model };
    } catch (e) { /* try next model */ }
  }
  if (AN) {
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
    const r = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': AN, 'anthropic-version': '2023-06-01' },
      { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }, ms);
    if (r.ok) { const d = await r.json(); return { text: (d.content || []).map(c => c.text || '').join(''), model }; }
  }
  throw new Error('no provider available');
};

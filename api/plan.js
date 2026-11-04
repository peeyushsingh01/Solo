// POST /api/plan  { mode: "plan" | "adapt", ... }  -> planner model (reasoning-class) output
const { callLLM, parseJSON, hasKey, limited, PLAN_MODELS } = require('./_llm');

const SYSTEM = `You are a periodization and learning-plan specialist for a self-improvement RPG app. Think carefully, then answer with ONLY one JSON object (no markdown, no commentary).
Rules: be realistic and safe. Progressive overload at most 10% per week. Physical goals get a lighter deload week at weeks 4 and 8. Respect the stated weekly hours and time slot. Keep all text short and concrete.

mode "plan" input: a goal (title, category, hoursPerWeek, slot, intensity), the player's level, and titles of other active goals.
mode "plan" output: {"metric":{"name":string,"unit":string,"direction":"up"|"down"},"phases":[{"weeks":"1-4","focus":string,"target":string},{"weeks":"5-8",...},{"weeks":"9-12",...}],"quests":[{"title":string,"desc":string}]}
Exactly 3 phases and exactly 3 quests (Phase 1 only; title max 6 words; desc one concrete sentence with a number). The metric is the single number that best tracks personal records for this goal (for example longest run in km, or minutes of unbroken focus).

mode "adapt" input: goal title, a metric (name, unit, direction, best), and recent results oldest to newest.
mode "adapt" output: {"nextTarget":number,"note":string}. nextTarget is a realistic next personal record: 2-10% beyond best in the metric's direction; smaller if recent results are flat or erratic. note is one sentence.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!hasKey()) return res.status(503).json({ error: 'No API key configured' });
  if (limited(req)) return res.status(429).json({ error: 'Too many requests' });
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const mode = b.mode === 'adapt' ? 'adapt' : 'plan';
  const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
  const input = mode === 'plan'
    ? { mode, level: Number(b.level) || 1, goal: { title: clip(b.goal && b.goal.title, 70), category: clip(b.goal && b.goal.category, 12), hoursPerWeek: Number(b.goal && b.goal.hoursPerWeek) || 5, slot: clip(b.goal && b.goal.slot, 12), intensity: Number(b.goal && b.goal.intensity) || 3 }, others: (b.others || []).slice(0, 10).map(x => clip(x, 70)) }
    : { mode, goal: clip(b.goal, 70), metric: b.metric || {}, history: (Array.isArray(b.history) ? b.history : []).slice(-6).map(Number).filter(Number.isFinite) };
  try {
    const { text } = await callLLM({ system: SYSTEM, user: JSON.stringify(input), models: PLAN_MODELS, maxTokens: 2500, ms: 25000 });
    const o = parseJSON(text);
    if (mode === 'adapt') return res.status(200).json({ nextTarget: Number(o.nextTarget) || null, note: clip(o.note, 200) });
    const m = o.metric || {};
    return res.status(200).json({
      metric: { name: clip(m.name, 40), unit: clip(m.unit, 12), direction: m.direction === 'down' ? 'down' : 'up' },
      phases: (Array.isArray(o.phases) ? o.phases : []).slice(0, 3).map(p => ({ weeks: clip(p.weeks, 10), focus: clip(p.focus, 120), target: clip(p.target, 120) })),
      quests: (Array.isArray(o.quests) ? o.quests : []).slice(0, 3).map(q => ({ title: clip(q.title, 50), desc: clip(q.desc, 160) }))
    });
  } catch (e) { return res.status(502).json({ error: 'Planner unavailable' }); }
};

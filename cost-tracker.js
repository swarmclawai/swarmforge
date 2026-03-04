/**
 * Cost Tracker — SwarmForge Plugin (OpenClaw Native)
 * Tracks token usage and estimated costs per agent session.
 * Cross-compatible: works on both SwarmClaw and OpenClaw platforms.
 */

const sessionCosts = new Map();

function estimateCost(model, inputTokens, outputTokens) {
  const pricing = {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-3.5': { input: 0.0005, output: 0.0015 },
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125 },
    'claude-3.5-sonnet': { input: 0.003, output: 0.015 },
    'llama': { input: 0, output: 0 },
    'mistral': { input: 0.0002, output: 0.0006 },
    'ollama': { input: 0, output: 0 },
  };

  const key = model ? Object.keys(pricing).find(k => model.toLowerCase().includes(k)) : null;
  const rate = key ? pricing[key] : { input: 0.003, output: 0.015 };
  return (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output;
}

function getSessionTracker(sessionId) {
  if (!sessionCosts.has(sessionId)) {
    sessionCosts.set(sessionId, { totalCost: 0, turns: 0, inputTokens: 0, outputTokens: 0, startedAt: Date.now() });
  }
  return sessionCosts.get(sessionId);
}

// --- SwarmClaw Format ---
module.exports = {
  name: 'Cost Tracker',
  description: 'Tracks token usage and estimated costs per agent chat. Provides a tool to check current session spend.',
  version: '1.0.0',
  openclaw: true,

  hooks: {
    afterAgentComplete(ctx) {
      const sessionId = ctx.session?.id || 'unknown';
      const model = ctx.session?.model || 'unknown';
      const responseLen = (ctx.response || '').length;
      const inputTokens = Math.ceil(responseLen / 4);
      const outputTokens = Math.ceil(responseLen / 4);
      const tracker = getSessionTracker(sessionId);
      tracker.turns++;
      tracker.inputTokens += inputTokens;
      tracker.outputTokens += outputTokens;
      tracker.totalCost += estimateCost(model, inputTokens, outputTokens);
    },
  },

  tools: [
    {
      name: 'check_session_cost',
      description: 'Check the estimated token usage and cost for the current chat session.',
      parameters: { type: 'object', properties: {} },
      execute(_args, ctx) {
        const sessionId = ctx?.session?.id || 'unknown';
        const tracker = getSessionTracker(sessionId);
        return JSON.stringify({
          sessionId,
          turns: tracker.turns,
          inputTokens: tracker.inputTokens,
          outputTokens: tracker.outputTokens,
          estimatedCost: `$${tracker.totalCost.toFixed(4)}`,
          duration: `${Math.round((Date.now() - tracker.startedAt) / 1000)}s`,
        }, null, 2);
      },
    },
  ],

  // --- OpenClaw Format ---
  activate(ctx) {
    ctx.onAgentComplete((agentCtx) => {
      const sessionId = agentCtx.session?.id || 'unknown';
      const model = agentCtx.session?.model || 'unknown';
      const responseLen = (agentCtx.response || '').length;
      const tokens = Math.ceil(responseLen / 4);
      const tracker = getSessionTracker(sessionId);
      tracker.turns++;
      tracker.inputTokens += tokens;
      tracker.outputTokens += tokens;
      tracker.totalCost += estimateCost(model, tokens, tokens);
    });
    ctx.registerTool({
      name: 'check_session_cost',
      description: 'Check estimated token usage and cost for the current session.',
      parameters: { type: 'object', properties: {} },
      execute() {
        const entries = Array.from(sessionCosts.entries()).map(([id, t]) => ({
          sessionId: id, turns: t.turns, cost: `$${t.totalCost.toFixed(4)}`,
        }));
        return JSON.stringify({ activeSessions: entries.length, sessions: entries.slice(-5) }, null, 2);
      },
    });
    ctx.log.info('Cost Tracker activated');
  },
  deactivate() { sessionCosts.clear(); },
};

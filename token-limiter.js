/**
 * Token Limiter — SwarmForge Plugin
 * Limits maximum tokens per agent response to prevent runaway costs.
 * Compatible with both SwarmClaw and OpenClaw plugin formats.
 */

const DEFAULT_MAX_TOKENS = 4096;

const MODEL_LIMITS = {
  'gpt-4': 8192,
  'gpt-4-turbo': 4096,
  'gpt-3.5-turbo': 2048,
  'claude-3-opus': 4096,
  'claude-3-sonnet': 4096,
  'claude-3-haiku': 2048,
  'claude-3.5-sonnet': 4096,
  'llama-3': 4096,
  'mistral': 2048,
};

function getLimit(model) {
  if (!model) return DEFAULT_MAX_TOKENS;
  const key = Object.keys(MODEL_LIMITS).find(k => model.toLowerCase().includes(k));
  return key ? MODEL_LIMITS[key] : DEFAULT_MAX_TOKENS;
}

function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  // Rough approximation: ~4 chars per token for English
  return Math.ceil(text.length / 4);
}

function truncateToLimit(text, maxTokens) {
  const estimated = estimateTokens(text);
  if (estimated <= maxTokens) return text;
  // Truncate to approximate char count and add notice
  const maxChars = maxTokens * 4;
  return text.slice(0, maxChars) + '\n\n[Response truncated by Token Limiter plugin — exceeded ' + maxTokens + ' token limit]';
}

// --- SwarmClaw Format ---
module.exports = {
  name: 'Token Limiter',
  description: 'Limits the maximum tokens per agent response to prevent runaway costs. Configurable per-model thresholds.',
  version: '1.0.0',

  hooks: {
    transformOutboundMessage(ctx) {
      const model = ctx.session?.model || ctx.session?.agent?.model;
      const limit = getLimit(model);
      return truncateToLimit(ctx.text, limit);
    },
  },

  tools: [
    {
      name: 'token_limiter_config',
      description: 'View or check current token limits per model.',
      parameters: {
        type: 'object',
        properties: {
          model: { type: 'string', description: 'Model name to check limit for' },
        },
      },
      execute(args) {
        if (args.model) {
          return JSON.stringify({
            model: args.model,
            limit: getLimit(args.model),
            defaultLimit: DEFAULT_MAX_TOKENS,
          });
        }
        return JSON.stringify({ limits: MODEL_LIMITS, default: DEFAULT_MAX_TOKENS }, null, 2);
      },
    },
  ],

  // --- OpenClaw Format ---
  activate(ctx) {
    ctx.onMessage((msgCtx) => {
      if (msgCtx.message?.role !== 'assistant') return;
      const model = msgCtx.session?.model;
      const limit = getLimit(model);
      if (msgCtx.message.content && typeof msgCtx.message.content === 'string') {
        msgCtx.message.content = truncateToLimit(msgCtx.message.content, limit);
      }
    });
    ctx.log.info('Token Limiter activated');
  },
  deactivate() {},
};

/**
 * Context Window — SwarmForge Plugin (OpenClaw Native)
 * Monitors and warns when conversation context is getting large.
 * Cross-compatible: works on both SwarmClaw and OpenClaw platforms.
 */

const WARNING_THRESHOLD = 50000; // ~50k tokens estimated
const CRITICAL_THRESHOLD = 100000; // ~100k tokens

function estimateContextTokens(messages) {
  if (!Array.isArray(messages)) return 0;
  let total = 0;
  for (const msg of messages) {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '');
    total += Math.ceil(content.length / 4);
  }
  return total;
}

// --- SwarmClaw Format ---
module.exports = {
  name: 'Context Window',
  description: 'Monitors conversation context size and warns agents when approaching model limits. Helps prevent context overflow.',
  version: '1.0.0',
  openclaw: true,

  hooks: {
    beforeAgentStart(ctx) {
      const messages = ctx.session?.messages || [];
      const tokens = estimateContextTokens(messages);
      if (tokens > CRITICAL_THRESHOLD) {
        console.warn(`[context-window] CRITICAL: ~${tokens} tokens in context for session ${ctx.session?.id}`);
      } else if (tokens > WARNING_THRESHOLD) {
        console.warn(`[context-window] WARNING: ~${tokens} tokens in context for session ${ctx.session?.id}`);
      }
    },
    transformInboundMessage(ctx) {
      const messages = ctx.session?.messages || [];
      const tokens = estimateContextTokens(messages);
      if (tokens > CRITICAL_THRESHOLD) {
        return ctx.text + '\n\n[System: Context is very large (~' + tokens + ' tokens). Consider summarizing the conversation or starting a new chat.]';
      }
      return ctx.text;
    },
  },

  tools: [
    {
      name: 'check_context_size',
      description: 'Check the estimated token count of the current conversation context.',
      parameters: { type: 'object', properties: {} },
      execute(_args, ctx) {
        const messages = ctx?.session?.messages || [];
        const tokens = estimateContextTokens(messages);
        const messageCount = messages.length;
        const status = tokens > CRITICAL_THRESHOLD ? 'critical' : tokens > WARNING_THRESHOLD ? 'warning' : 'ok';
        return JSON.stringify({
          estimatedTokens: tokens,
          messageCount,
          status,
          warningThreshold: WARNING_THRESHOLD,
          criticalThreshold: CRITICAL_THRESHOLD,
          recommendation: status === 'critical' ? 'Start a new chat or summarize context'
            : status === 'warning' ? 'Context is getting large, consider wrapping up'
            : 'Context size is healthy',
        }, null, 2);
      },
    },
  ],

  // --- OpenClaw Format ---
  activate(ctx) {
    ctx.onAgentStart((agentCtx) => {
      const messages = agentCtx.session?.messages || [];
      const tokens = estimateContextTokens(messages);
      if (tokens > WARNING_THRESHOLD) {
        ctx.log.warn(`Context size: ~${tokens} tokens (${tokens > CRITICAL_THRESHOLD ? 'CRITICAL' : 'WARNING'})`);
      }
    });
    ctx.registerTool({
      name: 'check_context_size',
      description: 'Check conversation context token count.',
      parameters: { type: 'object', properties: {} },
      execute() {
        return JSON.stringify({ message: 'Use within a session for accurate context measurement' });
      },
    });
    ctx.log.info('Context Window monitor activated');
  },
  deactivate() {},
};

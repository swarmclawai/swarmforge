/**
 * Webhook Notifier — SwarmForge Plugin
 * Sends HTTP webhooks on agent events.
 * Compatible with both SwarmClaw and OpenClaw plugin formats.
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(process.cwd(), 'data', 'webhook-notifier.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return { webhooks: [], enabled: true };
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

async function sendWebhook(url, payload) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* Fire and forget */ }
}

async function notifyAll(event, data) {
  const config = loadConfig();
  if (!config.enabled || !config.webhooks?.length) return;

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    source: 'swarmclaw',
    data,
  };

  await Promise.allSettled(
    config.webhooks
      .filter(w => w.enabled !== false && (!w.events || w.events.includes(event)))
      .map(w => sendWebhook(w.url, payload))
  );
}

// --- SwarmClaw Format ---
module.exports = {
  name: 'Webhook Notifier',
  description: 'Sends HTTP webhooks on agent events like task completion, errors, and tool executions. Supports Slack, Discord, and custom endpoints.',
  version: '1.0.0',

  hooks: {
    async afterAgentComplete(ctx) {
      await notifyAll('agent.complete', {
        sessionId: ctx.session?.id,
        agentId: ctx.session?.agentId,
        responseLength: ctx.response?.length || 0,
      });
    },
    async afterToolExec(ctx) {
      await notifyAll('tool.complete', {
        tool: ctx.toolName,
        outputLength: typeof ctx.output === 'string' ? ctx.output.length : 0,
      });
    },
    async onTaskComplete(ctx) {
      await notifyAll('task.complete', {
        taskId: ctx.taskId,
        result: typeof ctx.result === 'string' ? ctx.result.slice(0, 500) : ctx.result,
      });
    },
  },

  tools: [
    {
      name: 'webhook_manage',
      description: 'Add, remove, list, or test webhook endpoints.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'add', 'remove', 'test'] },
          url: { type: 'string', description: 'Webhook URL (for add/remove/test)' },
          events: { type: 'array', items: { type: 'string' }, description: 'Event types to subscribe to (default: all)' },
        },
        required: ['action'],
      },
      async execute(args) {
        const config = loadConfig();

        switch (args.action) {
          case 'list':
            return JSON.stringify({ enabled: config.enabled, webhooks: config.webhooks || [] }, null, 2);
          case 'add':
            if (!args.url) return 'URL required';
            config.webhooks = config.webhooks || [];
            config.webhooks.push({ url: args.url, events: args.events || null, enabled: true, addedAt: new Date().toISOString() });
            saveConfig(config);
            return `Added webhook: ${args.url}`;
          case 'remove':
            if (!args.url) return 'URL required';
            config.webhooks = (config.webhooks || []).filter(w => w.url !== args.url);
            saveConfig(config);
            return `Removed webhook: ${args.url}`;
          case 'test':
            if (!args.url) return 'URL required';
            await sendWebhook(args.url, { event: 'test', timestamp: new Date().toISOString(), source: 'swarmclaw', data: { message: 'Webhook test from SwarmClaw' } });
            return `Test webhook sent to ${args.url}`;
          default:
            return 'Unknown action. Use list, add, remove, or test.';
        }
      },
    },
  ],

  // --- OpenClaw Format ---
  activate(ctx) {
    ctx.onAgentComplete(async (agentCtx) => {
      await notifyAll('agent.complete', { sessionId: agentCtx.session?.id });
    });
    ctx.onToolResult(async (toolCtx) => {
      await notifyAll('tool.complete', { tool: toolCtx.toolName });
    });
    ctx.log.info('Webhook Notifier activated');
  },
  deactivate() {},
};

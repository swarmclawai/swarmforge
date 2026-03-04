/**
 * OpenClaw Bridge — SwarmForge Plugin
 * Bridges OpenClaw lifecycle events to SwarmClaw hooks.
 * Compatible with both SwarmClaw and OpenClaw plugin formats.
 */

const fs = require('fs');
const path = require('path');

const OPENCLAW_PLUGINS_DIR = path.join(process.cwd(), 'data', 'openclaw');

function discoverOpenClawPlugins() {
  const plugins = [];
  try {
    if (!fs.existsSync(OPENCLAW_PLUGINS_DIR)) return plugins;
    const files = fs.readdirSync(OPENCLAW_PLUGINS_DIR).filter(f => f.endsWith('.js') || f.endsWith('.mjs'));
    for (const file of files) {
      try {
        const fullPath = path.join(OPENCLAW_PLUGINS_DIR, file);
        delete require.cache[fullPath];
        const mod = require(fullPath);
        const raw = mod.default || mod;
        if (raw.name && typeof raw.activate === 'function') {
          plugins.push({ file, plugin: raw });
        }
      } catch { /* skip invalid */ }
    }
  } catch { /* ignore */ }
  return plugins;
}

// --- SwarmClaw Format ---
module.exports = {
  name: 'OpenClaw Bridge',
  description: 'Bridges OpenClaw lifecycle events to SwarmClaw hooks, enabling OpenClaw-format plugins to run natively in SwarmClaw.',
  version: '1.0.0',
  openclaw: true,

  hooks: {
    beforeAgentStart(ctx) {
      // Discover and activate any OpenClaw plugins found in data/openclaw/
      const ocPlugins = discoverOpenClawPlugins();
      for (const { plugin } of ocPlugins) {
        try {
          if (!plugin._activated) {
            plugin.activate({
              onAgentStart: () => {},
              onAgentComplete: () => {},
              onToolCall: () => {},
              onToolResult: () => {},
              onMessage: () => {},
              registerTool: () => {},
              log: {
                info: (msg) => console.log(`[openclaw:${plugin.name}]`, msg),
                warn: (msg) => console.warn(`[openclaw:${plugin.name}]`, msg),
                error: (msg) => console.error(`[openclaw:${plugin.name}]`, msg),
              },
            });
            plugin._activated = true;
          }
        } catch { /* skip failed activation */ }
      }
    },
  },

  tools: [
    {
      name: 'openclaw_bridge_status',
      description: 'List discovered OpenClaw plugins in data/openclaw/ directory.',
      parameters: { type: 'object', properties: {} },
      execute() {
        const plugins = discoverOpenClawPlugins();
        if (plugins.length === 0) {
          return JSON.stringify({
            status: 'active',
            pluginsDir: OPENCLAW_PLUGINS_DIR,
            discovered: 0,
            message: 'No OpenClaw plugins found. Place .js files with activate() in data/openclaw/',
          }, null, 2);
        }
        return JSON.stringify({
          status: 'active',
          pluginsDir: OPENCLAW_PLUGINS_DIR,
          discovered: plugins.length,
          plugins: plugins.map(p => ({
            file: p.file,
            name: p.plugin.name,
            version: p.plugin.version || 'unknown',
          })),
        }, null, 2);
      },
    },
  ],

  // --- OpenClaw Format ---
  activate(ctx) {
    ctx.log.info('OpenClaw Bridge activated — scanning data/openclaw/ for plugins');
    const ocPlugins = discoverOpenClawPlugins();
    for (const { file, plugin } of ocPlugins) {
      try {
        plugin.activate({
          onAgentStart: ctx.onAgentStart || (() => {}),
          onAgentComplete: ctx.onAgentComplete || (() => {}),
          onToolCall: ctx.onToolCall || (() => {}),
          onToolResult: ctx.onToolResult || (() => {}),
          onMessage: ctx.onMessage || (() => {}),
          registerTool: ctx.registerTool || (() => {}),
          log: ctx.log,
        });
        ctx.log.info(`Bridged OpenClaw plugin: ${plugin.name} (${file})`);
      } catch (err) {
        ctx.log.error(`Failed to bridge ${file}: ${err.message}`);
      }
    }
  },
  deactivate() {},
};

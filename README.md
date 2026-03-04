# swarmforge

Official plugin registry for [SwarmClaw](https://github.com/swarmclawai/swarmclaw-app). Dual-compatible with both SwarmClaw and OpenClaw plugin formats.

## Plugins

| Plugin | Description |
|-|-|
| `tool-logger` | Logs all tool executions with timestamps, inputs, and outputs |
| `shell-gate` | Blocks dangerous shell commands before they reach the terminal |
| `token-limiter` | Limits max tokens per response to prevent runaway costs |
| `memory-auto-save` | Auto-detects and saves important facts to the memory store |
| `webhook-notifier` | Sends webhooks on agent events (Slack, Discord, custom) |
| `response-filter` | Redacts API keys, passwords, PII from agent responses |
| `openclaw-bridge` | Bridges OpenClaw plugins to run natively in SwarmClaw |
| `task-auto-create` | Extracts TODOs and action items into tasks automatically |

## Install

From SwarmClaw's plugin manager, switch to the **SwarmForge** tab and click Install on any plugin.

Or install manually:
```
https://raw.githubusercontent.com/swarmclawai/swarmforge/main/<plugin-name>.js
```

## Plugin Format

Every plugin in this registry is dual-compatible:

**SwarmClaw format** — `module.exports` with `name`, `hooks`, `tools`:
```js
module.exports = {
  name: 'My Plugin',
  hooks: {
    afterAgentComplete(ctx) { /* ... */ },
  },
  tools: [{ name: '...', execute(args) { /* ... */ } }],
};
```

**OpenClaw format** — `activate(ctx)` / `deactivate()`:
```js
module.exports = {
  name: 'My Plugin',
  activate(ctx) {
    ctx.onAgentComplete((agentCtx) => { /* ... */ });
    ctx.registerTool({ name: '...', execute(args) { /* ... */ } });
  },
  deactivate() {},
};
```

## Contributing

Add a `.js` file to the root with both SwarmClaw and OpenClaw format exports. Open a PR.

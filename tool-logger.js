/**
 * Tool Logger — SwarmForge Plugin
 * Logs all tool executions with timestamps, inputs, and outputs.
 * Compatible with both SwarmClaw and OpenClaw plugin formats.
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'data', 'tool-logs');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB per log file

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogPath() {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `tools-${date}.jsonl`);
}

function rotateIfNeeded(logPath) {
  try {
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > MAX_LOG_SIZE) {
      fs.renameSync(logPath, logPath.replace('.jsonl', `-${Date.now()}.jsonl`));
    }
  } catch { /* ignore rotation errors */ }
}

function logEntry(entry) {
  ensureLogDir();
  const logPath = getLogPath();
  rotateIfNeeded(logPath);
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
}

// --- SwarmClaw Format ---
module.exports = {
  name: 'Tool Logger',
  description: 'Logs all tool executions with timestamps, inputs, and outputs to a local audit file for debugging and compliance.',
  version: '1.0.0',

  hooks: {
    beforeToolExec(ctx) {
      ctx._toolLogStart = Date.now();
    },
    afterToolExec(ctx) {
      const duration = ctx._toolLogStart ? Date.now() - ctx._toolLogStart : null;
      logEntry({
        ts: new Date().toISOString(),
        tool: ctx.toolName,
        input: ctx.input,
        output: typeof ctx.output === 'string' ? ctx.output.slice(0, 2000) : ctx.output,
        durationMs: duration,
      });
    },
  },

  tools: [
    {
      name: 'view_tool_logs',
      description: 'View recent tool execution logs from today.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of recent entries to show (default 20)' },
        },
      },
      execute(args) {
        const limit = args.limit || 20;
        const logPath = getLogPath();
        if (!fs.existsSync(logPath)) return 'No tool logs for today.';
        const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
        const recent = lines.slice(-limit);
        return JSON.stringify(recent.map(l => { try { return JSON.parse(l); } catch { return l; } }), null, 2);
      },
    },
  ],

  // --- OpenClaw Format ---
  activate(ctx) {
    ctx.onToolCall((toolCtx) => {
      toolCtx._toolLogStart = Date.now();
    });
    ctx.onToolResult((toolCtx) => {
      const duration = toolCtx._toolLogStart ? Date.now() - toolCtx._toolLogStart : null;
      logEntry({
        ts: new Date().toISOString(),
        tool: toolCtx.toolName,
        input: toolCtx.input,
        output: typeof toolCtx.output === 'string' ? toolCtx.output.slice(0, 2000) : toolCtx.output,
        durationMs: duration,
      });
    });
    ctx.registerTool({
      name: 'view_tool_logs',
      description: 'View recent tool execution logs from today.',
      parameters: { type: 'object', properties: { limit: { type: 'number' } } },
      execute(args) {
        const limit = args.limit || 20;
        const logPath = getLogPath();
        if (!fs.existsSync(logPath)) return 'No tool logs for today.';
        const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
        return JSON.stringify(lines.slice(-limit).map(l => { try { return JSON.parse(l); } catch { return l; } }), null, 2);
      },
    });
    ctx.log.info('Tool Logger activated');
  },
  deactivate() {},
};

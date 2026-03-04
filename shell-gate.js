/**
 * Shell Gate — SwarmForge Plugin
 * Blocks dangerous shell commands before they reach the terminal.
 * Compatible with both SwarmClaw and OpenClaw plugin formats.
 */

const BLOCKED_PATTERNS = [
  /\brm\s+(-[rRf]+\s+)*[\/~]/,        // rm -rf /
  /\bchmod\s+777\b/,                    // chmod 777
  /\bdd\s+if=/,                          // dd if=
  /\bmkfs\b/,                            // mkfs (format disk)
  />\s*\/dev\/sd[a-z]/,                  // write to raw disk
  /\b:()\s*\{\s*:\|\s*:\s*&\s*\}/,      // fork bomb
  /\bshutdown\b/,                        // shutdown
  /\breboot\b/,                          // reboot
  /\bkill\s+-9\s+1\b/,                  // kill init
  /\bcurl\b.*\|\s*(ba)?sh/,             // curl pipe to shell
  /\bwget\b.*\|\s*(ba)?sh/,             // wget pipe to shell
];

const BLOCKED_EXACT = new Set([
  'rm -rf /',
  'rm -rf /*',
  'rm -rf ~',
  'rm -rf ~/*',
  ':() { :|:& };:',
]);

function checkCommand(command) {
  if (!command || typeof command !== 'string') return null;
  const trimmed = command.trim();

  if (BLOCKED_EXACT.has(trimmed)) {
    return `Blocked dangerous command: "${trimmed}"`;
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return `Blocked command matching safety rule: ${pattern.toString()}`;
    }
  }

  return null;
}

// --- SwarmClaw Format ---
module.exports = {
  name: 'Shell Gate',
  description: 'Blocks dangerous shell commands like rm -rf /, chmod 777, and dd before they reach the terminal. Configurable blocklist.',
  version: '1.0.0',

  hooks: {
    beforeToolExec(ctx) {
      if (ctx.toolName !== 'execute_command' && ctx.toolName !== 'shell') return;
      const cmd = ctx.input?.command || ctx.input?.cmd || '';
      const blocked = checkCommand(cmd);
      if (blocked) {
        return { blocked: true, error: blocked };
      }
    },
  },

  tools: [
    {
      name: 'shell_gate_status',
      description: 'Show current Shell Gate blocked patterns and status.',
      parameters: { type: 'object', properties: {} },
      execute() {
        return JSON.stringify({
          enabled: true,
          blockedPatterns: BLOCKED_PATTERNS.length,
          exactBlocks: BLOCKED_EXACT.size,
          patterns: BLOCKED_PATTERNS.map(p => p.toString()),
        }, null, 2);
      },
    },
  ],

  // --- OpenClaw Format ---
  activate(ctx) {
    ctx.onToolCall((toolCtx) => {
      if (toolCtx.toolName !== 'execute_command' && toolCtx.toolName !== 'shell') return;
      const cmd = toolCtx.input?.command || toolCtx.input?.cmd || '';
      const blocked = checkCommand(cmd);
      if (blocked) {
        return { blocked: true, error: blocked };
      }
    });
    ctx.log.info('Shell Gate activated — dangerous commands will be blocked');
  },
  deactivate() {},
};

/**
 * Task Auto-Create — SwarmForge Plugin
 * Parses agent responses for actionable items and creates tasks.
 * Compatible with both SwarmClaw and OpenClaw plugin formats.
 */

const ACTION_PATTERNS = [
  /(?:TODO|TO-DO|TO DO):\s*(.+)/gi,
  /(?:ACTION ITEM|ACTION):\s*(.+)/gi,
  /(?:NEXT STEP|FOLLOW[- ]?UP):\s*(.+)/gi,
  /(?:^\s*[-*]\s*\[ \])\s*(.+)/gm,  // Markdown unchecked checkbox
];

const MIN_TASK_LENGTH = 10;
const MAX_TASK_LENGTH = 200;

function extractTasks(text) {
  if (!text || typeof text !== 'string') return [];

  const tasks = [];
  const seen = new Set();

  for (const pattern of ACTION_PATTERNS) {
    let match;
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const task = (match[1] || '').trim();
      if (task.length >= MIN_TASK_LENGTH && task.length <= MAX_TASK_LENGTH && !seen.has(task.toLowerCase())) {
        seen.add(task.toLowerCase());
        tasks.push(task);
      }
    }
  }

  return tasks.slice(0, 10); // Cap at 10 tasks per response
}

async function createTask(title, session) {
  try {
    await fetch(`http://localhost:${process.env.PORT || 3456}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': process.env.ACCESS_KEY || '',
      },
      body: JSON.stringify({
        title,
        status: 'todo',
        agentId: session?.agentId || session?.agent?.id,
        source: 'auto-extracted',
        metadata: { plugin: 'task-auto-create' },
      }),
    });
  } catch { /* Task API may not be available */ }
}

// --- SwarmClaw Format ---
module.exports = {
  name: 'Task Auto-Create',
  description: 'Parses agent responses for actionable items and automatically creates tasks on the task board with appropriate status.',
  version: '1.0.0',
  openclaw: true,

  hooks: {
    async afterAgentComplete(ctx) {
      const tasks = extractTasks(ctx.response);
      for (const title of tasks) {
        await createTask(title, ctx.session);
      }
    },
  },

  tools: [
    {
      name: 'task_auto_create_test',
      description: 'Test task extraction on sample text without creating actual tasks.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to analyze for actionable items' },
        },
        required: ['text'],
      },
      execute(args) {
        const tasks = extractTasks(args.text);
        return JSON.stringify({
          tasksFound: tasks.length,
          tasks,
          patterns: ACTION_PATTERNS.length,
        }, null, 2);
      },
    },
  ],

  // --- OpenClaw Format ---
  register(api) {
    api.registerHook('agent:complete', async (agentCtx) => {
      const tasks = extractTasks(agentCtx.response);
      if (tasks.length > 0) {
        api.log.info(`Auto-creating ${tasks.length} task(s)`);
        for (const title of tasks) {
          await createTask(title, agentCtx.session);
        }
      }
    });
    api.registerTool({
      name: 'task_auto_create_test',
      description: 'Test task extraction on text.',
      parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      execute(args) {
        return JSON.stringify({ tasksFound: extractTasks(args.text).length, tasks: extractTasks(args.text) }, null, 2);
      },
    });
    api.log.info('Task Auto-Create activated');
  },
};

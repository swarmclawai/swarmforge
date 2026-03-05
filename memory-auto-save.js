/**
 * Memory Auto-Save — SwarmForge Plugin
 * Automatically detects and saves important facts from agent responses.
 * Compatible with both SwarmClaw and OpenClaw plugin formats.
 */

const IMPORTANCE_PATTERNS = [
  /\b(remember|note|important|key (point|fact|takeaway))\b/i,
  /\b(decided|agreed|confirmed|established)\b/i,
  /\b(password|api[- ]?key|secret|credential|token)\b/i,
  /\b(deadline|due date|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
  /\b(action item|todo|next step|follow[- ]?up)\b/i,
  /\b(preference|always|never|rule)\b/i,
];

const MIN_LENGTH = 20;
const MAX_EXTRACT_LENGTH = 500;

function extractImportantFacts(text) {
  if (!text || text.length < MIN_LENGTH) return [];

  const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > MIN_LENGTH);
  const facts = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length > MAX_EXTRACT_LENGTH) continue;

    for (const pattern of IMPORTANCE_PATTERNS) {
      if (pattern.test(trimmed)) {
        facts.push(trimmed);
        break;
      }
    }
  }

  return facts.slice(0, 5); // Cap at 5 facts per response
}

async function saveToMemory(facts, session) {
  if (!facts.length) return;

  // Use the internal memory API if available
  try {
    const agentId = session?.agentId || session?.agent?.id || 'system';
    for (const fact of facts) {
      await fetch(`http://localhost:${process.env.PORT || 3456}/api/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Access-Key': process.env.ACCESS_KEY || '',
        },
        body: JSON.stringify({
          agentId,
          content: fact,
          type: 'auto_extracted',
          metadata: { source: 'memory-auto-save-plugin' },
        }),
      });
    }
  } catch { /* Memory API may not be available */ }
}

// --- SwarmClaw Format ---
module.exports = {
  name: 'Memory Auto-Save',
  description: 'Automatically detects and saves important facts, decisions, and context from agent responses to the memory store.',
  version: '1.0.0',
  openclaw: true,

  hooks: {
    async afterAgentComplete(ctx) {
      const facts = extractImportantFacts(ctx.response);
      if (facts.length > 0) {
        await saveToMemory(facts, ctx.session);
      }
    },
  },

  tools: [
    {
      name: 'memory_auto_save_test',
      description: 'Test fact extraction on a given text to see what would be auto-saved.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to analyze for important facts' },
        },
        required: ['text'],
      },
      execute(args) {
        const facts = extractImportantFacts(args.text);
        return JSON.stringify({
          factsFound: facts.length,
          facts,
          patterns: IMPORTANCE_PATTERNS.length,
        }, null, 2);
      },
    },
  ],

  // --- OpenClaw Format ---
  register(api) {
    api.registerHook('agent:complete', async (agentCtx) => {
      const facts = extractImportantFacts(agentCtx.response);
      if (facts.length > 0) {
        api.log.info(`Auto-saving ${facts.length} facts`);
        await saveToMemory(facts, agentCtx.session);
      }
    });
    api.registerTool({
      name: 'memory_auto_save_test',
      description: 'Test fact extraction on text.',
      parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      execute(args) {
        return JSON.stringify({ factsFound: extractImportantFacts(args.text).length, facts: extractImportantFacts(args.text) }, null, 2);
      },
    });
    api.log.info('Memory Auto-Save activated');
  },
};

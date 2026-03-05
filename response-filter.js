/**
 * Response Filter — SwarmForge Plugin
 * Scans agent responses for sensitive data and redacts them.
 * Compatible with both SwarmClaw and OpenClaw plugin formats.
 */

const REDACTION_PATTERNS = [
  { name: 'API Key', pattern: /\b(sk|pk|api|key)[_-][a-zA-Z0-9]{20,}\b/gi, replacement: '[REDACTED_API_KEY]' },
  { name: 'AWS Key', pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: '[REDACTED_AWS_KEY]' },
  { name: 'AWS Secret', pattern: /\b[A-Za-z0-9/+=]{40}\b(?=\s|$)/g, replacement: '[REDACTED_AWS_SECRET]' },
  { name: 'Bearer Token', pattern: /Bearer\s+[a-zA-Z0-9._-]{20,}/gi, replacement: 'Bearer [REDACTED_TOKEN]' },
  { name: 'JWT', pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, replacement: '[REDACTED_JWT]' },
  { name: 'Password Field', pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']?[^\s"',;]{4,}/gi, replacement: 'password=[REDACTED]' },
  { name: 'Private Key', pattern: /-----BEGIN\s+(RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END\s+(RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' },
  { name: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_SSN]' },
  { name: 'Credit Card', pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g, replacement: '[REDACTED_CC]' },
  { name: 'Email', pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, replacement: '[REDACTED_EMAIL]' },
];

function redactText(text) {
  if (!text || typeof text !== 'string') return { text, redactions: 0 };

  let result = text;
  let redactions = 0;

  for (const rule of REDACTION_PATTERNS) {
    const matches = result.match(rule.pattern);
    if (matches) {
      redactions += matches.length;
      result = result.replace(rule.pattern, rule.replacement);
    }
  }

  return { text: result, redactions };
}

// --- SwarmClaw Format ---
module.exports = {
  name: 'Response Filter',
  description: 'Scans agent responses for sensitive data like API keys, passwords, and PII, then redacts them before display.',
  version: '1.0.0',
  openclaw: true,

  hooks: {
    transformOutboundMessage(ctx) {
      const { text, redactions } = redactText(ctx.text);
      if (redactions > 0) {
        console.log(`[response-filter] Redacted ${redactions} sensitive item(s)`);
      }
      return text;
    },
  },

  tools: [
    {
      name: 'response_filter_test',
      description: 'Test the response filter on sample text to see what would be redacted.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to scan for sensitive data' },
        },
        required: ['text'],
      },
      execute(args) {
        const { text, redactions } = redactText(args.text);
        return JSON.stringify({
          redactionsFound: redactions,
          redactedText: text,
          rulesActive: REDACTION_PATTERNS.length,
        }, null, 2);
      },
    },
  ],

  // --- OpenClaw Format ---
  register(api) {
    api.registerHook('message:outbound', (msgCtx) => {
      if (msgCtx.message?.role !== 'assistant') return;
      if (msgCtx.message.content && typeof msgCtx.message.content === 'string') {
        const { text, redactions } = redactText(msgCtx.message.content);
        if (redactions > 0) {
          api.log.info(`Redacted ${redactions} sensitive item(s)`);
          msgCtx.message.content = text;
        }
      }
    });
    api.log.info('Response Filter activated');
  },
};

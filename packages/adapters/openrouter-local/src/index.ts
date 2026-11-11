export const type = "openrouter_local";
export const label = "OpenRouter";

export const DEFAULT_OPENROUTER_LOCAL_MODEL = "openrouter/anthropic/claude-sonnet-4-5";

export function isValidOpenRouterModelId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  // OpenRouter models are in format: provider/model-name
  const slashIndex = trimmed.indexOf("/");
  return Boolean(trimmed) && slashIndex > 0 && slashIndex !== trimmed.length - 1;
}

export const models: Array<{ id: string; label: string }> = [
  { id: DEFAULT_OPENROUTER_LOCAL_MODEL, label: "Claude Sonnet 4.5 (default)" },
  { id: "openrouter/anthropic/claude-opus-4.1", label: "Claude Opus 4.1" },
  { id: "openrouter/anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { id: "openrouter/anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "openrouter/openai/gpt-5", label: "GPT-5" },
  { id: "openrouter/openai/gpt-5.1", label: "GPT-5.1" },
  { id: "openrouter/openai/gpt-5.2", label: "GPT-5.2" },
  { id: "openrouter/openai/gpt-5.3-codex", label: "GPT-5.3 Codex" },
  { id: "openrouter/google/gemini-3.8-flash", label: "Gemini 3.8 Flash" },
  { id: "openrouter/google/gemini-3.7-flash", label: "Gemini 3.7 Flash" },
  { id: "openrouter/google/gemini-3.5-pro", label: "Gemini 3.5 Pro" },
  { id: "openrouter/xai/grok-4.7", label: "Grok 4.7" },
  { id: "openrouter/meta-llama/llama-4-maverick", label: "Llama 4 Maverick" },
  { id: "openrouter/meta-llama/llama-4-scout", label: "Llama 4 Scout" },
  { id: "openrouter/qwen/qwen-3-235b-a22b-thinking", label: "Qwen 3 235B" },
  { id: "openrouter/deepseek/deepseek-v4-flash-0731", label: "DeepSeek V4 Flash" },
];

export const agentConfigurationDoc = `# openrouter_local agent configuration

Adapter: openrouter_local

Use when:
- You want Paperclip to run agent tasks using OpenRouter's unified API
- You want access to multiple model providers (Anthropic, OpenAI, Google, Meta, etc.) through a single API key
- You want to use models that are available on OpenRouter but not natively supported by other adapters

Don't use when:
- You need webhook-style external invocation (use openclaw_gateway or http)
- You only need one-shot shell commands (use process)
- You prefer to use a provider's native CLI (use claude_local, codex_local, etc.)

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to the run prompt
- model (string, required): OpenRouter model id in provider/model format (for example openrouter/anthropic/claude-sonnet-4-5)
- promptTemplate (string, optional): run prompt template
- apiKey (string, optional): OpenRouter API key (can also be set via OPENROUTER_API_KEY environment variable)
- extraHeaders (object, optional): additional HTTP headers to include in requests
- timeoutSec (number, optional): request timeout in seconds (default: 300)
- maxTokens (number, optional): maximum tokens in response
- temperature (number, optional): sampling temperature (0-2)

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- OpenRouter provides a unified API for 100+ models from multiple providers
- The adapter uses the OpenRouter Chat Completions API (OpenAI-compatible)
- Set OPENROUTER_API_KEY environment variable or provide apiKey in adapterConfig
- Models are specified in OpenRouter format: provider/model-name (e.g., anthropic/claude-sonnet-4-5)
- The adapter streams responses for real-time output
- Paperclip injects instructions and context into the system prompt
`;
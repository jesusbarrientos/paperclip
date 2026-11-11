import type { AdapterConfigSchema } from "@paperclipai/adapter-utils";

export const getConfigSchema = (): AdapterConfigSchema => ({
  fields: [
    {
      key: "model",
      label: "Model",
      type: "combobox",
      required: true,
      hint: "OpenRouter model ID in provider/model format (e.g., anthropic/claude-sonnet-4-5)",
    },
    {
      key: "apiKey",
      label: "OpenRouter API Key",
      type: "text",
      required: false,
      hint: "OpenRouter API key (can also be set via OPENROUTER_API_KEY env var)",
    },
    {
      key: "cwd",
      label: "Working Directory",
      type: "text",
      required: false,
      hint: "Default absolute working directory for the agent process",
    },
    {
      key: "instructionsFilePath",
      label: "Instructions File",
      type: "text",
      required: false,
      hint: "Absolute path to a markdown instructions file prepended to the run prompt",
    },
    {
      key: "promptTemplate",
      label: "Prompt Template",
      type: "textarea",
      required: false,
      hint: "Custom prompt template (use {{instructions}} and {{input}} placeholders)",
    },
    {
      key: "extraHeaders",
      label: "Extra Headers (JSON)",
      type: "textarea",
      required: false,
      hint: "Additional HTTP headers to include in requests (JSON object)",
    },
    {
      key: "timeoutSec",
      label: "Request Timeout (seconds)",
      type: "number",
      required: false,
      hint: "Request timeout in seconds (default: 300)",
    },
    {
      key: "maxTokens",
      label: "Max Tokens",
      type: "number",
      required: false,
      hint: "Maximum tokens in response",
    },
    {
      key: "temperature",
      label: "Temperature",
      type: "number",
      required: false,
      hint: "Sampling temperature (0-2)",
    },
    {
      key: "extraArgs",
      label: "Extra CLI Args (JSON array)",
      type: "textarea",
      required: false,
      hint: "Additional CLI arguments (not used for OpenRouter API adapter)",
    },
    {
      key: "env",
      label: "Environment Variables (JSON)",
      type: "textarea",
      required: false,
      hint: "KEY=VALUE environment variables as JSON object",
    },
  ],
});
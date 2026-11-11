import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import { asString, parseObject } from "@paperclipai/adapter-utils/server-utils";

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface OpenRouterStreamChunk {
  id: string;
  choices: Array<{
    delta: Partial<OpenRouterMessage>;
    finish_reason: string | null;
  }>;
}

function getApiKey(config: Record<string, unknown>): string | null {
  // First check adapter config
  const configKey = config.apiKey;
  if (typeof configKey === "string" && configKey.trim().length > 0) {
    return configKey.trim();
  }
  // Then check environment variable
  const envKey = process.env.OPENROUTER_API_KEY;
  if (typeof envKey === "string" && envKey.trim().length > 0) {
    return envKey.trim();
  }
  return null;
}

function buildSystemPrompt(instructions: string | null, config: Record<string, unknown>): string {
  const parts: string[] = [];
  
  if (instructions) {
    parts.push(instructions);
  }
  
  // Add any additional system context from config
  const systemPrompt = config.systemPrompt;
  if (typeof systemPrompt === "string" && systemPrompt.trim().length > 0) {
    parts.push(systemPrompt.trim());
  }
  
  return parts.join("\n\n");
}

function getInputFromContext(context: Record<string, unknown>): string {
  // Try multiple possible locations for the input
  if (typeof context.input === "string" && context.input.trim().length > 0) {
    return context.input.trim();
  }
  if (typeof context.payload === "string" && context.payload.trim().length > 0) {
    return context.payload.trim();
  }
  if (typeof context.prompt === "string" && context.prompt.trim().length > 0) {
    return context.prompt.trim();
  }
  // Fallback: check if there's a connectionInstructions with text
  const connectionInstructions = parseObject(context.connectionInstructions);
  if (typeof connectionInstructions.text === "string" && connectionInstructions.text.trim().length > 0) {
    return connectionInstructions.text.trim();
  }
  return "";
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, context, onLog, onMeta, signal } = ctx;
  
  // Get API key
  const apiKey = getApiKey(config);
  if (!apiKey) {
    await onLog("stderr", "OpenRouter API key not configured. Set apiKey in adapter config or OPENROUTER_API_KEY environment variable.\n");
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "OpenRouter API key not configured",
      errorCode: "openrouter_api_key_missing",
      provider: "openrouter",
      summary: "Missing OpenRouter API key",
    };
  }
  
  // Get model
  const model = typeof config.model === "string" && config.model.trim().length > 0
    ? config.model.trim()
    : "openrouter/anthropic/claude-sonnet-4-5";
  
  // Get instructions from config (instructionsFilePath would need file reading)
  // For now, we'll use systemPrompt from config if provided
  const instructions = typeof config.systemPrompt === "string" && config.systemPrompt.trim().length > 0
    ? config.systemPrompt.trim()
    : null;
  
  // Build messages
  const systemPrompt = buildSystemPrompt(instructions, config);
  const messages: OpenRouterMessage[] = [];
  
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  
  // Get user input from context
  const userInput = getInputFromContext(context);
  if (userInput) {
    messages.push({ role: "user", content: userInput });
  } else {
    await onLog("stderr", "No input provided for OpenRouter completion\n");
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "No input provided",
      errorCode: "openrouter_no_input",
      provider: "openrouter",
      summary: "No input provided",
    };
  }
  
  // Build request
  const request: OpenRouterRequest = {
    model,
    messages,
    max_tokens: typeof config.maxTokens === "number" ? config.maxTokens : undefined,
    temperature: typeof config.temperature === "number" ? config.temperature : 0.7,
    stream: true,
  };
  
  const extraHeaders = typeof config.extraHeaders === "object" && config.extraHeaders !== null
    ? config.extraHeaders as Record<string, string>
    : {};
  
  // Add OpenRouter specific headers
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://paperclip.ai",
    "X-Title": "Paperclip",
    ...extraHeaders,
  };
  
  const timeoutSec = typeof config.timeoutSec === "number" ? config.timeoutSec : 300;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutSec * 1000);
  
  // Also respect the context signal
  signal?.addEventListener("abort", () => controller.abort());
  
  try {
    await onMeta?.({
      adapterType: "openrouter_local",
      command: "openrouter-chat",
      commandNotes: [`Model: ${model}`, `Streaming: true`],
    });
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      await onLog("stderr", `OpenRouter API error: ${response.status} ${response.statusText}\n${errorText}\n`);
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: `OpenRouter API error: ${response.status} ${response.statusText}`,
        errorCode: "openrouter_api_error",
        provider: "openrouter",
        summary: `API error: ${response.status}`,
      };
    }
    
    // Handle streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      await onLog("stderr", "No response body from OpenRouter\n");
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: "No response body from OpenRouter",
        errorCode: "openrouter_no_body",
        provider: "openrouter",
        summary: "Empty response",
      };
    }
    
    let fullContent = "";
    let finishReason = "stop";
    
    const decoder = new TextDecoder();
    let buffer = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        
        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6);
          try {
            const chunk: OpenRouterStreamChunk = JSON.parse(jsonStr);
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
              fullContent += delta.content;
              await onLog("stdout", delta.content);
            }
            if (chunk.choices[0]?.finish_reason) {
              finishReason = chunk.choices[0].finish_reason;
            }
          } catch {
            // Ignore parse errors for malformed chunks
          }
        }
      }
    }
    
    // Process any remaining buffer
    if (buffer.trim() && buffer.trim() !== "data: [DONE]") {
      if (buffer.trim().startsWith("data: ")) {
        try {
          const chunk: OpenRouterStreamChunk = JSON.parse(buffer.trim().slice(6));
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            await onLog("stdout", delta.content);
          }
          if (chunk.choices[0]?.finish_reason) {
            finishReason = chunk.choices[0].finish_reason;
          }
        } catch {
          // Ignore
        }
      }
    }
    
    await onLog("stdout", "\n");
    
    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      provider: "openrouter",
      summary: `OpenRouter completion (${model}, ${finishReason})`,
    };
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === "AbortError") {
      await onLog("stderr", "OpenRouter request timed out\n");
      return {
        exitCode: 1,
        signal: "SIGTERM",
        timedOut: true,
        errorMessage: "Request timed out",
        errorCode: "openrouter_timeout",
        provider: "openrouter",
        summary: "Request timed out",
      };
    }
    
    const message = error instanceof Error ? error.message : "Unknown error";
    await onLog("stderr", `OpenRouter execution error: ${message}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: message,
      errorCode: "openrouter_execution_error",
      provider: "openrouter",
      summary: `Execution error: ${message}`,
    };
  }
}
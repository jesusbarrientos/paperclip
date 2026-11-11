import type { AdapterEnvironmentTestResult } from "@paperclipai/adapter-utils";

export async function testEnvironment(): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentTestResult["checks"] = [];
  
  // Check if API key is available
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    checks.push({
      code: "openrouter_api_key_present",
      level: "info",
      message: "OPENROUTER_API_KEY environment variable is set",
    });
  } else {
    checks.push({
      code: "openrouter_api_key_missing",
      level: "warn",
      message: "OPENROUTER_API_KEY environment variable is not set (can be provided in adapter config)",
      hint: "Set OPENROUTER_API_KEY or provide apiKey in adapterConfig",
    });
  }
  
  // Test API connectivity if key is available
  if (apiKey && apiKey.trim().length > 0) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        signal: AbortSignal.timeout(5_000),
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });
      if (response.ok) {
        checks.push({
          code: "openrouter_api_reachable",
          level: "info",
          message: "OpenRouter API is reachable",
        });
      } else {
        checks.push({
          code: "openrouter_api_error",
          level: "error",
          message: `OpenRouter API returned ${response.status} ${response.statusText}`,
          hint: "Check your API key and network connectivity",
        });
      }
    } catch (error) {
      checks.push({
        code: "openrouter_api_unreachable",
        level: "error",
        message: `Could not reach OpenRouter API: ${error instanceof Error ? error.message : "Unknown error"}`,
        hint: "Check network connectivity and firewall",
      });
    }
  }
  
  const hasErrors = checks.some((c) => c.level === "error");
  const hasWarnings = checks.some((c) => c.level === "warn");
  
  let status: AdapterEnvironmentTestResult["status"] = "pass";
  if (hasErrors) status = "fail";
  else if (hasWarnings) status = "warn";
  
  return {
    adapterType: "openrouter_local",
    status,
    testedAt: new Date().toISOString(),
    checks,
  };
}
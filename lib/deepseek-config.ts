import { env } from "cloudflare:workers";

// Server-side DeepSeek-compatible endpoint. The key never leaves the worker.
// DEEPSEEK_BASE_URL allows an admin-configured gateway/proxy; its host must be
// listed in AI_MODEL_HOSTS (or be one of the built-in official hosts).
export function deepseekFromEnv() {
  const baseUrl = (env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").trim().replace(/\/+$/, "");
  return {
    apiKey: env.DEEPSEEK_API_KEY || "",
    model: env.DEEPSEEK_MODEL || "",
    baseUrl,
  };
}

export function deepseekEnvReady() {
  const config = deepseekFromEnv();
  return Boolean(config.apiKey && config.model);
}

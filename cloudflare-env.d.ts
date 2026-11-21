declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ADMIN_EMAILS?: string;
    ADMIN_USER_IDS?: string;
    AI_CREDENTIALS_ENCRYPTION_KEY?: string;
    AI_MODEL_HOSTS?: string;
    ORAL_AUDIO_PROVIDER_ID?: string;
    AI_OPENAI_RELAY_URL?: string;
    AI_OPENAI_RELAY_TOKEN?: string;
  }
}

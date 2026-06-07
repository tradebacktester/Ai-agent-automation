import OpenAI from "openai";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

function createClient(): OpenAI {
  if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  if (process.env.GROQ_API_KEY) {
    return new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: GROQ_BASE_URL,
    });
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  throw new Error(
    "No AI credentials found. Set GROQ_API_KEY or OPENAI_API_KEY.",
  );
}

let _client: OpenAI | null = null;

export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop) {
    if (!_client) _client = createClient();
    return (_client as any)[prop];
  },
});

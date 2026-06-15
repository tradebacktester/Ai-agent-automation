import OpenAI from "openai";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";
const OPENAI_FALLBACK_MODEL = "gpt-4o-mini";

let _usingGroq: boolean | null = null;

function createGroqClient(): { client: OpenAI; usingGroq: boolean } {
  if (process.env.GROQ_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: GROQ_BASE_URL,
      }),
      usingGroq: true,
    };
  }
  if (process.env.OPENAI_API_KEY) {
    console.warn("[AI] GROQ_API_KEY not set — groqClient falling back to OpenAI with gpt-4o-mini");
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      usingGroq: false,
    };
  }
  throw new Error(
    "No AI credentials found for chat/text generation. Set GROQ_API_KEY or OPENAI_API_KEY.",
  );
}

function createOpenAIAudioClient(): OpenAI {
  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  throw new Error(
    "[ERROR] OPENAI_API_KEY is required for voice synthesis (TTS/Whisper). Set it in Settings.",
  );
}

let _groqClientInner: OpenAI | null = null;
let _openaiAudioClient: OpenAI | null = null;

function ensureGroqClient(): OpenAI {
  if (!_groqClientInner) {
    const { client, usingGroq } = createGroqClient();
    _groqClientInner = client;
    _usingGroq = usingGroq;
  }
  return _groqClientInner;
}

export const groqClient: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const inner = ensureGroqClient();
    const value = (inner as any)[prop];

    // When falling back to OpenAI, intercept chat.completions to rewrite model
    if (prop === "chat" && _usingGroq === false) {
      return new Proxy(value, {
        get(_chatTarget, chatProp) {
          const chatValue = (value as any)[chatProp];
          if (chatProp === "completions") {
            return new Proxy(chatValue, {
              get(_completionsTarget, completionsProp) {
                const completionsValue = (chatValue as any)[completionsProp];
                if (completionsProp === "create") {
                  return (params: any, ...rest: any[]) => {
                    if (params?.model === GROQ_DEFAULT_MODEL) {
                      params = { ...params, model: OPENAI_FALLBACK_MODEL };
                    }
                    return completionsValue.call(chatValue, params, ...rest);
                  };
                }
                return completionsValue;
              },
            });
          }
          return chatValue;
        },
      });
    }

    return typeof value === "function" ? value.bind(inner) : value;
  },
});

export const openaiAudioClient: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop) {
    if (!_openaiAudioClient) _openaiAudioClient = createOpenAIAudioClient();
    return (_openaiAudioClient as any)[prop];
  },
});

export const openai: OpenAI = groqClient;

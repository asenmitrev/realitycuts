import { configureDotenv } from './dotenv';

configureDotenv();

export const LIBRARY_PROCESSING_CHUNK_SIZE = 4 * 60;
// The size the video needs to be to be split into chunks
export const LIBRARY_VIDEO_CHUNK_THRESHOLD = 2 * LIBRARY_PROCESSING_CHUNK_SIZE; // 10 minutes in seconds

export const OPENAI_KEY = process.env.OPENAI_KEY;
export const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
export const GROK_KEY = process.env.GROK_KEY;
export const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
export const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

export const ENVIRONMENT = process.env.ENVIRONMENT;
export const IS_PROD = process.env.IS_PROD;

export const CLIENT_URL = process.env.CLIENT_URL;
export const API_URL = process.env.API_URL;
export const MONGODB_URI = process.env.MONGODB_URI;
// CloudWatch logging removed — use file-based logging instead
export const CLOUDWATCH_LOGS = false;
export const LOGGLY_TOKEN = process.env.LOGGLY_TOKEN;
export const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
export const PINECONE_KEY = process.env.PINECONE_KEY;
export const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
export const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
export const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
export const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
export const QWEN_KEY = process.env.QWEN_KEY;
export const QWEN_BASE_URL = process.env.QWEN_BASE_URL;
export const LOCAL_LLM_BASE_URL = process.env.LOCAL_LLM_BASE_URL;
export const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
export const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

export const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY,
  maxTokens: 500,
});

export const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
});

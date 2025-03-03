import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export default new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  apiKey: process.env.GEMINI_API_KEY,
  maxOutputTokens: 500,
});

import { model } from "../agent/models/openai";

// Function to generate an answer from a question and context
export async function generateAnswerFromDocs(question: string, contextChunks: string[]): Promise<string> {
  const context = contextChunks.join("\n\n");

  if (context.length === 0) {
    console.log("No context provided");
    return "I'm sorry, but I cannot find the answer to your question in the documentation provided.";
  }

  const prompt = `You are a helpful assistant that answers questions based on provided documentation. 
  Please read the following documentation context carefully and then answer the question that follows.  
  Answer in complete sentences, be comprehensive and detailed, and try to provide as much relevant information as 
  possible from the context to fully answer the question.  If the documentation does not contain the answer, 
  please respond with: "I'm sorry, but I cannot find the answer to your question in the documentation provided."

  Documentation Context:
  [Start of Context]
  ${context}
  [End of Context]
  
  Question: ${question}
  
  Answer:`;

  try {
    const response = await model.invoke(prompt);
    return response.content.toString().trim(); // Trim whitespace from the response
  } catch (error) {
    console.error("Error generating answer from LLM:", error);
    return "Error processing your question. Please try again later."; // User-friendly error message
  }
}

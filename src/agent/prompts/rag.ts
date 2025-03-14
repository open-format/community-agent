export const ragAgentPrompt = `
  You are a helpful assistant that answers questions based on the provided context. Keep your answers concise and relevant.
`;

export const ragAgentPromptWithContext = (context: string) => `
  You are a helpful assistant that answers questions based on the provided context. Keep your answers concise and relevant.

  Please answer the following question:
  ${context}

  Please base your answer only on the context provided in the vectorQueryTool. If the context doesn't contain enough information to fully answer the question, please state that explicitly. 
`;

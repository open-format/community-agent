import { openai } from "@ai-sdk/openai";
import { embed } from "ai";

export async function getEmbeddingsVector(content?: string, model?: string): Promise<number[][]> {
    let embeddingsVector: number[][] = [];

    if (!content || content.length === 0) {
        return embeddingsVector;
    }

    try {
        const embedding = await embed({
            model: openai.embedding(model ?? "text-embedding-3-small"),
            value: content,
        });
        embeddingsVector = [embedding.embedding];

    } catch (error) {
        console.log('Error while creating embeddings: ', error);
    }

    return embeddingsVector;
}
import { MemorySaver } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { pool } from "../db";

let checkpointer: MemorySaver | PostgresSaver;

if (process.env.NODE_ENV === "production") {
  checkpointer = new PostgresSaver(pool);
} else {
  checkpointer = new MemorySaver();
}

export { checkpointer };

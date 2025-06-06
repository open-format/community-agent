import { processAndStoreDocument } from "@/lib/document_processing";
import { Hono } from "hono";

const docs = new Hono();

docs.post("/upload", async (c) => {
  const formData = await c.req.formData();
  const files = formData.getAll("documents") as File[];
  const communityId = formData.get("communityId") as string | null;

  if (!files || files.length === 0) {
    return c.json({ message: "No documents uploaded" }, 400);
  }
  if (!communityId) {
    return c.json({ message: "Community ID is required" }, 400);
  }

  try {
    const uploadPromises = files.map(async (file) => {
      if (file instanceof File) {
        const fileContents = await file.text();
        await processAndStoreDocument(communityId, file.name, fileContents);
        console.log(`Processed and stored: ${file.name}`);
      } else {
        console.warn("Unexpected file data:", file);
      }
    });

    await Promise.all(uploadPromises);

    return c.json({ message: "Documents uploaded and processed successfully" });
  } catch (error) {
    console.error("Document upload error:", error);
    return c.json({ message: "Failed to process documents", error: String(error) }, 500);
  }
});

export default docs;

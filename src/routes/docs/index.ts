import { Hono } from "hono";
import { processAndStoreDocument } from "../../lib/document_processing";

const docsRoute = new Hono();

docsRoute.post("/upload", async (c) => {
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
      // Create an array of promises
      if (file instanceof File) {
        const fileContents = await file.text();
        await processAndStoreDocument(communityId, file.name, fileContents); // Call processAndStoreDocument
        console.log(`Processed and stored: ${file.name}`);
      } else {
        console.warn("Unexpected file data:", file);
      }
    });

    await Promise.all(uploadPromises); // Wait for all promises to resolve (parallel processing)

    return c.json({ message: "Documents uploaded and processed successfully" });
  } catch (error) {
    console.error("Document upload error:", error);
    return c.json({ message: "Failed to process documents", error: String(error) }, 500);
  }
});

export default docsRoute;

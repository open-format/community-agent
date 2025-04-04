import { ThirdwebStorage } from "@thirdweb-dev/storage";
import 'dotenv/config';

// Initialize ThirdwebStorage
const THIRDWEB_SECRET = process.env.THIRDWEB_SECRET;
if (!THIRDWEB_SECRET) {
  throw new Error("THIRDWEB_SECRET environment variable is not set");
}

const storage = new ThirdwebStorage({
  secretKey: THIRDWEB_SECRET,
});

/**
 * Fetches metadata from IPFS using the provided hash
 */
export async function getMetadata(ipfsHash: string) {
  try {
    const metadata = await storage.downloadJSON(ipfsHash);
    return metadata;
  } catch (error) {
    console.error(`Error fetching metadata for IPFS hash ${ipfsHash}:`, error);
    return {};
  }
}

/**
 * Uploads metadata to IPFS and returns the hash
 */
export async function uploadMetadata(metadata: any) {
  try {
    const ipfsHash = await storage.upload(metadata, {
      uploadWithoutDirectory: true,
    });
    return ipfsHash;
  } catch (error) {
    console.error(`Error uploading metadata to IPFS:`, error);
    throw error;
  }
} 
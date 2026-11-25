import { NextRequest } from "next/server";
import { adminAuth } from "./firebaseAdmin";
export async function getAuthenticatedUid(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try { const decoded = await adminAuth.verifyIdToken(authHeader.slice(7)); return decoded.uid; } catch { return null; }
}

import { NextRequest } from "next/server";
import { getAdminAuth } from "./firebaseAdmin";

export async function getAuthenticatedUid(req: NextRequest): Promise<string | null> {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  try {
    const d = await getAdminAuth().verifyIdToken(h.slice(7));
    return d.uid;
  } catch {
    return null;
  }
}

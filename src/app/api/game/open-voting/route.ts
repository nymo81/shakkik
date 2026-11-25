import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuthenticatedUid } from "@/lib/verifyRequest";
import { generateAIVote } from "@/lib/aiEngine";
import { RoomPublicState } from "@/types/game";

export async function POST(req: NextRequest) {
  const uid = await getAuthenticatedUid(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { code } = await req.json();
  const roomRef = adminDb.collection("rooms").doc(String(code).toUpperCase());
  const serverRef = roomRef.collection("serverState").doc("current");
  const [roomSnap, serverSnap] = await Promise.all([roomRef.get(), serverRef.get()]);
  if (!roomSnap.exists || !serverSnap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const room = roomSnap.data() as RoomPublicState;
  if (room.hostId !== uid) return NextResponse.json({ error: "Host only" }, { status: 403 });
  const serverState = serverSnap.data()!;
  const playerList = Object.values(room.players);
  const candidates = playerList.map((p) => ({ id: p.id, name: p.name, answer: serverState.answers?.[p.id]?.text || "ما جاوب" }));
  const aiPlayers = playerList.filter((p) => p.isAI);
  const votesUpdate: Record<string, string> = {};
  const votedAiIds: string[] = [];
  await Promise.all(aiPlayers.map(async (ai) => { const targetId = await generateAIVote({ personaId: ai.personaId || "ali", selfId: ai.id, mainPrompt: serverState.normalPrompt, candidates }); if (targetId) { votesUpdate["votes." + ai.id] = targetId; votedAiIds.push(ai.id); } }));
  if (votedAiIds.length > 0) await serverRef.update(votesUpdate);
  await roomRef.update({ phase: "voting", votedPlayerIds: votedAiIds, phaseEndsAt: Date.now() + 30 * 1000 });
  return NextResponse.json({ ok: true });
}

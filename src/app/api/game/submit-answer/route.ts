import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuthenticatedUid } from "@/lib/verifyRequest";
import { RoomPublicState } from "@/types/game";

export async function POST(req: NextRequest) {
  const uid = await getAuthenticatedUid(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code, answer, forceReveal = false } = await req.json();
  const roomRef = adminDb.collection("rooms").doc(String(code).toUpperCase());
  const serverRef = roomRef.collection("serverState").doc("current");

  const [roomSnap, serverSnap] = await Promise.all([roomRef.get(), serverRef.get()]);
  if (!roomSnap.exists || !serverSnap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const room = roomSnap.data() as RoomPublicState;
  const serverState = serverSnap.data()!;

  if (room.phase !== "question") {
    return NextResponse.json({ ok: true });
  }

  const updatedAnswers = { ...(serverState.answers || {}) };
  const answeredSet = new Set(room.answeredPlayerIds || []);

  if (!forceReveal && answer && room.players[uid]) {
    updatedAnswers[uid] = { text: String(answer).trim().slice(0, 80) };
    answeredSet.add(uid);
    await serverRef.update({ answers: updatedAnswers });
  }

  const totalPlayers = Object.keys(room.players).length;
  const shouldReveal =
    (forceReveal && room.hostId === uid) || answeredSet.size >= totalPlayers;

  if (shouldReveal) {
    await roomRef.update({
      phase: "reveal",
      answeredPlayerIds: Array.from(answeredSet),
      revealedPrompt: serverState.normalPrompt,
      revealedAnswers: updatedAnswers,
      phaseEndsAt: null,
    });
  } else {
    await roomRef.update({
      answeredPlayerIds: Array.from(answeredSet),
    });
  }

  return NextResponse.json({ ok: true });
}

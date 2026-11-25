import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuthenticatedUid } from "@/lib/verifyRequest";
import { AI_PERSONAS } from "@/lib/aiPersonas";
import { AIDifficulty, RoomPublicState } from "@/types/game";

export async function POST(req: NextRequest) {
  const uid = await getAuthenticatedUid(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { code, action = "join_human", name, avatar, personaId, difficulty = "tactical", customQuestion, targetPlayerId } = body;
  const roomRef = adminDb.collection("rooms").doc(String(code || "").toUpperCase());
  const snap = await roomRef.get();
  if (!snap.exists) return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
  const room = snap.data() as RoomPublicState;
  if (action === "add_custom_question" && customQuestion) {
    const updated = [...(room.customQuestions || []), { round: ([1, 2, 3].includes(Number(customQuestion.round)) ? Number(customQuestion.round) : 1) as 1 | 2 | 3, normal: String(customQuestion.normal || "").trim().slice(0, 120), impostor: String(customQuestion.impostor || "").trim().slice(0, 120) }];
    await roomRef.update({ customQuestions: updated });
    return NextResponse.json({ ok: true });
  }
  if (action === "add_ai") {
    if (room.hostId !== uid) return NextResponse.json({ error: "للمضيف فقط" }, { status: 403 });
    const currentPlayers = Object.values(room.players);
    if (currentPlayers.length >= 10) return NextResponse.json({ error: "الغرفة ممتلئة" }, { status: 400 });
    if (currentPlayers.filter((p) => p.isAI).length >= 4) return NextResponse.json({ error: "الحد الأقصى 4 شخصيات ذكاء اصطناعي" }, { status: 400 });
    const persona = AI_PERSONAS.find((p) => p.id === personaId) || AI_PERSONAS[0];
    const aiId = "ai_" + persona.id + "_" + Date.now().toString(36).slice(-4);
    await roomRef.update({ ["players." + aiId]: { id: aiId, name: persona.name, avatar: persona.avatar, isAI: true, personaId: persona.id, difficulty: (difficulty as AIDifficulty) || "tactical", score: 0, isReady: true, stats: { caughtImpostors: 0, escapedAsImpostor: 0, falselyAccused: 0 } } });
    return NextResponse.json({ ok: true });
  }
  if (action === "remove_player") {
    if (room.hostId !== uid) return NextResponse.json({ error: "للمضيف فقط" }, { status: 403 });
    const updatedPlayers = { ...room.players };
    delete updatedPlayers[targetPlayerId];
    await roomRef.update({ players: updatedPlayers });
    return NextResponse.json({ ok: true });
  }
  if (!room.players[uid]) {
    if (Object.keys(room.players).length >= 10) return NextResponse.json({ error: "الغرفة ممتلئة (10 لاعبين)" }, { status: 400 });
    await roomRef.update({ ["players." + uid]: { id: uid, name: String(name || "لاعب").trim().slice(0, 18), avatar: String(avatar || "🦊"), isAI: false, score: 0, isReady: true, stats: { caughtImpostors: 0, escapedAsImpostor: 0, falselyAccused: 0 } } });
  }
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuthenticatedUid } from "@/lib/verifyRequest";
import { QUESTIONS_BANK } from "@/lib/questions";
import { generateAITurn } from "@/lib/aiEngine";
import { RoomPublicState } from "@/types/game";

export async function POST(req: NextRequest) {
  const uid = await getAuthenticatedUid(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code, round, questionIndex } = await req.json();
  const roomRef = adminDb.collection("rooms").doc(String(code).toUpperCase());
  const snap = await roomRef.get();
  if (!snap.exists) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const room = snap.data() as RoomPublicState;
  if (room.hostId !== uid) return NextResponse.json({ error: "Host only" }, { status: 403 });

  const playerList = Object.values(room.players);
  if (playerList.length < 3) {
    return NextResponse.json({ error: "تحتاجون 3 لاعبين على الأقل" }, { status: 400 });
  }

  const targetRound = ([1, 2, 3].includes(Number(round)) ? Number(round) : 1) as 1 | 2 | 3;

  // Build question pool excluding already-used question IDs
  const customPool = (room.customQuestions || []).map((q, i) => ({
    id: 10000 + i,
    round: q.round,
    normal: q.normal,
    impostor: q.impostor,
  }));
  const fullPool = [...customPool, ...QUESTIONS_BANK];
  const usedSet = new Set(room.usedQuestionIds || []);

  let available = fullPool.filter((q) => q.round === targetRound && !usedSet.has(q.id));
  if (available.length === 0) available = fullPool.filter((q) => !usedSet.has(q.id));
  if (available.length === 0) available = fullPool;

  const chosen = available[Math.floor(Math.random() * available.length)];

  // Select 1 impostor (or 2 in Round 3 if >= 7 players)
  const shuffled = [...playerList].sort(() => Math.random() - 0.5);
  const impostorCount = targetRound === 3 && playerList.length >= 7 ? 2 : 1;
  const impostorIds = shuffled.slice(0, impostorCount).map((p) => p.id);

  // Write individual secret prompts ONLY to /secrets/{playerId}
  const batch = adminDb.batch();
  for (const p of playerList) {
    const isImp = impostorIds.includes(p.id);
    batch.set(roomRef.collection("secrets").doc(p.id), {
      prompt: isImp ? chosen.impostor : chosen.normal,
    });
  }

  // Write server-only state
  batch.set(roomRef.collection("serverState").doc("current"), {
    normalPrompt: chosen.normal,
    impostorPrompt: chosen.impostor,
    impostorIds,
    answers: {},
    votes: {},
  });

  const roundSeconds =
    targetRound === 2 ? Math.max(20, room.settings.answerSeconds - 10) : room.settings.answerSeconds;

  batch.update(roomRef, {
    phase: "question",
    currentRound: targetRound,
    currentQuestionIndex: Number(questionIndex) || 1,
    answeredPlayerIds: [],
    votedPlayerIds: [],
    revealedPrompt: null,
    revealedAnswers: null,
    lastRoundResult: null,
    phaseEndsAt: Date.now() + roundSeconds * 1000,
    usedQuestionIds: [...(room.usedQuestionIds || []), chosen.id],
  });

  await batch.commit();

  // Trigger AI turns in parallel (fair: each AI only sees its own assigned prompt)
  const aiPlayers = playerList.filter((p) => p.isAI);
  if (aiPlayers.length > 0) {
    const playerNames = playerList.map((p) => p.name);
    const aiResults = await Promise.all(
      aiPlayers.map(async (ai) => {
        const isImp = impostorIds.includes(ai.id);
        const turn = await generateAITurn({
          personaId: ai.personaId || "ali",
          difficulty: ai.difficulty || "tactical",
          round: targetRound,
          secretPrompt: isImp ? chosen.impostor : chosen.normal,
          playerNames,
        });
        return { id: ai.id, turn };
      })
    );

    const serverStateRef = roomRef.collection("serverState").doc("current");
    const stateUpdates: Record<string, unknown> = {};
    const aiIds: string[] = [];

    for (const item of aiResults) {
      stateUpdates[`answers.${item.id}`] = item.turn;
      aiIds.push(item.id);
    }

    await serverStateRef.update(stateUpdates);
    await roomRef.update({ answeredPlayerIds: aiIds });
  }

  return NextResponse.json({ ok: true });
}

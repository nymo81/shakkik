import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuthenticatedUid } from "@/lib/verifyRequest";
import { RoomPublicState } from "@/types/game";

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST(req: NextRequest) {
  const uid = await getAuthenticatedUid(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, avatar, questionsPerRound = 5, answerSeconds = 45, hostAlsoPlays = true } = body;

  const code = makeCode();
  const players: RoomPublicState["players"] = {};

  if (hostAlsoPlays) {
    players[uid] = {
      id: uid,
      name: (name || "المضيف").trim().slice(0, 18),
      avatar: avatar || "🦁",
      isAI: false,
      score: 0,
      isReady: true,
      stats: { caughtImpostors: 0, escapedAsImpostor: 0, falselyAccused: 0 },
    };
  }

  const roomState: RoomPublicState = {
    code,
    hostId: uid,
    phase: "lobby",
    currentRound: 1,
    currentQuestionIndex: 0,
    settings: {
      questionsPerRound: Math.min(10, Math.max(5, Number(questionsPerRound))),
      answerSeconds: Math.min(90, Math.max(20, Number(answerSeconds))),
      hostAlsoPlays: Boolean(hostAlsoPlays),
    },
    players,
    answeredPlayerIds: [],
    votedPlayerIds: [],
    phaseEndsAt: null,
    usedQuestionIds: [],
    customQuestions: [],
  };

  await adminDb.collection("rooms").doc(code).set(roomState);
  return NextResponse.json({ code });
}

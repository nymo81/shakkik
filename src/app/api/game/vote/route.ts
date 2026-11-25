import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuthenticatedUid } from "@/lib/verifyRequest";
import { RoomPublicState } from "@/types/game";

export async function POST(req: NextRequest) {
  const uid = await getAuthenticatedUid(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code, targetPlayerId, forceTally = false } = await req.json();
  const roomRef = adminDb.collection("rooms").doc(String(code).toUpperCase());
  const serverRef = roomRef.collection("serverState").doc("current");

  const [roomSnap, serverSnap] = await Promise.all([roomRef.get(), serverRef.get()]);
  if (!roomSnap.exists || !serverSnap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const room = roomSnap.data() as RoomPublicState;
  const serverState = serverSnap.data()!;
  if (room.phase !== "voting") return NextResponse.json({ ok: true });

  const votes = { ...(serverState.votes || {}) };
  const votedSet = new Set(room.votedPlayerIds || []);

  if (!forceTally && targetPlayerId && room.players[uid] && targetPlayerId !== uid) {
    votes[uid] = targetPlayerId;
    votedSet.add(uid);
    await serverRef.update({ votes });
  }

  const playerIds = Object.keys(room.players);
  const shouldTally =
    (forceTally && room.hostId === uid) || votedSet.size >= playerIds.length;

  if (!shouldTally) {
    await roomRef.update({ votedPlayerIds: Array.from(votedSet) });
    return NextResponse.json({ ok: true });
  }

  // Calculate scores & reveal impostors
  const multiplier = room.currentRound;
  const basePts = 100 * multiplier;
  const impostorWinPts = 150 * multiplier;
  const impostorIds: string[] = serverState.impostorIds || [];

  const voteCounts: Record<string, number> = {};
  const pointsEarned: Record<string, number> = {};
  playerIds.forEach((id) => {
    voteCounts[id] = 0;
    pointsEarned[id] = 0;
  });

  Object.values(votes).forEach((votedId) => {
    if (voteCounts[votedId] !== undefined) voteCounts[votedId]++;
  });

  const updatedPlayers = { ...room.players };

  // Innocent voters who caught an impostor
  Object.entries(votes).forEach(([voterId, votedId]) => {
    if (!impostorIds.includes(voterId) && impostorIds.includes(votedId) && updatedPlayers[voterId]) {
      updatedPlayers[voterId].score += basePts;
      updatedPlayers[voterId].stats.caughtImpostors += 1;
      pointsEarned[voterId] += basePts;
    }
    if (!impostorIds.includes(votedId) && updatedPlayers[votedId]) {
      updatedPlayers[votedId].stats.falselyAccused += 1;
    }
  });

  // Impostor survival check (< 50% of non-impostor players voted for them)
  const nonImpostorCount = Math.max(1, playerIds.length - impostorIds.length);
  const threshold = Math.ceil(nonImpostorCount / 2);

  impostorIds.forEach((impId) => {
    if ((voteCounts[impId] || 0) < threshold && updatedPlayers[impId]) {
      updatedPlayers[impId].score += impostorWinPts;
      updatedPlayers[impId].stats.escapedAsImpostor += 1;
      pointsEarned[impId] += impostorWinPts;
    }
  });

  await roomRef.update({
    phase: "round_result",
    votedPlayerIds: Array.from(votedSet),
    players: updatedPlayers,
    lastRoundResult: {
      impostorIds,
      impostorPrompt: serverState.impostorPrompt,
      voteCounts,
      pointsEarned,
    },
    phaseEndsAt: null,
  });

  return NextResponse.json({ ok: true });
}

"use client";

import React, { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import {
  Users,
  Sparkles,
  ShieldAlert,
  Send,
  Trophy,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  Eye,
  Vote,
  Copy,
  Check,
} from "lucide-react";
import { db, ensureAuthUser } from "@/lib/firebaseClient";
import { AI_PERSONAS } from "@/lib/aiPersonas";
import { AIDifficulty, Player, RoomPublicState } from "@/types/game";

const AVATARS = ["🦁", "🦊", "🦉", "🐺", "🦅", "🐯", "🤖", "🎭", "👑", "🔥"];

export default function ShakkikApp() {
  const [uid, setUid] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [avatar, setAvatar] = useState("🦁");
  const [joinCode, setJoinCode] = useState("");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomPublicState | null>(null);
  const [secretPrompt, setSecretPrompt] = useState<string | null>(null);

  const [answerText, setAnswerText] = useState("");
  const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] = useState(AI_PERSONAS[0].id);
  const [selectedDifficulty, setSelectedDifficulty] = useState<AIDifficulty>("tactical");
  const [hostAlsoPlays, setHostAlsoPlays] = useState(true);
  const [questionsPerRound, setQuestionsPerRound] = useState(5);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  // Initialize anonymous auth & read ?room=CODE from URL
  useEffect(() => {
    ensureAuthUser().then((user) => setUid(user.uid));
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const codeParam = params.get("room");
      if (codeParam) setJoinCode(codeParam.toUpperCase());
    }
  }, []);

  // Subscribe to public room document
  useEffect(() => {
    if (!roomCode) return;
    const unsub = onSnapshot(doc(db, "rooms", roomCode), (snap) => {
      if (snap.exists()) {
        setRoom(snap.data() as RoomPublicState);
      } else {
        setErrorMsg("تم إغلاق الغرفة");
        setRoomCode(null);
      }
    });
    return () => unsub();
  }, [roomCode]);

  // Subscribe to private per-player secret prompt
  useEffect(() => {
    if (!roomCode || !uid) return;
    const unsub = onSnapshot(doc(db, "rooms", roomCode, "secrets", uid), (snap) => {
      if (snap.exists()) {
        setSecretPrompt(snap.data().prompt || null);
      }
    });
    return () => unsub();
  }, [roomCode, uid]);

  // Reset local inputs on phase change
  useEffect(() => {
    if (room?.phase === "question") {
      setAnswerText("");
      setSelectedVoteId(null);
    }
  }, [room?.phase, room?.currentQuestionIndex]);

  // Countdown timer
  useEffect(() => {
    if (!room?.phaseEndsAt) {
      setSecondsLeft(0);
      return;
    }
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.ceil((room.phaseEndsAt! - Date.now()) / 1000));
      setSecondsLeft(diff);
    }, 500);
    return () => clearInterval(interval);
  }, [room?.phaseEndsAt]);

  async function apiCall(path: string, payload: Record<string, unknown>) {
    setLoading(true);
    setErrorMsg(null);
    try {
      const user = await ensureAuthUser();
      const token = await user.getIdToken();
      const res = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "حدث خطأ غير متوقع");
      return data;
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "خطأ بالاتصال");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRoom() {
    if (!playerName.trim()) {
      setErrorMsg("اكتب اسمك أولاً");
      return;
    }
    const data = await apiCall("/api/game/create", {
      name: playerName,
      avatar,
      questionsPerRound,
      hostAlsoPlays,
    });
    if (data?.code) setRoomCode(data.code);
  }

  async function handleJoinRoom() {
    if (!playerName.trim() || !joinCode.trim()) {
      setErrorMsg("اكتب اسمك ورمز الغرفة");
      return;
    }
    const cleanCode = joinCode.trim().toUpperCase();
    const data = await apiCall("/api/game/join", {
      code: cleanCode,
      action: "join_human",
      name: playerName,
      avatar,
    });
    if (data?.ok) setRoomCode(cleanCode);
  }

  // -------------------- HOME SCREEN --------------------
  if (!roomCode || !room) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-[#1A132B] via-[#120D1D] to-[#0B0812]">
        <div className="w-full max-w-md space-y-6 animate-pop">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              النسخة التجريبية Beta v0.1
            </div>
            <h1 className="text-5xl font-black tracking-tight bg-gradient-to-l from-amber-400 via-violet-400 to-purple-300 bg-clip-text text-transparent">
              شكّك
            </h1>
            <p className="text-slate-400 text-sm font-semibold">
              شكّك بكلشي • لعبة الأسئلة السرية والمنافق بالذكاء الاصطناعي العراقي
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-sm text-center">
              {errorMsg}
            </div>
          )}

          <div className="bg-[#1B142C]/90 border border-violet-500/20 rounded-3xl p-6 shadow-2xl space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">اختر صورتك واسمك</label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {AVATARS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setAvatar(av)}
                    className={`text-2xl p-2 rounded-xl border transition shrink-0 ${
                      avatar === av
                        ? "bg-violet-600/30 border-amber-400 scale-105"
                        : "bg-slate-900/60 border-white/10 opacity-70 hover:opacity-100"
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
              <input
                type="text"
                maxLength={18}
                placeholder="اكتب اسمك هنا (مثلاً: زياد)..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="mt-2 w-full px-4 py-3.5 rounded-2xl bg-slate-950/70 border border-violet-500/30 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={5}
                  placeholder="رمز الغرفة"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-1/2 px-4 py-3.5 rounded-2xl bg-slate-950/70 border border-violet-500/30 text-center font-black tracking-widest uppercase text-amber-400 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={handleJoinRoom}
                  disabled={loading}
                  className="w-1/2 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black transition disabled:opacity-50"
                >
                  انضم لغرفة
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>أسئلة كل جولة:</span>
                <select
                  value={questionsPerRound}
                  onChange={(e) => setQuestionsPerRound(Number(e.target.value))}
                  className="bg-slate-900 border border-white/15 rounded-lg px-2 py-1 text-amber-400 font-bold"
                >
                  {[5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>
                      {n} أسئلة
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>المضيف يشارك باللعب (إلغِ التحديد لشاشة TV/ديسكورد فقط)</span>
                <input
                  type="checkbox"
                  checked={hostAlsoPlays}
                  onChange={(e) => setHostAlsoPlays(e.target.checked)}
                  className="accent-violet-500 w-4 h-4"
                />
              </label>

              <button
                onClick={handleCreateRoom}
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-gradient-to-l from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-black text-lg shadow-lg shadow-violet-600/30 transition disabled:opacity-50"
              >
                {loading ? "جاري الإنشاء..." : "أنشئ سهرة جديدة ✨"}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const isHost = uid === room.hostId;
  const playersList = Object.values(room.players || {});
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}?room=${room.code}` : room.code;

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Top Bar */}
      <header className="flex items-center justify-between bg-[#1B142C] border border-violet-500/20 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black text-amber-400">شكّك</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-violet-500/20 text-violet-300 text-xs font-bold">
            غرفة: {room.code}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold">
          {room.phase !== "lobby" && (
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300">
              الجولة {room.currentRound}/3 • سؤال {room.currentQuestionIndex}/
              {room.settings.questionsPerRound}
            </span>
          )}
          {secondsLeft > 0 && (
            <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 font-black">
              ⏱ {secondsLeft}ث
            </span>
          )}
        </div>
      </header>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-sm text-center">
          {errorMsg}
        </div>
      )}

      {/* -------------------- LOBBY PHASE -------------------- */}
      {room.phase === "lobby" && (
        <div className="grid md:grid-cols-2 gap-6 animate-pop">
          {/* Room Code & QR */}
          <div className="bg-[#1B142C] border border-violet-500/20 rounded-3xl p-6 flex flex-col items-center text-center space-y-4">
            <p className="text-xs font-bold text-violet-300">امسح الكود أو شارك الرمز مع أصدقائك</p>
            <div className="p-3 bg-white rounded-2xl">
              <QRCodeSVG value={shareUrl} size={140} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-4xl font-black tracking-widest text-amber-400">{room.code}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200"
                title="نسخ الرابط"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>

            {isHost && (
              <div className="w-full pt-4 border-t border-white/10 space-y-3 text-right">
                <p className="text-xs font-bold text-slate-300">أضف شخصية ذكاء اصطناعي عراقي (حتى 4):</p>
                <div className="flex gap-2">
                  <select
                    value={selectedPersona}
                    onChange={(e) => setSelectedPersona(e.target.value)}
                    className="flex-1 bg-slate-950 border border-violet-500/30 rounded-xl px-3 py-2.5 text-sm"
                  >
                    {AI_PERSONAS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.avatar} {p.name} ({p.age})
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedDifficulty}
                    onChange={(e) => setSelectedDifficulty(e.target.value as AIDifficulty)}
                    className="bg-slate-950 border border-violet-500/30 rounded-xl px-2 py-2.5 text-xs text-amber-300"
                  >
                    <option value="casual">عادي</option>
                    <option value="tactical">ذكي</option>
                    <option value="mastermind">محترف</option>
                  </select>
                  <button
                    onClick={() =>
                      apiCall("/api/game/join", {
                        code: room.code,
                        action: "add_ai",
                        personaId: selectedPersona,
                        difficulty: selectedDifficulty,
                      })
                    }
                    disabled={loading}
                    className="px-4 rounded-xl bg-violet-600 hover:bg-violet-500 font-bold text-sm flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> إضافة
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Connected Players List */}
          <div className="bg-[#1B142C] border border-violet-500/20 rounded-3xl p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-black text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-violet-400" />
                  اللاعبون المتصلون ({playersList.length}/10)
                </h2>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {playersList.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{p.avatar}</span>
                      <div>
                        <p className="font-bold text-sm flex items-center gap-2">
                          {p.name}
                          {p.isAI && (
                            <span className="px-2 py-0.5 text-[10px] rounded-full bg-violet-500/25 text-violet-300">
                              AI • {p.difficulty === "mastermind" ? "محترف" : p.difficulty === "tactical" ? "ذكي" : "عادي"}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    {isHost && p.id !== uid && (
                      <button
                        onClick={() =>
                          apiCall("/api/game/join", {
                            code: room.code,
                            action: "remove_player",
                            targetPlayerId: p.id,
                          })
                        }
                        className="p-1.5 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {isHost ? (
              <button
                onClick={() =>
                  apiCall("/api/game/start-round", {
                    code: room.code,
                    round: 1,
                    questionIndex: 1,
                  })
                }
                disabled={loading || playersList.length < 3}
                className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-lg flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Play className="w-5 h-5" />
                {playersList.length < 3 ? "بانتظار 3 لاعبين على الأقل..." : "ابدأ اللعبة الآن!"}
              </button>
            ) : (
              <p className="text-center text-xs text-slate-400 py-3">
                بانتظار المضيف لبدء الجولة الأولى...
              </p>
            )}
          </div>
        </div>
      )}

      {/* -------------------- SECRET QUESTION PHASE -------------------- */}
      {room.phase === "question" && (
        <div className="max-w-lg mx-auto bg-[#1B142C] border border-violet-500/30 rounded-3xl p-6 space-y-6 text-center animate-pop">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-bold">
            <ShieldAlert className="w-4 h-4" />
            سؤالك السري (لا تروّيه لأحد!)
          </div>

          {uid && room.players[uid] ? (
            <>
              <div className="p-6 rounded-2xl bg-gradient-to-br from-violet-900/50 to-slate-950 border border-violet-400/30">
                <p className="text-xl md:text-2xl font-black leading-relaxed text-white">
                  {secretPrompt || "جاري تحميل سؤالك السري..."}
                </p>
              </div>

              {room.answeredPlayerIds.includes(uid) ? (
                <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  تم تثبيت إجابتك! بانتظار البقية ({room.answeredPlayerIds.length}/{playersList.length})
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    maxLength={80}
                    placeholder="اكتب إجابتك باللهجة العراقية..."
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    className="w-full px-4 py-4 rounded-2xl bg-slate-950 border border-violet-500/40 text-center text-lg font-bold focus:outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={() =>
                      apiCall("/api/game/submit-answer", {
                        code: room.code,
                        answer: answerText,
                      })
                    }
                    disabled={loading || !answerText.trim()}
                    className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-lg flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    <Send className="w-5 h-5" />
                    ثبّت الإجابة
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="p-6 rounded-2xl bg-slate-950/60 space-y-2">
              <p className="text-lg font-bold text-violet-300">شاشة العرض الرئيسية</p>
              <p className="text-sm text-slate-400">
                تمت الإجابة: {room.answeredPlayerIds.length} من {playersList.length}
              </p>
            </div>
          )}

          {isHost && (
            <button
              onClick={() =>
                apiCall("/api/game/submit-answer", { code: room.code, forceReveal: true })
              }
              className="text-xs text-slate-400 underline hover:text-amber-300"
            >
              تخطي الوقت وكشف الإجابات الآن
            </button>
          )}
        </div>
      )}

      {/* -------------------- REVEAL & DISCUSSION PHASE -------------------- */}
      {room.phase === "reveal" && (
        <div className="space-y-5 animate-pop">
          <div className="bg-gradient-to-l from-violet-900/60 to-[#1B142C] border border-violet-400/30 rounded-3xl p-6 text-center space-y-2">
            <span className="text-xs font-bold text-amber-400">السؤال الحقيقي للأغلبية جان:</span>
            <h2 className="text-xl md:text-2xl font-black text-white">{room.revealedPrompt}</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {playersList.map((p) => {
              const ans = room.revealedAnswers?.[p.id];
              return (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-[#1B142C] border border-white/10 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{p.avatar}</span>
                    <span className="font-black text-sm text-violet-300">{p.name}</span>
                  </div>
                  <p className="text-lg font-bold text-white bg-slate-950/60 p-3 rounded-xl">
                    "{ans?.text || "ما لحگ يجاوب!"}"
                  </p>
                  {ans?.quip && (
                    <p className="text-xs text-amber-300/90 italic">💬 {ans.quip}</p>
                  )}
                </div>
              );
            })}
          </div>

          {isHost && (
            <button
              onClick={() => apiCall("/api/game/open-voting", { code: room.code })}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-lg flex items-center justify-center gap-2"
            >
              <Vote className="w-5 h-5" />
              افتح التصويت على المنافق!
            </button>
          )}
        </div>
      )}

      {/* -------------------- VOTING PHASE -------------------- */}
      {room.phase === "voting" && (
        <div className="max-w-xl mx-auto space-y-5 animate-pop">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black text-amber-400">منو المنافق بينكم؟</h2>
            <p className="text-xs text-slate-400">
              صوّتوا على الشخص اللي حسّيتوا سؤاله جان مختلف ({room.votedPlayerIds.length}/
              {playersList.length})
            </p>
          </div>

          {uid && room.players[uid] && !room.votedPlayerIds.includes(uid) ? (
            <div className="grid grid-cols-2 gap-3">
              {playersList
                .filter((p) => p.id !== uid)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedVoteId(p.id)}
                    className={`p-4 rounded-2xl border text-right transition space-y-1 ${
                      selectedVoteId === p.id
                        ? "bg-amber-500/20 border-amber-400 scale-[1.02]"
                        : "bg-[#1B142C] border-white/10 hover:border-violet-400/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{p.avatar}</span>
                      <span className="font-black text-sm">{p.name}</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      "{room.revealedAnswers?.[p.id]?.text || "..."}"
                    </p>
                  </button>
                ))}

              <button
                onClick={() =>
                  selectedVoteId &&
                  apiCall("/api/game/vote", { code: room.code, targetPlayerId: selectedVoteId })
                }
                disabled={loading || !selectedVoteId}
                className="col-span-2 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-lg disabled:opacity-40"
              >
                تثبيت التصويت 🗳️
              </button>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-[#1B142C] text-center text-emerald-300 font-bold">
              تم تسجيل تصويتك! بانتظار بقية اللاعبين...
            </div>
          )}

          {isHost && (
            <div className="text-center">
              <button
                onClick={() => apiCall("/api/game/vote", { code: room.code, forceTally: true })}
                className="text-xs text-slate-400 underline hover:text-amber-300"
              >
                إنهاء التصويت وإعلان النتيجة الآن
              </button>
            </div>
          )}
        </div>
      )}

      {/* -------------------- ROUND RESULT PHASE -------------------- */}
      {room.phase === "round_result" && room.lastRoundResult && (
        <div className="max-w-xl mx-auto space-y-5 animate-pop">
          <div className="bg-gradient-to-br from-rose-950/80 to-[#1B142C] border border-rose-500/40 rounded-3xl p-6 text-center space-y-3">
            <Eye className="w-10 h-10 text-rose-400 mx-auto" />
            <p className="text-xs font-bold text-rose-300">المنافق في هذا السؤال جان:</p>
            <div className="flex flex-wrap justify-center gap-3">
              {room.lastRoundResult.impostorIds.map((impId) => {
                const imp = room.players[impId];
                return (
                  <span
                    key={impId}
                    className="px-4 py-2 rounded-2xl bg-rose-500/20 border border-rose-400 text-xl font-black text-white"
                  >
                    {imp?.avatar} {imp?.name}
                  </span>
                );
              })}
            </div>
            <div className="pt-2 text-xs text-slate-300">
              سؤال المنافق جان:{" "}
              <span className="text-amber-300 font-bold">
                "{room.lastRoundResult.impostorPrompt}"
              </span>
            </div>
          </div>

          {/* Scoreboard */}
          <div className="bg-[#1B142C] border border-violet-500/20 rounded-3xl p-5 space-y-2">
            <h3 className="font-black text-sm text-violet-300 flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-amber-400" />
              ترتيب النقاط الحالي
            </h3>
            {[...playersList]
              .sort((a, b) => b.score - a.score)
              .map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-500">#{idx + 1}</span>
                    <span>{p.avatar}</span>
                    <span className="font-bold text-sm">{p.name}</span>
                    {(room.lastRoundResult?.pointsEarned[p.id] || 0) > 0 && (
                      <span className="text-xs font-black text-emerald-400">
                        +{room.lastRoundResult?.pointsEarned[p.id]}
                      </span>
                    )}
                  </div>
                  <span className="font-black text-amber-400">{p.score} نقطة</span>
                </div>
              ))}
          </div>

          {isHost && (
            <button
              onClick={() => {
                const isEndOfRound = room.currentQuestionIndex >= room.settings.questionsPerRound;
                if (isEndOfRound && room.currentRound >= 3) {
                  setRoomCode(null);
                  return;
                }
                const nextRound = isEndOfRound
                  ? ((room.currentRound + 1) as 1 | 2 | 3)
                  : room.currentRound;
                const nextIdx = isEndOfRound ? 1 : room.currentQuestionIndex + 1;

                apiCall("/api/game/start-round", {
                  code: room.code,
                  round: nextRound,
                  questionIndex: nextIdx,
                });
              }}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-black text-lg"
            >
              {room.currentQuestionIndex >= room.settings.questionsPerRound &&
              room.currentRound >= 3
                ? "إنهاء السهرة والعودة للرئيسية 🏁"
                : "السؤال التالي ⬅️"}
            </button>
          )}
        </div>
      )}
    </main>
  );
}

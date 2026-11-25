import { AI_PERSONAS, getDifficultyInstruction } from "./aiPersonas";
import { AIDifficulty } from "@/types/game";
export async function generateAITurn(params: { personaId: string; difficulty: AIDifficulty; round: 1 | 2 | 3; secretPrompt: string; playerNames: string[] }): Promise<{ answer: string; quip: string }> {
  const persona = AI_PERSONAS.find((p) => p.id === params.personaId) || AI_PERSONAS[0];
  const fallback = () => { const pool = params.round === 1 ? persona.fallbackAnswers.round1 : params.round === 2 ? persona.fallbackAnswers.round2 : persona.fallbackAnswers.round3; return { answer: pool[Math.floor(Math.random() * pool.length)], quip: persona.fallbackQuips[Math.floor(Math.random() * persona.fallbackQuips.length)] }; };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback();
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const res = await fetch("[https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=](https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=)" + apiKey, { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ systemInstruction: { parts: [{ text: "أنت شخصية عراقية اسمك " + persona.name + ". " + persona.dialectStyle + " " + persona.strategyStyle + " " + getDifficultyInstruction(params.difficulty) + " أجب بناءً على سؤالك فقط ولا تعرف إن كنت المنافق. أعد JSON فقط بـ answer و quip قصيرين باللهجة العراقية." }] }, contents: [{ role: "user", parts: [{ text: "اللاعبون: " + params.playerNames.join("، ") + " | سؤالك السري: " + params.secretPrompt }] }], generationConfig: { temperature: 0.85, maxOutputTokens: 140, responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { answer: { type: "STRING" }, quip: { type: "STRING" } }, required: ["answer", "quip"] } } }) });
    clearTimeout(timer); if (!res.ok) return fallback();
    const data = await res.json(); const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(raw || "{}");
    return { answer: String(parsed.answer || "").slice(0, 70) || fallback().answer, quip: String(parsed.quip || "").slice(0, 85) || fallback().quip };
  } catch { clearTimeout(timer); return fallback(); }
}
export async function generateAIVote(params: { personaId: string; selfId: string; mainPrompt: string; candidates: Array<{ id: string; name: string; answer: string }> }): Promise<string> {
  const targets = params.candidates.filter((c) => c.id !== params.selfId);
  if (!targets.length) return "";
  const pickRandom = () => targets[Math.floor(Math.random() * targets.length)].id;
  const apiKey = process.env.GEMINI_API_KEY; if (!apiKey) return pickRandom();
  const persona = AI_PERSONAS.find((p) => p.id === params.personaId) || AI_PERSONAS[0];
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const list = targets.map((t) => t.id + " (" + t.name + "): " + t.answer).join(" | ");
    const res = await fetch("[https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=](https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=)" + apiKey, { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ systemInstruction: { parts: [{ text: "أنت " + persona.name + " في لعبة شكّك. السؤال الأصلي: " + params.mainPrompt + ". اختر targetPlayerId الأكثر إثارة للشك من القائمة." }] }, contents: [{ role: "user", parts: [{ text: list }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 60, responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { targetPlayerId: { type: "STRING" } }, required: ["targetPlayerId"] } } }) });
    clearTimeout(timer); if (!res.ok) return pickRandom();
    const data = await res.json(); const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(raw || "{}");
    return targets.some((t) => t.id === parsed.targetPlayerId) ? parsed.targetPlayerId : pickRandom();
  } catch { clearTimeout(timer); return pickRandom(); }
}

import { AI_PERSONAS, getDifficultyInstruction } from "./aiPersonas";
import { AIDifficulty } from "@/types/game";

interface AIAnswerOutput {
  answer: string;
  quip: string;
}

interface AIVoteOutput {
  targetPlayerId: string;
}

/**
 * Generates an AI character's answer and post-reveal reaction quip.
 * STRICT FAIRNESS: Receives ONLY its own assigned secretPrompt (never knows if it is the impostor).
 */
export async function generateAITurn(params: {
  personaId: string;
  difficulty: AIDifficulty;
  round: 1 | 2 | 3;
  secretPrompt: string;
  playerNames: string[];
}): Promise<AIAnswerOutput> {
  const persona = AI_PERSONAS.find((p) => p.id === params.personaId) || AI_PERSONAS[0];
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return getFallbackTurn(persona.id, params.round);
  }

  const systemInstruction = `أنت شخصية عراقية اسمك "${persona.name}" (${persona.age} سنة).
نبذة عنك: ${persona.bio}
أسلوب كلامك: ${persona.dialectStyle}
أسلوب لعبك: ${persona.strategyStyle}
مستوى الصعوبة: ${getDifficultyInstruction(params.difficulty)}
قوانين صارمة:
- أنت تلعب لعبة "شكّك" مع أصدقائك: (${params.playerNames.join("، ")}).
- لا تعرف إذا كان سؤالك هو السؤال الأصلي أم سؤال المنافق، أجب بناءً على السؤال المعطى لك فقط.
- اكتب إجابة قصيرة جداً ومباشرة باللهجة العراقية (أقل من 60 حرفاً) تناسب السؤال تماماً.
- اكتب تعليقاً قصيراً (quip) باللهجة العراقية (أقل من 75 حرفاً) ستقوله لاحقاً عند كشف الإجابات لتشكك بالآخرين أو تدافع عن نفسك.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [
            {
              role: "user",
              parts: [{ text: `سؤالك السري في الجولة ${params.round} هو: "${params.secretPrompt}"` }],
            },
          ],
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 140,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                answer: { type: "STRING" },
                quip: { type: "STRING" },
              },
              required: ["answer", "quip"],
            },
          },
        }),
      }
    );

    clearTimeout(timeout);
    if (!res.ok) return getFallbackTurn(persona.id, params.round);

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return getFallbackTurn(persona.id, params.round);

    const parsed = JSON.parse(rawText) as AIAnswerOutput;
    return {
      answer: (parsed.answer || "").slice(0, 70) || getFallbackTurn(persona.id, params.round).answer,
      quip: (parsed.quip || "").slice(0, 85) || getFallbackTurn(persona.id, params.round).quip,
    };
  } catch {
    clearTimeout(timeout);
    return getFallbackTurn(persona.id, params.round);
  }
}

/**
 * Generates an AI character's vote after seeing the true main prompt and all players' answers.
 */
export async function generateAIVote(params: {
  personaId: string;
  difficulty: AIDifficulty;
  selfId: string;
  mainPrompt: string;
  candidates: Array<{ id: string; name: string; answer: string }>;
}): Promise<string> {
  const validTargets = params.candidates.filter((c) => c.id !== params.selfId);
  if (validTargets.length === 0) return "";

  const persona = AI_PERSONAS.find((p) => p.id === params.personaId) || AI_PERSONAS[0];
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return validTargets[Math.floor(Math.random() * validTargets.length)].id;
  }

  const candidateSummary = validTargets
    .map((c) => `- ID: "${c.id}" | الاسم: ${c.name} | إجابته: "${c.answer}"`)
    .join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `أنت ${persona.name} في لعبة "شكّك". السؤال الأصلي للأغلبية هو: "${params.mainPrompt}".
اختر ID اللاعب الذي تبدو إجابته غريبة أو مختلفة عن السؤال الأصلي (أو إذا كنت أنت المختلف، صوّت للاعب آخر لإبعاد الشك عنك). أعد فقط targetPlayerId من القائمة المتاحة.`,
              },
            ],
          },
          contents: [{ role: "user", parts: [{ text: `اللاعبون وإجاباتهم:\n${candidateSummary}` }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 60,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                targetPlayerId: { type: "STRING" },
              },
              required: ["targetPlayerId"],
            },
          },
        }),
      }
    );

    clearTimeout(timeout);
    if (!res.ok) return validTargets[Math.floor(Math.random() * validTargets.length)].id;

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(rawText || "{}") as AIVoteOutput;
    const exists = validTargets.some((c) => c.id === parsed.targetPlayerId);
    return exists
      ? parsed.targetPlayerId
      : validTargets[Math.floor(Math.random() * validTargets.length)].id;
  } catch {
    clearTimeout(timeout);
    return validTargets[Math.floor(Math.random() * validTargets.length)].id;
  }
}

function getFallbackTurn(personaId: string, round: 1 | 2 | 3): AIAnswerOutput {
  const persona = AI_PERSONAS.find((p) => p.id === personaId) || AI_PERSONAS[0];
  const pool =
    round === 1
      ? persona.fallbackAnswers.round1
      : round === 2
      ? persona.fallbackAnswers.round2
      : persona.fallbackAnswers.round3;
  return {
    answer: pool[Math.floor(Math.random() * pool.length)],
    quip: persona.fallbackQuips[Math.floor(Math.random() * persona.fallbackQuips.length)],
  };
}

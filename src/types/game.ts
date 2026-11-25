export type GamePhase =
  | "lobby"
  | "question"
  | "reveal"
  | "voting"
  | "round_result"
  | "gameover";

export type AIDifficulty = "casual" | "tactical" | "mastermind";

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isAI: boolean;
  personaId?: string;
  difficulty?: AIDifficulty;
  score: number;
  isReady: boolean;
  stats: {
    caughtImpostors: number;
    escapedAsImpostor: number;
    falselyAccused: number;
  };
}

export interface QuestionPair {
  id: number;
  round: 1 | 2 | 3;
  normal: string;
  impostor: string;
}

export interface RoomPublicState {
  code: string;
  hostId: string;
  phase: GamePhase;
  currentRound: 1 | 2 | 3;
  currentQuestionIndex: number;
  settings: {
    questionsPerRound: number;
    answerSeconds: number;
    hostAlsoPlays: boolean;
  };
  players: Record<string, Player>;
  answeredPlayerIds: string[];
  votedPlayerIds: string[];
  revealedPrompt?: string;
  revealedAnswers?: Record<string, { text: string; quip?: string }>;
  lastRoundResult?: {
    impostorIds: string[];
    impostorPrompt: string;
    voteCounts: Record<string, number>;
    pointsEarned: Record<string, number>;
  };
  phaseEndsAt: number | null;
  usedQuestionIds: number[];
  customQuestions: Array<{ round: 1 | 2 | 3; normal: string; impostor: string }>;
}

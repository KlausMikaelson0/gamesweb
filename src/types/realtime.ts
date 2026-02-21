export const ROOM_CODE_MIN_LENGTH = 4;
export const ROOM_CODE_MAX_LENGTH = 6;

export type GameId =
  | "sketch-and-guess"
  | "stop-human-animal-object"
  | "spyfall"
  | "most-likely-to"
  | "truth-or-dare"
  | "emoji-translator"
  | "the-spy"
  | "five-second-rule";

export type RoomStatus = "lobby" | "in-game";
export type CurrentGame =
  | "SKETCH"
  | "STOP"
  | "SPYFALL"
  | "MOST_LIKELY"
  | "TRUTH_OR_DARE"
  | "EMOJI_TRANSLATOR";
export type SketchPhase = "lobby" | "drawing" | "round-over";
export type StopPhase = "lobby" | "input" | "countdown" | "voting" | "results";
export type StopField = "name" | "animal" | "object" | "country" | "food";
export type SpyfallPhase = "lobby" | "reveal" | "discussion" | "voting" | "results";
export type MostLikelyPhase = "lobby" | "voting" | "results";
export type TruthOrDarePhase = "lobby" | "spinning" | "prompt";
export type EmojiTranslatorPhase = "lobby" | "guessing" | "results";

export interface PlayerState {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
}

export interface DrawSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
}

export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  timestamp: number;
  type: "chat" | "system" | "correct";
}

export interface SketchState {
  phase: SketchPhase;
  drawerId: string | null;
  round: number;
  timeLeft: number;
  maskedWord: string;
  currentWord?: string;
  drawingSegments: DrawSegment[];
  guessedPlayerIds: string[];
}

export interface StopAnswers {
  name: string;
  animal: string;
  object: string;
  country: string;
  food: string;
}

export type StopValidation = Record<StopField, boolean>;
export type StopFieldPoints = Record<StopField, number>;

export interface StopFieldVotingSummary {
  yes: number;
  no: number;
  myVote: boolean | null;
}

export type StopSubmissionVotes = Record<StopField, StopFieldVotingSummary>;

export interface StopSubmission {
  playerId: string;
  playerName: string;
  answers: StopAnswers;
  locked: boolean;
  autoValid: StopValidation;
  communityValid: StopValidation;
  pointsByField: StopFieldPoints;
  totalRoundPoints: number;
  votes: StopSubmissionVotes;
}

export interface StopState {
  phase: StopPhase;
  round: number;
  letter: string;
  timeLeft: number;
  stopByPlayerId: string | null;
  submissions: StopSubmission[];
}

export interface VoteCount {
  playerId: string;
  votes: number;
}

export interface SpyfallState {
  phase: SpyfallPhase;
  round: number;
  timeLeft: number;
  myRole: "spy" | "citizen" | null;
  myLocation: string | null;
  spyIdRevealed: string | null;
  locationRevealed: string | null;
  myVoteTargetId: string | null;
  votes: VoteCount[];
}

export interface MostLikelyState {
  phase: MostLikelyPhase;
  round: number;
  question: string;
  timeLeft: number;
  myVoteTargetId: string | null;
  votes: VoteCount[];
  winnerPlayerId: string | null;
}

export interface TruthOrDareState {
  phase: TruthOrDarePhase;
  round: number;
  timeLeft: number;
  spinAngle: number;
  selectedPlayerId: string | null;
  mode: "truth" | "dare" | null;
  prompt: string;
}

export interface EmojiTranslatorState {
  phase: EmojiTranslatorPhase;
  round: number;
  timeLeft: number;
  emoji: string;
  answerLength: number;
  solvedByPlayerId: string | null;
  revealAnswer: string | null;
}

export interface ReactionEvent {
  id: string;
  emoji: string;
  playerId: string;
  playerName: string;
  timestamp: number;
}

export interface RoomState {
  code: string;
  game: GameId;
  current_game: CurrentGame;
  status: RoomStatus;
  createdAt: number;
  players: PlayerState[];
  chat: ChatMessage[];
  sketch: SketchState;
  stop: StopState;
  spyfall: SpyfallState;
  mostLikely: MostLikelyState;
  truthOrDare: TruthOrDareState;
  emojiTranslator: EmojiTranslatorState;
}

export interface RoomStatePayload {
  room: RoomState;
  me: PlayerState | null;
}

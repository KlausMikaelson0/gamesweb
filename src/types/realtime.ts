export const ROOM_CODE_MIN_LENGTH = 4;
export const ROOM_CODE_MAX_LENGTH = 6;

export type GameId =
  | "sketch-and-guess"
  | "stop-human-animal-object"
  | "the-spy"
  | "five-second-rule";

export type RoomStatus = "lobby" | "in-game";
export type SketchPhase = "lobby" | "drawing" | "round-over";

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

export interface RoomState {
  code: string;
  game: GameId;
  status: RoomStatus;
  createdAt: number;
  players: PlayerState[];
  chat: ChatMessage[];
  sketch: SketchState;
}

export interface RoomStatePayload {
  room: RoomState;
  me: PlayerState | null;
}

import { ROOM_CODE_MAX_LENGTH, ROOM_CODE_MIN_LENGTH } from "@/types/realtime";

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function sanitizeRoomCode(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, ROOM_CODE_MAX_LENGTH);
}

export function isRoomCodeValid(value: string): boolean {
  return (
    value.length >= ROOM_CODE_MIN_LENGTH &&
    value.length <= ROOM_CODE_MAX_LENGTH &&
    /^[A-Z0-9]+$/.test(value)
  );
}

export function generateRoomCode(length = 5): string {
  const boundedLength = Math.min(ROOM_CODE_MAX_LENGTH, Math.max(ROOM_CODE_MIN_LENGTH, length));

  return Array.from({ length: boundedLength })
    .map(() => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)])
    .join("");
}

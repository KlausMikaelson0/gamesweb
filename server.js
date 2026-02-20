const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROUND_DURATION_SECONDS = 60;
const MAX_CHAT_MESSAGES = 80;
const MAX_DRAWING_SEGMENTS = 5000;
const VALID_GAMES = new Set([
  "sketch-and-guess",
  "stop-human-animal-object",
  "the-spy",
  "five-second-rule",
]);
const SKETCH_WORDS = [
  "Volcano",
  "Ice Cream",
  "Treasure Map",
  "Robot",
  "Dragon",
  "Beach Ball",
  "Spaceship",
  "Pineapple",
  "Rainbow",
  "Guitar",
  "Mermaid",
  "Castle",
  "Hot Air Balloon",
  "Popcorn",
  "Snowman",
];

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const rooms = new Map();

app
  .prepare()
  .then(() => {
    const httpServer = createServer((req, res) => handle(req, res));
    const io = new Server(httpServer);

    io.on("connection", (socket) => {
      socket.on("room:create", (payload) => {
        leaveCurrentRoom(socket, io);

        const name = sanitizePlayerName(payload?.name);
        const game = sanitizeGameId(payload?.game);
        if (!name) {
          socket.emit("room:error", { message: "Nickname is required." });
          return;
        }

        let roomCode = sanitizeRoomCode(payload?.requestedCode);
        if (!roomCode || rooms.has(roomCode)) {
          roomCode = generateUniqueRoomCode();
        }

        const room = createRoom(roomCode, game);
        rooms.set(roomCode, room);
        addPlayerToRoom(room, socket, name, true);
        appendMessage(room, {
          from: "System",
          text: `${name} created room ${room.code}.`,
          type: "system",
        });
        emitRoomState(room, io);
      });

      socket.on("room:join", (payload) => {
        leaveCurrentRoom(socket, io);

        const roomCode = sanitizeRoomCode(payload?.code);
        const name = sanitizePlayerName(payload?.name);
        if (!roomCode || !name) {
          socket.emit("room:error", { message: "Invalid join request." });
          return;
        }

        const room = rooms.get(roomCode);
        if (!room) {
          socket.emit("room:error", { message: "Room not found. Check the room code." });
          return;
        }

        if (room.players.size >= 12) {
          socket.emit("room:error", { message: "Room is full." });
          return;
        }

        addPlayerToRoom(room, socket, name, false);
        appendMessage(room, {
          from: "System",
          text: `${name} joined the room.`,
          type: "system",
        });
        emitRoomState(room, io);
      });

      socket.on("room:chat", (payload) => {
        const room = getRoomForSocket(socket);
        if (!room) {
          return;
        }
        const player = room.players.get(socket.id);
        const text = sanitizeChatText(payload?.text);
        if (!player || !text) {
          return;
        }

        appendMessage(room, { from: player.name, text, type: "chat" });
        emitRoomState(room, io);
      });

      socket.on("sketch:start-round", () => {
        const room = getRoomForSocket(socket);
        if (!room || room.game !== "sketch-and-guess") {
          return;
        }
        if (room.hostId !== socket.id) {
          socket.emit("room:error", { message: "Only the host can start the round." });
          return;
        }
        if (room.players.size < 2) {
          socket.emit("room:error", { message: "At least 2 players are required." });
          return;
        }

        startSketchRound(room, io);
      });

      socket.on("sketch:draw", (payload) => {
        const room = getRoomForSocket(socket);
        if (!room || room.game !== "sketch-and-guess") {
          return;
        }
        if (room.sketch.phase !== "drawing" || room.sketch.drawerId !== socket.id) {
          return;
        }

        const segment = sanitizeSegment(payload);
        if (!segment) {
          return;
        }

        room.sketch.drawingSegments.push(segment);
        if (room.sketch.drawingSegments.length > MAX_DRAWING_SEGMENTS) {
          room.sketch.drawingSegments.shift();
        }
        io.to(room.code).emit("sketch:draw", segment);
      });

      socket.on("sketch:clear", () => {
        const room = getRoomForSocket(socket);
        if (!room || room.game !== "sketch-and-guess") {
          return;
        }
        if (room.sketch.drawerId !== socket.id) {
          return;
        }
        room.sketch.drawingSegments = [];
        emitRoomState(room, io);
      });

      socket.on("sketch:guess", (payload) => {
        const room = getRoomForSocket(socket);
        if (!room) {
          return;
        }

        const player = room.players.get(socket.id);
        const text = sanitizeChatText(payload?.text);
        if (!player || !text) {
          return;
        }

        if (room.game !== "sketch-and-guess" || room.sketch.phase !== "drawing") {
          appendMessage(room, { from: player.name, text, type: "chat" });
          emitRoomState(room, io);
          return;
        }

        const isDrawer = room.sketch.drawerId === socket.id;
        const guessedCorrectly =
          !isDrawer && normalizeWord(text) === normalizeWord(room.sketch.currentWord);

        if (guessedCorrectly && !room.sketch.guessedPlayerIds.has(socket.id)) {
          room.sketch.guessedPlayerIds.add(socket.id);
          player.score += Math.max(80, room.sketch.timeLeft * 3);
          appendMessage(room, {
            from: "System",
            text: `${player.name} guessed the word!`,
            type: "correct",
          });
          endSketchRound(room, io, "guessed", socket.id);
          return;
        }

        appendMessage(room, {
          from: player.name,
          text: isDrawer ? "I'm drawing, no hints!" : text,
          type: "chat",
        });
        emitRoomState(room, io);
      });

      socket.on("room:leave", () => {
        leaveCurrentRoom(socket, io, "left");
      });

      socket.on("disconnect", () => {
        leaveCurrentRoom(socket, io, "disconnected");
      });
    });

    httpServer
      .once("error", (error) => {
        console.error(error);
        process.exit(1);
      })
      .listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
      });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

function createRoom(code, game) {
  return {
    code,
    game,
    hostId: "",
    status: "lobby",
    createdAt: Date.now(),
    players: new Map(),
    chat: [],
    sketch: {
      phase: "lobby",
      drawerId: null,
      round: 0,
      timeLeft: 0,
      currentWord: "",
      maskedWord: "-----",
      drawingSegments: [],
      guessedPlayerIds: new Set(),
      timerId: null,
      lastDrawerIndex: -1,
    },
  };
}

function addPlayerToRoom(room, socket, name, isCreator) {
  room.players.set(socket.id, {
    id: socket.id,
    name,
    score: 0,
    joinedAt: Date.now(),
    isHost: isCreator || room.players.size === 1,
  });
  if (!room.hostId || isCreator) {
    room.hostId = socket.id;
  }
  socket.join(room.code);
  socket.data.roomCode = room.code;
}

function getRoomForSocket(socket) {
  const roomCode = socket.data.roomCode;
  if (!roomCode) {
    return null;
  }
  return rooms.get(roomCode) ?? null;
}

function leaveCurrentRoom(socket, io, reason = "left") {
  const room = getRoomForSocket(socket);
  if (!room) {
    socket.data.roomCode = undefined;
    return;
  }

  const player = room.players.get(socket.id);
  if (player) {
    room.players.delete(socket.id);
    socket.leave(room.code);

    if (room.sketch.drawerId === socket.id && room.sketch.phase === "drawing") {
      endSketchRound(room, io, "drawer-left");
    }

    if (room.hostId === socket.id) {
      const nextHost = room.players.values().next().value;
      if (nextHost) {
        room.hostId = nextHost.id;
      } else {
        room.hostId = "";
      }
    }

    if (room.players.size > 0 && reason !== "left") {
      appendMessage(room, {
        from: "System",
        text: `${player.name} disconnected.`,
        type: "system",
      });
    }
  }

  socket.data.roomCode = undefined;

  if (room.players.size === 0) {
    clearSketchTimer(room);
    rooms.delete(room.code);
    return;
  }

  emitRoomState(room, io);
}

function startSketchRound(room, io) {
  clearSketchTimer(room);
  const players = Array.from(room.players.values());
  if (players.length < 2) {
    return;
  }

  room.status = "in-game";
  room.sketch.round += 1;
  room.sketch.lastDrawerIndex = (room.sketch.lastDrawerIndex + 1) % players.length;
  const drawer = players[room.sketch.lastDrawerIndex];
  room.sketch.drawerId = drawer.id;
  room.sketch.currentWord = SKETCH_WORDS[Math.floor(Math.random() * SKETCH_WORDS.length)];
  room.sketch.maskedWord = maskWord(room.sketch.currentWord);
  room.sketch.timeLeft = ROUND_DURATION_SECONDS;
  room.sketch.phase = "drawing";
  room.sketch.drawingSegments = [];
  room.sketch.guessedPlayerIds = new Set();

  appendMessage(room, {
    from: "System",
    text: `Round ${room.sketch.round} started. ${drawer.name} is drawing.`,
    type: "system",
  });
  emitRoomState(room, io);

  room.sketch.timerId = setInterval(() => {
    room.sketch.timeLeft -= 1;
    if (room.sketch.timeLeft <= 0) {
      endSketchRound(room, io, "timeout");
      return;
    }
    emitRoomState(room, io);
  }, 1000);
}

function endSketchRound(room, io, reason, winnerId) {
  if (room.sketch.phase !== "drawing") {
    return;
  }

  clearSketchTimer(room);
  room.sketch.phase = "round-over";
  room.status = "lobby";
  appendMessage(room, {
    from: "System",
    text: `Round ended (${reason}). Word was "${room.sketch.currentWord}".`,
    type: "system",
  });
  io.to(room.code).emit("sketch:round-ended", { reason, winnerId });
  emitRoomState(room, io);
}

function emitRoomState(room, io) {
  const players = Array.from(room.players.values());
  const chat = room.chat.slice(-MAX_CHAT_MESSAGES);

  players.forEach((player) => {
    const me = {
      id: player.id,
      name: player.name,
      score: player.score,
      isHost: player.id === room.hostId,
    };

    const publicRoom = {
      code: room.code,
      game: room.game,
      status: room.status,
      createdAt: room.createdAt,
      players: players.map((entry) => ({
        id: entry.id,
        name: entry.name,
        score: entry.score,
        isHost: entry.id === room.hostId,
      })),
      chat,
      sketch: {
        phase: room.sketch.phase,
        drawerId: room.sketch.drawerId,
        round: room.sketch.round,
        timeLeft: room.sketch.timeLeft,
        maskedWord: room.sketch.maskedWord,
        currentWord:
          room.sketch.drawerId === player.id ? room.sketch.currentWord : undefined,
        drawingSegments: room.sketch.drawingSegments,
        guessedPlayerIds: Array.from(room.sketch.guessedPlayerIds),
      },
    };

    io.to(player.id).emit("room:state", { room: publicRoom, me });
  });
}

function appendMessage(room, message) {
  room.chat.push({
    id: crypto.randomUUID(),
    from: message.from,
    text: message.text,
    timestamp: Date.now(),
    type: message.type,
  });
  if (room.chat.length > MAX_CHAT_MESSAGES) {
    room.chat.shift();
  }
}

function clearSketchTimer(room) {
  if (room.sketch.timerId) {
    clearInterval(room.sketch.timerId);
    room.sketch.timerId = null;
  }
}

function sanitizePlayerName(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().replace(/\s+/g, " ").slice(0, 22);
}

function sanitizeGameId(value) {
  if (typeof value !== "string") {
    return "sketch-and-guess";
  }
  if (!VALID_GAMES.has(value)) {
    return "sketch-and-guess";
  }
  return value;
}

function sanitizeRoomCode(value) {
  if (typeof value !== "string") {
    return "";
  }
  const clean = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
  if (clean.length < 4) {
    return "";
  }
  return clean;
}

function sanitizeChatText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, 180);
}

function sanitizeSegment(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const x0 = clamp01(Number(payload.x0));
  const y0 = clamp01(Number(payload.y0));
  const x1 = clamp01(Number(payload.x1));
  const y1 = clamp01(Number(payload.y1));
  if ([x0, y0, x1, y1].some((value) => Number.isNaN(value))) {
    return null;
  }

  const width = clamp(Number(payload.width), 2, 20);
  const color = typeof payload.color === "string" ? payload.color.slice(0, 24) : "#f8fafc";
  return { x0, y0, x1, y1, width, color };
}

function normalizeWord(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function maskWord(word) {
  return word
    .split("")
    .map((character) => (character === " " ? " " : "_"))
    .join("");
}

function generateUniqueRoomCode() {
  let candidate = "";
  do {
    candidate = Array.from({ length: 5 })
      .map(() => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)])
      .join("");
  } while (rooms.has(candidate));
  return candidate;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_CHAT_MESSAGES = 80;
const MAX_DRAWING_SEGMENTS = 5000;
const SKETCH_ROUND_SECONDS = 60;
const STOP_COUNTDOWN_SECONDS = 5;
const STOP_VOTING_SECONDS = 20;
const SPY_REVEAL_SECONDS = 15;
const SPY_DISCUSSION_SECONDS = 300;
const SPY_VOTING_SECONDS = 45;
const MOST_LIKELY_SECONDS = 35;
const TRUTH_PROMPT_SECONDS = 20;
const EMOJI_ROUND_SECONDS = 45;
const STOP_FIELDS = ["name", "animal", "object", "country", "food"];
const STOP_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ALLOWED_REACTIONS = new Set(["🔥", "😂", "👏"]);

const VALID_GAMES = new Set([
  "sketch-and-guess",
  "stop-human-animal-object",
  "spyfall",
  "most-likely-to",
  "truth-or-dare",
  "emoji-translator",
  "the-spy",
  "five-second-rule",
]);

const VALID_CURRENT_GAMES = new Set([
  "SKETCH",
  "STOP",
  "SPYFALL",
  "MOST_LIKELY",
  "TRUTH_OR_DARE",
  "EMOJI_TRANSLATOR",
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

const SPYFALL_LOCATIONS = [
  "Airport",
  "Amusement Park",
  "Art Museum",
  "Bank",
  "Beach",
  "Castle",
  "Cinema",
  "Cruise Ship",
  "Desert Camp",
  "Hospital",
  "Library",
  "Luxury Hotel",
  "Mall",
  "Metro Station",
  "Mountain Cabin",
  "Police Station",
  "Restaurant",
  "School",
  "Space Station",
  "Zoo",
];

const MOST_LIKELY_QUESTIONS = [
  "Most likely to forget their own birthday?",
  "Most likely to become famous overnight?",
  "Most likely to survive on a deserted island?",
  "Most likely to laugh in a serious meeting?",
  "Most likely to text the wrong person?",
  "Most likely to move to another country?",
  "Most likely to run a startup?",
  "Most likely to start dancing in public?",
  "Most likely to spend money on snacks first?",
  "Most likely to pull an all-nighter?",
  "Most likely to host the next game night?",
  "Most likely to become a detective?",
  "Most likely to get lost with maps on?",
  "Most likely to sing loudly in traffic?",
  "Most likely to try every challenge first?",
];

const TRUTH_PROMPTS = [
  "What is your most embarrassing search history item?",
  "What secret talent do you have?",
  "Who in this room would survive a zombie apocalypse?",
  "What is one lie you told this week?",
  "What is your weirdest fear?",
  "What is your guilty pleasure song?",
];

const DARE_PROMPTS = [
  "Speak like a robot for 30 seconds.",
  "Act out your favorite movie scene.",
  "Do 10 jumping jacks now.",
  "Send your funniest selfie to the group.",
  "Describe a banana as if it were a luxury item.",
  "Freestyle rap for 20 seconds.",
];

const EMOJI_PUZZLES = [
  { emoji: "🦁👑", answer: "Lion King" },
  { emoji: "🚢🧊", answer: "Titanic" },
  { emoji: "🧙‍♂️💍", answer: "Lord of the Rings" },
  { emoji: "🐼🥋", answer: "Kung Fu Panda" },
  { emoji: "🕷️🧑", answer: "Spider Man" },
  { emoji: "👻🔫", answer: "Ghostbusters" },
  { emoji: "🦖🏞️", answer: "Jurassic Park" },
  { emoji: "👸❄️", answer: "Frozen" },
  { emoji: "🏴‍☠️🌊", answer: "Pirates of the Caribbean" },
  { emoji: "🐠🔎", answer: "Finding Nemo" },
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

      socket.on("room:set-current-game", (payload) => {
        const room = getRoomForSocket(socket);
        if (!room) {
          return;
        }
        if (room.hostId !== socket.id) {
          socket.emit("room:error", { message: "Only host can switch games." });
          return;
        }

        const nextGame = sanitizeCurrentGame(payload?.currentGame);
        if (!nextGame) {
          socket.emit("room:error", { message: "Unknown game mode." });
          return;
        }

        switchCurrentGame(room, nextGame);
        appendMessage(room, {
          from: "System",
          text: `Host switched game mode to ${nextGame}.`,
          type: "system",
        });
        emitRoomState(room, io);
      });

      socket.on("room:reaction", (payload) => {
        const room = getRoomForSocket(socket);
        if (!room) {
          return;
        }
        const player = room.players.get(socket.id);
        const emoji = sanitizeReaction(payload?.emoji);
        if (!player || !emoji) {
          return;
        }
        io.to(room.code).emit("room:reaction", {
          id: crypto.randomUUID(),
          emoji,
          playerId: player.id,
          playerName: player.name,
          timestamp: Date.now(),
        });
      });

      socket.on("sketch:start-round", () => {
        const room = getRoomForSocket(socket);
        if (!room) {
          return;
        }
        if (room.hostId !== socket.id) {
          socket.emit("room:error", { message: "Only host can start this round." });
          return;
        }
        if (room.players.size < 2) {
          socket.emit("room:error", { message: "At least 2 players are required." });
          return;
        }
        if (room.current_game !== "SKETCH") {
          socket.emit("room:error", { message: "Switch to Sketch mode first." });
          return;
        }

        startSketchRound(room, io);
      });

      socket.on("sketch:draw", (payload) => {
        const room = getRoomForSocket(socket);
        if (!room || room.current_game !== "SKETCH") {
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
        if (!room || room.current_game !== "SKETCH") {
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

        if (room.current_game !== "SKETCH" || room.sketch.phase !== "drawing") {
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

      socket.on("stop:start-round", () => {
        const room = getRoomForSocket(socket);
        if (!room) {
          return;
        }
        if (room.current_game !== "STOP") {
          socket.emit("room:error", { message: "Switch to STOP mode first." });
          return;
        }
        if (room.hostId !== socket.id) {
          socket.emit("room:error", { message: "Only the host can generate the letter." });
          return;
        }
        if (room.players.size < 2) {
          socket.emit("room:error", { message: "At least 2 players are required." });
          return;
        }
        startStopRound(room, io);
      });

      socket.on("stop:update-answers", (payload) => {
        const room = getRoomForSocket(socket);
        if (!room || room.current_game !== "STOP") {
          return;
        }
        const updated = updateStopAnswers(room, socket.id, payload?.answers);
        if (updated) {
          emitRoomState(room, io);
        }
      });

      socket.on("stop:trigger-stop", () => {
        const room = getRoomForSocket(socket);
        if (!room || room.current_game !== "STOP") {
          return;
        }
        if (room.stop.phase !== "input" || room.stop.stopByPlayerId) {
          return;
        }

        const player = room.players.get(socket.id);
        const submission = room.stop.submissions.get(socket.id);
        if (!player || !submission || !isStopSubmissionComplete(submission)) {
          socket.emit("room:error", { message: "Fill all fields before pressing STOP." });
          return;
        }

        submission.locked = true;
        room.stop.phase = "countdown";
        room.stop.stopByPlayerId = socket.id;
        room.stop.timeLeft = STOP_COUNTDOWN_SECONDS;
        room.status = "in-game";
        appendMessage(room, {
          from: "System",
          text: `${player.name} pressed STOP! ${STOP_COUNTDOWN_SECONDS}s for everyone else.`,
          type: "system",
        });
        emitRoomState(room, io);

        clearStopTimer(room);
        room.stop.timerId = setInterval(() => {
          room.stop.timeLeft -= 1;
          if (room.stop.timeLeft <= 0) {
            transitionStopToVoting(room, io);
            return;
          }
          emitRoomState(room, io);
        }, 1000);
      });

      socket.on("stop:vote", (payload) => {
        const room = getRoomForSocket(socket);
        if (!room || room.current_game !== "STOP" || room.stop.phase !== "voting") {
          return;
        }
        if (castStopVote(room, socket.id, payload)) {
          emitRoomState(room, io);
        }
      });

      socket.on("stop:finalize-voting", () => {
        const room = getRoomForSocket(socket);
        if (!room || room.current_game !== "STOP") {
          return;
        }
        if (room.hostId !== socket.id) {
          socket.emit("room:error", { message: "Only host can finalize voting." });
          return;
        }
        finalizeStopRound(room, io);
      });

      socket.on("spyfall:start-round", () => {
        const room = getRoomForSocket(socket);
        if (!room) {
          return;
        }
        if (room.current_game !== "SPYFALL") {
          socket.emit("room:error", { message: "Switch to Spyfall mode first." });
          return;
        }
        if (room.hostId !== socket.id) {
          socket.emit("room:error", { message: "Only host can start Spyfall." });
          return;
        }
        if (room.players.size < 3) {
          socket.emit("room:error", { message: "Spyfall needs at least 3 players." });
          return;
        }
        startSpyfallRound(room, io);
      });

      socket.on("spyfall:start-voting", () => {
        const room = getRoomForSocket(socket);
        if (!room || room.current_game !== "SPYFALL") {
          return;
        }
        if (room.hostId !== socket.id) {
          socket.emit("room:error", { message: "Only host can move to voting." });
          return;
        }
        startSpyfallVoting(room, io);
      });

      socket.on("spyfall:vote", (payload) => {
        const room = getRoomForSocket(socket);
        if (!room || room.current_game !== "SPYFALL" || room.spyfall.phase !== "voting") {
          return;
        }
        const targetPlayerId =
          typeof payload?.targetPlayerId === "string" ? payload.targetPlayerId : "";
        if (!room.players.has(targetPlayerId) || !room.players.has(socket.id)) {
          return;
        }
        room.spyfall.votes.set(socket.id, targetPlayerId);
        emitRoomState(room, io);
      });

      socket.on("spyfall:finalize-voting", () => {
        const room = getRoomForSocket(socket);
        if (!room || room.current_game !== "SPYFALL") {
          return;
        }
        if (room.hostId !== socket.id) {
          socket.emit("room:error", { message: "Only host can finalize voting." });
          return;
        }
        finalizeSpyfallRound(room, io);
      });

      socket.on("mostlikely:start-round", () => {
        const room = getRoomForSocket(socket);
        if (!room) {
          return;
        }
        if (room.current_game !== "MOST_LIKELY") {
          socket.emit("room:error", { message: "Switch to Most Likely mode first." });
          return;
        }
        if (room.hostId !== socket.id) {
          socket.emit("room:error", { message: "Only host can start this round." });
          return;
        }
        if (room.players.size < 2) {
          socket.emit("room:error", { message: "At least 2 players are required." });
          return;
        }
        startMostLikelyRound(room, io);
      });

      socket.on("mostlikely:vote", (payload) => {
        const room = getRoomForSocket(socket);
        if (!room || room.current_game !== "MOST_LIKELY") {
          return;
        }
        if (room.mostLikely.phase !== "voting") {
          return;
        }
        const targetPlayerId =
          typeof payload?.targetPlayerId === "string" ? payload.targetPlayerId : "";
        if (!room.players.has(targetPlayerId) || !room.players.has(socket.id)) {
          return;
        }
        room.mostLikely.votes.set(socket.id, targetPlayerId);

        if (room.mostLikely.votes.size >= room.players.size) {
          finalizeMostLikelyRound(room, io);
          return;
        }
        emitRoomState(room, io);
      });

      socket.on("mostlikely:finalize", () => {
        const room = getRoomForSocket(socket);
        if (!room || room.current_game !== "MOST_LIKELY") {
          return;
        }
        if (room.hostId !== socket.id) {
          socket.emit("room:error", { message: "Only host can finalize." });
          return;
        }
        finalizeMostLikelyRound(room, io);
      });

      socket.on("truthdare:spin", () => {
        const room = getRoomForSocket(socket);
        if (!room) {
          return;
        }
        if (room.current_game !== "TRUTH_OR_DARE") {
          socket.emit("room:error", { message: "Switch to Truth or Dare mode first." });
          return;
        }
        if (room.hostId !== socket.id) {
          socket.emit("room:error", { message: "Only host can spin the wheel." });
          return;
        }
        if (room.players.size < 2) {
          socket.emit("room:error", { message: "At least 2 players are required." });
          return;
        }
        spinTruthOrDare(room, io);
      });

      socket.on("emoji:start-round", () => {
        const room = getRoomForSocket(socket);
        if (!room) {
          return;
        }
        if (room.current_game !== "EMOJI_TRANSLATOR") {
          socket.emit("room:error", { message: "Switch to Emoji Translator mode first." });
          return;
        }
        if (room.hostId !== socket.id) {
          socket.emit("room:error", { message: "Only host can start puzzle." });
          return;
        }
        if (room.players.size < 2) {
          socket.emit("room:error", { message: "At least 2 players are required." });
          return;
        }
        startEmojiRound(room, io);
      });

      socket.on("emoji:guess", (payload) => {
        const room = getRoomForSocket(socket);
        if (!room || room.current_game !== "EMOJI_TRANSLATOR") {
          return;
        }
        if (room.emojiTranslator.phase !== "guessing") {
          return;
        }
        const player = room.players.get(socket.id);
        const text = sanitizeChatText(payload?.text);
        if (!player || !text) {
          return;
        }
        if (normalizeWord(text) !== room.emojiTranslator.answerNormalized) {
          return;
        }
        finalizeEmojiRound(room, io, socket.id);
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
    current_game: mapGameToCurrentGame(game),
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
    stop: {
      phase: "lobby",
      round: 0,
      letter: "",
      timeLeft: 0,
      stopByPlayerId: null,
      submissions: new Map(),
      votes: new Map(),
      timerId: null,
    },
    spyfall: {
      phase: "lobby",
      round: 0,
      timeLeft: 0,
      spyId: null,
      location: "",
      spyIdRevealed: null,
      locationRevealed: null,
      votes: new Map(),
      timerId: null,
    },
    mostLikely: {
      phase: "lobby",
      round: 0,
      question: "",
      timeLeft: 0,
      votes: new Map(),
      winnerPlayerId: null,
      timerId: null,
    },
    truthOrDare: {
      phase: "lobby",
      round: 0,
      timeLeft: 0,
      spinAngle: 0,
      selectedPlayerId: null,
      mode: null,
      prompt: "",
      timerId: null,
    },
    emojiTranslator: {
      phase: "lobby",
      round: 0,
      timeLeft: 0,
      emoji: "",
      answer: "",
      answerNormalized: "",
      answerLength: 0,
      solvedByPlayerId: null,
      revealAnswer: null,
      timerId: null,
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

  if (room.current_game === "STOP" || room.stop.round > 0) {
    const submission = ensureStopSubmission(room, socket.id, name);
    if (room.stop.phase === "input") {
      submission.locked = false;
    } else if (
      room.stop.phase === "countdown" ||
      room.stop.phase === "voting" ||
      room.stop.phase === "results"
    ) {
      submission.locked = true;
    }
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
    removePlayerArtifactsFromGames(room, socket.id);

    if (room.sketch.drawerId === socket.id && room.sketch.phase === "drawing") {
      endSketchRound(room, io, "drawer-left");
    }

    if (room.hostId === socket.id) {
      const nextHost = room.players.values().next().value;
      room.hostId = nextHost ? nextHost.id : "";
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
    clearAllGameTimers(room);
    rooms.delete(room.code);
    return;
  }

  emitRoomState(room, io);
}

function removePlayerArtifactsFromGames(room, playerId) {
  removeStopPlayerArtifacts(room, playerId);

  room.spyfall.votes.delete(playerId);
  for (const [voterId, targetId] of room.spyfall.votes.entries()) {
    if (targetId === playerId || voterId === playerId) {
      room.spyfall.votes.delete(voterId);
    }
  }
  if (room.spyfall.spyId === playerId && room.spyfall.phase !== "lobby") {
    room.spyfall.phase = "results";
    room.spyfall.spyIdRevealed = playerId;
    room.spyfall.locationRevealed = room.spyfall.location;
    room.spyfall.timeLeft = 0;
    room.status = "lobby";
    clearSpyfallTimer(room);
  }

  room.mostLikely.votes.delete(playerId);
  for (const [voterId, targetId] of room.mostLikely.votes.entries()) {
    if (targetId === playerId || voterId === playerId) {
      room.mostLikely.votes.delete(voterId);
    }
  }
  if (room.mostLikely.winnerPlayerId === playerId) {
    room.mostLikely.winnerPlayerId = null;
  }

  if (room.truthOrDare.selectedPlayerId === playerId) {
    room.truthOrDare.selectedPlayerId = null;
  }
  if (room.emojiTranslator.solvedByPlayerId === playerId) {
    room.emojiTranslator.solvedByPlayerId = null;
  }
}

function switchCurrentGame(room, nextGame) {
  clearAllGameTimers(room);
  room.current_game = nextGame;
  room.game = mapCurrentGameToGameId(nextGame);
  room.status = "lobby";

  if (nextGame === "SKETCH") {
    room.sketch.phase = "lobby";
    room.sketch.timeLeft = 0;
  } else if (nextGame === "STOP") {
    room.stop.phase = "lobby";
    room.stop.timeLeft = 0;
    room.stop.stopByPlayerId = null;
  } else if (nextGame === "SPYFALL") {
    room.spyfall.phase = "lobby";
    room.spyfall.timeLeft = 0;
  } else if (nextGame === "MOST_LIKELY") {
    room.mostLikely.phase = "lobby";
    room.mostLikely.timeLeft = 0;
  } else if (nextGame === "TRUTH_OR_DARE") {
    room.truthOrDare.phase = "lobby";
    room.truthOrDare.timeLeft = 0;
  } else if (nextGame === "EMOJI_TRANSLATOR") {
    room.emojiTranslator.phase = "lobby";
    room.emojiTranslator.timeLeft = 0;
  }
}

function clearAllGameTimers(room) {
  clearSketchTimer(room);
  clearStopTimer(room);
  clearSpyfallTimer(room);
  clearMostLikelyTimer(room);
  clearTruthOrDareTimer(room);
  clearEmojiTimer(room);
}

function startSketchRound(room, io) {
  clearSketchTimer(room);
  room.current_game = "SKETCH";
  room.game = mapCurrentGameToGameId("SKETCH");
  room.status = "in-game";

  const players = Array.from(room.players.values());
  if (players.length < 2) {
    return;
  }

  room.sketch.round += 1;
  room.sketch.lastDrawerIndex = (room.sketch.lastDrawerIndex + 1) % players.length;
  const drawer = players[room.sketch.lastDrawerIndex];
  room.sketch.drawerId = drawer.id;
  room.sketch.currentWord = SKETCH_WORDS[Math.floor(Math.random() * SKETCH_WORDS.length)];
  room.sketch.maskedWord = maskWord(room.sketch.currentWord);
  room.sketch.timeLeft = SKETCH_ROUND_SECONDS;
  room.sketch.phase = "drawing";
  room.sketch.drawingSegments = [];
  room.sketch.guessedPlayerIds = new Set();

  appendMessage(room, {
    from: "System",
    text: `Sketch round ${room.sketch.round} started. ${drawer.name} is drawing.`,
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
    text: `Sketch round ended (${reason}). Word was "${room.sketch.currentWord}".`,
    type: "system",
  });
  io.to(room.code).emit("sketch:round-ended", { reason, winnerId });
  if (winnerId) {
    io.to(room.code).emit("game:winner", {
      currentGame: "SKETCH",
      winnerPlayerIds: [winnerId],
    });
  }
  emitRoomState(room, io);
}

function startStopRound(room, io) {
  clearStopTimer(room);
  room.current_game = "STOP";
  room.game = mapCurrentGameToGameId("STOP");
  room.status = "in-game";
  room.stop.phase = "input";
  room.stop.round += 1;
  room.stop.letter = STOP_LETTERS[Math.floor(Math.random() * STOP_LETTERS.length)];
  room.stop.timeLeft = 0;
  room.stop.stopByPlayerId = null;
  room.stop.votes.clear();

  for (const player of room.players.values()) {
    const submission = ensureStopSubmission(room, player.id, player.name);
    resetStopSubmissionForRound(submission);
  }

  appendMessage(room, {
    from: "System",
    text: `STOP round ${room.stop.round} started. Letter is ${room.stop.letter}.`,
    type: "system",
  });
  emitRoomState(room, io);
}

function transitionStopToVoting(room, io) {
  if (room.stop.phase !== "countdown" && room.stop.phase !== "input") {
    return;
  }

  clearStopTimer(room);
  room.stop.phase = "voting";
  room.stop.timeLeft = STOP_VOTING_SECONDS;

  for (const submission of room.stop.submissions.values()) {
    submission.locked = true;
    submission.autoValid = computeStopAutoValidation(submission.answers, room.stop.letter);
    submission.communityValid = createStopValidation(false);
    submission.pointsByField = createStopPoints(0);
    submission.totalRoundPoints = 0;
  }

  appendMessage(room, {
    from: "System",
    text: "STOP voting phase started.",
    type: "system",
  });
  emitRoomState(room, io);

  room.stop.timerId = setInterval(() => {
    room.stop.timeLeft -= 1;
    if (room.stop.timeLeft <= 0) {
      finalizeStopRound(room, io);
      return;
    }
    emitRoomState(room, io);
  }, 1000);
}

function finalizeStopRound(room, io) {
  if (room.stop.phase !== "voting") {
    return;
  }
  clearStopTimer(room);

  for (const submission of room.stop.submissions.values()) {
    submission.autoValid = computeStopAutoValidation(submission.answers, room.stop.letter);
    submission.communityValid = createStopValidation(false);
    submission.pointsByField = createStopPoints(0);
    submission.totalRoundPoints = 0;

    for (const field of STOP_FIELDS) {
      const voteSummary = getStopVoteSummary(room, submission.playerId, field, null);
      const hasVotes = voteSummary.yes + voteSummary.no > 0;
      submission.communityValid[field] =
        submission.autoValid[field] && (!hasVotes || voteSummary.yes >= voteSummary.no);
    }
  }

  const frequenciesByField = {
    name: new Map(),
    animal: new Map(),
    object: new Map(),
    country: new Map(),
    food: new Map(),
  };

  for (const submission of room.stop.submissions.values()) {
    if (!room.players.has(submission.playerId)) {
      continue;
    }
    for (const field of STOP_FIELDS) {
      if (!submission.communityValid[field]) {
        continue;
      }
      const normalized = normalizeStopAnswer(submission.answers[field]);
      if (!normalized) {
        continue;
      }
      const fieldMap = frequenciesByField[field];
      fieldMap.set(normalized, (fieldMap.get(normalized) ?? 0) + 1);
    }
  }

  for (const submission of room.stop.submissions.values()) {
    if (!room.players.has(submission.playerId)) {
      continue;
    }
    let totalRoundPoints = 0;
    for (const field of STOP_FIELDS) {
      if (!submission.communityValid[field]) {
        submission.pointsByField[field] = 0;
        continue;
      }
      const normalized = normalizeStopAnswer(submission.answers[field]);
      const count = frequenciesByField[field].get(normalized) ?? 0;
      const points = count <= 1 ? 10 : 5;
      submission.pointsByField[field] = points;
      totalRoundPoints += points;
    }

    submission.totalRoundPoints = totalRoundPoints;
    const player = room.players.get(submission.playerId);
    if (player) {
      player.score += totalRoundPoints;
    }
  }

  const winner = Array.from(room.stop.submissions.values())
    .filter((submission) => room.players.has(submission.playerId))
    .sort((left, right) => right.totalRoundPoints - left.totalRoundPoints)[0];

  room.stop.phase = "results";
  room.stop.timeLeft = 0;
  room.stop.stopByPlayerId = null;
  room.status = "lobby";

  appendMessage(room, {
    from: "System",
    text: winner
      ? `${winner.playerName} won STOP with ${winner.totalRoundPoints} points.`
      : "STOP round finalized.",
    type: "system",
  });
  if (winner && winner.totalRoundPoints > 0) {
    io.to(room.code).emit("game:winner", {
      currentGame: "STOP",
      winnerPlayerIds: [winner.playerId],
    });
  }
  emitRoomState(room, io);
}

function updateStopAnswers(room, playerId, answersPayload) {
  if (room.stop.phase !== "input" && room.stop.phase !== "countdown") {
    return false;
  }

  const player = room.players.get(playerId);
  if (!player) {
    return false;
  }
  const submission = ensureStopSubmission(room, playerId, player.name);
  if (submission.locked) {
    return false;
  }

  const sanitizedPatch = sanitizeStopAnswerPatch(answersPayload);
  if (!sanitizedPatch) {
    return false;
  }

  let changed = false;
  for (const field of STOP_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, field)) {
      const nextValue = sanitizedPatch[field];
      if (submission.answers[field] !== nextValue) {
        submission.answers[field] = nextValue;
        changed = true;
      }
    }
  }
  return changed;
}

function castStopVote(room, voterId, payload) {
  const targetPlayerId =
    typeof payload?.targetPlayerId === "string" ? payload.targetPlayerId : "";
  const field = typeof payload?.field === "string" ? payload.field : "";
  const isValid = Boolean(payload?.isValid);

  if (!room.players.has(voterId)) {
    return false;
  }
  if (!targetPlayerId || !STOP_FIELDS.includes(field)) {
    return false;
  }
  if (targetPlayerId === voterId) {
    return false;
  }

  const targetSubmission = room.stop.submissions.get(targetPlayerId);
  if (!targetSubmission || !targetSubmission.autoValid[field]) {
    return false;
  }

  const voteKey = getStopVoteKey(targetPlayerId, field);
  const voteMap = room.stop.votes.get(voteKey) ?? new Map();
  voteMap.set(voterId, isValid);
  room.stop.votes.set(voteKey, voteMap);
  return true;
}

function startSpyfallRound(room, io) {
  clearSpyfallTimer(room);
  room.current_game = "SPYFALL";
  room.game = mapCurrentGameToGameId("SPYFALL");
  room.status = "in-game";

  const players = Array.from(room.players.values());
  room.spyfall.round += 1;
  room.spyfall.phase = "reveal";
  room.spyfall.timeLeft = SPY_REVEAL_SECONDS;
  room.spyfall.spyId = players[Math.floor(Math.random() * players.length)]?.id ?? null;
  room.spyfall.location = SPYFALL_LOCATIONS[Math.floor(Math.random() * SPYFALL_LOCATIONS.length)];
  room.spyfall.spyIdRevealed = null;
  room.spyfall.locationRevealed = null;
  room.spyfall.votes.clear();

  appendMessage(room, {
    from: "System",
    text: "Spyfall cards are out. Reveal your role privately.",
    type: "system",
  });
  emitRoomState(room, io);

  room.spyfall.timerId = setInterval(() => {
    room.spyfall.timeLeft -= 1;
    if (room.spyfall.timeLeft <= 0) {
      startSpyfallDiscussion(room, io);
      return;
    }
    emitRoomState(room, io);
  }, 1000);
}

function startSpyfallDiscussion(room, io) {
  clearSpyfallTimer(room);
  room.spyfall.phase = "discussion";
  room.spyfall.timeLeft = SPY_DISCUSSION_SECONDS;

  appendMessage(room, {
    from: "System",
    text: "Spyfall discussion started (5 minutes).",
    type: "system",
  });
  emitRoomState(room, io);

  room.spyfall.timerId = setInterval(() => {
    room.spyfall.timeLeft -= 1;
    if (room.spyfall.timeLeft <= 0) {
      startSpyfallVoting(room, io);
      return;
    }
    emitRoomState(room, io);
  }, 1000);
}

function startSpyfallVoting(room, io) {
  clearSpyfallTimer(room);
  room.spyfall.phase = "voting";
  room.spyfall.timeLeft = SPY_VOTING_SECONDS;
  room.spyfall.votes.clear();

  appendMessage(room, {
    from: "System",
    text: "Spyfall voting started. Pick the spy.",
    type: "system",
  });
  emitRoomState(room, io);

  room.spyfall.timerId = setInterval(() => {
    room.spyfall.timeLeft -= 1;
    if (room.spyfall.timeLeft <= 0) {
      finalizeSpyfallRound(room, io);
      return;
    }
    emitRoomState(room, io);
  }, 1000);
}

function finalizeSpyfallRound(room, io) {
  if (room.spyfall.phase !== "voting" && room.spyfall.phase !== "discussion") {
    return;
  }

  clearSpyfallTimer(room);
  if (room.spyfall.phase === "discussion") {
    room.spyfall.votes.clear();
  }

  const voteCounts = aggregateVotesByTarget(room.spyfall.votes, room.players);
  const topVote = voteCounts.sort((left, right) => right.votes - left.votes)[0];
  const accusedPlayerId = topVote?.playerId ?? null;
  const spyCaught = Boolean(accusedPlayerId && accusedPlayerId === room.spyfall.spyId);
  const winnerPlayerIds = [];

  if (spyCaught) {
    for (const player of room.players.values()) {
      if (player.id !== room.spyfall.spyId) {
        player.score += 10;
        winnerPlayerIds.push(player.id);
      }
    }
  } else if (room.spyfall.spyId && room.players.has(room.spyfall.spyId)) {
    const spyPlayer = room.players.get(room.spyfall.spyId);
    if (spyPlayer) {
      spyPlayer.score += 20;
      winnerPlayerIds.push(spyPlayer.id);
    }
  }

  room.spyfall.phase = "results";
  room.spyfall.timeLeft = 0;
  room.spyfall.spyIdRevealed = room.spyfall.spyId;
  room.spyfall.locationRevealed = room.spyfall.location;
  room.status = "lobby";

  appendMessage(room, {
    from: "System",
    text: spyCaught
      ? "Spy was caught! Citizens take the round."
      : "Spy escaped! Spy wins the round.",
    type: "system",
  });

  if (winnerPlayerIds.length > 0) {
    io.to(room.code).emit("game:winner", {
      currentGame: "SPYFALL",
      winnerPlayerIds,
    });
  }
  emitRoomState(room, io);
}

function startMostLikelyRound(room, io) {
  clearMostLikelyTimer(room);
  room.current_game = "MOST_LIKELY";
  room.game = mapCurrentGameToGameId("MOST_LIKELY");
  room.status = "in-game";
  room.mostLikely.round += 1;
  room.mostLikely.phase = "voting";
  room.mostLikely.question =
    MOST_LIKELY_QUESTIONS[Math.floor(Math.random() * MOST_LIKELY_QUESTIONS.length)];
  room.mostLikely.timeLeft = MOST_LIKELY_SECONDS;
  room.mostLikely.votes.clear();
  room.mostLikely.winnerPlayerId = null;

  appendMessage(room, {
    from: "System",
    text: "Most Likely prompt is live. Cast your vote!",
    type: "system",
  });
  emitRoomState(room, io);

  room.mostLikely.timerId = setInterval(() => {
    room.mostLikely.timeLeft -= 1;
    if (room.mostLikely.timeLeft <= 0) {
      finalizeMostLikelyRound(room, io);
      return;
    }
    emitRoomState(room, io);
  }, 1000);
}

function finalizeMostLikelyRound(room, io) {
  if (room.mostLikely.phase !== "voting") {
    return;
  }

  clearMostLikelyTimer(room);
  const voteCounts = aggregateVotesByTarget(room.mostLikely.votes, room.players);
  const winner = voteCounts.sort((left, right) => right.votes - left.votes)[0];

  room.mostLikely.phase = "results";
  room.mostLikely.timeLeft = 0;
  room.status = "lobby";
  room.mostLikely.winnerPlayerId = winner?.playerId ?? null;

  if (winner && winner.votes > 0) {
    const player = room.players.get(winner.playerId);
    if (player) {
      player.score += 8;
    }
    appendMessage(room, {
      from: "System",
      text: `${player?.name ?? "A player"} got the most votes.`,
      type: "system",
    });
    io.to(room.code).emit("game:winner", {
      currentGame: "MOST_LIKELY",
      winnerPlayerIds: [winner.playerId],
    });
  } else {
    appendMessage(room, {
      from: "System",
      text: "Most Likely round ended with no votes.",
      type: "system",
    });
  }
  emitRoomState(room, io);
}

function spinTruthOrDare(room, io) {
  clearTruthOrDareTimer(room);
  room.current_game = "TRUTH_OR_DARE";
  room.game = mapCurrentGameToGameId("TRUTH_OR_DARE");
  room.status = "in-game";
  room.truthOrDare.phase = "spinning";
  room.truthOrDare.round += 1;
  room.truthOrDare.spinAngle += 1080 + Math.floor(Math.random() * 900);
  room.truthOrDare.timeLeft = 3;
  room.truthOrDare.selectedPlayerId = randomArrayItem(Array.from(room.players.keys()));
  room.truthOrDare.mode = Math.random() > 0.5 ? "truth" : "dare";
  room.truthOrDare.prompt =
    room.truthOrDare.mode === "truth"
      ? randomArrayItem(TRUTH_PROMPTS)
      : randomArrayItem(DARE_PROMPTS);

  appendMessage(room, {
    from: "System",
    text: "Truth or Dare wheel is spinning...",
    type: "system",
  });
  emitRoomState(room, io);

  room.truthOrDare.timerId = setInterval(() => {
    room.truthOrDare.timeLeft -= 1;
    if (room.truthOrDare.timeLeft <= 0) {
      clearTruthOrDareTimer(room);
      room.truthOrDare.phase = "prompt";
      room.truthOrDare.timeLeft = TRUTH_PROMPT_SECONDS;
      emitRoomState(room, io);

      room.truthOrDare.timerId = setInterval(() => {
        room.truthOrDare.timeLeft -= 1;
        if (room.truthOrDare.timeLeft <= 0) {
          clearTruthOrDareTimer(room);
          room.truthOrDare.phase = "lobby";
          room.truthOrDare.timeLeft = 0;
          room.status = "lobby";
          emitRoomState(room, io);
          return;
        }
        emitRoomState(room, io);
      }, 1000);
      return;
    }
    emitRoomState(room, io);
  }, 1000);
}

function startEmojiRound(room, io) {
  clearEmojiTimer(room);
  room.current_game = "EMOJI_TRANSLATOR";
  room.game = mapCurrentGameToGameId("EMOJI_TRANSLATOR");
  room.status = "in-game";
  room.emojiTranslator.round += 1;
  room.emojiTranslator.phase = "guessing";
  room.emojiTranslator.timeLeft = EMOJI_ROUND_SECONDS;
  room.emojiTranslator.solvedByPlayerId = null;
  room.emojiTranslator.revealAnswer = null;

  const puzzle = randomArrayItem(EMOJI_PUZZLES);
  room.emojiTranslator.emoji = puzzle.emoji;
  room.emojiTranslator.answer = puzzle.answer;
  room.emojiTranslator.answerNormalized = normalizeWord(puzzle.answer);
  room.emojiTranslator.answerLength = puzzle.answer.length;

  appendMessage(room, {
    from: "System",
    text: "Emoji puzzle started. Decode quickly!",
    type: "system",
  });
  emitRoomState(room, io);

  room.emojiTranslator.timerId = setInterval(() => {
    room.emojiTranslator.timeLeft -= 1;
    if (room.emojiTranslator.timeLeft <= 0) {
      finalizeEmojiRound(room, io, null);
      return;
    }
    emitRoomState(room, io);
  }, 1000);
}

function finalizeEmojiRound(room, io, winnerPlayerId) {
  if (room.emojiTranslator.phase !== "guessing") {
    return;
  }
  clearEmojiTimer(room);

  room.emojiTranslator.phase = "results";
  room.emojiTranslator.timeLeft = 0;
  room.emojiTranslator.solvedByPlayerId = winnerPlayerId;
  room.emojiTranslator.revealAnswer = room.emojiTranslator.answer;
  room.status = "lobby";

  if (winnerPlayerId && room.players.has(winnerPlayerId)) {
    const winner = room.players.get(winnerPlayerId);
    winner.score += 15;
    appendMessage(room, {
      from: "System",
      text: `${winner.name} solved the emoji puzzle first!`,
      type: "system",
    });
    io.to(room.code).emit("game:winner", {
      currentGame: "EMOJI_TRANSLATOR",
      winnerPlayerIds: [winnerPlayerId],
    });
  } else {
    appendMessage(room, {
      from: "System",
      text: "Emoji puzzle timed out.",
      type: "system",
    });
  }
  emitRoomState(room, io);
}

function emitRoomState(room, io) {
  const players = Array.from(room.players.values());
  const chat = room.chat.slice(-MAX_CHAT_MESSAGES);

  players.forEach((viewer) => {
    const me = {
      id: viewer.id,
      name: viewer.name,
      score: viewer.score,
      isHost: viewer.id === room.hostId,
    };

    const publicRoom = {
      code: room.code,
      game: room.game,
      current_game: room.current_game,
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
        currentWord: room.sketch.drawerId === viewer.id ? room.sketch.currentWord : undefined,
        drawingSegments: room.sketch.drawingSegments,
        guessedPlayerIds: Array.from(room.sketch.guessedPlayerIds),
      },
      stop: buildStopPublicState(room, viewer.id),
      spyfall: buildSpyfallPublicState(room, viewer.id),
      mostLikely: buildMostLikelyPublicState(room, viewer.id),
      truthOrDare: {
        phase: room.truthOrDare.phase,
        round: room.truthOrDare.round,
        timeLeft: room.truthOrDare.timeLeft,
        spinAngle: room.truthOrDare.spinAngle,
        selectedPlayerId: room.truthOrDare.selectedPlayerId,
        mode: room.truthOrDare.mode,
        prompt: room.truthOrDare.prompt,
      },
      emojiTranslator: {
        phase: room.emojiTranslator.phase,
        round: room.emojiTranslator.round,
        timeLeft: room.emojiTranslator.timeLeft,
        emoji: room.emojiTranslator.emoji,
        answerLength: room.emojiTranslator.answerLength,
        solvedByPlayerId: room.emojiTranslator.solvedByPlayerId,
        revealAnswer:
          room.emojiTranslator.phase === "results" ? room.emojiTranslator.revealAnswer : null,
      },
    };

    io.to(viewer.id).emit("room:state", { room: publicRoom, me });
  });
}

function buildStopPublicState(room, viewerPlayerId) {
  const submissions = Array.from(room.stop.submissions.values())
    .filter((submission) => room.players.has(submission.playerId))
    .map((submission) => ({
      playerId: submission.playerId,
      playerName: submission.playerName,
      answers: { ...submission.answers },
      locked: submission.locked,
      autoValid: { ...submission.autoValid },
      communityValid: { ...submission.communityValid },
      pointsByField: { ...submission.pointsByField },
      totalRoundPoints: submission.totalRoundPoints,
      votes: buildStopSubmissionVotes(room, submission.playerId, viewerPlayerId),
    }))
    .sort((left, right) => left.playerName.localeCompare(right.playerName));

  return {
    phase: room.stop.phase,
    round: room.stop.round,
    letter: room.stop.letter,
    timeLeft: room.stop.timeLeft,
    stopByPlayerId: room.stop.stopByPlayerId,
    submissions,
  };
}

function buildStopSubmissionVotes(room, targetPlayerId, viewerPlayerId) {
  return {
    name: getStopVoteSummary(room, targetPlayerId, "name", viewerPlayerId),
    animal: getStopVoteSummary(room, targetPlayerId, "animal", viewerPlayerId),
    object: getStopVoteSummary(room, targetPlayerId, "object", viewerPlayerId),
    country: getStopVoteSummary(room, targetPlayerId, "country", viewerPlayerId),
    food: getStopVoteSummary(room, targetPlayerId, "food", viewerPlayerId),
  };
}

function getStopVoteSummary(room, targetPlayerId, field, viewerPlayerId) {
  const voteMap = room.stop.votes.get(getStopVoteKey(targetPlayerId, field));
  let yes = 0;
  let no = 0;
  if (voteMap) {
    voteMap.forEach((voteValue) => {
      if (voteValue) {
        yes += 1;
      } else {
        no += 1;
      }
    });
  }
  const myVote =
    viewerPlayerId && voteMap && voteMap.has(viewerPlayerId)
      ? voteMap.get(viewerPlayerId)
      : null;
  return {
    yes,
    no,
    myVote: typeof myVote === "boolean" ? myVote : null,
  };
}

function buildSpyfallPublicState(room, viewerPlayerId) {
  const voteCounts = aggregateVotesByTarget(room.spyfall.votes, room.players);
  const myRole =
    room.spyfall.round > 0
      ? room.spyfall.spyId === viewerPlayerId
        ? "spy"
        : "citizen"
      : null;
  const myLocation =
    room.spyfall.round > 0 && room.spyfall.spyId !== viewerPlayerId
      ? room.spyfall.location
      : null;

  return {
    phase: room.spyfall.phase,
    round: room.spyfall.round,
    timeLeft: room.spyfall.timeLeft,
    myRole,
    myLocation,
    spyIdRevealed: room.spyfall.phase === "results" ? room.spyfall.spyIdRevealed : null,
    locationRevealed: room.spyfall.phase === "results" ? room.spyfall.locationRevealed : null,
    myVoteTargetId: room.spyfall.votes.get(viewerPlayerId) ?? null,
    votes: voteCounts,
  };
}

function buildMostLikelyPublicState(room, viewerPlayerId) {
  return {
    phase: room.mostLikely.phase,
    round: room.mostLikely.round,
    question: room.mostLikely.question,
    timeLeft: room.mostLikely.timeLeft,
    myVoteTargetId: room.mostLikely.votes.get(viewerPlayerId) ?? null,
    votes: aggregateVotesByTarget(room.mostLikely.votes, room.players),
    winnerPlayerId: room.mostLikely.winnerPlayerId,
  };
}

function aggregateVotesByTarget(voteMap, players) {
  const counts = new Map();
  for (const player of players.values()) {
    counts.set(player.id, 0);
  }
  for (const targetPlayerId of voteMap.values()) {
    if (counts.has(targetPlayerId)) {
      counts.set(targetPlayerId, counts.get(targetPlayerId) + 1);
    }
  }
  return Array.from(counts.entries()).map(([playerId, votes]) => ({ playerId, votes }));
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

function clearStopTimer(room) {
  if (room.stop.timerId) {
    clearInterval(room.stop.timerId);
    room.stop.timerId = null;
  }
}

function clearSpyfallTimer(room) {
  if (room.spyfall.timerId) {
    clearInterval(room.spyfall.timerId);
    room.spyfall.timerId = null;
  }
}

function clearMostLikelyTimer(room) {
  if (room.mostLikely.timerId) {
    clearInterval(room.mostLikely.timerId);
    room.mostLikely.timerId = null;
  }
}

function clearTruthOrDareTimer(room) {
  if (room.truthOrDare.timerId) {
    clearInterval(room.truthOrDare.timerId);
    room.truthOrDare.timerId = null;
  }
}

function clearEmojiTimer(room) {
  if (room.emojiTranslator.timerId) {
    clearInterval(room.emojiTranslator.timerId);
    room.emojiTranslator.timerId = null;
  }
}

function ensureStopSubmission(room, playerId, playerName) {
  let submission = room.stop.submissions.get(playerId);
  if (!submission) {
    submission = {
      playerId,
      playerName,
      answers: createStopAnswers(),
      locked: false,
      autoValid: createStopValidation(false),
      communityValid: createStopValidation(false),
      pointsByField: createStopPoints(0),
      totalRoundPoints: 0,
    };
    room.stop.submissions.set(playerId, submission);
  }
  submission.playerName = playerName;
  return submission;
}

function resetStopSubmissionForRound(submission) {
  submission.answers = createStopAnswers();
  submission.locked = false;
  submission.autoValid = createStopValidation(false);
  submission.communityValid = createStopValidation(false);
  submission.pointsByField = createStopPoints(0);
  submission.totalRoundPoints = 0;
}

function isStopSubmissionComplete(submission) {
  return STOP_FIELDS.every((field) => submission.answers[field].trim().length > 0);
}

function sanitizeStopAnswerPatch(answersPayload) {
  if (!answersPayload || typeof answersPayload !== "object") {
    return null;
  }

  const patch = {};
  for (const field of STOP_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(answersPayload, field)) {
      continue;
    }
    const rawValue = answersPayload[field];
    if (typeof rawValue !== "string") {
      continue;
    }
    patch[field] = rawValue.slice(0, 36).trimStart();
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

function computeStopAutoValidation(answers, letter) {
  const validation = createStopValidation(false);
  const normalizedLetter = String(letter || "").toLowerCase();

  for (const field of STOP_FIELDS) {
    const normalizedValue = normalizeStopAnswer(answers[field]);
    validation[field] =
      normalizedValue.length > 0 && normalizedValue.startsWith(normalizedLetter);
  }
  return validation;
}

function normalizeStopAnswer(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function removeStopPlayerArtifacts(room, playerId) {
  room.stop.submissions.delete(playerId);
  if (room.stop.stopByPlayerId === playerId) {
    room.stop.stopByPlayerId = null;
  }

  for (const [voteKey, voteMap] of room.stop.votes.entries()) {
    if (voteKey.startsWith(`${playerId}:`)) {
      room.stop.votes.delete(voteKey);
      continue;
    }
    voteMap.delete(playerId);
    if (voteMap.size === 0) {
      room.stop.votes.delete(voteKey);
    }
  }
}

function createStopAnswers() {
  return {
    name: "",
    animal: "",
    object: "",
    country: "",
    food: "",
  };
}

function createStopValidation(initialValue) {
  return {
    name: initialValue,
    animal: initialValue,
    object: initialValue,
    country: initialValue,
    food: initialValue,
  };
}

function createStopPoints(initialValue) {
  return {
    name: initialValue,
    animal: initialValue,
    object: initialValue,
    country: initialValue,
    food: initialValue,
  };
}

function getStopVoteKey(targetPlayerId, field) {
  return `${targetPlayerId}:${field}`;
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
  return VALID_GAMES.has(value) ? value : "sketch-and-guess";
}

function sanitizeCurrentGame(value) {
  if (typeof value !== "string") {
    return null;
  }
  return VALID_CURRENT_GAMES.has(value) ? value : null;
}

function sanitizeReaction(value) {
  if (typeof value !== "string") {
    return "";
  }
  return ALLOWED_REACTIONS.has(value) ? value : "";
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

function mapGameToCurrentGame(game) {
  if (game === "sketch-and-guess") {
    return "SKETCH";
  }
  if (game === "stop-human-animal-object") {
    return "STOP";
  }
  if (game === "spyfall" || game === "the-spy") {
    return "SPYFALL";
  }
  if (game === "most-likely-to") {
    return "MOST_LIKELY";
  }
  if (game === "truth-or-dare" || game === "five-second-rule") {
    return "TRUTH_OR_DARE";
  }
  if (game === "emoji-translator") {
    return "EMOJI_TRANSLATOR";
  }
  return "SKETCH";
}

function mapCurrentGameToGameId(currentGame) {
  if (currentGame === "SKETCH") {
    return "sketch-and-guess";
  }
  if (currentGame === "STOP") {
    return "stop-human-animal-object";
  }
  if (currentGame === "SPYFALL") {
    return "spyfall";
  }
  if (currentGame === "MOST_LIKELY") {
    return "most-likely-to";
  }
  if (currentGame === "TRUTH_OR_DARE") {
    return "truth-or-dare";
  }
  return "emoji-translator";
}

function normalizeWord(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function maskWord(word) {
  return word
    .split("")
    .map((character) => (character === " " ? " " : "_"))
    .join("");
}

function randomArrayItem(values) {
  return values[Math.floor(Math.random() * values.length)];
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

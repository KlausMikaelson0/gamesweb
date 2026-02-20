/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROUND_DURATION_SECONDS = 60;
const STOP_COUNTDOWN_SECONDS = 5;
const STOP_VOTING_SECONDS = 20;
const MAX_CHAT_MESSAGES = 80;
const MAX_DRAWING_SEGMENTS = 5000;
const STOP_FIELDS = ["name", "animal", "object", "country", "food"];
const STOP_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
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

      socket.on("stop:start-round", () => {
        const room = getRoomForSocket(socket);
        if (!room || room.game !== "stop-human-animal-object") {
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
        if (!room || room.game !== "stop-human-animal-object") {
          return;
        }
        const updated = updateStopAnswers(room, socket.id, payload?.answers);
        if (updated) {
          emitRoomState(room, io);
        }
      });

      socket.on("stop:trigger-stop", () => {
        const room = getRoomForSocket(socket);
        if (!room || room.game !== "stop-human-animal-object") {
          return;
        }
        if (room.stop.phase !== "input") {
          socket.emit("room:error", { message: "STOP can only be triggered during input phase." });
          return;
        }
        if (room.stop.stopByPlayerId) {
          return;
        }

        const player = room.players.get(socket.id);
        const submission = room.stop.submissions.get(socket.id);
        if (!player || !submission || !isStopSubmissionComplete(submission)) {
          socket.emit("room:error", {
            message: "Fill all fields before pressing STOP.",
          });
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
        if (!room || room.game !== "stop-human-animal-object") {
          return;
        }
        if (room.stop.phase !== "voting") {
          return;
        }

        const didVote = castStopVote(room, socket.id, payload);
        if (didVote) {
          emitRoomState(room, io);
        }
      });

      socket.on("stop:finalize-voting", () => {
        const room = getRoomForSocket(socket);
        if (!room || room.game !== "stop-human-animal-object") {
          return;
        }
        if (room.hostId !== socket.id) {
          socket.emit("room:error", { message: "Only host can finalize voting." });
          return;
        }
        finalizeStopRound(room, io);
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
  };
}

function mapGameToCurrentGame(game) {
  if (game === "sketch-and-guess") {
    return "SKETCH";
  }
  if (game === "stop-human-animal-object") {
    return "STOP";
  }
  if (game === "the-spy") {
    return "SPY";
  }
  return "FIVE_SECOND_RULE";
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

  if (room.game === "stop-human-animal-object") {
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

    if (room.sketch.drawerId === socket.id && room.sketch.phase === "drawing") {
      endSketchRound(room, io, "drawer-left");
    }

    if (room.game === "stop-human-animal-object") {
      removeStopPlayerArtifacts(room, socket.id);
      if (room.stop.phase === "countdown" && room.players.size <= 1) {
        transitionStopToVoting(room, io);
        finalizeStopRound(room, io);
      } else if (room.stop.phase === "voting" && room.players.size <= 1) {
        finalizeStopRound(room, io);
      }
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
    clearStopTimer(room);
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

  room.current_game = "SKETCH";
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
  room.current_game = "SKETCH";
  appendMessage(room, {
    from: "System",
    text: `Round ended (${reason}). Word was "${room.sketch.currentWord}".`,
    type: "system",
  });
  io.to(room.code).emit("sketch:round-ended", { reason, winnerId });
  emitRoomState(room, io);
}

function startStopRound(room, io) {
  clearStopTimer(room);
  room.current_game = "STOP";
  room.status = "in-game";
  room.stop.phase = "input";
  room.stop.round += 1;
  room.stop.letter = STOP_LETTERS[Math.floor(Math.random() * STOP_LETTERS.length)];
  room.stop.timeLeft = 0;
  room.stop.stopByPlayerId = null;
  room.stop.votes.clear();

  for (const submissionPlayerId of room.stop.submissions.keys()) {
    if (!room.players.has(submissionPlayerId)) {
      room.stop.submissions.delete(submissionPlayerId);
    }
  }

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
  room.status = "in-game";
  room.stop.phase = "voting";
  room.stop.timeLeft = STOP_VOTING_SECONDS;

  for (const player of room.players.values()) {
    ensureStopSubmission(room, player.id, player.name);
  }

  for (const submission of room.stop.submissions.values()) {
    submission.locked = true;
    submission.autoValid = computeStopAutoValidation(submission.answers, room.stop.letter);
    submission.communityValid = createStopValidation(false);
    submission.pointsByField = createStopPoints(0);
    submission.totalRoundPoints = 0;
  }

  appendMessage(room, {
    from: "System",
    text: "Voting phase started. Verify answers now.",
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

  for (const submissionPlayerId of room.stop.submissions.keys()) {
    if (!room.players.has(submissionPlayerId)) {
      room.stop.submissions.delete(submissionPlayerId);
    }
  }

  for (const player of room.players.values()) {
    ensureStopSubmission(room, player.id, player.name);
  }

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
      if (!normalized) {
        submission.pointsByField[field] = 0;
        continue;
      }
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
  room.current_game = "STOP";

  if (winner && winner.totalRoundPoints > 0) {
    appendMessage(room, {
      from: "System",
      text: `${winner.playerName} won the STOP round with ${winner.totalRoundPoints} points.`,
      type: "system",
    });
  } else {
    appendMessage(room, {
      from: "System",
      text: "STOP round finalized. No valid scoring answers this round.",
      type: "system",
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
  if (!targetSubmission) {
    return false;
  }
  if (!targetSubmission.autoValid[field]) {
    return false;
  }

  const voteKey = getStopVoteKey(targetPlayerId, field);
  const voteMap = room.stop.votes.get(voteKey) ?? new Map();
  voteMap.set(voterId, isValid);
  room.stop.votes.set(voteKey, voteMap);
  return true;
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
        currentWord:
          room.sketch.drawerId === player.id ? room.sketch.currentWord : undefined,
        drawingSegments: room.sketch.drawingSegments,
        guessedPlayerIds: Array.from(room.sketch.guessedPlayerIds),
      },
      stop: buildStopPublicState(room, player.id),
    };

    io.to(player.id).emit("room:state", { room: publicRoom, me });
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
    .sort((left, right) => {
      const leftPlayer = room.players.get(left.playerId);
      const rightPlayer = room.players.get(right.playerId);
      const scoreDifference = (rightPlayer?.score ?? 0) - (leftPlayer?.score ?? 0);
      if (scoreDifference !== 0) {
        return scoreDifference;
      }
      return left.playerName.localeCompare(right.playerName);
    });

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

function getStopVoteKey(targetPlayerId, field) {
  return `${targetPlayerId}:${field}`;
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

  if (Object.keys(patch).length === 0) {
    return null;
  }
  return patch;
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

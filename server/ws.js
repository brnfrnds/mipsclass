const { v4: uuidv4 } = require('uuid');

// ws -> { room, seatIndex, playerId }
const wsRooms = new Map();

function send(ws, message) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

function broadcast(room, message, excludeWs) {
  for (const [ws, info] of wsRooms) {
    if (info.room !== room) continue;
    if (ws === excludeWs) continue;
    send(ws, message);
  }
}

function handleMessage(ws, rooms, parsed) {
  const type = parsed.type;

  if (type === 'joinRoom') {
    const room = rooms.get(parsed.roomId);
    if (!room) {
      send(ws, { type: 'error', error: 'unknownRoom' });
      return;
    }
    const player = {
      id: uuidv4(),
      name: parsed.name,
      profilePictureUrl: parsed.profilePictureUrl,
    };
    const res = room.join(parsed.seatIndex, player);
    if (res.error) {
      send(ws, { type: 'error', error: res.error });
      return;
    }
    const isOperator = Boolean(
      parsed.operatorToken && room.operatorToken && parsed.operatorToken === room.operatorToken
    );
    if (isOperator) room.operatorId = res.player.id;
    wsRooms.set(ws, { room, seatIndex: res.player.seatIndex, playerId: res.player.id });
    // state must survive JSON: players come as an array (a Map would stringify to {})
    send(ws, {
      type: 'joined',
      player: res.player,
      operator: isOperator,
      state: { ...room.getState(), players: Array.from(room.players.values()) },
    });
    broadcast(room, { type: 'playerJoined', player: res.player }, ws);
    if (isOperator) sendOperatorQueue(room);
    return;
  }

  const info = wsRooms.get(ws);
  if (!info) {
    send(ws, { type: 'error', error: 'notJoined' });
    return;
  }
  const room = info.room;

  switch (type) {
    case 'typing': {
      const typing = !!parsed.typing;
      const player = room.players.get(info.playerId);
      if (player) player.status = typing ? 'typing' : 'active';
      broadcast(room, { type: 'playerTyping', seatIndex: info.seatIndex, typing }, ws);
      break;
    }

    case 'gadgetUpdate': {
      const gadget = parsed.gadget || {};
      for (const [key, value] of Object.entries(gadget)) {
        room.setGadget(key, value);
      }
      broadcast(room, { type: 'gadgetState', gadgetState: room.gadgetState });
      break;
    }

    case 'taskComplete': {
      broadcast(room, { type: 'taskComplete', seatIndex: info.seatIndex, task: parsed.task });
      break;
    }

    case 'blowUp': {
      const player = room.players.get(info.playerId);
      if (player) player.status = 'blownUp';
      broadcast(room, { type: 'playerBlownUp', seatIndex: info.seatIndex });
      break;
    }

    case 'submitJob': {
      const lineCount = Math.max(0, parseInt(parsed.lineCount, 10) || 0);
      const res = room.queue.submit(info.playerId, lineCount);
      if (res.error) {
        send(ws, { type: 'error', error: res.error });
        return;
      }
      send(ws, { type: 'jobQueued', jobId: res.job.id, position: res.position, etaMs: res.job.endAt - Date.now() });
      sendPositions(room);
      sendOperatorQueue(room);
      break;
    }

    case 'killJob':
    case 'bumpJob': {
      if (!room.operatorId || room.operatorId !== info.playerId) {
        send(ws, { type: 'error', error: 'notOperator' });
        return;
      }
      const jobId = parseInt(parsed.jobId, 10);
      const job = type === 'killJob' ? room.queue.kill(jobId) : room.queue.bump(jobId);
      if (!job) return;
      if (type === 'killJob') {
        const owner = wsFor(room, job.playerId);
        if (owner) send(owner, { type: 'jobKilled', jobId: job.id });
      }
      sendPositions(room);
      sendOperatorQueue(room);
      break;
    }

    case 'cableMessage': {
      const targetSeat = room.getCablePeer(info.seatIndex);
      if (targetSeat === null) {
        send(ws, { type: 'error', error: 'notCabled' });
        return;
      }
      for (const [targetWs, tinfo] of wsRooms) {
        if (tinfo.room !== room) continue;
        if (tinfo.seatIndex !== targetSeat) continue;
        send(targetWs, { type: 'cableMessage', from: info.seatIndex, payload: parsed.payload });
        break;
      }
      break;
    }
  }
}

function drop(ws) {
  const info = wsRooms.get(ws);
  wsRooms.delete(ws);
  if (!info) return;
  const room = info.room;
  room.leave(info.playerId);
  if (room.operatorId === info.playerId) room.operatorId = null;
  const killed = room.queue.drop(info.playerId); // their job dies with them
  if (killed) {
    sendOperatorQueue(room);
    sendPositions(room);
  }
  broadcast(room, { type: 'playerLeft', seatIndex: info.seatIndex });
}

function wsFor(room, playerId) {
  for (const [ws, info] of wsRooms) {
    if (info.room === room && info.playerId === playerId) return ws;
  }
  return null;
}

/** Private queue-position update to each job's owner. */
function sendPositions(room) {
  for (const job of room.queue.jobs) {
    const owner = wsFor(room, job.playerId);
    if (owner) {
      send(owner, { type: 'jobPosition', jobId: job.id, position: room.queue.position(job.id), etaMs: job.endAt - Date.now() });
    }
  }
}

/** The operator sees the whole queue. */
function sendOperatorQueue(room) {
  if (!room.operatorId) return;
  const ws = wsFor(room, room.operatorId);
  if (ws) send(ws, { type: 'operatorQueue', jobs: room.queue.snapshot() });
}

/** The mainframe clock: advance every room's queue. */
function tickQueues(rooms) {
  const now = Date.now();
  for (const room of rooms.values()) {
    const { started, done } = room.queue.tick(now);
    if (!started.length && !done.length) continue;
    for (const job of started) {
      const owner = wsFor(room, job.playerId);
      if (owner) send(owner, { type: 'jobRunning', jobId: job.id });
    }
    for (const job of done) {
      const owner = wsFor(room, job.playerId);
      if (owner) send(owner, { type: 'jobDone', jobId: job.id });
    }
    sendPositions(room);
    sendOperatorQueue(room);
  }
}

module.exports = { handleMessage, broadcast, send, drop, tickQueues };

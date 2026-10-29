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
    wsRooms.set(ws, { room, seatIndex: res.player.seatIndex, playerId: res.player.id });
    // state must survive JSON: players come as an array (a Map would stringify to {})
    send(ws, {
      type: 'joined',
      player: res.player,
      state: { ...room.getState(), players: Array.from(room.players.values()) },
    });
    broadcast(room, { type: 'playerJoined', player: res.player }, ws);
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
  broadcast(room, { type: 'playerLeft', seatIndex: info.seatIndex });
}

module.exports = { handleMessage, broadcast, send, drop };

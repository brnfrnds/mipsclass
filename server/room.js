const { JobQueue } = require('./queue');

class Room {
  constructor(seatCount, opts = {}) {
    this.seatCount = seatCount;
    // seats[seatIndex] = playerId or null
    this.seats = new Array(seatCount).fill(null);
    this.players = new Map(); // playerId -> player
    this.gadgetState = {
      printer: { text: '', online: true },
      board: { text: '', online: true },
      controller: {},
    };
    this.cablePairs = []; // [{ seatA, seatB, sharedMemory: { base, size } }]
    this.queue = new JobQueue(); // the simulated mainframe queue
    this.operatorName = opts.operatorName || null; // the person who opened the room
    this.operatorToken = opts.operatorToken || null; // secret that proves it
    this.operatorId = null; // set when that person joins
  }

  join(seatIndex, player) {
    if (Number.isInteger(seatIndex) === false || seatIndex < 0 || seatIndex >= this.seatCount) {
      return { error: 'outOfRange' };
    }
    if (this.seats[seatIndex] !== null) {
      return { error: 'seatTaken' };
    }
    const seated = {
      id: player.id,
      seatIndex,
      name: player.name,
      profilePictureUrl: player.profilePictureUrl,
      status: 'active',
    };
    this.seats[seatIndex] = player.id;
    this.players.set(player.id, seated);
    return { ok: true, player: seated };
  }

  leave(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;
    this.seats[player.seatIndex] = null;
    this.players.delete(playerId);
  }

  setGadget(key, value) {
    if (!this.gadgetState[key]) {
      this.gadgetState[key] = value;
    } else {
      this.gadgetState[key] = { ...this.gadgetState[key], ...value };
    }
  }

  addCablePair(seatA, seatB, sharedMemory) {
    if (seatA < 0 || seatA >= this.seatCount) return;
    if (seatB < 0 || seatB >= this.seatCount) return;
    if (seatA === seatB) return;
    this.cablePairs.push({ seatA, seatB, sharedMemory: sharedMemory || { base: 0, size: 0 } });
  }

  getCablePeer(seatIndex) {
    const pair = this.cablePairs.find((cp) => cp.seatA === seatIndex || cp.seatB === seatIndex);
    if (!pair) return null;
    return pair.seatA === seatIndex ? pair.seatB : pair.seatA;
  }

  getState() {
    return {
      seats: this.seats.slice(),
      players: new Map(this.players),
      gadgetState: this.gadgetState,
      cablePairs: this.cablePairs,
    };
  }

  summary(roomId) {
    return {
      roomId,
      seatCount: this.seatCount,
      occupied: this.players.size,
      operator: this.operatorName,
    };
  }
}

module.exports = { Room };

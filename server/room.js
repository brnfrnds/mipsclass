class Room {
  constructor(seatCount) {
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

  getState() {
    return {
      seats: this.seats.slice(),
      players: new Map(this.players),
      gadgetState: this.gadgetState,
      cablePairs: this.cablePairs,
    };
  }
}

module.exports = { Room };

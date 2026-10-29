// The simulated mainframe queue: per-room FIFO. Jobs wait; the one at the
// front runs for its run time (1000 + 200ms × lines), then clears the deck.
// The queue only tracks and times jobs — execution is client-side; the
// server's messages tell each owner when their slot starts and ends.
class JobQueue {
  constructor() {
    this.jobs = []; // { id, playerId, lineCount, runMs, startAt, endAt, state: 'queued'|'running' }
    this.nextId = 1;
  }

  runMs(lineCount) {
    return 1000 + 200 * Math.max(0, lineCount);
  }

  submit(playerId, lineCount, now = Date.now()) {
    if (this.jobs.some((j) => j.playerId === playerId)) {
      return { error: 'one job per player' };
    }
    const last = this.jobs[this.jobs.length - 1];
    const startAt = last ? Math.max(last.endAt, now) : now;
    const runMs = this.runMs(lineCount);
    const job = {
      id: this.nextId++,
      playerId,
      lineCount,
      runMs,
      startAt,
      endAt: startAt + runMs,
      state: 'queued',
    };
    this.jobs.push(job);
    return { job, position: this.jobs.length };
  }

  position(jobId) {
    const idx = this.jobs.findIndex((j) => j.id === jobId);
    return idx === -1 ? null : idx + 1;
  }

  /** Advance the clock: start jobs whose slot arrived, complete finished ones. */
  tick(now = Date.now()) {
    const started = [];
    const done = [];
    for (const j of this.jobs) {
      if (j.state === 'queued' && now >= j.startAt) { j.state = 'running'; started.push(j); }
    }
    for (const j of this.jobs) {
      if (j.state === 'running' && now >= j.endAt) { j.state = 'done'; done.push(j); }
    }
    if (done.length) {
      this.jobs = this.jobs.filter((j) => j.state !== 'done');
      this._retimes(now);
    }
    return { started, done };
  }

  kill(jobId, now = Date.now()) {
    const idx = this.jobs.findIndex((j) => j.id === jobId);
    if (idx === -1) return null;
    const [job] = this.jobs.splice(idx, 1);
    this._retimes(now);
    return job;
  }

  bump(jobId, now = Date.now()) {
    const idx = this.jobs.findIndex((j) => j.id === jobId);
    if (idx <= 0) return null; // absent or already front
    const [job] = this.jobs.splice(idx, 1);
    this.jobs.unshift(job);
    this._retimes(now);
    return job;
  }

  drop(playerId, now = Date.now()) {
    const job = this.jobs.find((j) => j.playerId === playerId);
    if (!job) return null;
    return this.kill(job.id, now);
  }

  snapshot() {
    return this.jobs.map((j, i) => ({
      id: j.id,
      playerId: j.playerId,
      lineCount: j.lineCount,
      position: i + 1,
      state: j.state,
    }));
  }

  /** Recompute start/end for queued jobs after the queue changed. */
  _retimes(now = Date.now()) {
    const running = this.jobs.find((j) => j.state === 'running');
    let t = running ? running.endAt : now;
    for (const j of this.jobs) {
      if (j.state !== 'queued') continue;
      j.startAt = t;
      j.endAt = t + j.runMs;
      t = j.endAt;
    }
  }
}

module.exports = { JobQueue };

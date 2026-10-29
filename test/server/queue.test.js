const { test } = require('node:test');
const assert = require('node:assert');

test('submit assigns position, computes ETA from line count', async () => {
  const { JobQueue } = require('../../server/queue.js');
  const q = new JobQueue();
  const now = 1000;
  const r1 = q.submit('p1', 10, now); // 1000 + 200*10 = 3000ms
  assert.ok(r1.job);
  assert.equal(r1.position, 1);
  assert.equal(r1.job.runMs, 3000);
  assert.equal(r1.job.endAt, now + 3000);
});

test('a second job queues behind the first and its ETA accounts for the wait', async () => {
  const { JobQueue } = require('../../server/queue.js');
  const q = new JobQueue();
  const r1 = q.submit('p1', 10, 1000);   // ends at 4000
  const r2 = q.submit('p2', 5, 1100);    // 1000+1000=2000ms, starts at 4000
  assert.equal(r2.position, 2);
  assert.equal(r2.job.startAt, 4000);
  assert.equal(r2.job.endAt, 6000);
});

test('tick moves queued to running at startAt, running to done at endAt', async () => {
  const { JobQueue } = require('../../server/queue.js');
  const q = new JobQueue();
  q.submit('p1', 5, 1000); // ends 3000
  const mid = q.tick(2000);
  assert.equal(mid.started.length, 1);
  assert.equal(mid.done.length, 0);
  const end = q.tick(3000);
  assert.equal(end.started.length, 0);
  assert.equal(end.done.length, 1);
  assert.equal(q.jobs.length, 0, 'done jobs leave the queue');
});

test('one outstanding job per player; resubmit is refused', async () => {
  const { JobQueue } = require('../../server/queue.js');
  const q = new JobQueue();
  q.submit('p1', 5, 1000);
  const again = q.submit('p1', 5, 1100);
  assert.equal(again.error, 'one job per player');
});

test('kill removes a job and retimes the rest; drop removes by player', async () => {
  const { JobQueue } = require('../../server/queue.js');
  const q = new JobQueue();
  q.submit('p1', 5, 1000);  // ends 3000
  q.submit('p2', 5, 1100);  // 3000..5000
  const killed = q.kill(1, 1200);
  assert.ok(killed);
  assert.equal(q.jobs.length, 1);
  assert.equal(q.jobs[0].startAt, 1200, 'p2 retimes to now');
  const gone = q.drop('p2', 1250);
  assert.ok(gone);
  assert.equal(q.jobs.length, 0);
});

test('bump moves a job to the front and retimes', async () => {
  const { JobQueue } = require('../../server/queue.js');
  const q = new JobQueue();
  q.submit('p1', 5, 1000); // 1000..3000
  q.submit('p2', 5, 1100); // 3000..5000
  q.submit('p3', 5, 1200); // 5000..7000
  const bumped = q.bump(3);
  assert.ok(bumped);
  assert.equal(q.position(3), 1);
  assert.equal(q.position(1), 2);
});

test('snapshot lists jobs with positions for the operator', async () => {
  const { JobQueue } = require('../../server/queue.js');
  const q = new JobQueue();
  q.submit('p1', 5, 1000);
  q.submit('p2', 5, 1100);
  const snap = q.snapshot();
  assert.equal(snap.length, 2);
  assert.equal(snap[0].playerId, 'p1');
  assert.equal(snap[1].position, 2);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { RateLimitError, SlidingWindowLimiter } from './limiter.js';

const HOUR = 3_600_000;
const DAY = 86_400_000;

test('duas janelas: permite cinco relatos e bloqueia o sexto na hora', () => {
  let now = 0;
  const limiter = new SlidingWindowLimiter(() => now);
  const rules = [{ scope: 'hour', max: 5, windowMs: HOUR }, { scope: 'day', max: 20, windowMs: DAY }];
  for (let i = 0; i < 5; i++) limiter.consume('ip1', rules);
  assert.throws(() => limiter.consume('ip1', rules), (err: unknown) => err instanceof RateLimitError && err.retryAfterSeconds === 3600);
  limiter.consume('ip2', rules);
  now = HOUR + 1;
  limiter.consume('ip1', rules);
});

test('limite diário permanece após expirar as janelas por hora', () => {
  let now = 0;
  const limiter = new SlidingWindowLimiter(() => now);
  const rules = [{ scope: 'hour', max: 5, windowMs: HOUR }, { scope: 'day', max: 20, windowMs: DAY }];
  for (let h = 0; h < 4; h++) {
    now = h * (HOUR + 1);
    for (let i = 0; i < 5; i++) limiter.consume('ip1', rules);
  }
  now = 4 * (HOUR + 1);
  assert.throws(() => limiter.consume('ip1', rules), RateLimitError);
  now = DAY + 1;
  limiter.consume('ip1', rules);
});

test('refund de tentativa inválida devolve o slot apenas uma vez', () => {
  const limiter = new SlidingWindowLimiter(() => 100);
  const rules = [{ scope: 'hour', max: 1, windowMs: HOUR }];
  const booking = limiter.consume('ip1', rules);
  assert.throws(() => limiter.consume('ip1', rules), RateLimitError);
  booking.release();
  booking.release();
  limiter.consume('ip1', rules);
  assert.throws(() => limiter.consume('ip1', rules), RateLimitError);
});

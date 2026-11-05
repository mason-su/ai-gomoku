"use strict";

/**
 * Mulberry32 — small seeded PRNG returning values in [0, 1).
 * https://github.com/bryc/code/blob/master/jshash/PRNGs.md
 */
function mulberry32(seed) {
  let t = seed >>> 0;
  return function random() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed) {
  if (seed === null || seed === undefined || seed === "") {
    return Math.random.bind(Math);
  }
  const n = Number(seed);
  if (!Number.isFinite(n)) {
    throw new Error("Seed must be a finite number, got: " + seed);
  }
  return mulberry32(n >>> 0);
}

module.exports = {
  mulberry32: mulberry32,
  createRng: createRng,
};

import { describe, expect, it } from 'vitest';
import { createSkillSourceScanLimiter } from '../services/skill-source-scan-limit.js';

describe('skill source scan limits', () => {
  it('keeps one caller from taking both download slots and releases once', () => {
    const limit = createSkillSourceScanLimiter();
    const alice = limit('alice');
    expect(() => limit('alice')).toThrow('already running');
    const bob = limit('bob');
    expect(() => limit('charlie')).toThrow('already running');
    alice.release(); alice.release();
    const next = limit('alice');
    expect(() => limit('alice')).toThrow('already running');
    next.release(); bob.release();
  });

  it('bounds repeated cache hits, restores quotas after a minute, and keeps active leases', () => {
    let now = 0;
    const limit = createSkillSourceScanLimiter(() => now);
    for (let i = 0; i < 30; i++) limit('alice').release();
    expect(() => limit('alice')).toThrow('scan limit');
    now = 60_000;
    const active = limit('alice');
    now += 60_000;
    expect(() => limit('alice')).toThrow('already running');
    active.release();
    limit('alice').release();
  });

  it('bounds instance requests across different callers without charging denied requests', () => {
    let now = 0;
    const limit = createSkillSourceScanLimiter(() => now);
    for (let i = 0; i < 60; i++) limit(`user-${i}`).release();
    expect(() => limit('new-user')).toThrow('scan limit');
    now = 60_000;
    limit('new-user').release();
  });

  it('limits repeated downloads separately from cached scans and counts failed attempts', () => {
    let now = 0;
    const limit = createSkillSourceScanLimiter(() => now);
    for (let i = 0; i < 6; i++) {
      const lease = limit('alice');
      lease.beforeDownload(); lease.release();
    }
    const cached = limit('alice');
    expect(() => cached.beforeDownload()).toThrow('download limit');
    cached.release();
    for (let i = 0; i < 6; i++) {
      const lease = limit(`user-${i}`);
      lease.beforeDownload(); lease.release();
    }
    const instanceLimited = limit('new-user');
    expect(() => instanceLimited.beforeDownload()).toThrow('download limit');
    instanceLimited.release();
    now = 60_000;
    const retry = limit('alice');
    retry.beforeDownload(); retry.release();
  });
});

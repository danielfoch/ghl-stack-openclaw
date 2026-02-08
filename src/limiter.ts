export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// Simple concurrency limiter.
export class Semaphore {
  private available: number;
  private queue: Array<() => void> = [];

  constructor(max: number) {
    this.available = Math.max(1, Math.floor(max));
  }

  async acquire(): Promise<() => void> {
    if (this.available > 0) {
      this.available -= 1;
      return () => this.release();
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.available -= 1;
    return () => this.release();
  }

  private release() {
    this.available += 1;
    const next = this.queue.shift();
    if (next) next();
  }
}

// Token bucket for basic RPS throttling.
export class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;

  constructor(
    private rps: number,
    private burst: number
  ) {
    this.rps = Math.max(1, rps);
    this.burst = Math.max(1, burst);
    this.tokens = this.burst;
    this.lastRefillMs = Date.now();
  }

  async take(): Promise<void> {
    while (true) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      // Wait ~1 token interval.
      await sleep(Math.ceil(1000 / this.rps));
    }
  }

  private refill() {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillMs;
    if (elapsedMs <= 0) return;
    const refill = (elapsedMs / 1000) * this.rps;
    if (refill <= 0) return;
    this.tokens = Math.min(this.burst, this.tokens + refill);
    this.lastRefillMs = now;
  }
}


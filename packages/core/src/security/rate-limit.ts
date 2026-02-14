export class SlidingWindowRateLimiter {
  private readonly windows = new Map<string, number[]>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  allow(key: string, now = Date.now()): boolean {
    const start = now - this.windowMs;
    const current = (this.windows.get(key) ?? []).filter((t) => t >= start);
    if (current.length >= this.limit) {
      this.windows.set(key, current);
      return false;
    }
    current.push(now);
    this.windows.set(key, current);
    return true;
  }
}

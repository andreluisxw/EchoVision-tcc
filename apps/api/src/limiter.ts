export interface LimitRule {
  scope: string;
  max: number;
  windowMs: number;
}

export interface Reservation {
  release: () => void;
}

export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('RATE_LIMIT_EXCEEDED');
  }
}

/**
 * Um processo, memória local. Consume atomicamente (sem await) janelas simultâneas.
 * Sem persistência no restart: uso inicial em instância única; para escalar, Redis/DB.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly clock: () => number;

  constructor(clock: () => number = Date.now) { this.clock = clock; }

  consume(subject: string, rules: readonly LimitRule[]): Reservation {
    const now = this.clock();
    const active = rules.map(rule => {
      const key = `${rule.scope}:${subject}`;
      const prev = this.hits.get(key) || [];
      const recent = prev.filter(at => at > now - rule.windowMs);
      this.hits.set(key, recent);
      return { key, rule, recent };
    });
    let waitMs = 0;
    for (const { rule, recent } of active) {
      if (recent.length >= rule.max) {
        waitMs = Math.max(waitMs, recent[0]! + rule.windowMs - now);
      }
    }
    if (waitMs > 0) throw new RateLimitError(Math.max(1, Math.ceil(waitMs / 1000)));
    for (const { recent } of active) recent.push(now);
    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        for (const { key } of active) {
          const entries = this.hits.get(key);
          if (entries) {
            const pos = entries.indexOf(now);
            if (pos >= 0) entries.splice(pos, 1);
            if (entries.length === 0) this.hits.delete(key);
          }
        }
      },
    };
  }

  cleanup(): void {
    const now = this.clock();
    // Os escopos do app utilizam, no máximo, uma janela de 24h.
    for (const [key, values] of this.hits.entries()) {
      const filtered = values.filter(at => at > now - 86_400_000);
      if (filtered.length) this.hits.set(key, filtered);
      else this.hits.delete(key);
    }
  }
}

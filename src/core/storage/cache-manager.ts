import type { CompletionSuggestion } from '../../types/completion.d';

interface CacheEntry {
  value: CompletionSuggestion[];
  timestamp: number;
  accessCount: number;
}

export class CompletionCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_SIZE = 1000;

  set(key: string, value: CompletionSuggestion[]): void {
    if (this.cache.size >= this.MAX_SIZE) {
      this.evictLRU();
    }
    this.cache.set(key, {
      value: value.map((suggestion) => ({ ...suggestion })),
      timestamp: Date.now(),
      accessCount: 1,
    });
  }

  get(key: string): CompletionSuggestion[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    entry.accessCount++;
    return entry.value.map((suggestion) => ({ ...suggestion }));
  }

  private evictLRU(): void {
    let minCount = Infinity;
    let minKey: string | null = null;
    for (const [k, v] of this.cache.entries()) {
      if (v.accessCount < minCount) {
        minCount = v.accessCount;
        minKey = k;
      }
    }
    if (minKey) this.cache.delete(minKey);
  }
}

export class RateLimitedExecutor {
  private readonly queue: Array<() => Promise<void>> = [];
  private executing = 0;
  private readonly maxConcurrent = 1;
  private readonly minDelay = 40;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.executing--;
          setTimeout(() => this.processQueue(), this.minDelay);
        }
      });
      this.processQueue();
    });
  }

  private processQueue(): void {
    while (this.executing < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) return;
      this.executing++;
      void task();
    }
  }
}

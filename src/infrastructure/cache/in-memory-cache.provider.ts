import { Injectable } from '@nestjs/common';
import { ICacheService } from './cache.interface';

interface CacheEntry {
  value: any;
  expiresAt: number | null;
}

@Injectable()
export class InMemoryCacheProvider implements ICacheService {
  private store = new Map<string, CacheEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}
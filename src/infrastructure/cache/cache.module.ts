import { Module, Global } from '@nestjs/common';
import { InMemoryCacheProvider } from './in-memory-cache.provider';
import { CACHE_SERVICE } from './cache.interface';

@Global()
@Module({
  providers: [{ provide: CACHE_SERVICE, useClass: InMemoryCacheProvider }],
  exports: [CACHE_SERVICE],
})
export class CacheModule {}
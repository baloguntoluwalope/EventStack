import { Module, Global } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get('nodeEnv') === 'production' ? 'info' : 'debug',
          transport:
            config.get('nodeEnv') !== 'production'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
        },
      }),
    }),
  ],
  exports: [LoggerModule],
})
export class LoggingModule {}
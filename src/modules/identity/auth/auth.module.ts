import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Global() // Makes JwtModule and AuthService globally available across all modules
@Module({
  imports: [UsersModule, EmailModule, JwtModule.register({})],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule], // Export so JwtService can be injected by guards everywhere
})
export class AuthModule {}
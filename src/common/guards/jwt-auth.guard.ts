import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService, private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.split(' ')[1];
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.config.get('jwt.accessSecret'),
      });
      request.user = { userId: payload.sub, platformAdmin: payload.platformAdmin ?? false };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
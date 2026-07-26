import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import type { IUserRepository } from '../users/interface/users-repository.interface';
import { USER_REPOSITORY } from '../users/interface/users-repository.interface';

import type { IEmailProvider } from '../../../common/providers/email-provider.interface';
import { EMAIL_PROVIDER } from '../../../common/providers/email-provider.interface';

import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USER_REPOSITORY) private userRepo: IUserRepository,
    @Inject(EMAIL_PROVIDER) private emailProvider: IEmailProvider,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepo.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      emailVerified: false,
    });

    const userId = (user as any).id?.toString() || (user as any)._id?.toString();
    const verifyToken = this.signShortLivedToken({ sub: userId, purpose: 'verify' });

    try {
      const link = `${this.config.get('appUrl')}/api/v1/auth/verify-email?token=${verifyToken}`;
      await this.emailProvider.send(
        user.email,
        'Verify your email',
        `<p>Hi ${user.name || ''},</p><p>Confirm your email:</p><a href="${link}">Verify Email</a>`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to send verification email to ${user.email}: ${err.message}`);
    }

    return {
      id: userId,
      email: user.email,
      message: 'Registration successful. Check your email to verify your account.',
    };
  }

  async verifyEmail(token: string) {
    const payload = this.verifyShortLivedToken(token, 'verify');

    if (!payload.sub) {
      throw new BadRequestException('Invalid token payload: missing subject ID');
    }

    const updatedUser = await this.userRepo.updateById(payload.sub, {
      emailVerified: true,
      emailVerifiedAt: new Date(),
    } as any);

    if (!updatedUser) {
      throw new BadRequestException('User associated with this token no longer exists');
    }

    return { verified: true };
  }

  async login(dto: { email: string; password: string }) {
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const userId = (user as any).id?.toString() || (user as any)._id?.toString();
    return this.issueTokens(userId, (user as any).platformAdmin ?? false);
  }

  async refresh(refreshToken: string) {
    let payload: any;
    const refreshSecret =
      this.config.get('jwt.refreshSecret') || this.config.get('JWT_REFRESH_SECRET');

    try {
      payload = this.jwtService.verify(refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.userRepo.findById(payload.sub);
    return this.issueTokens(payload.sub, (user as any)?.platformAdmin ?? false);
  }

  async forgotPassword(email: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return { sent: true };

    const userId = (user as any).id?.toString() || (user as any)._id?.toString();
    const resetToken = this.signShortLivedToken({ sub: userId, purpose: 'reset' });

    try {
      const link = `${this.config.get('appUrl')}/reset-password?token=${resetToken}`;
      await this.emailProvider.send(
        user.email,
        'Reset your password',
        `<p>Reset your password:</p><a href="${link}">Reset Password</a>`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to send password reset email to ${user.email}: ${err.message}`);
    }

    return { sent: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const payload = this.verifyShortLivedToken(token, 'reset');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.updateById(payload.sub, { passwordHash } as any);
    return { reset: true };
  }

  private getAccessSecret(): string {
    const secret = this.config.get('jwt.accessSecret') || this.config.get('JWT_ACCESS_SECRET');
    if (!secret) {
      this.logger.error('JWT Access Secret is missing from ConfigService!');
    }
    return secret || 'default-secret-fallback';
  }

  private issueTokens(userId: string, platformAdmin = false) {
    const accessSecret = this.getAccessSecret();
    const refreshSecret =
      this.config.get('jwt.refreshSecret') || this.config.get('JWT_REFRESH_SECRET');

    const accessToken = this.jwtService.sign(
      { sub: userId, platformAdmin },
      {
        secret: accessSecret,
        expiresIn: this.config.get('jwt.accessExpiry') || '15m',
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, type: 'refresh' },
      {
        secret: refreshSecret,
        expiresIn: this.config.get('jwt.refreshExpiry') || '7d',
      },
    );

    return { accessToken, refreshToken };
  }

  private signShortLivedToken(payload: object) {
    return this.jwtService.sign(payload, {
      secret: this.getAccessSecret(),
      expiresIn: '60m',
    });
  }

  private verifyShortLivedToken(token: string, expectedPurpose: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(token, { secret: this.getAccessSecret() });
    } catch (err: any) {
      this.logger.warn(`JWT verification failed: ${err.message}`);
      throw new BadRequestException('Invalid or expired token');
    }

    if (payload.purpose !== expectedPurpose) {
      throw new BadRequestException('Invalid token purpose');
    }

    return payload;
  }
}
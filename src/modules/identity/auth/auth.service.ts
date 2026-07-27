import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

import type { IEmailProvider } from '../../../common/providers/email-provider.interface';
import { EMAIL_PROVIDER } from '../../../common/providers/email-provider.interface';

import { RegisterDto } from './dto/register.dto';
import { renderVerificationEmail } from '../email/templates/verification-email.template';
import { renderPasswordResetEmail } from '../email/templates/password-reset-email.template';

interface TokenPayload {
  sub: string;
  purpose?: string;
  type?: string;
  platformAdmin?: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      emailVerified: false,
    });

    const userId = user._id ? user._id.toString() : (user as any).id;
    const verifyToken = this.signShortLivedToken({ sub: userId, purpose: 'verify' });

    try {
      const appUrl = this.config.get<string>('appUrl') ?? 'http://localhost:3000';
      const verifyUrl = `${appUrl}/verify-email?token=${verifyToken}`;
      await this.emailProvider.send(
        user.email,
        'Verify your email',
        renderVerificationEmail(user.name, verifyUrl, appUrl),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send verification email to ${user.email}: ${message}`);
    }

    return {
      id: userId,
      email: user.email,
      message: 'Registration successful. Check your email to verify your account.',
    };
  }

  async verifyEmail(token: string) {
    const payload = this.verifyShortLivedToken(token, 'verify');
    await this.usersService.updateById(payload.sub, {
      emailVerified: true,
      emailVerifiedAt: new Date(),
    } as any);
    return { verified: true };
  }

  async login(dto: { email: string; password: string }) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const userId = user._id ? user._id.toString() : (user as any).id;
    return this.issueTokens(userId, user.platformAdmin);
  }

  async refresh(refreshToken: string) {
    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret') ?? 'default_refresh_secret',
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid token type');

    const user = await this.usersService.findById(payload.sub);
    return this.issueTokens(payload.sub, user?.platformAdmin ?? false);
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return { sent: true };

    const userId = user._id ? user._id.toString() : (user as any).id;
    const resetToken = this.signShortLivedToken({ sub: userId, purpose: 'reset' });

    try {
      const appUrl = this.config.get<string>('appUrl') ?? 'http://localhost:3000';
      const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
      await this.emailProvider.send(
        user.email,
        'Reset your password',
        renderPasswordResetEmail(resetUrl, appUrl),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send password reset email to ${user.email}: ${message}`);
    }

    return { sent: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const payload = this.verifyShortLivedToken(token, 'reset');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.updateById(payload.sub, { passwordHash } as any);
    return { reset: true };
  }

  private issueTokens(userId: string, platformAdmin = false) {
    const accessToken = this.jwtService.sign(
      { sub: userId, platformAdmin },
      {
        secret: this.config.get<string>('jwt.accessSecret') ?? 'default_access_secret',
        expiresIn: (this.config.get<string>('jwt.accessExpiry') ?? '15m') as JwtSignOptions['expiresIn'],
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, type: 'refresh' },
      {
        secret: this.config.get<string>('jwt.refreshSecret') ?? 'default_refresh_secret',
        expiresIn: (this.config.get<string>('jwt.refreshExpiry') ?? '7d') as JwtSignOptions['expiresIn'],
      },
    );

    return { accessToken, refreshToken };
  }

  private signShortLivedToken(payload: object) {
    return this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.accessSecret') ?? 'default_access_secret',
      expiresIn: '60m',
    });
  }

  private verifyShortLivedToken(token: string, expectedPurpose: string): TokenPayload {
    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(token, {
        secret: this.config.get<string>('jwt.accessSecret') ?? 'default_access_secret',
      });
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }

    if (payload.purpose !== expectedPurpose) throw new BadRequestException('Invalid token');
    return payload;
  }
}
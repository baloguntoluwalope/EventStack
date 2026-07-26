import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new account (sends verification email)' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Confirm email using token from the link in the verification email' })
  @ApiQuery({ name: 'token', required: true })
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email + password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Exchange refresh token for a new access token' })
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Send password reset email' })
  forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using token from reset email' })
  resetPassword(@Body('token') token: string, @Body('password') password: string) {
    return this.authService.resetPassword(token, password);
  }
}
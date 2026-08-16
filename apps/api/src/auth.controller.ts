import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsString() trustedDeviceToken?: string;
}
class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(10) newPassword!: string;
}
class ChallengeDto { @IsString() challengeToken!: string; }
class EmailVerifyDto extends ChallengeDto {
  @IsString() @Length(6, 6) code!: string;
  @IsOptional() @IsBoolean() rememberDevice?: boolean;
}
class TotpVerifyDto extends ChallengeDto {
  @IsString() @Length(6, 8) code!: string;
  @IsOptional() @IsString() setupToken?: string;
  @IsOptional() @IsBoolean() rememberDevice?: boolean;
}
class RecoveryVerifyDto extends ChallengeDto {
  @IsString() @MinLength(8) recoveryCode!: string;
  @IsOptional() @IsBoolean() rememberDevice?: boolean;
}
class CurrentPasswordDto { @IsString() currentPassword!: string; }
class AccountTotpConfirmDto { @IsString() setupToken!: string; @IsString() @Length(6, 8) code!: string; }
class AccountEmailConfirmDto { @IsString() setupToken!: string; @IsString() @Length(6, 6) code!: string; }

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string) {
    return this.auth.login(dto.email, dto.password, dto.trustedDeviceToken, userAgent);
  }

  @Post('mfa/totp/setup')
  totpSetup(@Body() dto: ChallengeDto) {
    return this.auth.createTotpSetupForLogin(dto.challengeToken);
  }

  @Post('mfa/totp/verify')
  totpVerify(@Body() dto: TotpVerifyDto, @Headers('user-agent') userAgent?: string) {
    return this.auth.verifyTotpLogin(dto.challengeToken, dto.code, dto.setupToken, Boolean(dto.rememberDevice), userAgent);
  }

  @Post('mfa/email/send')
  emailSend(@Body() dto: ChallengeDto) {
    return this.auth.sendLoginEmailCode(dto.challengeToken);
  }

  @Post('mfa/email/verify')
  emailVerify(@Body() dto: EmailVerifyDto, @Headers('user-agent') userAgent?: string) {
    return this.auth.verifyEmailLogin(dto.challengeToken, dto.code, Boolean(dto.rememberDevice), userAgent);
  }

  @Post('mfa/recovery/verify')
  recoveryVerify(@Body() dto: RecoveryVerifyDto, @Headers('user-agent') userAgent?: string) {
    return this.auth.verifyRecoveryLogin(dto.challengeToken, dto.recoveryCode, Boolean(dto.rememberDevice), userAgent);
  }

  @Get('mfa/status')
  @UseGuards(JwtGuard)
  mfaStatus(@Req() req: any) {
    return this.auth.mfaStatus(req.user.sub);
  }

  @Post('mfa/account/totp/setup')
  @UseGuards(JwtGuard)
  accountTotpSetup(@Req() req: any, @Body() dto: CurrentPasswordDto) {
    return this.auth.accountTotpSetup(req.user.sub, dto.currentPassword);
  }

  @Post('mfa/account/totp/confirm')
  @UseGuards(JwtGuard)
  accountTotpConfirm(@Req() req: any, @Body() dto: AccountTotpConfirmDto) {
    return this.auth.accountTotpConfirm(req.user.sub, dto.setupToken, dto.code);
  }

  @Post('mfa/account/email/send')
  @UseGuards(JwtGuard)
  accountEmailSend(@Req() req: any, @Body() dto: CurrentPasswordDto) {
    return this.auth.accountEmailSend(req.user.sub, dto.currentPassword);
  }

  @Post('mfa/account/email/confirm')
  @UseGuards(JwtGuard)
  accountEmailConfirm(@Req() req: any, @Body() dto: AccountEmailConfirmDto) {
    return this.auth.accountEmailConfirm(req.user.sub, dto.setupToken, dto.code);
  }

  @Post('mfa/recovery/regenerate')
  @UseGuards(JwtGuard)
  regenerateRecovery(@Req() req: any, @Body() dto: CurrentPasswordDto) {
    return this.auth.regenerateRecoveryCodes(req.user.sub, dto.currentPassword);
  }

  @Post('mfa/trusted-devices/revoke')
  @UseGuards(JwtGuard)
  revokeTrusted(@Req() req: any) {
    return this.auth.revokeTrustedDevices(req.user.sub);
  }

  @Post('change-password')
  @UseGuards(JwtGuard)
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(req.user.sub, dto.currentPassword, dto.newPassword);
  }
}

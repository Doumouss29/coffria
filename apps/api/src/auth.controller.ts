import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';

class LoginDto { @IsEmail() email!: string; @IsString() @MinLength(8) password!: string; }
class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(10) newPassword!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto.email, dto.password); }
  @Post('change-password')
  @UseGuards(JwtGuard)
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(req.user.sub, dto.currentPassword, dto.newPassword);
  }
}

import { BadGatewayException, Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import * as nodemailer from 'nodemailer';

class ContactDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() @MaxLength(180) company?: string;
  @IsString() @MinLength(5) @MaxLength(5000) message!: string;
}

@Controller('contact')
export class ContactController {
  @Post()
  async send(@Body() dto: ContactDto) {
    const host = process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com';
    const port = Number(process.env.BREVO_SMTP_PORT || 587);
    const user = process.env.BREVO_SMTP_LOGIN;
    const pass = process.env.BREVO_SMTP_KEY;
    const to = process.env.CONTACT_TO_EMAIL || 'contact.lmurbs@gmail.com';
    const fromEmail = process.env.CONTACT_FROM_EMAIL || to;
    const fromName = process.env.CONTACT_FROM_NAME || 'Coffria';

    if (!user || !pass) {
      throw new BadGatewayException('Le service email Coffria n’est pas configuré.');
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const safe = (value: string) => value.replace(/[<>]/g, '');
    const subject = `Nouveau contact Coffria — ${safe(dto.company || dto.name)}`;
    const text = [
      'Nouvelle demande depuis coffria.ci',
      '',
      `Nom : ${dto.name}`,
      `Email : ${dto.email}`,
      `Organisation : ${dto.company || 'Non renseignée'}`,
      '',
      'Message :',
      dto.message,
    ].join('\n');

    try {
      const info = await transporter.sendMail({
        from: { name: fromName, address: fromEmail },
        to,
        replyTo: dto.email,
        subject,
        text,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#14213d">
            <h2 style="margin-bottom:20px">Nouvelle demande Coffria</h2>
            <p><strong>Nom :</strong> ${safe(dto.name)}</p>
            <p><strong>Email :</strong> ${safe(dto.email)}</p>
            <p><strong>Organisation :</strong> ${safe(dto.company || 'Non renseignée')}</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
            <p style="white-space:pre-wrap;line-height:1.6">${safe(dto.message)}</p>
          </div>
        `,
      });

      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Brevo SMTP contact error', error);
      throw new BadGatewayException('Impossible d’envoyer votre message pour le moment.');
    }
  }
}

import { createTransport, Transporter } from 'nodemailer';

import { getTemplate } from './get-template';

import type { SendMail } from './types';

export default class EmailService {
  private name: string;
  private mail: string;
  private replyTo: string;
  private transporter: Transporter;

  constructor(
    name: string,
    mail: string,
    replyTo: string,
    host: string,
    port: number,
    username: string,
    password: string
  ) {
    this.transporter = createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user: username,
        pass: password,
      },
    });

    this.name = name;
    this.mail = mail;
    this.replyTo = replyTo;
  }

  async sendEmail(args: SendMail) {
    await this.transporter.sendMail({
      from: {
        name: this.name,
        address: this.mail,
      },
      replyTo: this.replyTo,
      to: args.to,
      bcc: args.bcc,
      subject: args.subject,
      html: await getTemplate(args.template),
      attachments: args.attachments,
    });
  }
}

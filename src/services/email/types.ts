interface AttachmentMail {
  type: 'attachment';
}

export type MailTemplate = AttachmentMail;

export interface SendMail {
  to: string;
  bcc?: string;
  subject: string;
  template: MailTemplate;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

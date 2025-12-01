declare module 'global' {
  global {
    namespace NodeJS {
      interface ProcessEnv {
        SMTP_NAME: string;
        SMTP_MAIL: string;
        SMTP_REPLY_TO: string;
        SMTP_HOST: string;
        SMTP_PORT: string;
        SMTP_USERNAME: string;
        SMTP_PASSWORD: string;

        RECEIVER_EMAIL: string;

        API_CLIENT_NUMBER: string;
        API_CLIENT_TOKEN: string;
      }
    }
  }
}

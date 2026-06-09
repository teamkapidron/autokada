import { resolve } from 'path';
import { config } from 'dotenv';

import EmailService from './services/email';
import { getStocksData } from './services/data';
import { convertToCSV } from './services/csv';

config({ path: resolve(__dirname, '../.env.local'), quiet: true });

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} must be set in environment variables`);
  }

  return value;
}

const smtpPort = Number.parseInt(requiredEnv('SMTP_PORT'), 10);

if (Number.isNaN(smtpPort)) {
  throw new Error('SMTP_PORT must be a valid number');
}

export const emailService = new EmailService(
  requiredEnv('SMTP_NAME'),
  requiredEnv('SMTP_MAIL'),
  requiredEnv('SMTP_REPLY_TO'),
  requiredEnv('SMTP_HOST'),
  smtpPort,
  requiredEnv('SMTP_USERNAME'),
  requiredEnv('SMTP_PASSWORD'),
);

async function main() {
  const stocksData = await getStocksData();

  console.log(`Fetched ${stocksData.length} stock items`);

  const csvData = convertToCSV(stocksData);

  await emailService.sendEmail({
    to: requiredEnv('RECEIVER_EMAIL'),
    bcc: 'teamkapidron@gmail.com',
    subject: 'NOR B2B Stock',
    template: {
      type: 'attachment',
    },
    attachments: [
      {
        filename: 'NOR B2B stock.csv',
        content: Buffer.from(csvData, 'utf-8'),
        contentType: 'text/csv',
      },
    ],
  });
}

main().catch((error) => {
  console.error('Error in main execution:', error);
});

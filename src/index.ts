import { resolve } from 'path';
import { config } from 'dotenv';

import EmailService from './services/email';
import { getStocksData } from './services/data';
import { convertToExcel } from './services/excel';

config({ path: resolve(__dirname, '../.env.local'), quiet: true });

export const emailService = new EmailService(
  process.env.SMTP_NAME,
  process.env.SMTP_MAIL,
  process.env.SMTP_REPLY_TO,
  process.env.SMTP_HOST,
  parseInt(process.env.SMTP_PORT, 10),
  process.env.SMTP_USERNAME,
  process.env.SMTP_PASSWORD
);

async function main() {
  const stocksData = await getStocksData();

  console.log(`Fetched ${stocksData.length} stock items`);

  const excelBuffer = convertToExcel(stocksData);

  await emailService.sendEmail({
    to: process.env.RECEIVER_EMAIL,
    bcc: 'teamkapidron@gmail.com',
    subject: 'NOR B2B Stock',
    template: {
      type: 'attachment',
    },
    attachments: [
      {
        filename: 'NOR B2B stock.xlsx',
        content: excelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
  });
}

main().catch((error) => {
  console.error('Error in main execution:', error);
});

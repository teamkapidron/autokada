import * as XLSX from 'xlsx';
import type { LogisticsRow } from '../data/types';

export function convertToExcel(data: LogisticsRow[]): Buffer {
  const headers = [
    'Varenr',
    'Navn',
    'Lokasjon',
    'Kostpris',
    'Pris eks MVA',
    'Antall',
  ];

  const rows = data.map((row) => [
    row.varenr ?? '',
    row.navn ?? '',
    row.lokasjon ?? '',
    row.kostpris ?? '',
    row.pris_eks_mva ?? '',
    row.antall ?? '',
  ]);

  const worksheetData = [headers, ...rows];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Auto-size columns for better readability
  const colWidths = headers.map((header, i) => {
    const maxLength = Math.max(
      header.length,
      ...rows.map((row) => String(row[i]).length)
    );
    return { wch: Math.min(maxLength + 2, 50) };
  });
  worksheet['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock');

  const excelBuffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  });

  return excelBuffer;
}

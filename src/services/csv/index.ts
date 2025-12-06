import type { LogisticsRow } from '../data/types';

export function convertToCSV(data: LogisticsRow[]): string {
  if (data.length === 0) {
    return '';
  }

  const headers = [
    'Varenr',
    'Navn',
    'Lokasjon',
    'Kostpris',
    'Pris eks MVA',
    'Antall',
  ];

  const headerRow = headers.join(',');

  const dataRows = data.map((row) => {
    return [
      `${row.varenr ?? ''}`,
      escapeCSV(row.navn ?? ''),
      escapeCSV(row.lokasjon ?? ''),
      row.kostpris != null ? row.kostpris.toString() : '',
      row.pris_eks_mva != null ? row.pris_eks_mva.toString() : '',
      row.antall != null ? row.antall.toString() : '',
    ].join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

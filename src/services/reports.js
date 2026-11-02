import ExcelJS from 'exceljs';
import pdfMakeModule from 'pdfmake/build/pdfmake.js';
import pdfFontsModule from 'pdfmake/build/vfs_fonts.js';
import { money, periodLabel, dateLabel, totals } from './utils.js';
import { exportFile } from './file-export.js';

// pdfmake'in gömülü Roboto yazı tipi Türkçe karakterleri destekler.
const pdfMake = pdfMakeModule?.default || pdfMakeModule;
const pdfFonts = pdfFontsModule?.default || pdfFontsModule;
const fonts = pdfFonts?.pdfMake?.vfs || pdfFonts?.vfs || pdfFonts;
pdfMake.vfs = fonts;

export async function exportExcel(period, items, periodNote = '') {
  const rows = items.filter(item => item.period === period).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const sum = totals(rows);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bütçe Takip';
  workbook.created = new Date();
  const overview = workbook.addWorksheet('Aylık Özet');
  overview.columns = [{ header: 'Gösterge', key: 'label', width: 28 }, { header: 'Tutar (TL)', key: 'amount', width: 20 }];
  overview.addRows([
    { label: 'Dönem', amount: periodLabel(period) },
    { label: 'Toplam Gelir', amount: sum.income },
    { label: 'Toplam Gider', amount: sum.expense },
    { label: 'Kalan Bakiye', amount: sum.balance },
    { label: 'Ödenen Gider', amount: sum.paid },
    { label: 'Bekleyen Gider', amount: sum.unpaid },
    { label: 'Dönem Notu', amount: periodNote || '—' }
  ]);
  overview.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  overview.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF426B91' } };
  const sheet = workbook.addWorksheet('Gelir ve Giderler');
  sheet.columns = [
    { header: 'Tür', key: 'type', width: 14 },
    { header: 'Kategori', key: 'category', width: 30 },
    { header: 'Miktar (TL)', key: 'amount', width: 18 },
    { header: 'Dönem', key: 'period', width: 14 },
    { header: 'Son ödeme tarihi', key: 'dueDate', width: 20 },
    { header: 'Durum', key: 'status', width: 16 },
    { header: 'Not', key: 'note', width: 42 }
  ];
  rows.forEach(item => sheet.addRow({
    type: item.type === 'income' ? 'Gelir' : 'Gider', category: item.category, amount: Number(item.amount),
    period: item.period, dueDate: item.dueDate || '', status: item.status === 'paid' ? 'Ödendi / Alındı' : 'Bekliyor', note: item.note || ''
  }));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF426B91' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  await exportFile(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `butce-raporu-${period}.xlsx`);
}

export function exportPDF(period, items, periodNote = '') {
  const rows = items.filter(item => item.period === period).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const sum = totals(rows);
  const body = [
    [{ text: 'Tür', bold: true }, { text: 'Kategori', bold: true }, { text: 'Tutar', bold: true }, { text: 'Tarih', bold: true }, { text: 'Durum', bold: true }, { text: 'Not', bold: true }],
    ...rows.map(item => [
      item.type === 'income' ? 'Gelir' : 'Gider', item.category, money(item.amount), dateLabel(item.dueDate), item.status === 'paid' ? 'Ödendi / Alındı' : 'Bekliyor', item.note || ''
    ])
  ];
  const definition = {
    pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [28, 34, 28, 34],
    defaultStyle: { font: 'Roboto', fontSize: 8 },
    content: [
      { text: 'BÜTÇE TAKİP', fontSize: 18, bold: true, color: '#426B91' },
      { text: periodLabel(period), fontSize: 13, margin: [0, 4, 0, 16] },
      ...(periodNote ? [{ text: `Dönem notu: ${periodNote}`, fontSize: 9, margin: [0, 0, 0, 12] }] : []),
      { columns: [
        { text: `Toplam gelir: ${money(sum.income)}`, bold: true },
        { text: `Toplam gider: ${money(sum.expense)}`, bold: true },
        { text: `Kalan bakiye: ${money(sum.balance)}`, bold: true },
        { text: `Bekleyen: ${money(sum.unpaid)}`, bold: true }
      ], margin: [0, 0, 0, 14] },
      { table: { headerRows: 1, widths: ['auto', '*', 'auto', 'auto', 'auto', '*'], body }, layout: 'lightHorizontalLines' },
      { text: `Rapor oluşturulma: ${new Date().toLocaleString('tr-TR')}`, color: '#777777', fontSize: 8, margin: [0, 16, 0, 0] }
    ]
  };
  const filename = `butce-raporu-${period}.pdf`;
  return new Promise((resolve, reject) => {
    pdfMake.createPdf(definition).getBlob(async blob => {
      try { await exportFile(blob, filename, 'application/pdf'); resolve(); }
      catch (error) { reject(error); }
    });
  });
}

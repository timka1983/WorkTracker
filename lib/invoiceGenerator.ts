import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType } from 'docx';
import { saveAs } from 'file-saver';
import { PlanType, Organization } from '../types';

export const generateInvoicePDF = (org: Organization, planType: PlanType, term: number, amount: number) => {
  const doc = new jsPDF();
  
  // Note: For Cyrillic support in jsPDF, we normally need to add a font.
  // Since we can't easily upload a font file here, we'll use a simple layout.
  // In a real app, you'd do: doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  
  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
  const date = new Date().toLocaleDateString('ru-RU');
  
  doc.setFontSize(20);
  doc.text('INVOICE / СЧЕТ', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(`Number / Номер: ${invoiceNumber}`, 20, 40);
  doc.text(`Date / Дата: ${date}`, 20, 50);
  
  doc.text('Customer / Заказчик:', 20, 70);
  doc.text(org.name, 20, 80);
  
  const tableData = [
    ['Description / Описание', 'Term / Срок', 'Price / Цена', 'Total / Итого'],
    [`Subscription: ${planType}`, `${term} month(s)`, `${amount / term} RUB`, `${amount} RUB`]
  ];
  
  (doc as any).autoTable({
    startY: 90,
    head: [tableData[0]],
    body: [tableData[1]],
    theme: 'grid',
    styles: { fontSize: 10 }
  });
  
  doc.save(`Invoice_${invoiceNumber}.pdf`);
};

export const generateInvoiceExcel = (org: Organization, planType: PlanType, term: number, amount: number) => {
  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
  const date = new Date().toLocaleDateString('ru-RU');
  
  const data = [
    ['СЧЕТ НА ОПЛАТУ', '', '', ''],
    ['Номер:', invoiceNumber, '', ''],
    ['Дата:', date, '', ''],
    ['Заказчик:', org.name, '', ''],
    ['', '', '', ''],
    ['Наименование', 'Срок (мес)', 'Цена', 'Сумма'],
    [`Подписка на тариф ${planType}`, term, amount / term, amount],
    ['', '', 'ИТОГО:', amount]
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoice");
  
  XLSX.writeFile(wb, `Invoice_${invoiceNumber}.xlsx`);
};

export const generateInvoiceWord = async (org: Organization, planType: PlanType, term: number, amount: number) => {
  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
  const date = new Date().toLocaleDateString('ru-RU');

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: "СЧЕТ НА ОПЛАТУ",
              bold: true,
              size: 32,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [
            new TextRun({ text: `Номер счета: ${invoiceNumber}`, bold: true }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Дата: ${date}`, bold: true }),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [
            new TextRun({ text: `Заказчик: ${org.name}` }),
          ],
        }),
        new Paragraph({ text: "" }),
        new Table({
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Наименование")] }),
                new TableCell({ children: [new Paragraph("Срок (мес)")] }),
                new TableCell({ children: [new Paragraph("Цена")] }),
                new TableCell({ children: [new Paragraph("Сумма")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(`Подписка на тариф ${planType}`)] }),
                new TableCell({ children: [new Paragraph(term.toString())] }),
                new TableCell({ children: [new Paragraph(`${amount / term} руб.`)] }),
                new TableCell({ children: [new Paragraph(`${amount} руб.`)] }),
              ],
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [
            new TextRun({ text: `ИТОГО К ОПЛАТЕ: ${amount} руб.`, bold: true }),
          ],
          alignment: AlignmentType.RIGHT,
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Invoice_${invoiceNumber}.docx`);
};

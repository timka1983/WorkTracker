import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import { PlanType, Organization, ReceivingOrganization, Invoice } from '../types';

export const generateInvoicePDF = async (elementId: string, invoiceNumber: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Element not found:', elementId);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const imgProps = pdf.getImageProperties(imgData);
    const imgWidth = pdfWidth - 20; // 10mm margin on each side
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
    pdf.save(`Invoice_${invoiceNumber}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

export const generateInvoiceExcel = (org: Organization, planType: PlanType, term: number, amount: number, recipient: ReceivingOrganization, invoice: Invoice) => {
  const clientReq = org.clientRequisites || { name: org.name, inn: '', kpp: '', address: '' };
  
  const data = [
    ['СЧЕТ НА ОПЛАТУ', '', '', '', '', ''],
    ['Номер:', invoice.contractNumber, '', 'Дата:', invoice.date, ''],
    ['', '', '', '', '', ''],
    ['ПОСТАВЩИК:', recipient.name, '', '', '', ''],
    ['ИНН/КПП:', `${recipient.requisites.inn} / ${recipient.requisites.kpp}`, '', '', '', ''],
    ['Адрес:', recipient.requisites.address, '', '', '', ''],
    ['', '', '', '', '', ''],
    ['ПЛАТЕЛЬЩИК:', clientReq.name, '', '', '', ''],
    ['ИНН/КПП:', `${clientReq.inn || '—'} / ${clientReq.kpp || '—'}`, '', '', '', ''],
    ['Адрес:', clientReq.address || '—', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['№', 'Наименование', 'Кол-во', 'Ед.', 'Цена', 'Сумма'],
    ['1', `Доступ к WorkTracker Pro (${planType})`, 1, 'усл.', amount, amount],
    ['', '', '', '', 'ИТОГО:', amount],
    ['', '', '', '', '', ''],
    ['Назначение платежа:', invoice.paymentPurpose || '', '', '', '', '']
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoice");
  
  XLSX.writeFile(wb, `Invoice_${invoice.contractNumber}.xlsx`);
};

export const generateInvoiceWord = async (org: Organization, planType: PlanType, term: number, amount: number, recipient: ReceivingOrganization, invoice: Invoice) => {
  const clientReq = org.clientRequisites || { name: org.name, inn: '', kpp: '', address: '' };

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: "СЧЕТ НА ОПЛАТУ", bold: true, size: 32 }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `№ ${invoice.contractNumber} от ${invoice.date}`, bold: true, size: 24 }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ children: [new TextRun({ text: "ПОСТАВЩИК:", bold: true })] }),
        new Paragraph({ text: recipient.name }),
        new Paragraph({ text: `ИНН/КПП: ${recipient.requisites.inn} / ${recipient.requisites.kpp}` }),
        new Paragraph({ text: `Адрес: ${recipient.requisites.address}` }),
        new Paragraph({ text: "" }),
        new Paragraph({ children: [new TextRun({ text: "ПЛАТЕЛЬЩИК:", bold: true })] }),
        new Paragraph({ text: clientReq.name }),
        new Paragraph({ text: `ИНН/КПП: ${clientReq.inn || '—'} / ${clientReq.kpp || '—'}` }),
        new Paragraph({ text: `Адрес: ${clientReq.address || '—'}` }),
        new Paragraph({ text: "" }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Наименование", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Кол-во", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Сумма", bold: true })] })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(`Доступ к WorkTracker Pro (${planType})`)] }),
                new TableCell({ children: [new Paragraph("1")] }),
                new TableCell({ children: [new Paragraph(`${amount} руб.`)] }),
              ],
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [new TextRun({ text: `ИТОГО К ОПЛАТЕ: ${amount} руб.`, bold: true, size: 28 })],
          alignment: AlignmentType.RIGHT,
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ children: [new TextRun({ text: "Назначение платежа:", bold: true })] }),
        new Paragraph({ text: invoice.paymentPurpose || "" }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Invoice_${invoice.contractNumber}.docx`);
};

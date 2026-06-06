import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export const generatePayslipPDF = async (employee: any, payroll: any, month: string, payments: any[] = [], machines: any[] = []) => {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '600px';
  container.style.padding = '30px';
  container.style.backgroundColor = 'white';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.color = '#1e293b';

  const monthName = format(new Date(month), 'MMMM yyyy', { locale: ru });
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = payroll.totalSalary - totalPaid;

  container.innerHTML = `
    <div style="border: 2px solid #334155; padding: 20px; border-radius: 8px;">
      <h2 style="text-align: center; margin-bottom: 5px; font-size: 22px; font-weight: bold; text-transform: uppercase;">Расчетный листок</h2>
      <div style="text-align: center; margin-bottom: 20px; font-size: 14px; color: #64748b;">за ${monthName}</div>
      
      <table style="width: 100%; margin-bottom: 20px;">
        <tr>
          <td style="width: 50%; padding: 5px 0;"><strong>Сотрудник:</strong> ${employee.name}</td>
          <td style="width: 50%; padding: 5px 0; text-align: right;"><strong>Должность:</strong> ${employee.position || 'Не указана'}</td>
        </tr>
      </table>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">
            <th style="text-align: left; padding: 10px; font-size: 12px;">Вид начисления/удержания</th>
            <th style="text-align: center; padding: 10px; font-size: 12px;">Кол-во</th>
            <th style="text-align: right; padding: 10px; font-size: 12px;">Сумма (₽)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 10px; border-bottom: 1px dashed #e2e8f0;">Оклад / Основная оплата</td>
            <td style="text-align: center; padding: 10px; border-bottom: 1px dashed #e2e8f0;">${payroll.details.regularHours ? payroll.details.regularHours.toFixed(1) + ' ч' : '-'}</td>
            <td style="text-align: right; padding: 10px; border-bottom: 1px dashed #e2e8f0;">${payroll.regularPay.toLocaleString('ru-RU')}</td>
          </tr>
          ${payroll.overtimePay > 0 ? `
          <tr>
            <td style="padding: 10px; border-bottom: 1px dashed #e2e8f0;">Сверхурочные</td>
            <td style="text-align: center; padding: 10px; border-bottom: 1px dashed #e2e8f0;">${payroll.details.overtimeHours.toFixed(1)} ч</td>
            <td style="text-align: right; padding: 10px; border-bottom: 1px dashed #e2e8f0;">${payroll.overtimePay.toLocaleString('ru-RU')}</td>
          </tr>` : ''}
          ${payroll.nightShiftPay > 0 ? `
          <tr>
            <td style="padding: 10px; border-bottom: 1px dashed #e2e8f0;">Ночные смены</td>
            <td style="text-align: center; padding: 10px; border-bottom: 1px dashed #e2e8f0;">${payroll.details.nightShiftCount}</td>
            <td style="text-align: right; padding: 10px; border-bottom: 1px dashed #e2e8f0;">${payroll.nightShiftPay.toLocaleString('ru-RU')}</td>
          </tr>` : ''}
          ${payroll.sickLeavePay > 0 ? `
          <tr>
            <td style="padding: 10px; border-bottom: 1px dashed #e2e8f0;">Больничные</td>
            <td style="text-align: center; padding: 10px; border-bottom: 1px dashed #e2e8f0;">${payroll.details.sickDays} дн</td>
            <td style="text-align: right; padding: 10px; border-bottom: 1px dashed #e2e8f0;">${payroll.sickLeavePay.toLocaleString('ru-RU')}</td>
          </tr>` : ''}
          ${payroll.bonuses > 0 ? `
          <tr>
            <td style="padding: 10px; border-bottom: 1px dashed #e2e8f0; color: #16a34a;">Премии и бонусы</td>
            <td style="text-align: center; padding: 10px; border-bottom: 1px dashed #e2e8f0;">-</td>
            <td style="text-align: right; padding: 10px; border-bottom: 1px dashed #e2e8f0; color: #16a34a;">+${payroll.bonuses.toLocaleString('ru-RU')}</td>
          </tr>` : ''}
          ${payroll.fines > 0 ? `
          <tr>
            <td style="padding: 10px; border-bottom: 1px dashed #e2e8f0; color: #dc2626;">Штрафы и удержания</td>
            <td style="text-align: center; padding: 10px; border-bottom: 1px dashed #e2e8f0;">-</td>
            <td style="text-align: right; padding: 10px; border-bottom: 1px dashed #e2e8f0; color: #dc2626;">-${payroll.fines.toLocaleString('ru-RU')}</td>
          </tr>` : ''}
        </tbody>
        <tfoot>
          <tr style="background-color: #f8fafc; font-weight: bold;">
            <td colspan="2" style="padding: 12px 10px; border-top: 2px solid #334155;">Всего начислено:</td>
            <td style="text-align: right; padding: 12px 10px; border-top: 2px solid #334155;">${payroll.totalSalary.toLocaleString('ru-RU')} ₽</td>
          </tr>
        </tfoot>
      </table>

      ${payments.length > 0 ? `
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 14px; margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">Выплаты</h3>
        <table style="width: 100%; font-size: 12px;">
          ${payments.map(p => `
            <tr>
              <td style="padding: 4px 0; color: #64748b;">${format(new Date(p.date), 'dd.MM.yyyy')}</td>
              <td style="padding: 4px 0;">${p.type === 'advance' ? 'Аванс' : p.type === 'salary' ? 'Зарплата' : 'Прочее'}</td>
              <td style="padding: 4px 0; text-align: right; font-weight: bold;">${p.amount.toLocaleString('ru-RU')} ₽</td>
            </tr>
          `).join('')}
        </table>
      </div>
      ` : ''}

      <table style="width: 100%; margin-top: 30px; border-top: 2px solid #334155; padding-top: 15px;">
        <tr>
          <td style="width: 50%; font-size: 14px;"><strong>Выплачено:</strong></td>
          <td style="width: 50%; text-align: right; font-size: 14px; font-weight: bold;">${totalPaid.toLocaleString('ru-RU')} ₽</td>
        </tr>
        <tr>
          <td style="width: 50%; font-size: 16px; padding-top: 10px;"><strong>К выплате (долг):</strong></td>
          <td style="width: 50%; text-align: right; font-size: 16px; font-weight: bold; padding-top: 10px; color: ${balance > 0 ? '#dc2626' : '#16a34a'};">${balance.toLocaleString('ru-RU')} ₽</td>
        </tr>
      </table>

      <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px;">
        <div style="width: 45%; border-top: 1px solid #cbd5e1; padding-top: 5px; text-align: center;">Подпись руководителя</div>
        <div style="width: 45%; border-top: 1px solid #cbd5e1; padding-top: 5px; text-align: center;">Подпись сотрудника</div>
      </div>
      
      <div style="margin-top: 20px; text-align: center; color: #94a3b8; font-size: 10px;">
        Сформировано: ${format(new Date(), 'dd.MM.yyyy HH:mm')}
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: 'white'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Payslip_${employee.name.replace(/\s+/g, '_')}_${month}.pdf`);
  } catch (error) {
    console.error('Failed to generate PDF:', error);
  } finally {
    document.body.removeChild(container);
  }
};

export const generatePayrollReportPDF = async (payrollData: any[], month: string) => {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px'; // A4 width approx
  container.style.padding = '20px';
  container.style.backgroundColor = 'white';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.fontSize = '10px'; // Smaller font

  const monthName = format(new Date(month), 'MMMM yyyy', { locale: ru });

  container.innerHTML = `
    <div style="padding: 10px;">
      <h2 style="text-align: center; color: #1e293b; margin-bottom: 15px; font-size: 20px; font-weight: bold;">Ведомость по зарплате: ${monthName}</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #334155;">
        <thead>
          <tr style="background-color: #f8fafc; border-bottom: 2px solid #334155;">
            <th style="text-align: left; padding: 6px; border: 1px solid #334155; width: 20%;">Сотрудник</th>
            <th style="text-align: left; padding: 6px; border: 1px solid #334155; width: 15%;">Должность</th>
            <th style="text-align: center; padding: 6px; border: 1px solid #334155;">Часы</th>
            <th style="text-align: center; padding: 6px; border: 1px solid #334155;">Б/л</th>
            <th style="text-align: center; padding: 6px; border: 1px solid #334155;">Аванс</th>
            <th style="text-align: center; padding: 6px; border: 1px solid #334155;">Премия</th>
            <th style="text-align: right; padding: 6px; border: 1px solid #334155;">Начислено</th>
            <th style="text-align: right; padding: 6px; border: 1px solid #334155;">Выдано</th>
            <th style="text-align: right; padding: 6px; border: 1px solid #334155;">Получил</th>
            <th style="text-align: right; padding: 6px; border: 1px solid #334155;">Остаток</th>
          </tr>
        </thead>
        <tbody>
          ${payrollData.map(p => `
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding: 4px 6px; border: 1px solid #334155;">${p.employeeName}</td>
              <td style="padding: 4px 6px; border: 1px solid #334155;">${p.position}</td>
              <td style="padding: 4px 6px; text-align: center; border: 1px solid #334155;">${p.totalHours || ''}</td>
              <td style="padding: 4px 6px; text-align: center; border: 1px solid #334155;">${p.sickDays || ''}</td>
              <td style="padding: 4px 6px; text-align: center; border: 1px solid #334155;">${p.advance || ''}</td>
              <td style="padding: 4px 6px; text-align: center; border: 1px solid #334155;">${p.bonus || ''}</td>
              <td style="padding: 4px 6px; text-align: right; border: 1px solid #334155;">${p.totalSalary.toLocaleString('ru-RU')}</td>
              <td style="padding: 4px 6px; text-align: right; border: 1px solid #334155;"></td>
              <td style="padding: 4px 6px; text-align: right; border: 1px solid #334155;"></td>
              <td style="padding: 4px 6px; text-align: right; border: 1px solid #334155;"></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top: 10px; text-align: right; color: #64748b; font-size: 9px;">
        Сформировано: ${format(new Date(), 'dd.MM.yyyy HH:mm')}
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: 'white'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4'); // Portrait orientation
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Payroll_Report_${month}.pdf`);
  } catch (error) {
    console.error('Failed to generate PDF:', error);
  } finally {
    document.body.removeChild(container);
  }
};

export const generateReconciliationReportPDF = async (employee: any, transactions: any[], startDate: string, endDate: string, totalBalance: number) => {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.padding = '40px';
  container.style.backgroundColor = 'white';
  container.style.fontFamily = 'Arial, sans-serif';

  container.innerHTML = `
    <div style="color: #1e293b;">
      <h1 style="text-align: center; font-size: 24px; margin-bottom: 20px; font-weight: bold;">Отчет по взаиморасчетам</h1>
      
      <div style="margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">
        <p style="margin: 5px 0;"><strong>Сотрудник:</strong> ${employee.name}</p>
        <p style="margin: 5px 0;"><strong>Должность:</strong> ${employee.position}</p>
        <p style="margin: 5px 0;"><strong>Период:</strong> ${format(new Date(startDate), 'dd.MM.yyyy')} — ${format(new Date(endDate), 'dd.MM.yyyy')}</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1;">
            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Дата</th>
            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Тип операции</th>
            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Комментарий</th>
            <th style="padding: 12px; text-align: right; border-bottom: 1px solid #e2e8f0;">Начислено</th>
            <th style="padding: 12px; text-align: right; border-bottom: 1px solid #e2e8f0;">Выплачено</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.map(t => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 12px;">${format(new Date(t.date), 'dd.MM.yyyy')}</td>
              <td style="padding: 10px 12px;">${t.type}</td>
              <td style="padding: 10px 12px; font-size: 12px; color: #64748b;">${t.comment || ''}</td>
              <td style="padding: 10px 12px; text-align: right; color: ${t.accrual > 0 ? '#059669' : '#1e293b'}">${t.accrual > 0 ? t.accrual.toLocaleString('ru-RU') : ''}</td>
              <td style="padding: 10px 12px; text-align: right; color: ${t.payment > 0 ? '#dc2626' : '#1e293b'}">${t.payment > 0 ? t.payment.toLocaleString('ru-RU') : ''}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1;">
            <td colspan="3" style="padding: 12px; text-align: right;">ИТОГО ЗА ПЕРИОД:</td>
            <td style="padding: 12px; text-align: right;">${transactions.reduce((sum, t) => sum + (t.accrual || 0), 0).toLocaleString('ru-RU')}</td>
            <td style="padding: 12px; text-align: right;">${transactions.reduce((sum, t) => sum + (t.payment || 0), 0).toLocaleString('ru-RU')}</td>
          </tr>
        </tfoot>
      </table>

      <div style="text-align: right; margin-top: 20px; font-size: 18px;">
        <strong>Текущий общий баланс: <span style="color: ${totalBalance >= 0 ? '#059669' : '#dc2626'}">${totalBalance.toLocaleString('ru-RU')} ₽</span></strong>
      </div>

      <div style="margin-top: 50px; display: flex; justify-content: space-between;">
        <div style="border-top: 1px solid #94a3b8; width: 200px; text-align: center; padding-top: 5px; font-size: 12px;">Работодатель</div>
        <div style="border-top: 1px solid #94a3b8; width: 200px; text-align: center; padding-top: 5px; font-size: 12px;">Сотрудник</div>
      </div>

      <div style="margin-top: 30px; text-align: right; color: #94a3b8; font-size: 10px;">
        Сформировано: ${format(new Date(), 'dd.MM.yyyy HH:mm')}
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: 'white'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Reconciliation_Report_${employee.name}_${startDate}_${endDate}.pdf`);
  } catch (error) {
    console.error('Failed to generate PDF:', error);
  } finally {
    document.body.removeChild(container);
  }
};

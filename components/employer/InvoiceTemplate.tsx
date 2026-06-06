import React from 'react';
import { Invoice, Organization, ReceivingOrganization } from '../../types';

interface InvoiceTemplateProps {
  invoice: Invoice;
  org: Organization;
  recipient: ReceivingOrganization;
}

export const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ invoice, org, recipient }) => {
  const clientReq = org.clientRequisites || { name: org.name, inn: '', kpp: '', address: '' };
  
  const getVatAmount = () => {
    const rateStr = recipient.requisites.vatRate || 'Без НДС';
    if (rateStr === 'Без НДС') return 0;
    const percent = parseInt(rateStr.replace('%', ''));
    if (isNaN(percent)) return 0;
    return (invoice.amount * percent) / 100;
  };

  const vatAmount = getVatAmount();
  const vatLabel = recipient.requisites.vatRate === 'Без НДС' ? 'Без НДС' : `В том числе НДС (${recipient.requisites.vatRate || '20%'}):`;

  return (
    <div className="p-8 bg-white text-black font-sans text-sm leading-relaxed max-w-[210mm] mx-auto min-h-[297mm]">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-1">Счёт на оплату</h1>
          <p className="text-lg font-bold text-slate-600">№ {invoice.contractNumber} от {invoice.date}</p>
        </div>
        <div className="text-right">
          <p className="font-black uppercase text-[10px] tracking-widest text-slate-400 mb-1">Статус</p>
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
            invoice.status === 'paid' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-amber-50 text-amber-600 border-amber-200'
          }`}>
            {invoice.status === 'paid' ? 'Оплачен' : 'Ожидает оплаты'}
          </span>
        </div>
      </div>

      {/* Requisites Grid */}
      <div className="grid grid-cols-2 gap-12 mb-10">
        <div className="space-y-4">
          <div>
            <h4 className="font-black uppercase text-[10px] tracking-widest text-slate-400 mb-2">Поставщик (Получатель)</h4>
            <p className="font-bold text-base mb-1">{recipient.name}</p>
              <div className="text-xs space-y-1 text-slate-600">
                <p><span className="font-bold">ИНН/КПП:</span> {recipient.requisites.inn} / {recipient.requisites.kpp}</p>
                <p><span className="font-bold">Адрес:</span> {recipient.requisites.address}</p>
                <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="font-bold block mb-1">Банковские реквизиты:</span>
                  <p><span className="text-slate-400">Банк:</span> {recipient.requisites.bankName}</p>
                  <p><span className="text-slate-400">БИК:</span> {recipient.requisites.bik}</p>
                  <p><span className="text-slate-400">К/с:</span> {recipient.requisites.corrAccount}</p>
                  <p><span className="text-slate-400">Р/с:</span> {recipient.requisites.settlementAccount}</p>
                </div>
              </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="font-black uppercase text-[10px] tracking-widest text-slate-400 mb-2">Заказчик (Плательщик)</h4>
            <p className="font-bold text-base mb-1">{clientReq.name}</p>
            <div className="text-xs space-y-1 text-slate-600">
              <p><span className="font-bold">ИНН/КПП:</span> {clientReq.inn || '—'} / {clientReq.kpp || '—'}</p>
              <p><span className="font-bold">Адрес:</span> {clientReq.address || '—'}</p>
              {(clientReq.bankName || clientReq.settlementAccount) && (
                <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="font-bold block mb-1">Банковские реквизиты:</span>
                  {clientReq.bankName && <p><span className="text-slate-400">Банк:</span> {clientReq.bankName}</p>}
                  {clientReq.bik && <p><span className="text-slate-400">БИК:</span> {clientReq.bik}</p>}
                  {clientReq.corrAccount && <p><span className="text-slate-400">К/с:</span> {clientReq.corrAccount}</p>}
                  {clientReq.settlementAccount && <p><span className="text-slate-400">Р/с:</span> {clientReq.settlementAccount}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-10">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest">№</th>
              <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest">Наименование товара, работ, услуг</th>
              <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">Кол-во</th>
              <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">Ед.</th>
              <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">Цена</th>
              <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">Сумма</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 border-b-2 border-slate-900">
            <tr>
              <td className="p-4 font-bold text-slate-400">1</td>
              <td className="p-4">
                <p className="font-bold">Предоставление доступа к WorkTracker Pro (Тариф {invoice.planType})</p>
                <p className="text-[10px] text-slate-500 mt-1">Период подписки: {invoice.termMonths} мес.</p>
              </td>
              <td className="p-4 text-center font-bold">1</td>
              <td className="p-4 text-center font-bold">усл.</td>
              <td className="p-4 text-right font-bold">{invoice.amount}</td>
              <td className="p-4 text-right font-black">{invoice.amount}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-10">
        <div className="w-64 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="font-bold text-slate-400 uppercase tracking-widest">Итого:</span>
            <span className="font-black">{invoice.amount} руб.</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="font-bold text-slate-400 uppercase tracking-widest">{vatLabel}</span>
            <span className="font-black">{vatAmount > 0 ? `${vatAmount.toFixed(2)} руб.` : '—'}</span>
          </div>
          <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
            <span className="font-black uppercase text-[10px] tracking-widest">Всего к оплате:</span>
            <span className="text-2xl font-black">{invoice.amount} руб.</span>
          </div>
        </div>
      </div>

      {/* Payment Purpose Section */}
      <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 mb-10">
        <h4 className="font-black uppercase text-[10px] tracking-widest text-slate-400 mb-2">Назначение платежа</h4>
        <p className="text-sm font-bold leading-relaxed">
          {invoice.paymentPurpose || `Оплата по Договору № ${org.contractNumber || 'Б/Н'} от ${org.contractDate || invoice.date} за продление по тарифу ${invoice.planType}`}
        </p>
      </div>

      {/* Footer / Signatures */}
      <div className="grid grid-cols-2 gap-12 pt-12 border-t border-slate-100">
        <div className="space-y-8">
          <div className="flex items-end gap-4">
            <div className="flex-1 border-b border-black pb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Руководитель</p>
            </div>
            <div className="w-32 border-b border-black pb-1 text-center">
              <p className="text-[10px] text-slate-400">(подпись)</p>
            </div>
          </div>
          <div className="flex items-end gap-4">
            <div className="flex-1 border-b border-black pb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Главный бухгалтер</p>
            </div>
            <div className="w-32 border-b border-black pb-1 text-center">
              <p className="text-[10px] text-slate-400">(подпись)</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center border-2 border-slate-100 rounded-full w-32 h-32 mx-auto text-slate-300 font-black text-[10px] uppercase tracking-widest">
          М.П.
        </div>
      </div>
    </div>
  );
};

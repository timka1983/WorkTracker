import React from 'react';
import { Invoice, Organization, ReceivingOrganization } from '../../types';

interface InvoiceTemplateProps {
  invoice: Invoice;
  org: Organization;
  recipient: ReceivingOrganization;
}

export const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ invoice, org, recipient }) => {
  return (
    <div className="hidden print:block p-8 bg-white text-black">
      <h2 className="text-2xl font-bold mb-4">Счёт №{invoice.contractNumber} от {invoice.date}</h2>
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div><h4 className="font-bold">Поставщик:</h4><p>{recipient.name}</p><p>ИНН: {recipient.requisites.inn}</p></div>
        <div><h4 className="font-bold">Плательщик:</h4><p>{org.clientRequisites?.name || org.name}</p><p>ИНН: {org.clientRequisites?.inn}</p></div>
      </div>
      <table className="w-full border-collapse border border-black mb-8">
        <thead><tr><th className="border border-black p-2">Наименование</th><th className="border border-black p-2">Срок</th><th className="border border-black p-2">Сумма</th></tr></thead>
        <tbody><tr><td className="border border-black p-2">Тариф {invoice.planType}</td><td className="border border-black p-2">{invoice.termMonths} мес.</td><td className="border border-black p-2">{invoice.amount} руб.</td></tr></tbody>
      </table>
      <p className="font-bold text-xl">Итого к оплате: {invoice.amount} руб.</p>
    </div>
  );
};

import React, { useState } from 'react';
import { User, PayrollSnapshot, PayrollPayment } from '../../types';
import { format, isWithinInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { X, Calendar, Download, FileText, User as UserIcon } from 'lucide-react';
import { generateReconciliationReportPDF } from '../../utils/pdfGenerator';

interface ReconciliationReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  allSnapshots: PayrollSnapshot[];
  allPayments: PayrollPayment[];
}

export const ReconciliationReportModal: React.FC<ReconciliationReportModalProps> = ({
  isOpen,
  onClose,
  users,
  allSnapshots,
  allPayments
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || '');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  if (!isOpen) return null;

  const selectedUser = users.find(u => u.id === selectedUserId);

  const handleGenerate = () => {
    if (!selectedUser) return;

    const start = parseISO(startDate);
    const end = parseISO(endDate);

    // Filter snapshots and payments within the interval
    const filteredSnapshots = allSnapshots.filter(s => {
      if (s.userId !== selectedUserId) return false;
      const snapshotDate = parseISO(`${s.month}-01`);
      return isWithinInterval(snapshotDate, { start, end });
    });

    const filteredPayments = allPayments.filter(p => {
      if (p.userId !== selectedUserId) return false;
      const paymentDate = parseISO(p.date);
      return isWithinInterval(paymentDate, { start, end });
    });

    // Create a unified list of transactions
    const transactions: any[] = [
      ...filteredSnapshots.map(s => ({
        date: `${s.month}-01`,
        type: 'Начисление (ЗП)',
        comment: `За период ${s.month}`,
        accrual: s.totalSalary,
        payment: 0
      })),
      ...filteredPayments.map(p => ({
        date: p.date,
        type: `Выплата (${p.type})`,
        comment: p.comment,
        accrual: 0,
        payment: p.amount
      }))
    ].sort((a, b) => a.date.localeCompare(b.date));

    // Calculate total balance for this user (across all time)
    const totalEarnings = allSnapshots
      .filter(s => s.userId === selectedUserId)
      .reduce((sum, s) => sum + s.totalSalary, 0);
    const totalPaid = allPayments
      .filter(p => p.userId === selectedUserId)
      .reduce((sum, p) => sum + p.amount, 0);
    const totalBalance = totalEarnings - totalPaid;

    generateReconciliationReportPDF(selectedUser, transactions, startDate, endDate, totalBalance);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Отчет по взаиморасчетам</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Детализация начислений и выплат</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Сотрудник</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.position})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">С даты</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">По дату</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
              Отчет включает все начисления (закрытые периоды) и все фактически произведенные выплаты в указанном интервале.
            </p>
          </div>
        </div>

        <div className="p-8 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            Отмена
          </button>
          <button
            onClick={handleGenerate}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none active:scale-95"
          >
            <Download size={18} />
            Скачать PDF
          </button>
        </div>
      </div>
    </div>
  );
};

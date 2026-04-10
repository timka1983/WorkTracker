import React, { useState, useEffect } from 'react';
import { PlanType, Plan, Organization, PlanLimits, User, Machine, Invoice, ReceivingOrganization } from '../../types';
import { format } from 'date-fns';
import { PLAN_LIMITS } from '../../constants';
import { db } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { generateInvoicePDF, generateInvoiceExcel, generateInvoiceWord } from '../../lib/invoiceGenerator';
import { InvoiceTemplate } from './InvoiceTemplate';

interface BillingViewProps {
  currentOrg: Organization | null;
  plans: Plan[];
  planLimits: PlanLimits;
  users: User[];
  machines: Machine[];
  promoCode: string;
  setPromoCode: (code: string) => void;
  isApplyingPromo: boolean;
  handleApplyPromo: () => void;
  promoMessage: { text: string, type: 'success' | 'error' } | null;
}

export const BillingView: React.FC<BillingViewProps> = ({
  currentOrg,
  plans,
  planLimits,
  users,
  machines,
  promoCode,
  setPromoCode,
  isApplyingPromo,
  handleApplyPromo,
  promoMessage
}) => {
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [subscriptionTerm, setSubscriptionTerm] = useState(1);
  const [activeTab, setActiveTab] = useState<'billing' | 'invoices'>('billing');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receivingOrgs, setReceivingOrgs] = useState<ReceivingOrganization[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [paymentBlockSource, setPaymentBlockSource] = useState<'grid' | 'renew' | null>(null);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (currentOrg) {
      db.getSubscriptionHistory(currentOrg.id).then(history => {
        if (history) setPaymentHistory(history);
      }).catch(err => console.error('Error fetching subscription history:', err));
      db.getInvoices(currentOrg.id).then(invs => {
        if (invs) setInvoices(invs);
      }).catch(err => console.error('Error fetching invoices:', err));
      db.getReceivingOrganizations().then(orgs => {
        if (orgs) setReceivingOrgs(orgs);
      }).catch(err => console.error('Error fetching receiving organizations:', err));
    }
  }, [currentOrg]);

  const handleOnlinePayment = async (planType: PlanType) => {
    if (!currentOrg) return;
    setIsProcessingPayment(planType);
    
    try {
      const response = await fetch('/api/payments/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: currentOrg.id,
          planType: planType,
          termMonths: subscriptionTerm,
          amount: (planType === PlanType.PRO ? 1500 : 5000) * subscriptionTerm
        })
      });

      if (!response.ok) throw new Error('Failed to create payment session');
      
      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      console.error('Payment error:', error);
      alert('Ошибка при создании платежа: ' + error.message);
    } finally {
      setIsProcessingPayment(null);
    }
  };

  const handleInvoiceGeneration = async (planType: PlanType, formatType?: 'pdf' | 'excel' | 'word') => {
    if (!currentOrg) return;
    
    const amount = (planType === PlanType.PRO ? 1500 : 5000) * subscriptionTerm;
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const invoiceNumber = `${invoices.length + 1}/${month}/${year}`;
    
    // Generate a temporary invoice object for preview/saving
    const newInvoice: Invoice = {
      id: crypto.randomUUID(),
      organizationId: currentOrg.id,
      contractNumber: invoiceNumber,
      date: format(date, 'dd.MM.yyyy'),
      planType: planType,
      amount: amount,
      termMonths: subscriptionTerm,
      status: 'pending'
    };

    try {
      // Save to database
      const { error: saveError } = await db.saveInvoice(newInvoice);
      if (saveError) throw saveError;

      // Refresh invoices list
      const updatedInvoices = await db.getInvoices(currentOrg.id);
      if (updatedInvoices) setInvoices(updatedInvoices);

      if (formatType) {
        if (formatType === 'pdf') {
          generateInvoicePDF(currentOrg, planType, subscriptionTerm, amount);
        } else if (formatType === 'excel') {
          generateInvoiceExcel(currentOrg, planType, subscriptionTerm, amount);
        } else if (formatType === 'word') {
          await generateInvoiceWord(currentOrg, planType, subscriptionTerm, amount);
        }
        setShowPaymentOptions(false);
        setPaymentBlockSource(null);
      } else {
        // Just show preview
        setCurrentInvoice(newInvoice);
        setShowInvoiceModal(true);
      }
    } catch (error) {
      console.error('Invoice generation error:', error);
      alert('Ошибка при формировании счета');
    }
  };

  const handlePlanAction = (planType: PlanType, source: 'grid' | 'renew') => {
    setSelectedPlan(planType);
    setShowPaymentOptions(true);
    setPaymentBlockSource(source);
  };

  return (
    <div className="space-y-8 no-print animate-fadeIn">
      {modalConfig && (
        <Modal
          isOpen={modalConfig.isOpen}
          onClose={() => setModalConfig(null)}
          onConfirm={modalConfig.onConfirm}
          title={modalConfig.title}
          message={modalConfig.message}
        />
      )}
      
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800">
        <button onClick={() => setActiveTab('billing')} className={`pb-2 ${activeTab === 'billing' ? 'border-b-2 border-blue-600 font-bold' : 'text-slate-500'}`}>Биллинг</button>
        <button onClick={() => setActiveTab('invoices')} className={`pb-2 ${activeTab === 'invoices' ? 'border-b-2 border-blue-600 font-bold' : 'text-slate-500'}`}>Счета</button>
      </div>

      {activeTab === 'billing' ? (
        <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.82v-1.91c-1.52-.35-2.82-1.3-3.27-2.7h1.82c.45.75 1.2 1.25 2.1 1.25 1.1 0 2-.9 2-2s-.9-2-2-2c-2.1 0-3.9-1.8-3.9-3.9s1.8-3.9 3.9-3.9V5h2.82v1.91c1.52.35 2.82 1.3 3.27 2.7h-1.82c-.45-.75-1.2-1.25-2.1-1.25-1.1 0-2 .9-2 2s.9 2 2 2c2.1 0 3.9 1.8 3.9 3.9s-1.8 3.9-3.9 3.9z"/></svg>
          </div>
          
          <div className="relative z-10">
            <h3 className="font-black text-slate-900 dark:text-slate-100 mb-2 uppercase text-xs tracking-widest underline decoration-blue-500 decoration-4 underline-offset-8">Ваш тарифный план</h3>
            <div className="flex items-baseline gap-3 mt-6">
              <span className="text-4xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">{currentOrg?.plan || PlanType.FREE}</span>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100 dark:border-blue-800">Активен</span>
              {currentOrg?.expiryDate && (
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-4">
                  Осталось дней: {Math.max(0, Math.ceil((new Date(currentOrg.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))}
                </span>
              )}
            </div>

            <div className="mt-8 flex flex-col gap-4">
              <button 
                onClick={() => handlePlanAction(currentOrg?.plan || PlanType.FREE, 'renew')}
                disabled={currentOrg?.plan === PlanType.FREE}
                className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50 w-fit"
              >
                Продлить тариф
              </button>
              
              {showPaymentOptions && paymentBlockSource === 'renew' && (
                <div className="mt-4 animate-fadeIn">
                  {renderPaymentOptions()}
                </div>
              )}
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 max-w-md">
              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 ml-1">Активация промокода</h4>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={promoCode}
                  onChange={e => setPromoCode(e.target.value)}
                  placeholder="Введите код..."
                  className="flex-1 border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold uppercase tracking-widest outline-none focus:border-blue-500 transition-all bg-white dark:bg-slate-900 dark:text-slate-100"
                />
                <button 
                  onClick={handleApplyPromo}
                  disabled={isApplyingPromo || !promoCode.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl dark:shadow-slate-900/20 shadow-blue-100 dark:shadow-none hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:shadow-none transition-all"
                >
                  {isApplyingPromo ? '...' : 'ОК'}
                </button>
              </div>
              {promoMessage && (
                <p className={`mt-3 text-[10px] font-bold uppercase tracking-tight px-4 py-2 rounded-xl ${promoMessage.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800'}`}>
                  {promoMessage.text}
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Сотрудники</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{users.length}</span>
                  <span className="text-sm font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400">/ {planLimits.maxUsers}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${users.length / planLimits.maxUsers > 0.9 ? 'bg-red-500' : 'bg-blue-600'}`} 
                    style={{ width: `${Math.min((users.length / planLimits.maxUsers) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Оборудование</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{machines.length}</span>
                  <span className="text-sm font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400">/ {planLimits.maxMachines}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${machines.length / planLimits.maxMachines > 0.9 ? 'bg-red-500' : 'bg-blue-600'}`} 
                    style={{ width: `${Math.min((machines.length / planLimits.maxMachines) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Функционал</p>
                <div className="space-y-2 mt-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${planLimits.features.photoCapture ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                    <span className={`text-[10px] font-bold uppercase ${planLimits.features.photoCapture ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 dark:text-slate-400'}`}>Фотофиксация</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${planLimits.features.nightShift ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                    <span className={`text-[10px] font-bold uppercase ${planLimits.features.nightShift ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 dark:text-slate-400'}`}>Ночные смены</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${planLimits.features.advancedAnalytics ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                    <span className={`text-[10px] font-bold uppercase ${planLimits.features.advancedAnalytics ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 dark:text-slate-400'}`}>Аналитика</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${planLimits.features.payroll ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                    <span className={`text-[10px] font-bold uppercase ${planLimits.features.payroll ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 dark:text-slate-400'}`}>Зарплата</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${planLimits.features.shiftMonitoring ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                    <span className={`text-[10px] font-bold uppercase ${planLimits.features.shiftMonitoring ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 dark:text-slate-400'}`}>Мониторинг</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20">
          <h3 className="font-black text-slate-900 dark:text-slate-100 mb-6 uppercase text-xs tracking-widest underline decoration-blue-500 decoration-4 underline-offset-8">Сформированные счета</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest">Номер</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest">Дата</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest">Сумма</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 text-xs font-bold text-slate-600 dark:text-slate-400">{inv.contractNumber}</td>
                    <td className="py-4 text-xs font-bold text-slate-600 dark:text-slate-400">{inv.date}</td>
                    <td className="py-4 text-xs font-black text-slate-900 dark:text-slate-100">{inv.amount} руб.</td>
                    <td className="py-4 text-xs font-bold text-slate-600 dark:text-slate-400">{inv.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[PlanType.FREE, PlanType.PRO, PlanType.BUSINESS].map((planType) => {
          const dynamicPlan = plans.find(p => p.type === planType);
          const limits = dynamicPlan ? dynamicPlan.limits : PLAN_LIMITS[planType];
          const isCurrent = currentOrg?.plan === planType;
          const isSelected = selectedPlan === planType;
          
          return (
            <div key={planType} className={`bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border-2 transition-all flex flex-col ${isCurrent || isSelected ? 'border-blue-600 shadow-2xl dark:shadow-slate-900/20 shadow-blue-50 dark:shadow-none' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter text-xl">{dynamicPlan?.name || planType}</h4>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">
                    {planType === PlanType.FREE ? 'Для малого бизнеса' : planType === PlanType.PRO ? 'Для растущих команд' : 'Для крупных предприятий'}
                  </p>
                </div>
                {isCurrent && <span className="text-[8px] font-black bg-blue-600 text-white px-2 py-1 rounded-full uppercase">Текущий</span>}
                {!isCurrent && isSelected && <span className="text-[8px] font-black bg-green-600 text-white px-2 py-1 rounded-full uppercase">Выбран</span>}
              </div>
              
              <div className="mb-8 space-y-4 flex-1">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{limits.maxUsers === 1000 ? 'Безлимитно' : `${limits.maxUsers} сотрудников`}</p>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase">Макс. пользователей</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 01-2-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{limits.maxMachines === 1000 ? 'Безлимитно' : `${limits.maxMachines} станков`}</p>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase">Оборудование</p>
                  </div>
                </div>

                <div className="pt-4 space-y-2 border-t border-slate-50 dark:border-slate-800">
                  {[
                    { label: 'Фотофиксация', enabled: limits.features.photoCapture },
                    { label: 'Ночные смены', enabled: limits.features.nightShift },
                    { label: 'Аналитика', enabled: limits.features.advancedAnalytics },
                    { label: 'Зарплата', enabled: limits.features.payroll },
                    { label: 'Мониторинг смен', enabled: limits.features.shiftMonitoring },
                    { label: 'Облачная синхронизация', enabled: true },
                    { label: 'Техподдержка 24/7', enabled: planType !== PlanType.FREE },
                  ].map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {feat.enabled ? (
                        <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                      ) : (
                        <svg className="w-3 h-3 text-slate-300 dark:text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                      )}
                      <span className={`text-[10px] font-bold uppercase ${feat.enabled ? 'text-slate-600 dark:text-slate-400' : 'text-slate-300 dark:text-slate-600 dark:text-slate-300 line-through'}`}>{feat.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <button 
                disabled={isCurrent || isProcessingPayment === planType || planType === PlanType.FREE}
                onClick={() => handlePlanAction(planType as PlanType, 'grid')}
                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${isCurrent || planType === PlanType.FREE ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 dark:text-slate-400 cursor-default' : isSelected ? 'bg-green-600 text-white shadow-xl' : 'bg-slate-900 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 shadow-xl dark:shadow-slate-900/20 shadow-slate-100 dark:shadow-none hover:shadow-blue-100 active:scale-95'}`}
              >
                {isCurrent ? 'Ваш тариф' : isSelected ? 'Выбран' : isProcessingPayment === planType ? 'Загрузка...' : 'Выбрать тариф'}
              </button>
            </div>
          );
        })}
      </div>

      {showPaymentOptions && paymentBlockSource === 'grid' && (
        <div className="mt-8 animate-fadeIn">
          {renderPaymentOptions()}
        </div>
      )}

      {paymentHistory.length > 0 && (
        <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 mt-8">
          <h3 className="font-black text-slate-900 dark:text-slate-100 mb-6 uppercase text-xs tracking-widest underline decoration-blue-500 decoration-4 underline-offset-8">История платежей</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest">Дата</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest">Тариф</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest">Сумма</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-widest">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {paymentHistory.map((payment, idx) => (
                  <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 text-xs font-bold text-slate-600 dark:text-slate-400">
                      {format(new Date(payment.created_at), 'dd.MM.yyyy HH:mm')}
                    </td>
                    <td className="py-4">
                      <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg uppercase tracking-widest border border-blue-100 dark:border-blue-800">
                        {payment.plan_type}
                      </span>
                    </td>
                    <td className="py-4 text-xs font-black text-slate-900 dark:text-slate-100">
                      {payment.amount} {payment.currency || 'RUB'}
                    </td>
                    <td className="py-4">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border ${
                        payment.status === 'completed' 
                          ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' 
                          : 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800'
                      }`}>
                        {payment.status === 'completed' ? 'Успешно' : 'В обработке'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showInvoiceModal && currentInvoice && (
        <Modal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          title="Печатная форма счета"
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-auto max-h-[60vh]">
              <div id="printable-invoice">
                <InvoiceTemplate 
                  invoice={currentInvoice} 
                  org={currentOrg!} 
                  recipient={receivingOrgs.find(o => o.isDefault) || receivingOrgs[0] || {
                    id: 'default',
                    name: 'ООО "Ворк Трекер"',
                    abbreviation: 'ВТ',
                    requisites: { inn: '1234567890', kpp: '123456789', address: 'г. Москва', bankDetails: 'Р/С 123...' },
                    isDefault: true
                  }} 
                />
                {/* Visual version for the modal since InvoiceTemplate is hidden print:block */}
                <div className="text-slate-900 dark:text-slate-100">
                  <h2 className="text-xl font-black mb-4 uppercase tracking-tight">Счёт №{currentInvoice.contractNumber}</h2>
                  <div className="grid grid-cols-2 gap-8 mb-8 text-xs">
                    <div>
                      <h4 className="font-black text-slate-400 uppercase mb-1">Поставщик:</h4>
                      <p className="font-bold">{(receivingOrgs.find(o => o.isDefault) || receivingOrgs[0])?.name || 'ООО "Ворк Трекер"'}</p>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-400 uppercase mb-1">Плательщик:</h4>
                      <p className="font-bold">{currentOrg?.clientRequisites?.name || currentOrg?.name}</p>
                    </div>
                  </div>
                  <table className="w-full text-xs mb-8 border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-200 dark:border-slate-700 text-left">
                        <th className="py-2 font-black uppercase">Наименование</th>
                        <th className="py-2 font-black uppercase text-right">Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-4 font-bold">Тариф {currentInvoice.planType} ({currentInvoice.termMonths} мес.)</td>
                        <td className="py-4 font-black text-right">{currentInvoice.amount} руб.</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="text-right">
                    <p className="text-2xl font-black text-blue-600">{currentInvoice.amount} руб.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3 justify-end">
              <button 
                onClick={() => window.print()}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all"
              >
                Распечатать
              </button>
              <button 
                onClick={() => handleInvoiceGeneration(currentInvoice.planType, 'pdf')}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all"
              >
                PDF
              </button>
              <button 
                onClick={() => handleInvoiceGeneration(currentInvoice.planType, 'excel')}
                className="px-6 py-3 bg-green-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-green-700 transition-all"
              >
                Excel
              </button>
              <button 
                onClick={() => handleInvoiceGeneration(currentInvoice.planType, 'word')}
                className="px-6 py-3 bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-400 transition-all"
              >
                Word
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );

  function renderPaymentOptions() {
    if (!selectedPlan) return null;
    
    return (
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20">
        <h3 className="font-black text-slate-900 dark:text-slate-100 mb-6 uppercase text-xs tracking-widest underline decoration-blue-500 decoration-4 underline-offset-8">Параметры оплаты</h3>
        
        <div className="space-y-8">
          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Срок подписки: {subscriptionTerm} {subscriptionTerm === 1 ? 'месяц' : subscriptionTerm < 5 ? 'месяца' : 'месяцев'}</label>
              <span className="text-xl font-black text-blue-600 dark:text-blue-400">{subscriptionTerm} мес.</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="12" 
              step="1"
              value={subscriptionTerm} 
              onChange={(e) => setSubscriptionTerm(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between mt-4 px-1 gap-2">
              {[1, 3, 6, 12].map(m => (
                <button 
                  key={m} 
                  onClick={() => setSubscriptionTerm(m)} 
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${
                    subscriptionTerm === m 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none' 
                      : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-blue-200 dark:hover:border-blue-900 hover:text-blue-600'
                  }`}
                >
                  {m} {m === 1 ? 'мес' : m < 5 ? 'мес' : 'мес'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Итого к оплате за {selectedPlan}</p>
                <p className="text-3xl font-black text-slate-900 dark:text-slate-100">{(selectedPlan === PlanType.PRO ? 1500 : 5000) * subscriptionTerm} руб.</p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={() => setModalConfig({
                    isOpen: true,
                    title: 'Подтверждение оплаты',
                    message: `Вы уверены, что хотите оплатить тариф ${selectedPlan} на ${subscriptionTerm} мес. онлайн?`,
                    onConfirm: () => handleOnlinePayment(selectedPlan!)
                  })}
                  disabled={isProcessingPayment === selectedPlan}
                  className="px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100 dark:shadow-none hover:bg-blue-700 transition-all active:scale-95"
                >
                  {isProcessingPayment === selectedPlan ? 'Загрузка...' : 'Онлайн оплата'}
                </button>
                
                <button 
                  onClick={() => handleInvoiceGeneration(selectedPlan!)}
                  className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2"
                >
                  Сформировать счёт
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
};

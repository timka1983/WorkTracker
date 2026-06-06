import React, { useState, useEffect } from 'react';
import { User, WorkLog, Machine, Organization, Branch, ChatMessage } from '../../types';
import { format } from 'date-fns';
import { formatTime, formatDurationShort } from '../../utils';
import { db, supabase } from '../../lib/supabase';
import { STORAGE_KEYS } from '../../constants';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface AnalyticsViewProps {
  dashboardStats: any;
  users: User[];
  machines: Machine[];
  userPerms: any;
  handleForceFinish: (log: WorkLog) => void;
  branches: Branch[];
  onEditLog: (log: WorkLog) => void;
  onEmployeeLateClick: (userId: string) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  dashboardStats,
  users,
  machines,
  userPerms,
  handleForceFinish,
  branches,
  onEditLog,
  onEmployeeLateClick
}) => {
  const [recentMessages, setRecentMessages] = useState<ChatMessage[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ANALYTICS_EXPANDED);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse expanded sections', e);
      }
    }
    return {
      active: true,
      finished: true,
      late: true,
      absence: true,
      chat: true,
      sick: true
    };
  });

  const toggleSection = (section: string) => {
    const next = { ...expandedSections, [section]: !expandedSections[section] };
    setExpandedSections(next);
    localStorage.setItem(STORAGE_KEYS.ANALYTICS_EXPANDED, JSON.stringify(next));
  };

  useEffect(() => {
    const orgId = localStorage.getItem(STORAGE_KEYS.ORG_ID);
    if (!orgId) return;

    const fetchMessages = async () => {
      const messages = await db.getChatMessages(orgId);
      // get last 5
      setRecentMessages(messages.slice(-5));
    };

    fetchMessages();

    const channel = supabase
      .channel(`analytics_chat_${orgId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `organization_id=eq.${orgId}`
      }, (payload) => {
        fetchMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-8 no-print">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
         <div className="space-y-6">
            {/* Внутренний чат (Moved Up) */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20">
               <div className="flex items-center justify-between mb-4">
                 <button 
                   onClick={() => toggleSection('chat')}
                   className="flex-1 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity py-2"
                 >
                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                       Внутренний чат
                   </h3>
                   {expandedSections.chat ? <ChevronUp size={24} className="text-blue-500 stroke-[3px]" /> : <ChevronDown size={24} className="text-blue-500 stroke-[3px]" />}
                 </button>
                 <button 
                   onClick={() => window.dispatchEvent(new CustomEvent('open-employee-chat'))}
                   className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 px-3 py-1.5 rounded-xl ml-2"
                 >
                   Открыть
                 </button>
               </div>
               
               <AnimatePresence initial={false}>
                 {expandedSections.chat && (
                   <motion.div 
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: 'auto', opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     transition={{ duration: 0.3, ease: 'easeInOut' }}
                     className="space-y-3 overflow-hidden"
                   >
                     {recentMessages.length > 0 ? recentMessages.map((msg) => (
                       <div key={msg.id} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                         <div className="flex justify-between items-baseline mb-1">
                           <span className="text-[10px] font-bold text-slate-900 dark:text-slate-100 truncate pr-2">{msg.senderName}</span>
                           <span className="text-[9px] text-slate-400 whitespace-nowrap">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                         </div>
                         <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">{msg.isDeleted ? <em className="text-slate-400">Сообщение удалено</em> : msg.message}</p>
                       </div>
                     )) : (
                       <p className="text-xs text-slate-400 italic text-center py-6">Нет сообщений</p>
                     )}
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>

            {/* Сейчас в работе */}
            <div className="space-y-4">
               <button 
                 onClick={() => toggleSection('active')}
                 className="w-full flex items-center justify-between px-2 cursor-pointer hover:opacity-80 transition-opacity py-2"
               >
                  <div className="flex items-center gap-2">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Сейчас в работе</h3>
                    {expandedSections.active ? <ChevronUp size={24} className="text-blue-500 stroke-[3px]" /> : <ChevronDown size={24} className="text-blue-500 stroke-[3px]" />}
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] font-black text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full border border-green-100 dark:border-green-900/30">
                       {new Set(dashboardStats.activeShifts.map((s: WorkLog) => s.userId)).size} чел.
                     </span>
                     <span className="flex h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse"></span>
                  </div>
               </button>
               
               <AnimatePresence initial={false}>
                 {expandedSections.active && (
                   <motion.div 
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: 'auto', opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     transition={{ duration: 0.3, ease: 'easeInOut' }}
                     className="space-y-3 overflow-hidden"
                   >
                      {dashboardStats.activeShifts.length > 0 ? dashboardStats.activeShifts.map((s: WorkLog) => {
                         const emp = users.find(u => u.id === s.userId);
                         const machine = machines.find(m => m.id === s.machineId);
                         const machineName = machine?.name || 'Работа';
                         const isOld = s.date !== dashboardStats.todayStr;
                         
                         return (
                           <div 
                             key={s.id} 
                             onClick={() => onEditLog(s)}
                             className={`group/item relative bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all shadow-md dark:shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-lg dark:hover:shadow-[0_0_25px_rgba(255,255,255,0.1)] cursor-pointer ${isOld ? 'border-red-200 bg-red-50/30 dark:border-red-900/50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-800'}`}>
                              <div className="flex justify-between items-start mb-3">
                                 <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                       <span className={`text-sm font-bold truncate ${isOld ? 'text-red-900 dark:text-red-200' : 'text-slate-900 dark:text-slate-100'}`}>
                                         {emp?.name}
                                       </span>
                                       {emp?.isArchived && <span className="flex-shrink-0 text-[8px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-full">Архив</span>}
                                    </div>
                                    <div className="flex flex-col gap-0.5 mt-1">
                                       <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">{emp?.position}</span>
                                       <div className="flex items-center gap-1.5">
                                         <span className={`text-[10px] font-black uppercase tracking-tight ${isOld ? 'text-red-500' : 'text-blue-500'}`}>
                                           {machineName}
                                         </span>
                                         {emp?.branchId && branches.find(b => b.id === emp.branchId) && (
                                           <span className="text-[9px] text-slate-400 font-bold uppercase">
                                             • {branches.find(b => b.id === emp.branchId)?.name}
                                           </span>
                                         )}
                                       </div>
                                    </div>
                                 </div>
                                 <div className="text-right shrink-0">
                                    <div className={`text-xs font-black px-2 py-1 rounded-lg border ${isOld ? 'text-red-600 dark:text-red-400 border-red-200 bg-white dark:bg-slate-900 dark:border-red-900/50' : 'text-blue-600 dark:text-blue-400 border-blue-100 bg-blue-50/50 dark:border-blue-900/30 dark:bg-blue-900/20'}`}>
                                       {formatTime(s.checkIn)}
                                    </div>
                                    {isOld && (
                                      <div className="text-[8px] font-black text-red-600 dark:text-red-400 uppercase mt-1 tracking-tighter">
                                        Начало: {format(new Date(s.date), 'dd.MM')}
                                      </div>
                                    )}
                                 </div>
                              </div>
       
                              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                                 <div className="flex items-center gap-1.5">
                                    {s.isNightShift && (
                                      <div className="flex items-center gap-1 text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded-md">
                                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>
                                        Ночь
                                      </div>
                                    )}
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">В работе</span>
                                 </div>
                                 
                                 {userPerms.isFullAdmin && (
                                   <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleForceFinish(s);
                                      }}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isOld ? 'bg-red-600 text-white hover:bg-red-700 shadow-xl dark:shadow-slate-900/20 shadow-red-100 dark:shadow-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:text-red-400'}`}
                                   >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                      Стоп
                                   </button>
                                 )}
                              </div>
                           </div>
                         );
                      }) : (
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                           <p className="text-xs text-slate-400 font-medium italic">Все отдыхают</p>
                        </div>
                      )}
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>
         </div>
         
         {/* Смена (Завершено) */}
         <div className="space-y-4">
            <button 
              onClick={() => toggleSection('finished')}
              className="w-full flex items-center justify-between px-2 cursor-pointer hover:opacity-80 transition-opacity py-2"
            >
               <div className="flex items-center gap-2">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Смена (Завершено)</h3>
                 {expandedSections.finished ? <ChevronUp size={24} className="text-blue-500 stroke-[3px]" /> : <ChevronDown size={24} className="text-blue-500 stroke-[3px]" />}
               </div>
               <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                 {new Set(dashboardStats.finishedToday.map((s: WorkLog) => s.userId)).size} чел.
               </span>
            </button>

            <AnimatePresence initial={false}>
              {expandedSections.finished && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="space-y-3 overflow-hidden"
                >
                   {dashboardStats.finishedToday.length > 0 ? dashboardStats.finishedToday.map((s: any) => {
                      const emp = users.find(u => u.id === s.userId);
                      return (
                        <div key={s.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 hover:shadow-lg transition-all">
                           <div className="flex justify-between items-start mb-3">
                              <div className="min-w-0 flex-1">
                                 <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{emp?.name}</span>
                                    {emp?.isArchived && <span className="flex-shrink-0 text-[8px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-full">Архив</span>}
                                 </div>
                                 <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">
                                       {formatTime(s.checkIn)} — {formatTime(s.checkOut)}
                                    </span>
                                 </div>
                              </div>
                              <div className="text-right shrink-0">
                                 <div className="text-xs font-black text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                                    {formatDurationShort(s.durationMinutes)}
                                 </div>
                              </div>
                           </div>
                           
                           <div className="flex items-center gap-1.5 pt-3 border-t border-slate-50 dark:border-slate-800">
                              {s.isNightShift && (
                                <div className="flex items-center gap-1 text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded-md">
                                   <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>
                                   Ночь
                                </div>
                              )}
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Завершено</span>
                           </div>
                        </div>
                      );
                   }) : (
                     <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                        <p className="text-xs text-slate-400 font-medium italic">Нет завершенных смен</p>
                     </div>
                   )}
                </motion.div>
              )}
            </AnimatePresence>
         </div>

         <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20">
               <button 
                 onClick={() => toggleSection('late')}
                 className="w-full flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity py-2"
               >
                 <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Опоздания</h3>
                    {expandedSections.late ? <ChevronUp size={24} className="text-blue-500 stroke-[3px]" /> : <ChevronDown size={24} className="text-blue-500 stroke-[3px]" />}
                 </div>
               </button>
               
               <AnimatePresence initial={false}>
                 {expandedSections.late && (
                   <motion.div 
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: 'auto', opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     transition={{ duration: 0.3, ease: 'easeInOut' }}
                     className="mt-4 space-y-4 overflow-hidden"
                   >
                      <div>
                         <p className="text-[9px] font-black text-red-600 dark:text-red-400 uppercase mb-2">Сегодня</p>
                         <div className="space-y-1">
                            {dashboardStats.lateTodayEmployees?.length > 0 ? dashboardStats.lateTodayEmployees.map((e: any) => (
                              <div key={e.id} onClick={() => onEmployeeLateClick(e.id)} className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer hover:text-blue-600 truncate">{e.name}</div>
                            )) : <div className="text-xs text-slate-400 italic">Нет</div>}
                         </div>
                      </div>
                      <div>
                         <p className="text-[9px] font-black text-red-600 dark:text-red-400 uppercase mb-2">Неделя</p>
                         <div className="space-y-1">
                            {dashboardStats.lateWeekEmployees?.length > 0 ? dashboardStats.lateWeekEmployees.map((e: any) => (
                              <div key={e.id} onClick={() => onEmployeeLateClick(e.id)} className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer hover:text-blue-600 truncate">{e.name} - {e.count} дн.</div>
                            )) : <div className="text-xs text-slate-400 italic">Нет</div>}
                         </div>
                      </div>
                      <div>
                         <p className="text-[9px] font-black text-red-600 dark:text-red-400 uppercase mb-2">Топ Месяц</p>
                         <div className="space-y-1">
                            {dashboardStats.lateMonthEmployees?.length > 0 ? dashboardStats.lateMonthEmployees.map((e: any) => (
                              <div key={e.id} onClick={() => onEmployeeLateClick(e.id)} className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer hover:text-blue-600 truncate">{e.name} - {e.count} дн.</div>
                            )) : <div className="text-xs text-slate-400 italic">Нет</div>}
                         </div>
                      </div>
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20">
               <button 
                 onClick={() => toggleSection('sick')}
                 className="w-full flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity py-2"
               >
                 <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Болеют / Отпуск (Сегодня)</h3>
                    {expandedSections.sick ? <ChevronUp size={24} className="text-blue-500 stroke-[3px]" /> : <ChevronDown size={24} className="text-blue-500 stroke-[3px]" />}
                 </div>
               </button>
               
               <AnimatePresence initial={false}>
                 {expandedSections.sick && (
                   <motion.div 
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: 'auto', opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     transition={{ duration: 0.3, ease: 'easeInOut' }}
                     className="mt-4 space-y-2 overflow-hidden"
                   >
                      {dashboardStats.sickOrVacationToday.length > 0 ? dashboardStats.sickOrVacationToday.map((u: User) => (
                        <div key={u.id} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                           <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-xs">{u.name.charAt(0)}</div>
                           <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{u.name}</p>
                        </div>
                      )) : <p className="text-xs text-slate-400 italic text-center py-4">Все на месте</p>}
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20">
               <button 
                 onClick={() => toggleSection('absence')}
                 className="w-full flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity py-2"
               >
                 <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Топ пропусков</h3>
                    {expandedSections.absence ? <ChevronUp size={24} className="text-blue-500 stroke-[3px]" /> : <ChevronDown size={24} className="text-blue-500 stroke-[3px]" />}
                 </div>
               </button>
               
               <AnimatePresence initial={false}>
                 {expandedSections.absence && (
                   <motion.div 
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: 'auto', opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     transition={{ duration: 0.3, ease: 'easeInOut' }}
                     className="mt-4 space-y-4 overflow-hidden"
                   >
                      {dashboardStats.absenceCounts.length > 0 ? dashboardStats.absenceCounts.map((a: any, i: number) => (
                        <div key={i} className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-center font-black text-xs">{i+1}</div>
                           <div className="flex-1">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{a.name}</p>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-1 overflow-hidden">
                                 <div className="bg-red-500 h-full rounded-full" style={{ width: `${Math.min((a.count / 10) * 100, 100)}%` }}></div>
                              </div>
                           </div>
                           <span className="text-[10px] font-black text-slate-400 tabular-nums">{a.count} дн.</span>
                        </div>
                      )) : <p className="text-xs text-slate-400 italic text-center py-4">Без пропусков в этом месяце</p>}
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>
         </div>
      </div>

      {/* Средняя выработка (Moved to bottom) */}
      <div className="bg-slate-900 dark:bg-slate-950 p-8 rounded-[2.5rem] text-white shadow-2xl dark:shadow-slate-900/40 shadow-slate-200 dark:shadow-none border border-slate-800 dark:border-slate-800 relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-125 transition-transform duration-500">
            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
         </div>
         <div className="relative z-10">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Средняя выработка (Последние 7 дней)</h3>
           <div className="flex items-baseline gap-3">
              <span className="text-6xl font-black tabular-nums tracking-tighter">{dashboardStats.avgWeeklyHours.toFixed(1)}</span>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-400 uppercase leading-none">часов</span>
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">в среднем за день</span>
              </div>
           </div>
         </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Machine, PositionConfig, PlanLimits, Organization, FIXED_POSITION_TURNER, Branch } from '../../types';
import { DEFAULT_PERMISSIONS } from '../../constants';
import { db } from '../../lib/supabase';
import { getTelegramUrl } from '../../lib/telegram';
import { BranchEditModal } from './BranchEditModal';
import { Archive, Settings, Check } from 'lucide-react';
import { ArchiveConfirmModal, ArchiveViewModal } from './ArchiveModals';
import MapModal from './MapModal';
import { useConfirm } from '../../contexts/ConfirmContext';

interface SettingsViewProps {
  planLimits: PlanLimits;
  nightShiftBonusMinutes: number;
  onUpdateNightBonus: (minutes: number) => void;
  currentOrg: Organization | null;
  onUpdateOrg: (org: Organization) => void;
  machines: Machine[];
  isMachineLimitReached: boolean;
  newMachineName: string;
  setNewMachineName: (name: string) => void;
  handleUpdateMachinesList: (machines: Machine[], deletedMachineInfo?: { id: string, reason: string }[]) => void;
  editingMachineId: string | null;
  setEditingMachineId: (id: string | null) => void;
  editingMachineBranchId?: string;
  setEditingMachineBranchId?: (id: string | undefined) => void;
  editValue: string;
  setEditValue: (value: string) => void;
  saveMachineEdit: (id: string) => void;
  positions: PositionConfig[];
  newPositionName: string;
  setNewPositionName: (name: string) => void;
  onUpdatePositions: (positions: PositionConfig[]) => void;
  editingPositionName: string | null;
  setEditingPositionName: (name: string | null) => void;
  savePositionEdit: (name: string) => void;
  setConfiguringPosition: (pos: PositionConfig) => void;
  handleExportAll: () => void;
  handleFileImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  branches: Branch[];
  onUpdateBranches: (branch: Branch) => void;
  onDeleteBranch: (branchId: string) => void;
  newMachineBranchId?: string;
  setNewMachineBranchId?: (id: string) => void;
  getArchivedMachines: () => Promise<Machine[] | null>;
  handleRestoreMachine: (id: string) => Promise<{ error: any }>;
  setViewMode?: (mode: 'billing') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  planLimits,
  nightShiftBonusMinutes,
  onUpdateNightBonus,
  currentOrg,
  onUpdateOrg,
  machines,
  isMachineLimitReached,
  newMachineName,
  setNewMachineName,
  handleUpdateMachinesList,
  editingMachineId,
  setEditingMachineId,
  editingMachineBranchId,
  setEditingMachineBranchId,
  editValue,
  setEditValue,
  saveMachineEdit,
  positions,
  newPositionName,
  setNewPositionName,
  onUpdatePositions,
  editingPositionName,
  setEditingPositionName,
  savePositionEdit,
  setConfiguringPosition,
  handleExportAll,
  handleFileImport,
  branches,
  onUpdateBranches,
  onDeleteBranch,
  newMachineBranchId,
  setNewMachineBranchId,
  getArchivedMachines,
  handleRestoreMachine,
  setViewMode
}) => {
  const { confirm } = useConfirm();
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<{ isOpen: boolean; machineId: string; machineName: string }>({
    isOpen: false,
    machineId: '',
    machineName: ''
  });
  const [isArchiveViewOpen, setIsArchiveViewOpen] = useState(false);

  const handleSaveBranch = (branch: Branch) => {
    onUpdateBranches(branch);
  };

  const handleConfirmArchive = (reason: string) => {
    handleUpdateMachinesList(
      machines.filter(m => m.id !== archiveConfirm.machineId),
      [{ id: archiveConfirm.machineId, reason }]
    );
    setArchiveConfirm({ isOpen: false, machineId: '', machineName: '' });
  };

  return (
    <div className="space-y-8 no-print">
      {editingBranch !== undefined && (
        <BranchEditModal 
          editingBranch={editingBranch} 
          setEditingBranch={setEditingBranch} 
          onSave={handleSaveBranch} 
        />
      )}

      <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 relative overflow-hidden">
         <h3 className="font-black text-slate-900 dark:text-slate-50 mb-6 flex items-center gap-2 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Филиалы</h3>
         
         <div className="flex justify-end mb-6">
            <button 
              onClick={() => {
                if (!planLimits.features.multipleBranches && branches.length >= 1) {
                  alert('В вашем тарифе доступен только 1 филиал. Перейдите на тариф PRO или BUSINESS для добавления новых филиалов.');
                  return;
                }
                setEditingBranch({ id: crypto.randomUUID(), organizationId: currentOrg?.id || '', name: '' });
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase hover:bg-blue-700 transition-all shadow-2xl dark:shadow-slate-900/20 shadow-blue-200"
            >
              Добавить филиал
            </button>
         </div>

         <div className="space-y-3">
            {branches.length === 0 ? (
              <div className="text-center p-8 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-slate-400 font-bold text-sm">Филиалы не добавлены</p>
                <p className="text-xs text-slate-400 mt-1">Добавьте филиалы, чтобы разделять сотрудников и настройки по локациям</p>
              </div>
            ) : (
              branches.map(branch => (
                <div key={branch.id} className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg dark:shadow-slate-900/20 transition-all group">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{branch.name}</h4>
                    {branch.address && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{branch.address}</p>}
                    {branch.locationSettings && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-blue-500 font-bold uppercase tracking-wide">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Геолокация настроена
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setEditingBranch(branch)}
                      className="p-2 text-slate-400 hover:text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button 
                      onClick={() => onDeleteBranch(branch.id)}
                      className="p-2 text-slate-400 hover:text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
         </div>
      </section>
      <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 relative overflow-hidden">
        <h3 className="font-black text-slate-900 dark:text-slate-50 mb-6 flex items-center gap-2 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Автоматическое завершение смены</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          Система автоматически отслеживает просроченные смены. Если смена не закрыта вовремя, включается трехэтапный контроль:
          <br/><b className="text-slate-900 dark:text-white">1-й интервал:</b> При превышении лимита времени на заданное количество минут система проверяет геопозицию. Если сотрудник вне зоны — смена завершается принудительно. Если в зоне — отправляется уведомление.
          <br/><b className="text-slate-900 dark:text-white">2-й интервал:</b> Через указанное время после первого этапа система снова проверяет геопозицию. Если сотрудник вне зоны — смена завершается принудительно.
          <br/><b className="text-slate-900 dark:text-white">3-й интервал:</b> Еще через указанное время система принудительно завершает смену в любом случае.
        </p>
        <div className="space-y-4">
          <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all">
            <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">Включить авто-завершение</p>
            <input 
              type="checkbox" 
              checked={currentOrg?.autoShiftCompletion?.enabled || false}
              onChange={(e) => {
                const newSettings = {
                  ...(currentOrg?.autoShiftCompletion || { enabled: false, firstAlertMinutes: 15, secondAlertMinutes: 5, thirdAlertMinutes: 5 }),
                  enabled: e.target.checked
                };
                if (currentOrg) {
                  onUpdateOrg({ ...currentOrg, autoShiftCompletion: newSettings });
                  db.updateOrganization(currentOrg.id, { autoShiftCompletion: newSettings });
                }
              }}
              className="w-4 h-4 rounded accent-blue-600"
            />
          </label>
          {currentOrg?.autoShiftCompletion?.enabled && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'firstAlertMinutes', label: '1-й интервал (мин)' },
                { key: 'secondAlertMinutes', label: '2-й интервал (мин)' },
                { key: 'thirdAlertMinutes', label: '3-й интервал (мин)' }
              ].map((field) => (
                <div key={field.key}>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{field.label}</label>
                  <input 
                    type="number"
                    value={(currentOrg.autoShiftCompletion as any)?.[field.key] || 0}
                    onChange={(e) => {
                      const newSettings = {
                        ...currentOrg.autoShiftCompletion!,
                        [field.key]: parseInt(e.target.value)
                      };
                      onUpdateOrg({ ...currentOrg, autoShiftCompletion: newSettings });
                      db.updateOrganization(currentOrg.id, { autoShiftCompletion: newSettings });
                    }}
                    className="w-full border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 relative overflow-hidden">
        {!planLimits.features.nightShift && (
           <div className="absolute inset-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-[2px] z-10 flex items-center justify-center cursor-help" onClick={() => alert('Ночная смена доступна в PRO тарифе')}>
              <span className="bg-blue-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-2xl dark:shadow-slate-900/20">Разблокировать в PRO</span>
           </div>
        )}
        <h3 className="font-black text-slate-900 dark:text-slate-50 mb-6 flex items-center gap-2 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Параметры смен</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="space-y-4">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Бонус за ночную смену (%)</label>
                 <div className="flex items-center gap-4">
                    <input 
                       type="number" 
                       min="0"
                       max="100"
                       value={nightShiftBonusMinutes} 
                       onChange={e => onUpdateNightBonus(parseInt(e.target.value || '0'))}
                       className="w-24 border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-2xl px-4 py-3 text-sm font-bold text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500 transition-all"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium italic leading-tight">
                       Процент времени, добавляемый к длительности ночной смены. Например, 20% превратит 10 часов работы в 12 часов (10ч + 2ч бонуса).
                    </span>
                 </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={currentOrg?.autoNightShift || false}
                      onChange={async (e) => {
                        const val = e.target.checked;
                        if (currentOrg) {
                          onUpdateOrg({ ...currentOrg, autoNightShift: val });
                          await db.updateOrganization(currentOrg.id, { autoNightShift: val });
                        }
                      }}
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${currentOrg?.autoNightShift ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${currentOrg?.autoNightShift ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">Автоматическое определение ночной смены</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">Система сама рассчитает ночные часы, если отработано более 1 часа</p>
                  </div>
                </label>
                
                {currentOrg?.autoNightShift && (
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Начало ночи</label>
                      <input 
                        type="time" 
                        value={currentOrg?.nightShiftStart || '22:00'}
                        onChange={async (e) => {
                          const val = e.target.value;
                          if (currentOrg) {
                            onUpdateOrg({ ...currentOrg, nightShiftStart: val });
                            await db.updateOrganization(currentOrg.id, { nightShiftStart: val });
                          }
                        }}
                        className="w-full border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Конец ночи</label>
                      <input 
                        type="time" 
                        value={currentOrg?.nightShiftEnd || '06:00'}
                        onChange={async (e) => {
                          const val = e.target.value;
                          if (currentOrg) {
                            onUpdateOrg({ ...currentOrg, nightShiftEnd: val });
                            await db.updateOrganization(currentOrg.id, { nightShiftEnd: val });
                          }
                        }}
                        className="w-full border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Время начала смен</h4>
                <p className="text-[10px] text-slate-400">Используется для фиксации опозданий и аналитики.</p>
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map((shift) => (
                    <div key={shift} className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{shift} смена</label>
                      <input 
                        type="time" 
                        value={currentOrg?.[`shiftStart${shift}` as keyof Organization] !== undefined ? (currentOrg?.[`shiftStart${shift}` as keyof Organization] as string) : (shift === 1 ? '08:00' : shift === 2 ? '16:00' : '00:00')}
                        onChange={async (e) => {
                          const val = e.target.value;
                          if (currentOrg) {
                            const key = `shiftStart${shift}` as keyof Organization;
                            onUpdateOrg({ ...currentOrg, [key]: val });
                            await db.updateOrganization(currentOrg.id, { [key]: val });
                          }
                        }}
                        className="w-full border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                 <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all">
                   <div>
                     <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">Округление 15 минут</p>
                     <p className="text-[9px] text-slate-400">Если отработано до 15 минут сверх часа — округлять до часа. Если 16+ минут — считать как есть.</p>
                   </div>
                   <input 
                     type="checkbox" 
                     checked={currentOrg?.roundShiftMinutes || false}
                     onChange={async (e) => {
                       if (currentOrg) {
                         const val = e.target.checked;
                         const updatedOrg = { ...currentOrg, roundShiftMinutes: val };
                         onUpdateOrg(updatedOrg);
                         try {
                           const { error } = await db.updateOrganization(currentOrg.id, { roundShiftMinutes: val });
                           if (error) throw error;
                         } catch (err: any) {
                           alert('Ошибка сохранения: ' + (err.message || err));
                           // Revert on error
                           onUpdateOrg({ ...currentOrg, roundShiftMinutes: !val });
                         }
                       }
                     }}
                     className="w-4 h-4 rounded accent-blue-600"
                   />
                 </label>
              </div>
              
              <button 
                onClick={async () => {
                  if (currentOrg) {
                    try {
                      await db.updateOrganization(currentOrg.id, {
                        nightShiftBonus: nightShiftBonusMinutes,
                        autoNightShift: currentOrg.autoNightShift,
                        nightShiftStart: currentOrg.nightShiftStart,
                        nightShiftEnd: currentOrg.nightShiftEnd,
                        shiftStart1: currentOrg.shiftStart1,
                        shiftStart2: currentOrg.shiftStart2,
                        shiftStart3: currentOrg.shiftStart3,
                        roundShiftMinutes: currentOrg.roundShiftMinutes
                      });
                      alert('Параметры смен успешно сохранены!');
                    } catch (err: any) {
                      alert('Ошибка при сохранении: ' + (err.message || err));
                    }
                  }
                }}
                className="mt-6 w-full py-3 bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 transition-all active:scale-95 shadow-lg shadow-blue-500/30"
              >
                Сохранить параметры смен
              </button>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Push-уведомления администратора</label>
              <div className="space-y-2">
                {[
                  { key: 'onShiftStart', label: 'Начало смены', desc: 'Уведомлять, когда сотрудник приступает к работе' },
                  { key: 'onShiftEnd', label: 'Конец смены', desc: 'Уведомлять о завершении работы' },
                  { key: 'onOvertime', label: 'Превышение лимита', desc: 'Уведомлять, если смена длится дольше нормы' },
                ].map(pref => (
                  <label key={pref.key} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all">
                    <div>
                      <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">{pref.label}</p>
                      <p className="text-[9px] text-slate-400">{pref.desc}</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={(currentOrg?.notificationSettings as any)?.[pref.key] || false}
                      onChange={(e) => {
                        const settings = {
                          ...(currentOrg?.notificationSettings || { onShiftStart: false, onShiftEnd: false, onOvertime: false }),
                          [pref.key]: e.target.checked
                        };
                        if (currentOrg) {
                          const updatedOrg = { ...currentOrg, notificationSettings: settings };
                          onUpdateOrg(updatedOrg);
                          db.updateOrganization(currentOrg.id, { notificationSettings: settings }).then(({ error }) => {
                            if (error) {
                              console.error('Failed to save notification settings:', error);
                            }
                          }).catch(err => console.error('Error updating org:', err));
                        }
                      }}
                      className="w-4 h-4 rounded accent-blue-600"
                    />
                  </label>
                ))}
                <button 
                  onClick={async () => {
                    if ('Notification' in window) {
                      const permission = await Notification.requestPermission();
                      if (permission === 'granted') {
                        alert('Уведомления включены!');
                      }
                    } else {
                      alert('Ваш браузер не поддерживает Push-уведомления');
                    }
                  }}
                  className="w-full py-2 bg-slate-100 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Проверить разрешения браузера
                </button>

                <button 
                  onClick={() => {
                    alert('Закройте или сверните приложение сейчас. Уведомление придет через 5 секунд.');
                    setTimeout(async () => {
                      try {
                        const reg = await navigator.serviceWorker.ready;
                        await reg.showNotification('Тестовое уведомление', {
                          body: 'Это уведомление пришло когда приложение было свернуто.',
                          icon: '/icons/icon-192.png',
                          badge: '/icons/badge-72.png',
                          tag: 'test-push',
                          renotify: true
                        } as any);
                      } catch (e) {
                         console.error('Test notification failed', e);
                      }
                    }, 5000);
                  }}
                  className="w-full mt-2 py-2 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-200 transition-all border border-blue-200 dark:border-blue-800"
                >
                  Тест свернутого окна (5 сек)
                </button>
              </div>
           </div>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 relative overflow-hidden">
         <h3 className="font-black text-slate-900 dark:text-slate-50 mb-6 flex items-center gap-2 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Геолокация (Анти-фрод)</h3>
         
         <div className="space-y-6">
            <div className="flex items-center justify-between">
               <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Контроль местоположения</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Запретить начало смены вне рабочей зоны</p>
               </div>
               <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={currentOrg?.locationSettings?.enabled || false}
                    onChange={(e) => {
                       const newSettings = {
                          ...(currentOrg?.locationSettings || { latitude: 0, longitude: 0, radius: 100 }),
                          enabled: e.target.checked
                       };
                       if (currentOrg) {
                          onUpdateOrg({ ...currentOrg, locationSettings: newSettings });
                          db.updateOrganization(currentOrg.id, { locationSettings: newSettings });
                       }
                    }}
                  />
                  <div className="w-11 h-6 bg-slate-400 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-md border border-slate-500 dark:border-transparent"></div>
               </label>
            </div>

            {currentOrg?.locationSettings?.enabled && (
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fadeIn">
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Широта</label>
                     <input 
                        type="number" 
                        step="0.000001"
                        value={currentOrg.locationSettings.latitude}
                        onChange={(e) => {
                           const newSettings = { ...currentOrg.locationSettings!, latitude: parseFloat(e.target.value) };
                           onUpdateOrg({ ...currentOrg, locationSettings: newSettings });
                           db.updateOrganization(currentOrg.id, { locationSettings: newSettings });
                        }}
                        className="w-full border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                     />
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Долгота</label>
                     <input 
                        type="number" 
                        step="0.000001"
                        value={currentOrg.locationSettings.longitude}
                        onChange={(e) => {
                           const newSettings = { ...currentOrg.locationSettings!, longitude: parseFloat(e.target.value) };
                           onUpdateOrg({ ...currentOrg, locationSettings: newSettings });
                           db.updateOrganization(currentOrg.id, { locationSettings: newSettings });
                        }}
                        className="w-full border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                     />
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Радиус (метров)</label>
                     <input 
                        type="number" 
                        value={currentOrg.locationSettings.radius}
                        onChange={(e) => {
                           const newSettings = { ...currentOrg.locationSettings!, radius: parseInt(e.target.value) };
                           onUpdateOrg({ ...currentOrg, locationSettings: newSettings });
                           db.updateOrganization(currentOrg.id, { locationSettings: newSettings });
                        }}
                        className="w-full border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                     />
                  </div>
                  
                  <div className="md:col-span-3">
                     <button 
                        onClick={() => {
                           if ('geolocation' in navigator) {
                              navigator.geolocation.getCurrentPosition(
                                 (position) => {
                                    const newSettings = {
                                       ...currentOrg.locationSettings!,
                                       latitude: position.coords.latitude,
                                       longitude: position.coords.longitude
                                    };
                                    onUpdateOrg({ ...currentOrg, locationSettings: newSettings });
                                    db.updateOrganization(currentOrg.id, { locationSettings: newSettings });
                                    alert('Координаты обновлены!');
                                 },
                                 (error) => alert('Ошибка получения геопозиции: ' + error.message)
                              );
                           } else {
                              alert('Геолокация не поддерживается');
                           }
                        }}
                        className="w-full py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all flex items-center justify-center gap-2"
                     >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Установить текущее местоположение как рабочую зону
                     </button>
                  </div>
               </div>
            )}
         </div>
      </section>

      <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 relative overflow-hidden">
         <h3 className="font-black text-slate-900 dark:text-slate-50 mb-6 flex items-center gap-2 underline decoration-indigo-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Оформление и Темы</h3>
         
         <div className="mb-8 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between">
            <div>
               <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100">Применить тему для сотрудников</p>
               <p className="text-[10px] text-indigo-600 dark:text-indigo-400">Если выключено, сотрудники будут видеть стандартную или темную тему</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
               <input 
                 type="checkbox" 
                 className="sr-only peer"
                 checked={currentOrg?.applyThemeToEmployees || false}
                 onChange={(e) => {
                    if (currentOrg) {
                       const val = e.target.checked;
                       onUpdateOrg({ ...currentOrg, applyThemeToEmployees: val });
                       db.updateOrganization(currentOrg.id, { applyThemeToEmployees: val });
                    }
                 }}
               />
               <div className="w-11 h-6 bg-slate-400 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-md border border-slate-500 dark:border-transparent"></div>
            </label>
         </div>

         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
               { id: 'default', name: 'Стандартная', desc: 'Классический синий интерфейс', color: 'bg-slate-100' },
               { id: 'paper', name: 'Винтажная бумага', desc: 'Теплые тона и классический шрифт', color: 'bg-[#f9f4e8]' },
               { id: 'forest', name: 'Таинственный лес', desc: 'Глубокие зеленые тона природы', color: 'bg-[#1a2e1a]' },
               { id: 'cartoon', name: 'Мультфильм', desc: 'Яркие цвета и жирные контуры', color: 'bg-[#ffeb3b]' }
            ].map((theme) => (
               <button
                  key={theme.id}
                  onClick={() => {
                     if (currentOrg) {
                        const updatedOrg = { ...currentOrg, theme: theme.id as any };
                        onUpdateOrg(updatedOrg);
                        db.updateOrganization(currentOrg.id, { theme: theme.id as any });
                     }
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all text-left group relative overflow-hidden ${
                     (currentOrg?.theme || 'default') === theme.id 
                        ? 'border-indigo-600 ring-4 ring-indigo-50 dark:ring-indigo-900/20' 
                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                  }`}
               >
                  <div className={`w-full h-12 rounded-lg mb-3 ${theme.color} flex items-center justify-center`}>
                     <div className="w-1/2 h-2 bg-slate-300 dark:bg-slate-600 rounded-full opacity-50"></div>
                  </div>
                  <p className="font-black text-xs text-slate-900 dark:text-slate-50 uppercase tracking-wider">{theme.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{theme.desc}</p>
                  
                  {(currentOrg?.theme || 'default') === theme.id && (
                     <div className="absolute top-2 right-2 bg-indigo-600 text-white p-1 rounded-full">
                        <Check className="w-3 h-3" />
                     </div>
                  )}
               </button>
            ))}
         </div>
      </section>

      <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 relative overflow-hidden">
         <h3 className="font-black text-slate-900 dark:text-slate-50 mb-6 flex items-center gap-2 underline decoration-orange-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Сеть и Прокси</h3>
         <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
           Настройки прокси-серверов для стабильной работы в условиях ограниченного доступа к API Supabase и Telegram.
         </p>
         <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all">
               <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Прокси для Supabase</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Использовать встроенный прокси для запросов к базе данных</p>
               </div>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={currentOrg?.useSupabaseProxy || false}
                    onChange={(e) => {
                       if (currentOrg) {
                          const val = e.target.checked;
                          onUpdateOrg({ ...currentOrg, useSupabaseProxy: val });
                          db.updateOrganization(currentOrg.id, { useSupabaseProxy: val });
                          localStorage.setItem('use_supabase_proxy', String(val));
                          if (val !== (localStorage.getItem('use_supabase_proxy') === 'true')) {
                             // This is redundant but ensures local storage is updated
                          }
                       }
                    }}
                  />
                  <div className={`w-11 h-6 bg-slate-400 dark:bg-slate-600 border border-slate-500 dark:border-slate-500 rounded-full peer peer-checked:bg-blue-600 peer-checked:border-blue-700 transition-colors after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${currentOrg?.useSupabaseProxy ? 'after:translate-x-5' : ''}`}></div>
               </div>
            </label>

            <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all">
               <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Прокси для Telegram</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Использовать встроенный прокси для отправки уведомлений</p>
               </div>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={currentOrg?.useTelegramProxy || false}
                    onChange={(e) => {
                       if (currentOrg) {
                          const val = e.target.checked;
                          onUpdateOrg({ ...currentOrg, useTelegramProxy: val });
                          db.updateOrganization(currentOrg.id, { useTelegramProxy: val });
                          localStorage.setItem('use_telegram_proxy', String(val));
                       }
                    }}
                  />
                  <div className={`w-11 h-6 bg-slate-400 dark:bg-slate-600 border border-slate-500 dark:border-slate-500 rounded-full peer peer-checked:bg-blue-600 peer-checked:border-blue-700 transition-colors after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${currentOrg?.useTelegramProxy ? 'after:translate-x-5' : ''}`}></div>
               </div>
            </label>

            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30 font-mono">
               ⚠️ ВНИМАНИЕ: Изменение настройки прокси для Supabase требует перезагрузки страницы (F5) для применения изменений.
            </p>
         </div>
      </section>

      <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 relative overflow-hidden">
         <h3 className="font-black text-slate-900 dark:text-slate-50 mb-6 flex items-center gap-2 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Telegram Уведомления</h3>
         
         <div className="space-y-6">
            <div className="flex items-center justify-between">
               <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Интеграция с Telegram</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Получать уведомления о сменах в чат</p>
               </div>
               <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={currentOrg?.telegramSettings?.enabled || false}
                    onChange={(e) => {
                       const newSettings = {
                          ...(currentOrg?.telegramSettings || { botToken: '', chatId: '' }),
                          enabled: e.target.checked
                       };
                       if (currentOrg) {
                          onUpdateOrg({ ...currentOrg, telegramSettings: newSettings });
                          db.updateOrganization(currentOrg.id, { telegramSettings: newSettings });
                       }
                    }}
                  />
                  <div className="w-11 h-6 bg-slate-400 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-md border border-slate-500 dark:border-transparent"></div>
               </label>
            </div>

            {currentOrg?.telegramSettings?.enabled && (
               <div className="grid grid-cols-1 gap-4 animate-fadeIn">
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Bot Token</label>
                     <input 
                        type="text" 
                        value={currentOrg.telegramSettings.botToken}
                        onChange={(e) => {
                           const newSettings = { ...currentOrg.telegramSettings!, botToken: e.target.value };
                           onUpdateOrg({ ...currentOrg, telegramSettings: newSettings });
                           db.updateOrganization(currentOrg.id, { telegramSettings: newSettings });
                        }}
                        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                        className="w-full border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                     />
                     <p className="text-[10px] text-slate-400 mt-1">Создайте бота через @BotFather и скопируйте токен</p>
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Chat ID</label>
                     <div className="flex gap-2">
                        <input 
                           type="text" 
                           value={currentOrg.telegramSettings.chatId}
                           onChange={(e) => {
                              const newSettings = { ...currentOrg.telegramSettings!, chatId: e.target.value };
                              onUpdateOrg({ ...currentOrg, telegramSettings: newSettings });
                              db.updateOrganization(currentOrg.id, { telegramSettings: newSettings });
                           }}
                           placeholder="-100123456789"
                           className="w-full border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                        />
                        <button 
                           onClick={async () => {
                              if (!currentOrg.telegramSettings?.enabled) {
                                alert('TelegramAPI отключен в настройках организации.');
                                return;
                              }
                              if (!currentOrg.telegramSettings?.botToken) {
                                 alert('Сначала введите Bot Token');
                                 return;
                              }
                              try {
                                 const res = await fetch(getTelegramUrl(currentOrg.telegramSettings.botToken, 'getUpdates'));
                                 const data = await res.json();
                                 if (data.ok && data.result.length > 0) {
                                    const lastMsg = data.result[data.result.length - 1];
                                    const chatId = lastMsg.message?.chat.id || lastMsg.channel_post?.chat.id;
                                    if (chatId) {
                                       const newSettings = { ...currentOrg.telegramSettings!, chatId: String(chatId) };
                                       onUpdateOrg({ ...currentOrg, telegramSettings: newSettings });
                                       db.updateOrganization(currentOrg.id, { telegramSettings: newSettings });
                                       alert(`Chat ID найден: ${chatId}`);
                                    } else {
                                       alert('Не удалось определить Chat ID. Напишите боту сообщение и попробуйте снова.');
                                    }
                                 } else {
                                    alert('Нет обновлений. Напишите боту сообщение и попробуйте снова.');
                                 }
                              } catch (e: any) {
                                 console.error('Telegram API Error:', e);
                                 let msg = 'Ошибка при запросе к Telegram API';
                                 if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
                                    msg = 'Не удалось связаться с Telegram API. Возможно, доступ заблокирован вашим провайдером или расширением браузера (AdBlock).';
                                 }
                                 alert(msg);
                              }
                           }}
                           className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                           Найти ID
                        </button>
                     </div>
                     <p className="text-[10px] text-slate-400 mt-1">ID чата или группы, куда бот будет слать уведомления. Добавьте бота в группу и сделайте админом.</p>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Типы уведомлений</p>
                     
                     {[
                        { key: 'notifyOnShiftStart', label: 'Начало смены' },
                        { key: 'notifyOnShiftEnd', label: 'Конец смены' },
                        { key: 'notifyOnLimitExceeded', label: 'Превышение лимита (более 15 минут)' }
                     ].map(pref => (
                        <div key={pref.key} className="flex items-center justify-between">
                           <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{pref.label}</span>
                           <label className="relative inline-flex items-center cursor-pointer scale-75">
                              <input 
                                 type="checkbox" 
                                 className="sr-only peer"
                                 checked={(currentOrg.telegramSettings as any)?.[pref.key] ?? true}
                                 onChange={(e) => {
                                    const newSettings = { 
                                       ...currentOrg.telegramSettings!, 
                                       [pref.key]: e.target.checked 
                                    };
                                    onUpdateOrg({ ...currentOrg, telegramSettings: newSettings });
                                    db.updateOrganization(currentOrg.id, { telegramSettings: newSettings });
                                 }}
                              />
                              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                           </label>
                        </div>
                     ))}
                  </div>

                  <div>
                     <button 
                        onClick={async () => {
                           if (!currentOrg.telegramSettings?.enabled) {
                              alert('TelegramAPI отключен в настройках организации.');
                              return;
                           }
                           if (!currentOrg.telegramSettings?.botToken || !currentOrg.telegramSettings?.chatId) {
                              alert('Заполните все поля');
                              return;
                           }
                           try {
                              const res = await fetch(getTelegramUrl(currentOrg.telegramSettings.botToken, 'sendMessage'), {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    chat_id: currentOrg.telegramSettings.chatId,
                                    text: '🔔 Тестовое уведомление от WorkTracker Pro'
                                })
                              });
                              const data = await res.json();
                              if (data.ok) {
                                alert('Сообщение отправлено!');
                              } else {
                                alert('Ошибка отправки: ' + data.description);
                              }
                           } catch (e: any) {
                              if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
                                 alert('Ошибка сети: Не удалось связаться с Telegram. Проверьте интернет-соединение или отключите блокировщик рекламы.');
                              } else {
                                 alert('Ошибка сети: ' + e.message);
                              }
                           }
                        }}
                        className="w-full py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all flex items-center justify-center gap-2"
                     >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        Отправить тестовое сообщение
                     </button>
                  </div>
               </div>
            )}
         </div>
      </section>

      <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 relative overflow-hidden">
         <h3 className="font-black text-slate-900 dark:text-slate-50 mb-6 flex items-center gap-2 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Max Messenger Уведомления</h3>
         
         <div className="space-y-6">
            <div className="flex items-center justify-between">
               <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Интеграция с Max Messenger</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Получать уведомления через Max Messenger</p>
               </div>
               <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={currentOrg?.maxSettings?.enabled || false}
                    onChange={(e) => {
                       const newSettings = {
                          ...(currentOrg?.maxSettings || { botToken: '', chatId: '' }),
                          enabled: e.target.checked
                       };
                       if (currentOrg) {
                          onUpdateOrg({ ...currentOrg, maxSettings: newSettings });
                          db.updateOrganization(currentOrg.id, { maxSettings: newSettings });
                       }
                    }}
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
               </label>
            </div>

            {currentOrg?.maxSettings?.enabled && (
               <div className="grid grid-cols-1 gap-4 animate-fadeIn">
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Bot Token</label>
                     <input 
                        type="text" 
                        value={currentOrg.maxSettings.botToken}
                        onChange={(e) => {
                           const newSettings = { ...currentOrg.maxSettings!, botToken: e.target.value };
                           onUpdateOrg({ ...currentOrg, maxSettings: newSettings });
                           db.updateOrganization(currentOrg.id, { maxSettings: newSettings });
                        }}
                        placeholder="Введите Bot Token"
                        className="w-full border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                     />
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Chat ID</label>
                     <input 
                        type="text" 
                        value={currentOrg.maxSettings.chatId}
                        onChange={(e) => {
                             const newSettings = { ...currentOrg.maxSettings!, chatId: e.target.value };
                             onUpdateOrg({ ...currentOrg, maxSettings: newSettings });
                             db.updateOrganization(currentOrg.id, { maxSettings: newSettings });
                        }}
                        placeholder="Введите Chat ID"
                        className="w-full border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                     />
                  </div>
                  
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Типы уведомлений</p>
                     
                     {[
                        { key: 'notifyOnShiftStart', label: 'Начало смены' },
                        { key: 'notifyOnShiftEnd', label: 'Конец смены' },
                        { key: 'notifyOnLimitExceeded', label: 'Превышение лимита (более 15 минут)' }
                     ].map(pref => (
                        <div key={pref.key} className="flex items-center justify-between">
                           <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{pref.label}</span>
                           <label className="relative inline-flex items-center cursor-pointer scale-75">
                              <input 
                                 type="checkbox" 
                                 className="sr-only peer"
                                 checked={(currentOrg.maxSettings as any)?.[pref.key] ?? true}
                                 onChange={(e) => {
                                    const newSettings = { 
                                       ...currentOrg.maxSettings!, 
                                       [pref.key]: e.target.checked 
                                    };
                                    onUpdateOrg({ ...currentOrg, maxSettings: newSettings });
                                    db.updateOrganization(currentOrg.id, { maxSettings: newSettings });
                                 }}
                              />
                              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                           </label>
                        </div>
                     ))}
                  </div>

                  <div>
                     <button 
                        onClick={async () => {
                           if (!currentOrg.maxSettings?.botToken || !currentOrg.maxSettings?.chatId) {
                              alert('Заполните все поля');
                              return;
                           }
                           try {
                              const res = await fetch('/api/max/send', {
                                 method: 'POST',
                                 headers: { 'Content-Type': 'application/json' },
                                 body: JSON.stringify({
                                    botToken: currentOrg.maxSettings.botToken,
                                    chatId: currentOrg.maxSettings.chatId,
                                    message: '🔔 Тестовое уведомление от WorkTracker Pro (Max Messenger)'
                                 })
                              });
                              const data = await res.json();
                              if (data.success) {
                                 alert('Сообщение отправлено!');
                              } else {
                                 alert('Ошибка отправки: ' + data.error);
                              }
                           } catch (e: any) {
                              alert('Ошибка сети: ' + e.message);
                           }
                        }}
                        className="w-full py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all flex items-center justify-center gap-2"
                     >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        Отправить тестовое сообщение
                     </button>
                  </div>
               </div>
            )}
         </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900 dark:text-slate-50 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Оборудование</h3>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsArchiveViewOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-all text-[9px] font-black uppercase tracking-widest"
              >
                <Archive size={12} />
                Архив
              </button>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isMachineLimitReached ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                 {machines.length} / {planLimits.maxMachines}
              </span>
            </div>
          </div>
          
          <div className="flex gap-2 mb-6">
            <input 
               disabled={isMachineLimitReached}
               type="text" 
               value={newMachineName} 
               onChange={e => setNewMachineName(e.target.value)} 
               placeholder={isMachineLimitReached ? "Лимит тарифа исчерпан" : "Название станка"} 
               className="flex-1 border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 transition-all disabled:bg-slate-50 dark:disabled:bg-slate-800" 
            />
            {branches.length > 0 && setNewMachineBranchId && (
              <select
                disabled={isMachineLimitReached}
                value={newMachineBranchId}
                onChange={e => setNewMachineBranchId(e.target.value)}
                className="border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 transition-all disabled:bg-slate-50 dark:disabled:bg-slate-800"
              >
                <option value="">Без филиала</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            <button 
              disabled={isMachineLimitReached}
              onClick={() => {
                if (newMachineName.trim()) {
                  handleUpdateMachinesList([...machines, { id: 'm' + Date.now(), name: newMachineName, branchId: newMachineBranchId }]);
                  setNewMachineName('');
                  if (setNewMachineBranchId) setNewMachineBranchId('');
                }
              }} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase disabled:bg-slate-300">Добавить</button>
          </div>
          
          {isMachineLimitReached && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 text-center space-y-3 mb-6">
              <p className="text-[11px] font-bold text-blue-800 dark:text-blue-300 leading-tight">Достигнут лимит оборудования для тарифа {currentOrg?.plan}</p>
              <button onClick={() => setViewMode ? setViewMode('billing') : window.location.href='#pricing'} className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl dark:shadow-slate-900/20 shadow-blue-200">Расширить лимит</button>
            </div>
          )}
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {machines.map(m => (
              <div key={m.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-all">
                {editingMachineId === m.id ? (
                  <div className="flex-1 flex gap-2">
                     <input 
                       autoFocus 
                       className="flex-1 border-2 border-blue-200 dark:border-blue-900/50 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-1 text-sm outline-none" 
                       value={editValue} 
                       onChange={e => setEditValue(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && saveMachineEdit(m.id)}
                     />
                     {branches.length > 0 && setEditingMachineBranchId && (
                       <select
                         value={editingMachineBranchId || ''}
                         onChange={e => setEditingMachineBranchId(e.target.value || undefined)}
                         className="border-2 border-blue-200 dark:border-blue-900/50 rounded-xl px-2 py-1 text-xs font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none"
                       >
                         <option value="">Без филиала</option>
                         {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                       </select>
                     )}
                     <button onClick={() => saveMachineEdit(m.id)} className="text-green-600 dark:text-green-400 font-black px-2">OK</button>
                     <button onClick={() => setEditingMachineId(null)} className="text-slate-400 font-black px-2">X</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{m.name}</span>
                      {m.branchId && branches.find(b => b.id === m.branchId) && (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-bold rounded-full border border-slate-200 dark:border-slate-700">
                          {branches.find(b => b.id === m.branchId)?.name}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => { setEditingMachineId(m.id); setEditValue(m.name); if (setEditingMachineBranchId) setEditingMachineBranchId(m.branchId); }} className="text-slate-300 hover:text-blue-500">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                       </button>
                       <button 
                         onClick={() => setArchiveConfirm({ isOpen: true, machineId: m.id, machineName: m.name })} 
                         className="text-slate-300 hover:text-amber-600 dark:text-amber-400"
                         title="Архивировать"
                       >
                         <Archive size={18} />
                       </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20">
          <h3 className="font-bold text-slate-900 dark:text-slate-50 mb-6 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Должности и Функции</h3>
          <div className="flex gap-2 mb-6">
            <input type="text" value={newPositionName} onChange={e => setNewPositionName(e.target.value)} placeholder="Новая роль" className="flex-1 border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all" />
            <button onClick={() => {
              if (newPositionName.trim()) {
                if (positions.some(p => p.name.toLowerCase() === newPositionName.trim().toLowerCase())) {
                  alert('Такая должность уже существует');
                  return;
                }
                onUpdatePositions([...positions, { name: newPositionName.trim(), permissions: DEFAULT_PERMISSIONS }]);
                setNewPositionName('');
              }
            }} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase">Добавить</button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {positions.map(p => (
              <div key={p.name} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-all group">
                {editingPositionName === p.name ? (
                  <div className="flex-1 flex gap-2">
                     <input 
                       autoFocus 
                       className="flex-1 border-2 border-blue-200 dark:border-blue-900/50 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-1 text-sm outline-none" 
                       value={editValue} 
                       onChange={e => setEditValue(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && savePositionEdit(p.name)}
                     />
                     <button onClick={() => savePositionEdit(p.name)} className="text-green-600 dark:text-green-400 font-black px-2">OK</button>
                     <button onClick={() => setEditingPositionName(null)} className="text-slate-400 font-black px-2">X</button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col">
                       <span className={`text-sm font-bold ${p.name === FIXED_POSITION_TURNER ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>{p.name}</span>
                    </div>
                    <div className="flex gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                       <button 
                         onClick={() => setConfiguringPosition(p)} 
                         className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:text-blue-400"
                         title="Конструктор функций"
                       >
                         <Settings className="w-4 h-4" />
                       </button>
                       {p.name !== FIXED_POSITION_TURNER && (
                         <>
                           <button onClick={() => { setEditingPositionName(p.name); setEditValue(p.name); }} className="p-2 text-slate-300 hover:text-blue-500">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                           </button>
                           <button 
                            onClick={async () => { 
                              const confirmed = await confirm({
                                title: 'Удаление должности',
                                message: 'Удалить должность?',
                                type: 'danger'
                              });
                              if (confirmed) {
                                onUpdatePositions(positions.filter(x => x.name !== p.name)); 
                              }
                            }} 
                            className="text-slate-300 hover:text-red-500"
                          >
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                           </button>
                         </>
                       )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-slate-900 dark:text-slate-50 flex items-center gap-2 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Реквизиты организации</h3>
          <button 
            onClick={async () => {
              if (currentOrg) {
                try {
                  const { error } = await db.updateOrganization(currentOrg.id, { clientRequisites: currentOrg.clientRequisites });
                  if (error) throw error;
                  alert('Реквизиты успешно сохранены!');
                } catch (err: any) {
                  alert('Ошибка при сохранении: ' + (err.message || err));
                }
              }
            }}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
          >
            Сохранить реквизиты
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input placeholder="Название организации" value={currentOrg?.clientRequisites?.name || ''} onChange={e => onUpdateOrg({ ...currentOrg!, clientRequisites: { ...currentOrg?.clientRequisites, name: e.target.value } as any })} className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100" />
          <input placeholder="ИНН" value={currentOrg?.clientRequisites?.inn || ''} onChange={e => onUpdateOrg({ ...currentOrg!, clientRequisites: { ...currentOrg?.clientRequisites, inn: e.target.value } as any })} className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100" />
          <input placeholder="КПП" value={currentOrg?.clientRequisites?.kpp || ''} onChange={e => onUpdateOrg({ ...currentOrg!, clientRequisites: { ...currentOrg?.clientRequisites, kpp: e.target.value } as any })} className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100" />
          <input placeholder="Адрес" value={currentOrg?.clientRequisites?.address || ''} onChange={e => onUpdateOrg({ ...currentOrg!, clientRequisites: { ...currentOrg?.clientRequisites, address: e.target.value } as any })} className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input placeholder="Наименование банка" value={currentOrg?.clientRequisites?.bankName || ''} onChange={e => onUpdateOrg({ ...currentOrg!, clientRequisites: { ...currentOrg?.clientRequisites, bankName: e.target.value } as any })} className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100" />
          <input placeholder="БИК" value={currentOrg?.clientRequisites?.bik || ''} onChange={e => onUpdateOrg({ ...currentOrg!, clientRequisites: { ...currentOrg?.clientRequisites, bik: e.target.value } as any })} className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100" />
          <input placeholder="Кор.счет" value={currentOrg?.clientRequisites?.corrAccount || ''} onChange={e => onUpdateOrg({ ...currentOrg!, clientRequisites: { ...currentOrg?.clientRequisites, corrAccount: e.target.value } as any })} className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100" />
          <input placeholder="Расч.счет" value={currentOrg?.clientRequisites?.settlementAccount || ''} onChange={e => onUpdateOrg({ ...currentOrg!, clientRequisites: { ...currentOrg?.clientRequisites, settlementAccount: e.target.value } as any })} className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100" />
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20">
        <h3 className="font-black text-slate-900 dark:text-slate-50 mb-6 flex items-center gap-2 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest">Файлы и Бэкап</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">Система хранит данные в облаке Supabase и локально. Рекомендуется периодически экспортировать данные.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={handleExportAll} className="flex items-center justify-center gap-3 py-5 bg-slate-900 text-white rounded-3xl font-black hover:bg-slate-800 transition-all shadow-2xl dark:shadow-slate-900/20 shadow-slate-100 uppercase text-xs tracking-widest">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Экспорт (JSON)
          </button>
          <label className="flex items-center justify-center gap-3 py-5 bg-blue-600 text-white rounded-3xl font-black hover:bg-blue-700 transition-all shadow-2xl dark:shadow-slate-900/20 shadow-blue-100 uppercase text-xs tracking-widest cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Импорт (JSON)
            <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
          </label>
        </div>
      </section>

      <section className="bg-slate-900 p-8 rounded-[2.5rem] text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[100px] -mr-32 -mt-32"></div>
        <h3 className="font-black mb-6 flex items-center gap-2 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase text-xs tracking-widest relative z-10">Инструкция и техподдержка</h3>
        
        <div className="space-y-6 relative z-10">
          <div className="pt-4 border-t border-white/10">
            <p className="text-[10px] text-slate-400 italic text-center">
              Для получения полной инструкции по всем разделам приложения, обратитесь к файлу README.md в корне проекта или в чат поддержки.
            </p>
          </div>
        </div>
      </section>

      <ArchiveConfirmModal
        isOpen={archiveConfirm.isOpen}
        onClose={() => setArchiveConfirm({ isOpen: false, machineId: '', machineName: '' })}
        onConfirm={handleConfirmArchive}
        title="Архивация оборудования"
        itemName={archiveConfirm.machineName}
      />

      <ArchiveViewModal
        isOpen={isArchiveViewOpen}
        onClose={() => setIsArchiveViewOpen(false)}
        type="machines"
        getArchivedItems={getArchivedMachines}
        onRestore={handleRestoreMachine}
      />
    </div>
  );
};

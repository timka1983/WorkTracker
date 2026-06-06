import React, { useState, useEffect } from 'react';
import { ReceivingOrganization } from '../types';
import { db } from '../lib/supabase';
import { Plus, Trash2, Save, Building2, Edit2 } from 'lucide-react';

export const RequisitesView: React.FC = () => {
  const [requisites, setRequisites] = useState<ReceivingOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [newReq, setNewReq] = useState<Partial<ReceivingOrganization>>({
    name: '',
    abbreviation: '',
    requisites: { 
      inn: '', 
      kpp: '', 
      address: '', 
      bankName: '', 
      bik: '', 
      corrAccount: '', 
      settlementAccount: '', 
      vatRate: 'Без НДС' 
    },
    isDefault: false
  });

  useEffect(() => {
    fetchRequisites();
  }, []);

  const fetchRequisites = async () => {
    setLoading(true);
    try {
      const data = await db.getReceivingOrganizations();
      setRequisites(data || []);
    } catch (e) {
      console.error('Error fetching requisites:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!newReq.name || !newReq.abbreviation) {
      alert('Заполните название и аббревиатуру');
      return;
    }
    try {
      const id = newReq.id || crypto.randomUUID();
      const req: ReceivingOrganization = {
        id,
        name: newReq.name!,
        abbreviation: newReq.abbreviation!,
        requisites: newReq.requisites!,
        isDefault: newReq.isDefault || false
      };
      const { error } = await db.saveReceivingOrganization(req);
      if (error) throw new Error(typeof error === 'string' ? error : (error as any).message);

      if (newReq.id) {
        setRequisites(requisites.map(r => r.id === id ? req : r));
      } else {
        setRequisites([...requisites, req]);
      }

      setNewReq({
        name: '',
        abbreviation: '',
        requisites: { 
          inn: '', 
          kpp: '', 
          address: '', 
          bankName: '', 
          bik: '', 
          corrAccount: '', 
          settlementAccount: '', 
          vatRate: 'Без НДС' 
        },
        isDefault: false
      });
    } catch (e: any) {
      alert('Ошибка при сохранении: ' + e.message);
    }
  };

  const handleEdit = (req: ReceivingOrganization) => {
    setNewReq({ ...req });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого получателя?')) return;
    try {
      const { error } = await db.deleteReceivingOrganization(id);
      if (error) throw error;
      setRequisites(requisites.filter(r => r.id !== id));
    } catch (e: any) {
      alert('Ошибка при удалении: ' + e.message);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-md border border-slate-200 dark:border-slate-800">
        <h3 className="font-black text-slate-900 dark:text-slate-50 mb-6 uppercase text-xs tracking-widest">
          {newReq.id ? 'Редактировать получателя' : 'Добавить получателя'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input placeholder="Название организации" value={newReq.name} onChange={e => setNewReq({...newReq, name: e.target.value})} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100" />
          <input placeholder="Аббревиатура (например, ПМС)" value={newReq.abbreviation} onChange={e => setNewReq({...newReq, abbreviation: e.target.value})} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100" />
          <input placeholder="ИНН" value={newReq.requisites?.inn} onChange={e => setNewReq({...newReq, requisites: {...newReq.requisites!, inn: e.target.value}})} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100" />
          <input placeholder="КПП" value={newReq.requisites?.kpp} onChange={e => setNewReq({...newReq, requisites: {...newReq.requisites!, kpp: e.target.value}})} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100" />
          <input placeholder="Адрес" value={newReq.requisites?.address} onChange={e => setNewReq({...newReq, requisites: {...newReq.requisites!, address: e.target.value}})} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 md:col-span-2" />
          
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Ставка НДС</label>
              <select 
                value={newReq.requisites?.vatRate || 'Без НДС'} 
                onChange={e => setNewReq({...newReq, requisites: {...newReq.requisites!, vatRate: e.target.value}})}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold"
              >
                <option value="Без НДС">Без НДС</option>
                <option value="5%">5%</option>
                <option value="7%">7%</option>
                <option value="22%">22%</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Наименование банка</label>
              <input 
                placeholder="Наименование банка" 
                value={newReq.requisites?.bankName || ''} 
                onChange={e => setNewReq({...newReq, requisites: {...newReq.requisites!, bankName: e.target.value}})} 
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100" 
              />
            </div>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">БИК</label>
              <input 
                placeholder="БИК" 
                value={newReq.requisites?.bik || ''} 
                onChange={e => setNewReq({...newReq, requisites: {...newReq.requisites!, bik: e.target.value}})} 
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Кор.счет</label>
              <input 
                placeholder="Кор.счет" 
                value={newReq.requisites?.corrAccount || ''} 
                onChange={e => setNewReq({...newReq, requisites: {...newReq.requisites!, corrAccount: e.target.value}})} 
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Расч.счет</label>
              <input 
                placeholder="Расч.счет" 
                value={newReq.requisites?.settlementAccount || ''} 
                onChange={e => setNewReq({...newReq, requisites: {...newReq.requisites!, settlementAccount: e.target.value}})} 
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100" 
              />
            </div>
          </div>
          <div className="flex items-center justify-between md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400">
              <input type="checkbox" checked={newReq.isDefault} onChange={e => setNewReq({...newReq, isDefault: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              По умолчанию
            </label>
            <div className="flex gap-2">
              {newReq.id && (
                <button 
                  onClick={() => setNewReq({ 
                    name: '', 
                    abbreviation: '', 
                    requisites: { 
                      inn: '', 
                      kpp: '', 
                      address: '', 
                      bankName: '', 
                      bik: '', 
                      corrAccount: '', 
                      settlementAccount: '', 
                      vatRate: 'Без НДС' 
                    }, 
                    isDefault: false 
                  })}
                  className="px-6 py-3 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold"
                >
                  Отмена
                </button>
              )}
              <button onClick={handleSave} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-all">
                {newReq.id ? 'Обновить' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {requisites.map(req => (
          <div key={req.id} className={`p-6 bg-white dark:bg-slate-900 rounded-3xl border transition-all hover:shadow-xl ${req.isDefault ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-800'}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-50">{req.name}</h4>
                <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{req.abbreviation}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleEdit(req)}
                  className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  title="Редактировать"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(req.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                  title="Удалить"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {req.isDefault && <span className="text-[10px] font-black bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg uppercase tracking-wider">По умолчанию</span>}
              </div>
            </div>
            <div className="space-y-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <p><span className="font-bold text-slate-400 uppercase mr-1">ИНН:</span> {req.requisites.inn}</p>
              <p><span className="font-bold text-slate-400 uppercase mr-1">КПП:</span> {req.requisites.kpp}</p>
              <p className="line-clamp-1"><span className="font-bold text-slate-400 uppercase mr-1">Адрес:</span> {req.requisites.address}</p>
              <p><span className="font-bold text-slate-400 uppercase mr-1">НДС:</span> {req.requisites.vatRate || 'Без НДС'}</p>
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="font-bold text-slate-400 uppercase text-[10px] mb-1">Банковские реквизиты:</p>
                <p><span className="text-slate-400">Банк:</span> {req.requisites.bankName}</p>
                <p><span className="text-slate-400">БИК:</span> {req.requisites.bik}</p>
                <p><span className="text-slate-400">К/с:</span> {req.requisites.corrAccount}</p>
                <p><span className="text-slate-400">Р/с:</span> {req.requisites.settlementAccount}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

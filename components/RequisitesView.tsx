import React, { useState, useEffect } from 'react';
import { ReceivingOrganization } from '../types';
import { db } from '../lib/supabase';
import { Plus, Trash2, Save, Building2 } from 'lucide-react';

export const RequisitesView: React.FC = () => {
  const [requisites, setRequisites] = useState<ReceivingOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [newReq, setNewReq] = useState<Partial<ReceivingOrganization>>({
    name: '',
    abbreviation: '',
    requisites: { inn: '', kpp: '', address: '', bankDetails: '' },
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
      const id = crypto.randomUUID();
      const req: ReceivingOrganization = {
        id,
        name: newReq.name!,
        abbreviation: newReq.abbreviation!,
        requisites: newReq.requisites!,
        isDefault: newReq.isDefault || false
      };
      await db.saveReceivingOrganization(req);
      setRequisites([...requisites, req]);
      setNewReq({
        name: '',
        abbreviation: '',
        requisites: { inn: '', kpp: '', address: '', bankDetails: '' },
        isDefault: false
      });
    } catch (e) {
      alert('Ошибка при сохранении');
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-md border border-slate-200 dark:border-slate-800">
        <h3 className="font-black text-slate-900 dark:text-slate-50 mb-6 uppercase text-xs tracking-widest">Добавить получателя</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input placeholder="Название организации" value={newReq.name} onChange={e => setNewReq({...newReq, name: e.target.value})} className="p-3 bg-slate-50 rounded-xl border border-slate-200" />
          <input placeholder="Аббревиатура (например, ПМС)" value={newReq.abbreviation} onChange={e => setNewReq({...newReq, abbreviation: e.target.value})} className="p-3 bg-slate-50 rounded-xl border border-slate-200" />
          <input placeholder="ИНН" value={newReq.requisites?.inn} onChange={e => setNewReq({...newReq, requisites: {...newReq.requisites!, inn: e.target.value}})} className="p-3 bg-slate-50 rounded-xl border border-slate-200" />
          <input placeholder="КПП" value={newReq.requisites?.kpp} onChange={e => setNewReq({...newReq, requisites: {...newReq.requisites!, kpp: e.target.value}})} className="p-3 bg-slate-50 rounded-xl border border-slate-200" />
          <input placeholder="Адрес" value={newReq.requisites?.address} onChange={e => setNewReq({...newReq, requisites: {...newReq.requisites!, address: e.target.value}})} className="p-3 bg-slate-50 rounded-xl border border-slate-200 md:col-span-2" />
          <textarea placeholder="Банковские реквизиты" value={newReq.requisites?.bankDetails} onChange={e => setNewReq({...newReq, requisites: {...newReq.requisites!, bankDetails: e.target.value}})} className="p-3 bg-slate-50 rounded-xl border border-slate-200 md:col-span-2" />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={newReq.isDefault} onChange={e => setNewReq({...newReq, isDefault: e.target.checked})} />
            По умолчанию
          </label>
          <button onClick={handleSave} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">Сохранить</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {requisites.map(req => (
          <div key={req.id} className={`p-6 bg-white dark:bg-slate-900 rounded-3xl border ${req.isDefault ? 'border-blue-500' : 'border-slate-200'}`}>
            <div className="flex justify-between items-start mb-4">
              <h4 className="font-bold">{req.name} ({req.abbreviation})</h4>
              {req.isDefault && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">По умолчанию</span>}
            </div>
            <p className="text-sm text-slate-600">ИНН: {req.requisites.inn}</p>
            <p className="text-sm text-slate-600">КПП: {req.requisites.kpp}</p>
            <p className="text-sm text-slate-600">Адрес: {req.requisites.address}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

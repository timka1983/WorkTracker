import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { STORAGE_KEYS } from '../constants';

interface EmployerLoginProps {
  onBack: () => void;
  onSuccess: () => void;
}

const EmployerLogin: React.FC<EmployerLoginProps> = ({ onBack, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Refresh Token Not Found')) {
          await supabase.auth.signOut();
          setError('Ошибка сессии. Пожалуйста, попробуйте войти снова.');
          setLoading(false);
          return;
        }
        if (error.message === 'Failed to fetch') {
          setError('Ошибка сети: Не удалось подключиться к серверу. Проверьте настройки Supabase.');
        } else {
          setError(error.message);
        }
        setLoading(false);
      } else if (data.user) {
        // Try to fetch by Supabase Auth UID first
        let { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (userError || !userData) {
          console.log('User not found by UID, falling back to "admin" ID');
          const { data: adminData, error: adminError } = await supabase
            .from('users')
            .select('*')
            .eq('id', 'admin')
            .single();
          userData = adminData;
          userError = adminError;
        }

        if (userError || !userData) {
          console.error('Error fetching admin profile:', userError);
          const fallbackAdmin = {
            id: data.user.id,
            name: data.user.user_metadata?.name || 'Администратор',
            role: data.user.user_metadata?.role || 'EMPLOYER',
            position: 'Администратор',
            isAdmin: true,
            organizationId: data.user.user_metadata?.organizationId || 'initial_org'
          };
          
          // Try to upsert the user to the database so they are "real"
          try {
            await supabase.from('users').upsert({
              id: fallbackAdmin.id,
              name: fallbackAdmin.name,
              role: fallbackAdmin.role,
              position: fallbackAdmin.position,
              is_admin: true,
              organization_id: fallbackAdmin.organizationId,
              pin: '0000' // Default PIN for new admin
            });
          } catch (upsertErr) {
            console.warn('Failed to upsert user to database (might be RLS):', upsertErr);
          }

          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(fallbackAdmin));
          // Link session to user
          supabase.rpc('link_current_session_to_user', { target_user_id: fallbackAdmin.id });
        } else {
          const adminUser = {
            id: userData.id,
            name: userData.name,
            role: userData.role || 'EMPLOYER',
            position: userData.position,
            isAdmin: userData.is_admin === true || userData.isAdmin === true || userData.id === 'admin' || userData.position === 'Администратор',
            organizationId: userData.organization_id || userData.organizationId
          };
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(adminUser));
          // Link session to user
          supabase.rpc('link_current_session_to_user', { target_user_id: adminUser.id });
        }
        
        onSuccess();
      }
    } catch (err) {
      console.error('Unexpected login error:', err);
      setError('Произошла непредвиденная ошибка');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 text-center uppercase tracking-widest">Вход для работодателя</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 ml-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-all"
            required
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 ml-1">Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-all"
            required
          />
        </div>
        {error && <p className="text-red-500 text-[11px] text-center font-black uppercase">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-3xl py-4 font-black uppercase text-sm hover:bg-blue-700 transition-all disabled:opacity-50"
        >
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>
      <button onClick={onBack} className="w-full text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-200">Назад к PIN-коду</button>
    </div>
  );
};

export default EmployerLogin;

import React, { useState } from 'react';
import { supabase, db } from '../lib/supabase';
import { STORAGE_KEYS } from '../constants';

const AdminLoginScreen: React.FC = () => {
  console.log('AdminLoginScreen rendered');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showFixDb, setShowFixDb] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    console.log('Login attempt started for:', email);
    setError('');
    setLoading(true);
    
    try {
      console.log('Calling supabase.auth.signInWithPassword...');
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      
      console.log('Login result received:', { data, error: authError });
      
      if (authError) {
        console.error('Login error details:', authError);
        if (authError.message.includes('Email not confirmed')) {
          setError('Email не подтвержден. Пожалуйста, проверьте почту.');
        } else if (authError.message.includes('Invalid login credentials')) {
          setError('Неверный Email или пароль.');
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }
      
      if (data.user) {
        console.log('Login success, user ID:', data.user.id);
        console.log('Fetching admin profile from users table...');
        
        // Try to fetch by Supabase Auth UID first
        // We use specific columns to avoid errors if some are missing
        let { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, name, role, position, organization_id')
          .eq('id', data.user.id)
          .maybeSingle();

        if (userError) {
          console.error('❌ Error fetching user profile:', userError);
          // Check if it's a missing column error
          if (userError.code === '42703' || userError.message?.includes('column')) {
            setError('Структура базы данных устарела. Пожалуйста, обратитесь к супер-админу или нажмите кнопку "Исправить БД" ниже.');
            setShowFixDb(true);
            setLoading(false);
            return;
          }
        }

        // If not found by ID, try to find by Email (for cases where ID hasn't been updated yet)
        if (!userData && data.user.email) {
          console.log('User not found by UID, trying to find by Email:', data.user.email);
          const { data: emailData, error: emailError } = await supabase
            .from('users')
            .select('id, name, role, position, organization_id')
            .eq('email', data.user.email)
            .maybeSingle();
          
          if (emailData) {
            console.log('User found by Email, updating record to use Auth UID:', data.user.id);
            userData = emailData;
            // Update the record to use the new Auth UUID
            await supabase.from('users').update({ id: data.user.id }).eq('id', emailData.id);
          } else if (emailError && (emailError.code === '42703' || emailError.message?.includes('column'))) {
            setError('Структура базы данных устарела. Пожалуйста, обратитесь к супер-админу или нажмите кнопку "Исправить БД" ниже.');
            setShowFixDb(true);
            setLoading(false);
            return;
          }
        }

        if (!userData) {
          const orgIdFromMetadata = data.user.user_metadata?.organizationId;
          console.log('User still not found, falling back to "admin" ID for org:', orgIdFromMetadata);
          
          let query = supabase.from('users').select('id, name, role, position, organization_id').eq('id', 'admin');
          if (orgIdFromMetadata) {
            query = query.eq('organization_id', orgIdFromMetadata);
          }
          
          const { data: adminData } = await query.maybeSingle();
          userData = adminData;
        }

        if (!userData) {
          console.log('Using fallback admin profile for user:', data.user.email);
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
            console.log('Attempting to upsert missing user to database...');
            const payload: any = {
              id: fallbackAdmin.id,
              name: fallbackAdmin.name,
              role: fallbackAdmin.role,
              position: fallbackAdmin.position,
              organization_id: fallbackAdmin.organizationId,
              pin: '0000'
            };
            await supabase.from('users').upsert(payload);
            console.log('User upserted successfully');
          } catch (upsertErr) {
            console.warn('Failed to upsert user to database (might be RLS or missing columns):', upsertErr);
          }

          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(fallbackAdmin));
          // Link session to user
          supabase.rpc('link_current_session_to_user', { target_user_id: fallbackAdmin.id });
        } else {
          console.log('Admin profile fetched successfully:', userData);
          const adminUser = {
            id: userData.id,
            name: userData.name,
            role: userData.role || 'EMPLOYER',
            position: userData.position,
            isAdmin: true,
            organizationId: userData.organization_id
          };
          console.log('Mapped admin user for session:', adminUser);
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(adminUser));
          // Link session to user
          supabase.rpc('link_current_session_to_user', { target_user_id: adminUser.id });
        }
        
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('Error getting session after login:', sessionError);
          // If session is invalid, clear it and retry or show error
          if (sessionError.message.includes('Refresh Token Not Found')) {
            await supabase.auth.signOut();
            setError('Ошибка сессии. Пожалуйста, попробуйте войти снова.');
            setLoading(false);
            return;
          }
        }
        console.log('Current session after login:', sessionData?.session);
        
        console.log('Redirecting to /...');
        window.location.replace('/');
      } else {
        console.warn('Login returned no error but also no user data');
      }
    } catch (err) {
      console.error('Unexpected login error caught in catch block:', err);
      setError('Произошла непредвиденная ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleFixDb = async () => {
    setLoading(true);
    try {
      const result = await db.fixDatabase();
      if (result.success) {
        alert('База данных успешно обновлена!');
        window.location.reload();
      } else {
        alert('Пожалуйста, выполните этот SQL в панели Supabase SQL Editor:\n\n' + result.sql);
      }
    } catch (e) {
      alert('Ошибка при попытке исправить БД автоматически.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50 dark:bg-slate-950">
      <form onSubmit={handleLogin} className="w-full max-w-sm p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 text-center uppercase tracking-tighter">Вход администратора</h2>
        {error && <p className="text-rose-500 mb-4 text-sm font-bold text-center">{error}</p>}
        <input 
          type="email" 
          placeholder="Email" 
          className="w-full p-4 mb-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-blue-500" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
        />
        <input 
          type="password" 
          placeholder="Пароль" 
          className="w-full p-4 mb-6 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-blue-500" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
        />
        <button 
          type="submit" 
          disabled={loading}
          className="w-full p-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Вход...' : 'Войти'}
        </button>

        {showFixDb && (
          <button 
            type="button"
            onClick={handleFixDb}
            className="w-full mt-4 p-4 bg-amber-500 text-white rounded-2xl font-black uppercase text-sm hover:bg-amber-600 transition-colors"
          >
            Исправить БД
          </button>
        )}

        <a href="/" className="block mt-6 text-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold uppercase transition-colors">Назад к PIN-коду</a>
      </form>
    </div>
  );
};

export default AdminLoginScreen;

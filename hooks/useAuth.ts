import { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { STORAGE_KEYS } from '../constants';
import { db, supabase } from '../lib/supabase';

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedLoginUser, setSelectedLoginUser] = useState<User | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showLanding, setShowLanding] = useState<boolean>(() => {
    const hasUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    const hasLastUsed = localStorage.getItem(STORAGE_KEYS.LAST_USER_ID);
    return !hasUser && !hasLastUsed;
  });

  // Initialize current user from storage
  useEffect(() => {
    const cachedCurrentUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (cachedCurrentUser) {
      const parsed = JSON.parse(cachedCurrentUser);
      console.log('🔑 useAuth: Initializing user from storage:', parsed);
      setCurrentUser(parsed);
      setShowLanding(false);
    } else {
      console.log('🔑 useAuth: No user found in storage');
    }
  }, []);

  const validateAndLogin = async (
    pin: string, 
    users: User[], 
    superAdminPin: string, 
    globalAdminPin: string, 
    user?: User
  ) => {
    const adminUser = users.find(u => u.id === 'admin');
    
    // Секретный PIN для Супер-админа
    if (pin === superAdminPin) {
      const superAdminUser: User = {
        id: 'super-admin',
        name: 'Главный Администратор',
        role: UserRole.SUPER_ADMIN,
        position: 'Super Admin',
        pin: superAdminPin
      };
      setCurrentUser(superAdminUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(superAdminUser));
      setPinInput('');
      setLoginError('');
      setShowLanding(false);
      return;
    }

    // Check for Global Admin PIN (Master Key for admins)
    if (user && (user.id === 'admin' || user.isAdmin) && pin === globalAdminPin) {
      const loginSessionUser = { ...user, role: UserRole.EMPLOYER };
      setCurrentUser(loginSessionUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(loginSessionUser));
      localStorage.setItem(STORAGE_KEYS.LAST_USER_ID, user.id);
      setPinInput('');
      setLoginError('');
      setShowLanding(false);
      return;
    }

    let isPinValid = false;
    if (user) {
      isPinValid = await db.checkPin(user.id, pin);
    }

    if (user && isPinValid) {
      if (user.isArchived) {
        setLoginError('Пользователь заблокирован');
        setTimeout(() => setPinInput(''), 500);
        return;
      }
      const loginSessionUser = { ...user, role: UserRole.EMPLOYEE };
      setCurrentUser(loginSessionUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(loginSessionUser));
      localStorage.setItem(STORAGE_KEYS.LAST_USER_ID, user.id);
      
      // SHADOW MIGRATION: Link this session to the user
      supabase.auth.signInAnonymously().then(({ error: authError }) => {
        if (authError) {
          console.error('🔑 useAuth: Error signing in anonymously:', authError);
          if (authError.message.includes('Refresh Token Not Found')) {
            supabase.auth.signOut().then(() => {
              // Retry sign in after clearing
              supabase.auth.signInAnonymously();
            });
          }
          return;
        }
        supabase.rpc('link_current_session_to_user', { target_user_id: user.id });
      }).catch(err => {
        console.error('🔑 useAuth: Unexpected error during anonymous sign in:', err);
      });

      setPinInput('');
      setLoginError('');
      setShowLanding(false);
    } else if ((adminUser && pin === adminUser.pin) || pin === globalAdminPin) {
      // Master Exit: Local Admin PIN or Global Admin PIN
      setSelectedLoginUser(null);
      setPinInput('');
      setLoginError('');
      localStorage.removeItem(STORAGE_KEYS.LAST_USER_ID);
    } else {
      setLoginError('Неверный PIN-код');
      setTimeout(() => setPinInput(''), 500);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setPinInput('');
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    const hasLastUsed = localStorage.getItem(STORAGE_KEYS.LAST_USER_ID);
    setShowLanding(!hasLastUsed);
  };

  const handleSwitchRole = (role: UserRole) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, role };
      setCurrentUser(updatedUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
    }
  };

  return {
    currentUser,
    setCurrentUser,
    selectedLoginUser,
    setSelectedLoginUser,
    pinInput,
    setPinInput,
    loginError,
    setLoginError,
    showLanding,
    setShowLanding,
    validateAndLogin,
    handleLogout,
    handleSwitchRole
  };
};

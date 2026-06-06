import { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { STORAGE_KEYS } from '../constants';
import { db, supabase } from '../lib/supabase';

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedLoginUser, setSelectedLoginUser] = useState<User | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showLanding, setShowLanding] = useState<boolean>(() => {
    // Check if we are forcibly app-only via env
    if (import.meta.env.VITE_APP_MODE === 'app') return false;
    // Check if we are forcibly landing-only via env
    if (import.meta.env.VITE_APP_MODE === 'landing') return true;
    
    // Default logic
    const hasLastUsed = localStorage.getItem(STORAGE_KEYS.LAST_USER_ID);
    return !hasLastUsed;
  });

  // Initialize current user from Supabase Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('🔑 useAuth: Error getting session:', sessionError);
          setIsAuthReady(true);
          return;
        }

        if (session) {
          console.log('🔑 useAuth: Supabase session active, but requiring PIN challenge');
          // We DON'T set currentUser here because we want a PIN entry every time.
          // We just ensure we don't show the landing page if user is already known
          setShowLanding(false);
          
          // If we have a session, we can try to pre-select the user for better UX
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('supabase_auth_id', session.user.id)
            .maybeSingle();
            
          if (userData && !selectedLoginUser) {
            setSelectedLoginUser(userData as User);
          }
        } else {
          console.log('🔑 useAuth: No active session');
        }
      } catch (err) {
        console.error('🔑 useAuth: Unexpected error during init:', err);
      } finally {
        setIsAuthReady(true);
      }
    };

    initAuth();

    // Listen for visibility changes to "lock" the app when user comes back
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const lastActivity = localStorage.getItem('last_active_at');
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        if (lastActivity && (now - parseInt(lastActivity)) > fiveMinutes) {
          console.log('🔒 Locking app due to inactivity');
          setCurrentUser(null);
          setPinInput('');
        }
        localStorage.setItem('last_active_at', now.toString());
      }
    };

    const updateActivity = () => {
      localStorage.setItem('last_active_at', Date.now().toString());
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('mousedown', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('touchstart', updateActivity);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔑 useAuth: Auth state changed:', event);
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        localStorage.removeItem('last_active_at');
      }
    });

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('mousedown', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
    };
  }, [selectedLoginUser]);

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
      console.log('🔑 useAuth: Super Admin PIN matched');
      const superAdminUser: User = {
        id: 'super-admin',
        name: 'Главный Администратор',
        role: UserRole.SUPER_ADMIN,
        position: 'Super Admin',
        pin: superAdminPin
      };
      setCurrentUser(superAdminUser);
      
      // Link session to DB for RLS
      setIsAuthReady(false);
      supabase.auth.signInAnonymously()
        .then(({ error: authError }) => {
          if (authError) {
            console.error('🔑 useAuth: Super Admin Auth Error:', authError);
            setIsAuthReady(true);
            return;
          }
          console.log('🔑 useAuth: Super Admin signed in anonymously, linking session...');
          return supabase.rpc('link_current_session_to_user', { target_user_id: 'super-admin' });
        })
        .then((response) => {
          if (response && response.error) {
            console.error('🔑 useAuth: Super Admin RPC Error:', response.error);
          } else {
            console.log('🔑 useAuth: Super Admin session linked successfully');
          }
          setIsAuthReady(true);
        })
        .catch(err => {
          console.error('🔑 useAuth: Super Admin Login Exception:', err);
          setIsAuthReady(true);
        });

      setPinInput('');
      setLoginError('');
      setShowLanding(false);
      return;
    }

    // Check for Global Admin PIN (Master Key for admins)
    if (user && (user.id === 'admin' || user.isAdmin) && pin === globalAdminPin) {
      console.log('🔑 useAuth: Global Admin PIN matched for user:', user.name);
      const loginSessionUser = { ...user, role: UserRole.EMPLOYER };
      setCurrentUser(loginSessionUser);
      localStorage.setItem(STORAGE_KEYS.LAST_USER_ID, user.id);
      
      // Link session to DB for RLS
      setIsAuthReady(false);
      supabase.auth.signInAnonymously()
        .then(({ error: authError }) => {
          if (authError) {
            console.error('🔑 useAuth: Global Admin Auth Error:', authError);
            setIsAuthReady(true);
            return;
          }
          return supabase.rpc('link_current_session_to_user', { target_user_id: user.id });
        })
        .then((response) => {
          if (response && response.error) {
            console.error('🔑 useAuth: Global Admin RPC Error:', response.error);
          }
          setIsAuthReady(true);
        })
        .catch(err => {
          console.error('🔑 useAuth: Global Admin Login Exception:', err);
          setIsAuthReady(true);
        });

      setPinInput('');
      setLoginError('');
      setShowLanding(false);
      return;
    }

    let isPinValid = false;
    if (user) {
      // 1. Try DB RPC validation (most secure, handles hashes)
      isPinValid = await db.checkPin(user.id, pin);
      
      // 2. Fallback to local check if RPC fails (allows plain text pins from state)
      if (!isPinValid && user.pin && pin === user.pin) {
        console.log('🔑 useAuth: PIN matched via local fallback');
        isPinValid = true;
      }
    }

    if (user && isPinValid) {
      if (user.isArchived) {
        setLoginError('Пользователь заблокирован');
        setTimeout(() => setPinInput(''), 500);
        return;
      }
      const loginSessionUser = { ...user, role: UserRole.EMPLOYEE };
      setCurrentUser(loginSessionUser);
      localStorage.setItem(STORAGE_KEYS.LAST_USER_ID, user.id);
      
      // SHADOW MIGRATION: Link this session to the user
      setIsAuthReady(false);
      supabase.auth.signInAnonymously().then(async ({ error: authError }) => {
        if (authError) {
          console.error('🔑 useAuth: Error signing in anonymously:', authError);
          setIsAuthReady(true);
          if (authError.message.includes('Refresh Token Not Found')) {
            await supabase.auth.signOut();
            // Retry sign in after clearing
            await supabase.auth.signInAnonymously();
          }
          return;
        }
        try {
          await supabase.rpc('link_current_session_to_user', { target_user_id: user.id });
          setIsAuthReady(true);
        } catch (err) {
          console.error('🔑 useAuth: Error linking session:', err);
          setIsAuthReady(true);
        }
      }).catch(err => {
        console.error('🔑 useAuth: Unexpected error during anonymous sign in:', err);
        setIsAuthReady(true);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setPinInput('');
    const hasLastUsed = localStorage.getItem(STORAGE_KEYS.LAST_USER_ID);
    setShowLanding(!hasLastUsed);
  };

  const handleSwitchRole = (role: UserRole) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, role };
      setCurrentUser(updatedUser);
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
    handleSwitchRole,
    isAuthReady
  };
};

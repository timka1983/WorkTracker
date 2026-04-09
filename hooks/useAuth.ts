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
    const hasUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    const hasLastUsed = localStorage.getItem(STORAGE_KEYS.LAST_USER_ID);
    return !hasUser && !hasLastUsed;
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
          console.log('🔑 useAuth: Supabase session active, fetching user...');
          // Fetch user from DB based on supabase_auth_id
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('supabase_auth_id', session.user.id)
            .maybeSingle();

          if (userError) {
            console.error('🔑 useAuth: Error fetching user from DB:', userError);
          } else if (userData) {
            console.log('🔑 useAuth: User found in DB:', userData);
            const user: User = {
              id: userData.id,
              name: userData.name,
              role: userData.role as UserRole,
              position: userData.position,
              isAdmin: userData.is_admin,
              organizationId: userData.organization_id,
              pin: userData.pin,
              isArchived: userData.is_archived
            };
            setCurrentUser(user);
            localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
            setShowLanding(false);
          } else {
            // Fallback to local storage if DB fetch fails but session exists
            const cachedCurrentUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
            if (cachedCurrentUser) {
              const parsed = JSON.parse(cachedCurrentUser);
              setCurrentUser(parsed);
              setShowLanding(false);
              // Try to link again just in case
              supabase.rpc('link_current_session_to_user', { target_user_id: parsed.id });
            }
          }
        } else {
          console.log('🔑 useAuth: No active session');
          // Check local storage for legacy support or if session expired
          const cachedCurrentUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
          if (cachedCurrentUser) {
            const parsed = JSON.parse(cachedCurrentUser);
            console.log('🔑 useAuth: Found cached user, signing in anonymously...');
            const { error: signInError } = await supabase.auth.signInAnonymously();
            if (!signInError) {
              await supabase.rpc('link_current_session_to_user', { target_user_id: parsed.id });
              setCurrentUser(parsed);
              setShowLanding(false);
            }
          }
        }
      } catch (err) {
        console.error('🔑 useAuth: Unexpected error during init:', err);
      } finally {
        setIsAuthReady(true);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔑 useAuth: Auth state changed:', event);
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      } else if (event === 'SIGNED_IN' && session) {
        // We handle SIGNED_IN in the login function to ensure we link the session first
      }
    });

    return () => {
      subscription.unsubscribe();
    };
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
      console.log('🔑 useAuth: Super Admin PIN matched');
      const superAdminUser: User = {
        id: 'super-admin',
        name: 'Главный Администратор',
        role: UserRole.SUPER_ADMIN,
        position: 'Super Admin',
        pin: superAdminPin
      };
      setCurrentUser(superAdminUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(superAdminUser));
      
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
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(loginSessionUser));
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
    handleSwitchRole,
    isAuthReady
  };
};

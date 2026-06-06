export const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {
    console.error('Audio play failed', e);
  }
};

import { SWNotificationOptions } from '../types/notification-types';

// Дедупликация: не отправляем одинаковый тег чаще раза в 10 сек
const _pushDedup = new Map<string, number>();
const PUSH_DEDUP_MS = 10_000;

export const showPushNotification = async (title: string, options?: SWNotificationOptions) => {
  try {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    if (Notification.permission !== 'granted') return;

    const tag = options?.tag || `wt-push-${title}`.replace(/\s+/g, '-').slice(0, 64);

    const lastSent = _pushDedup.get(tag);
    if (lastSent && Date.now() - lastSent < PUSH_DEDUP_MS) return;
    _pushDedup.set(tag, Date.now());

    const swOptions: SWNotificationOptions = {
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag,
      renotify: true,
      ...options,
    };

    // SW с таймаутом 3 сек — не висим вечно если SW не готов
    try {
      const swReady = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('SW ready timeout')), 3000)
        ),
      ]);
      await (swReady as ServiceWorkerRegistration).showNotification(title, swOptions);
      return;
    } catch (swErr) {
      console.warn('[Push] SW path failed, fallback:', swErr);
    }

    // Fallback: прямой Notification API
    const n = new Notification(title, {
      body: options?.body as string | undefined,
      icon: swOptions.icon,
      tag,
    });
    setTimeout(() => n.close(), 8000);

  } catch (e) {
    console.error('[Push] Notification failed:', e);
  }
};
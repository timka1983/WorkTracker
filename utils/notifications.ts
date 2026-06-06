export const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
    oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.1); 
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

import { SWNotificationOptions } from '../types/notification-types';

export const showPushNotification = async (title: string, options?: SWNotificationOptions) => {
  try {
    if (!("Notification" in window)) return;

    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }

    if (Notification.permission !== "granted") return;

    // Используем Service Worker — работает когда приложение свёрнуто
    const reg = await navigator.serviceWorker.ready;
    const swOptions: SWNotificationOptions = {
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: 'worktracker',
      renotify: true,
      ...options,
    };
    await reg.showNotification(title, swOptions);
  } catch (e) {
    console.error("Notification failed", e);
  }
};
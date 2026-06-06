import { format, differenceInMinutes, eachDayOfInterval, endOfMonth, parseISO, startOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { WorkLog, User, EntryType, PositionConfig, PayrollConfig, Organization } from './types';
import { SWNotificationOptions } from './types/notification-types';

import { getTelegramUrl } from './lib/telegram';

export const cleanValue = (val: any) => {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (trimmed.length > 0 && !/[a-zA-Z0-9]/.test(trimmed[0])) {
    return trimmed.replace(/^[^a-zA-Z0-9]+/, '');
  }
  return trimmed;
};

export const formatTime = (dateStr?: string) => {
  if (!dateStr) return '--:--';
  return format(parseISO(dateStr), 'HH:mm');
};

export const formatDate = (dateStr: string) => {
  return format(parseISO(dateStr), 'd MMMM yyyy', { locale: ru });
};

export const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}ч ${m}м`;
};

export const formatDurationShort = (minutes: number) => {
  if (minutes === 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
};

export const calculateMinutes = (start: string, end: string) => {
  return differenceInMinutes(parseISO(end), parseISO(start));
};

export const applyRounding = (minutes: number, enabled?: boolean) => {
  if (!enabled) return minutes;
  // Округление вниз до ближайшего часа, если прошло менее 15 минут
  // Например: 1ч 10м -> 1ч 00м (60 мин)
  // 1ч 20м -> 1ч 20м (без изменений)
  const remainder = minutes % 60;
  if (remainder > 0 && remainder <= 15) {
    return minutes - remainder;
  }
  return minutes;
};

export const calculateNightShiftOverlap = (checkIn: string, checkOut: string, nightShiftStart: string = '22:00', nightShiftEnd: string = '06:00') => {
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  let overlapMs = 0;
  const [startHr, startMin] = nightShiftStart.split(':').map(Number);
  const [endHr, endMin] = nightShiftEnd.split(':').map(Number);
  
  let currentDay = new Date(start);
  currentDay.setHours(12, 0, 0, 0); 
  const endDay = new Date(end);
  endDay.setHours(12, 0, 0, 0);
  
  for (let d = new Date(currentDay.getTime() - 86400000); d.getTime() <= endDay.getTime() + 86400000; d = new Date(d.getTime() + 86400000)) {
    const nightStart = new Date(d);
    nightStart.setHours(startHr, startMin, 0, 0);
    const nightEnd = new Date(d);
    if (endHr < startHr || (endHr === startHr && endMin < startMin)) {
      nightEnd.setDate(nightEnd.getDate() + 1);
    }
    nightEnd.setHours(endHr, endMin, 0, 0);
    
    const overlapStart = Math.max(start, nightStart.getTime());
    const overlapEnd = Math.min(end, nightEnd.getTime());
    
    if (overlapEnd > overlapStart) {
      overlapMs += (overlapEnd - overlapStart);
    }
  }
  return overlapMs / (1000 * 60);
};

export const getDaysInMonthArray = (monthStr: string) => {
  const start = startOfMonth(parseISO(`${monthStr}-01`));
  const end = endOfMonth(start);
  return eachDayOfInterval({ start, end });
};

export const exportToCSV = (logs: WorkLog[], users: User[]) => {
  const header = ['Дата', 'Сотрудник', 'Тип', 'Начало', 'Конец', 'Минуты', 'Часы'].join(';');
  const rows = logs.map(log => {
    const user = users.find(u => u.id === log.userId);
    return [
      log.date,
      user?.name || 'Удален',
      log.entryType,
      log.checkIn ? formatTime(log.checkIn) : '',
      log.checkOut ? formatTime(log.checkOut) : '',
      log.durationMinutes,
      (log.durationMinutes / 60).toFixed(2)
    ].join(';');
  });

  const csvContent = "\uFEFF" + [header, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180; // φ, λ in radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  const d = R * c; // in metres
  return d;
};

export const sendNotification = async (title: string, body: string, options?: {
  tag?: string;
  url?: string;
  icon?: string;
}) => {
  if (!('Notification' in window)) return;

  // Запрашиваем разрешение если ещё не дано
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }

  if (Notification.permission !== 'granted') return;

  try {
    // Всегда используем Service Worker — работает когда приложение свёрнуто
    const reg = await navigator.serviceWorker.ready;
    const swOptions: SWNotificationOptions = {
      body,
      icon: options?.icon || '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: options?.tag || 'worktracker-default',
      renotify: true,
      data: { url: options?.url || '/' },
    };
    await reg.showNotification(title, swOptions);
  } catch (err) {
    // Фоллбэк для браузеров без полной SW-поддержки
    console.warn('SW notification failed, fallback:', err);
    try {
      new Notification(title, { body, icon: '/icons/icon-192.png' });
    } catch (e) {
      console.error('Notification fallback failed:', e);
    }
  }
};

export const sendMaxNotification = async (
  botToken: string,
  chatId: string,
  message: string
) => {
  if (!botToken || !chatId) return;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`https://api.max.ru/v1/bot/${botToken}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    clearTimeout(timeoutId);
    
    const data = await response.json();
    if (!data.ok) {
      throw new Error(`Max API error: ${data.description}`);
    }
  } catch (e) {
    console.error('Failed to send Max notification:', e);
  }
};

export const sendTelegramNotification = async (
  botToken: string,
  chatId: string,
  message: string,
  enabled: boolean = true
) => {
  if (!enabled || !botToken || !chatId) return;

  try {
    const url = getTelegramUrl(botToken, 'sendMessage');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.description || 'Telegram API error');
    }
  } catch (e) {
    console.error('Failed to send Telegram notification:', e);
  }
};
   
export const getEffectivePayrollConfig = (user: User, positions: PositionConfig[]) => {
  const positionConfig = positions.find(p => p.name === user.position);
  const baseConfig = positionConfig?.payroll || {
    type: 'hourly' as const,
    rate: 0,
    overtimeMultiplier: 1.5,
    nightShiftBonus: 0,
    sickLeaveRate: 0,
    machineRates: {}
  };

  if (!user.payroll) return baseConfig;

  return {
    ...baseConfig,
    type: user.payroll.overrides?.type ? (user.payroll.type ?? baseConfig.type) : baseConfig.type,
    rate: user.payroll.overrides?.rate ? (user.payroll.rate ?? baseConfig.rate) : baseConfig.rate,
    overtimeMultiplier: user.payroll.overrides?.overtimeMultiplier ? (user.payroll.overtimeMultiplier ?? baseConfig.overtimeMultiplier) : baseConfig.overtimeMultiplier,
    nightShiftBonus: user.payroll.overrides?.nightShiftBonus ? (user.payroll.nightShiftBonus ?? baseConfig.nightShiftBonus) : baseConfig.nightShiftBonus,
    sickLeaveRate: user.payroll.overrides?.sickLeaveRate ? (user.payroll.sickLeaveRate ?? baseConfig.sickLeaveRate) : baseConfig.sickLeaveRate,
    machineRates: user.payroll.overrides?.machineRates 
      ? (user.payroll.machineRates ?? baseConfig.machineRates)
      : baseConfig.machineRates
  };
};

export const calculateMonthlyPayroll = (
  user: User,
  logs: WorkLog[],
  positions: PositionConfig[],
  org?: Organization
): {
  totalSalary: number;
  regularPay: number;
  overtimePay: number;
  nightShiftPay: number;
  sickLeavePay: number;
  bonuses: number;
  fines: number;
  machineEarnings: Record<string, { mins: number, pay: number }>;
  details: {
    regularHours: number;
    overtimeHours: number;
    nightShiftCount: number;
    sickDays: number;
  };
} => {
  const config = getEffectivePayrollConfig(user, positions);
  const positionConfig = positions.find(p => p.name === user.position);

  let regularPay = 0;
  let overtimePay = 0;
  let nightShiftPay = 0;
  let sickLeavePay = 0;
  let bonuses = 0;
  let fines = 0;

  let regularMins = 0;
  let overtimeMins = 0;
  let nightShiftCount = 0;
  let sickDays = 0;

  const machineEarnings: Record<string, { mins: number, pay: number }> = {};

  const standardShiftMinutes = positionConfig?.permissions.maxShiftDurationMinutes || 480;

  const logsByDate: Record<string, WorkLog[]> = {};
  logs.forEach(l => {
    if (!logsByDate[l.date]) logsByDate[l.date] = [];
    logsByDate[l.date].push(l);
  });

  Object.entries(logsByDate).forEach(([date, dayLogs]) => {
    const workLogs = dayLogs.filter(l => l.entryType === EntryType.WORK);
    const absences = dayLogs.filter(l => l.entryType !== EntryType.WORK);

    if (workLogs.length > 0) {
      let anyNight = false;
      const machineTotals: Record<string, { mins: number, rate: number, isNight: boolean }> = {};

      workLogs.forEach(log => {
        let currentRate = config.rate;
        if (log.machineId && config.machineRates && config.machineRates[log.machineId] !== undefined) {
          currentRate = config.machineRates[log.machineId];
        }
        
        // Оплачиваем каждый лог отдельно
        let logPay = 0;
        if (config.type === 'hourly') {
          logPay = (log.durationMinutes / 60) * currentRate;
        } else if (config.type === 'shift') {
          logPay = currentRate;
        } else if (config.type === 'piecework') {
          logPay = (log.itemsProduced || 0) * currentRate;
        }
        
        regularPay += logPay;

        if (log.machineId) {
          if (!machineEarnings[log.machineId]) {
            machineEarnings[log.machineId] = { mins: 0, pay: 0 };
          }
          machineEarnings[log.machineId].mins += log.durationMinutes;
          machineEarnings[log.machineId].pay += logPay;
        }

        // Расчет часов для каждого станка отдельно
        const effectiveDuration = applyRounding(log.durationMinutes, org?.roundShiftMinutes);
        
        if (effectiveDuration > 0) {
          let regularMinutes = Math.min(effectiveDuration, standardShiftMinutes);
          let overtimeMinutes = Math.max(0, effectiveDuration - standardShiftMinutes);

          // Бонус за сверхурочные
          if (overtimeMinutes > 0 && positionConfig?.permissions.calculateOvertime) {
            if (config.type === 'hourly') {
              overtimePay += (overtimeMinutes / 60) * currentRate * (config.overtimeMultiplier - 1);
            } else if (config.type === 'shift') {
              const impliedHourlyRate = currentRate / (standardShiftMinutes / 60);
              overtimePay += (overtimeMinutes / 60) * impliedHourlyRate * (config.overtimeMultiplier - 1);
            } else if (config.type === 'piecework') {
              // Для сдельной оплаты сверхурочные можно считать от базовой часовой ставки, 
              // но проще не применять множитель к сдельной оплате, либо применять его к произведенным деталям в сверхурочное время.
              // Пока оставим без сверхурочных для сдельной, так как это требует отдельного учета деталей в овертайм.
            }
          }

          regularMins += regularMinutes;
          if (positionConfig?.permissions.calculateOvertime) {
            overtimeMins += overtimeMinutes;
          } else {
            regularMins += overtimeMinutes;
          }

          if (log.isNightShift) {
            anyNight = true;
          }
        }
      });

      if (anyNight) {
        nightShiftCount++;
        nightShiftPay += config.nightShiftBonus;
      }
    }

    absences.forEach(log => {
      if (log.entryType === EntryType.SICK) {
        sickDays++;
        if (config.sickLeaveRate) {
          sickLeavePay += config.sickLeaveRate;
        }
      }
    });

    dayLogs.forEach(log => {
      if (log.fine) fines += log.fine;
      if (log.bonus) bonuses += log.bonus;
    });
  });

  if (config.type === 'fixed') {
    regularPay = config.rate;
    const impliedHourlyRate = config.rate / 160;
    overtimePay = (overtimeMins / 60) * impliedHourlyRate * config.overtimeMultiplier;
  }

  const totalSalary = regularPay + overtimePay + nightShiftPay + sickLeavePay + bonuses - fines;

  const toDecimalHours = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h + (m / 100);
  };

  return {
    totalSalary: Math.max(0, Math.round(totalSalary)),
    regularPay: Math.round(regularPay),
    overtimePay: Math.round(overtimePay),
    nightShiftPay: Math.round(nightShiftPay),
    sickLeavePay: Math.round(sickLeavePay),
    bonuses: Math.round(bonuses),
    fines: Math.round(fines),
    machineEarnings,
    details: {
      regularHours: toDecimalHours(regularMins),
      overtimeHours: toDecimalHours(overtimeMins),
      nightShiftCount,
      sickDays
    }
  };
};
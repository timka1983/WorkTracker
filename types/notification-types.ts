/**
 * Расширенные опции уведомлений Service Worker.
 *
 * Стандартный NotificationOptions из lib.dom.d.ts не включает ряд свойств
 * (renotify, badge, data, actions, vibrate), которые поддерживаются браузерами
 * согласно Notifications API spec. Этот интерфейс добавляет недостающие поля,
 * сохраняя полную типобезопасность без использования `as any`.
 *
 * @see https://notifications.spec.whatwg.org/#dictdef-notificationoptions
 */

/** Кнопка действия в уведомлении (до 2 штук, поддержка зависит от браузера) */
export interface SWNotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface SWNotificationOptions extends NotificationOptions {
  /** Повторно показывать звук/вибрацию если tag совпадает с существующим уведомлением */
  renotify?: boolean;
  /** URL маленькой иконки-бейджа (отображается поверх иконки приложения на Android) */
  badge?: string;
  /** Произвольные данные, доступные в notificationclick через event.notification.data */
  data?: unknown;
  /** Паттерн вибрации в мс: [вибрация, пауза, вибрация, ...] */
  vibrate?: number[];
  /** Кнопки действий под текстом уведомления */
  actions?: SWNotificationAction[];
  /** Не показывать уведомление на экране блокировки */
  silent?: boolean;
  /** Требовать взаимодействия пользователя (не скрывать автоматически) */
  requireInteraction?: boolean;
}

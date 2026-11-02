import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { DB } from './db.js';

const ACTION_TYPE = 'PAYMENT_REMINDER_ACTIONS';

function notificationId(transactionId) {
  let hash = 2166136261;
  for (const char of String(transactionId)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 2000000000) + 1;
}

function plannedReminderDate(item, settings = {}) {
  const daysBefore = Math.max(0, Number(settings.reminderDays ?? 1));
  const time = settings.reminderTime || '09:00';
  const [year, month, day] = item.dueDate.split('-').map(Number);
  const date = new Date(year, month - 1, day - daysBefore, Number(time.slice(0, 2)), Number(time.slice(3, 5)), 0, 0);
  if (date.getTime() <= Date.now()) return new Date(Date.now() + 60_000);
  return date;
}

export async function setupNotificationActions(onPaid) {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.registerActionTypes({
    types: [{
      id: ACTION_TYPE,
      actions: [
        { id: 'PAYMENT_PAID', title: 'Ödendi', foreground: true },
        { id: 'SNOOZE_ONE_HOUR', title: 'Ödenmedi · 1 saat sonra', foreground: true }
      ]
    }]
  });
  await LocalNotifications.addListener('localNotificationActionPerformed', async event => {
    const transactionId = event.notification?.extra?.transactionId;
    if (!transactionId) return;
    if (event.actionId === 'PAYMENT_PAID') {
      const item = await DB.getTransaction(transactionId);
      if (item) {
        item.status = 'paid';
        item.paidAt = new Date().toISOString();
        item.updatedAt = new Date().toISOString();
        await DB.saveTransaction(item);
        onPaid?.(item);
      }
      await cancelReminder(transactionId);
    } else if (event.actionId === 'SNOOZE_ONE_HOUR') {
      await scheduleOneHourAgain(transactionId);
    }
  });
}

export async function requestNotificationPermission() {
  if (!Capacitor.isNativePlatform()) return { supported: false, message: 'Bildirimler yalnızca Android uygulamasında tam olarak çalışır.' };
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions();
  let exact = null;
  try { exact = await LocalNotifications.checkExactNotificationSetting(); } catch { /* Android sürümüne göre desteklenmeyebilir. */ }
  return { supported: true, permission: permission.display, exact: exact?.exact_alarm ?? 'unknown' };
}

export async function openExactAlarmSettings() {
  if (!Capacitor.isNativePlatform()) return;
  try { await LocalNotifications.changeExactNotificationSetting(); } catch (error) { console.warn('Tam zamanlı alarm ayarları açılamadı:', error); }
}

export async function cancelReminder(transactionId) {
  if (!Capacitor.isNativePlatform()) return;
  try { await LocalNotifications.cancel({ notifications: [{ id: notificationId(transactionId) }] }); } catch { /* Zamanlanmış bildirim yoksa sorun değil. */ }
}

export async function scheduleOneHourAgain(transactionId) {
  if (!Capacitor.isNativePlatform()) return;
  const item = await DB.getTransaction(transactionId);
  if (!item || item.status === 'paid') return;
  const notifyAt = new Date(Date.now() + 60 * 60 * 1000);
  const id = notificationId(transactionId);
  try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch { /* yok */ }
  await LocalNotifications.schedule({ notifications: [{
    id,
    title: 'Ödeme hatırlatması',
    body: `${item.category}: ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(item.amount)} — ödendi olarak işaretlenmedi.`,
    schedule: { at: notifyAt, allowWhileIdle: true },
    actionTypeId: ACTION_TYPE,
    extra: { transactionId }
  }] });
}

export async function scheduleReminder(item) {
  if (!Capacitor.isNativePlatform() || item.type !== 'expense' || item.status === 'paid' || !item.dueDate) return;
  const id = notificationId(item.id);
  const settings = await DB.getSetting('reminders', { reminderDays: 1, reminderTime: '09:00' });
  const at = plannedReminderDate(item, settings);
  try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch { /* yok */ }
  await LocalNotifications.schedule({ notifications: [{
    id,
    title: 'Yaklaşan ödeme',
    body: `${item.category}: ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(item.amount)} • Son ödeme: ${item.dueDate}`,
    schedule: { at, allowWhileIdle: true },
    actionTypeId: ACTION_TYPE,
    extra: { transactionId: item.id }
  }] });
}

export async function syncAllReminders() {
  if (!Capacitor.isNativePlatform()) return;
  try { await LocalNotifications.cancelAll(); } catch { /* İlk açılışta boş olabilir. */ }
  const items = await DB.allTransactions();
  for (const item of items) {
    if (item.type === 'expense' && item.status !== 'paid' && item.dueDate) {
      try { await scheduleReminder(item); } catch (error) { console.warn('Hatırlatma zamanlanamadı:', item.category, error); }
    }
  }
}

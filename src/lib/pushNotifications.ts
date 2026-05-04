
// Web Push Notifications Service
// Handles push notification subscription and display

const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjZJjSqaerxoC2tOkjgsFHlJkNRs0';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
}

export async function requestPushPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function subscribeToPush(userId: string, userRole: string): Promise<PushSubscription | null> {
  try {
    const granted = await requestPushPermission();
    if (!granted) return null;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push messaging is not supported');
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) return existing;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    return subscription;
  } catch (err) {
    console.log('Push subscription failed:', err);
    return null;
  }
}

// Show a local notification immediately (works when app is open)
export function showLocalNotification(title: string, body: string, options?: NotificationOptions): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notifOpts: NotificationOptions = {
    body,
    icon: '/retrobliss-icon.jpg',
    badge: '/retrobliss-icon.jpg',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    tag: `rb-${Date.now()}`,
    ...options,
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, notifOpts);
    }).catch(() => {
      new Notification(title, notifOpts);
    });
  } else {
    new Notification(title, notifOpts);
  }
}

// Re-engagement notification scheduler
let reEngagementTimer: ReturnType<typeof setTimeout> | null = null;

const RE_ENGAGEMENT_MESSAGES = [
  { title: '🚗 Ready for your next ride?', body: "It's safer to travel with RetroBliss. Book a ride now and get where you're going fast!" },
  { title: '⭐ Nigeria\'s #1 Ride Platform', body: 'Trusted by thousands of riders across Nigeria. Your next safe ride is just a tap away!' },
  { title: '🛡️ Safe. Fast. Reliable.', body: 'RetroBliss drivers are vetted and verified. Travel with confidence today!' },
  { title: '⚡ Beat the traffic!', body: 'Skip the stress — book a RetroBliss ride and arrive on time, every time.' },
  { title: '💰 Great fares await!', body: 'Affordable rides across your city. Check out our current fares and book your trip!' },
];

export function startReEngagementNotifications(): void {
  if (reEngagementTimer) clearTimeout(reEngagementTimer);

  const sendReEngagement = () => {
    const msg = RE_ENGAGEMENT_MESSAGES[Math.floor(Math.random() * RE_ENGAGEMENT_MESSAGES.length)];
    showLocalNotification(msg.title, msg.body, {
      tag: 're-engagement',
      requireInteraction: false,
    });

    // Schedule next one in 2-4 hours
    const nextIn = (120 + Math.random() * 120) * 60 * 1000;
    reEngagementTimer = setTimeout(sendReEngagement, nextIn);
  };

  // First one after 30 minutes of inactivity
  reEngagementTimer = setTimeout(sendReEngagement, 30 * 60 * 1000);
}

export function resetReEngagementTimer(): void {
  if (reEngagementTimer) clearTimeout(reEngagementTimer);
  startReEngagementNotifications();
}

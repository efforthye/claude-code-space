// Fires a local notification when a generation job finishes. Mounted app-wide so
// it works regardless of which tab is open. Note: Expo Go supports LOCAL
// notifications (this) but not remote push — for background/killed-app delivery a
// development build with a push token would be needed later.

import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { listJobs } from '@/api/client';
import { useSettings } from '@/settings/settings';

import { useInbox } from './inbox';

// Local notifications aren't supported on web — skip the handler there.
const NOTIFY_SUPPORTED = Platform.OS !== 'web';

if (NOTIFY_SUPPORTED) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export function JobNotifier() {
  const { t, notifyOnDone } = useSettings();
  const inbox = useInbox();
  const inboxRef = useRef(inbox);
  inboxRef.current = inbox;
  const tRef = useRef(t);
  tRef.current = t;
  const notifyRef = useRef(notifyOnDone);
  notifyRef.current = notifyOnDone;
  const known = useRef<Record<string, string>>({});
  const grantedRef = useRef(false);

  const router = useRouter();

  // Tapping the SYSTEM notification has to land somewhere too. Without this the
  // OS opens the app at whatever screen it was last on, which after "your film
  // is ready" is the one place the news is not.
  useEffect(() => {
    if (!NOTIFY_SUPPORTED) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const href = response.notification.request.content.data?.href;
      if (typeof href === 'string' && href) router.push(href as never);
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    let alive = true;

    if (NOTIFY_SUPPORTED) {
      (async () => {
        try {
          const current = await Notifications.getPermissionsAsync();
          if (current.status === 'granted') {
            grantedRef.current = true;
          } else {
            const req = await Notifications.requestPermissionsAsync();
            grantedRef.current = req.status === 'granted';
          }
        } catch {
          grantedRef.current = false;
        }
      })();
    }

    const tick = async () => {
      try {
        const jobs = await listJobs();
        if (!alive) return;
        for (const job of jobs) {
          const prev = known.current[job.id];
          const finished = job.status === 'done' || job.status === 'failed';
          // Only notify on a real transition we witnessed (not the first sighting).
          if (prev && prev !== job.status && finished) {
            const done = job.status === 'done';
            // Always file it into the in-app inbox (all platforms)…
            inboxRef.current.add({
              icon: done ? 'film' : 'alert',
              title: done ? tRef.current('notify.doneTitle') : tRef.current('notify.failTitle'),
              body: job.title,
              // A finished film lives in the library; a failed one is only
              // explicable on its own job screen, where the reason is shown.
              href: done ? '/(tabs)/library' : `/jobs/${job.id}`,
            });
            // …and additionally pop a system notification where supported.
            if (NOTIFY_SUPPORTED && grantedRef.current && notifyRef.current) {
              Notifications.scheduleNotificationAsync({
                content: {
                  title: done ? tRef.current('notify.doneTitle') : tRef.current('notify.failTitle'),
                  body: job.title,
                  data: { href: done ? '/(tabs)/library' : `/jobs/${job.id}` },
                },
                trigger: null,
              }).catch(() => {});
            }
          }
          known.current[job.id] = job.status;
        }
      } catch {
        // offline / transient — ignore
      }
    };

    tick();
    const timer = setInterval(tick, 8000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return null;
}

// Fires a local notification when a generation job finishes. Mounted app-wide so
// it works regardless of which tab is open. Note: Expo Go supports LOCAL
// notifications (this) but not remote push — for background/killed-app delivery a
// development build with a push token would be needed later.

import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';

import { listJobs } from '@/api/client';
import { useI18n } from '@/settings/settings';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function JobNotifier() {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const known = useRef<Record<string, string>>({});
  const grantedRef = useRef(false);

  useEffect(() => {
    let alive = true;

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

    const tick = async () => {
      try {
        const jobs = await listJobs();
        if (!alive) return;
        for (const job of jobs) {
          const prev = known.current[job.id];
          const finished = job.status === 'done' || job.status === 'failed';
          // Only notify on a real transition we witnessed (not the first sighting).
          if (prev && prev !== job.status && finished && grantedRef.current) {
            const done = job.status === 'done';
            Notifications.scheduleNotificationAsync({
              content: {
                title: done ? tRef.current('notify.doneTitle') : tRef.current('notify.failTitle'),
                body: job.title,
              },
              trigger: null,
            }).catch(() => {});
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

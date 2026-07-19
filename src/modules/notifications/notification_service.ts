import { Inject, Injectable } from '@nestjs/common';
import type { App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { FIREBASE_APP } from '../../config/firebase.config';

@Injectable()
export class NotificationService {
  constructor(@Inject(FIREBASE_APP) private readonly firebaseApp: App) {}

  async sendNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    const messaging = getMessaging(this.firebaseApp);
    const response = await messaging.send({
      token: token,
      notification: {
        title: title,
        body: body,
      },
      data,
      android: {
        priority: 'high',
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    });
    return response;
  }
}

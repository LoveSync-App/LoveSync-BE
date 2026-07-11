import { Injectable } from '@nestjs/common';
import admin from '../../config/firebase.config';
import { getMessaging } from 'firebase-admin/messaging';

@Injectable()
export class NotificationService {
  async sendNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    const messaging = getMessaging(admin);
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

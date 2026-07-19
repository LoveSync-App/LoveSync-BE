import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  App,
  cert,
  getApps,
  initializeApp,
  ServiceAccount,
} from 'firebase-admin/app';

export const FIREBASE_APP = 'FIREBASE_APP';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: FIREBASE_APP,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): App => {
        const projectId = configService.get<string>('FIREBASE_PROJECT_ID');
        const clientEmail = configService.get<string>('FIREBASE_CLIENT_EMAIL');
        const privateKey = configService.get<string>('FIREBASE_PRIVATE_KEY');

        if (!projectId || !clientEmail || !privateKey) {
          throw new Error(
            'Missing Firebase config. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env',
          );
        }

        const firebaseServiceAccount: ServiceAccount = {
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        };

        return getApps().length === 0
          ? initializeApp({
              credential: cert(firebaseServiceAccount),
            })
          : getApps()[0];
      },
    },
  ],
  exports: [FIREBASE_APP],
})
export class FirebaseConfigModule {}

import { Inject, Injectable } from '@nestjs/common';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FIREBASE_APP } from '../../config/firebase.config';

@Injectable()
export class FirebaseIdentityService {
  constructor(@Inject(FIREBASE_APP) private readonly firebaseApp: App) {}

  verifyIdToken(idToken: string) {
    return getAuth(this.firebaseApp).verifyIdToken(idToken, true);
  }
}

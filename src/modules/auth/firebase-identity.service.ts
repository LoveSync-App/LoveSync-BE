import { Injectable } from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import firebaseApp from '../../config/firebase.config';

@Injectable()
export class FirebaseIdentityService {
  verifyIdToken(idToken: string) {
    return getAuth(firebaseApp).verifyIdToken(idToken, true);
  }
}

import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import serviceAccount from '../../firebase-service-account.json';

const firebaseServiceAccount: ServiceAccount = {
    projectId: serviceAccount.project_id,
    privateKey: serviceAccount.private_key,
    clientEmail: serviceAccount.client_email,
};

const app =
    getApps().length === 0
    ? initializeApp({
        credential: cert(firebaseServiceAccount),
    })
    : getApps()[0];

export default app;
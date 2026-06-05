import { supabase } from './supabase';
import { OperationType } from '../types';

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  // Safe default user lookup
  const user = (supabase.auth as any)._currentUser || null;

  const errInfo: any = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.id || 'guest',
      email: user?.email || null,
    },
    operationType,
    path
  };
  console.error('Supabase Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}


import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wmjcqbtxazxtiupdqfgb.supabase.co';
const supabaseKey = 'sb_publishable_PY7K8XUsFp5HfjzIl72WDQ__fwe4c0W';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to prevent database/auth operations from hanging indefinitely
export function withTimeout<T>(
  promise: PromiseLike<T>, 
  ms: number = 8000, 
  errorMsg: string = 'Secure connection timeout. Please check your internet connection and try again.'
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([
    Promise.resolve(promise).then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise
  ]);
}

// Compatibility class for Firebase Timestamps
export class SupabaseTimestamp {
  seconds: number;
  nanoseconds: number;

  constructor(dateInput: any) {
    const d = new Date(dateInput || Date.now());
    this.seconds = Math.floor(d.getTime() / 1000);
    this.nanoseconds = (d.getTime() % 1000) * 1000000;
  }

  toDate(): Date {
    return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1000000));
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1000000);
  }

  static now(): SupabaseTimestamp {
    return new SupabaseTimestamp(new Date());
  }
}

export function mapFromSupabase(item: any): any {
  if (!item) return item;
  const result = { ...item };
  
  // 1. Convert snake_case / lowercase keys to camelCase for typescript usage
  for (const key of Object.keys(result)) {
    const camelKey = REVERSE_KEY_MAPPINGS[key];
    if (camelKey && result[camelKey] === undefined) {
      result[camelKey] = result[key];
    }
  }

  // 2. Map timestamp fields
  const timestampFields = [
    'lastUpdated', 'last_updated', 'lastupdated',
    'startTime', 'start_time', 'starttime',
    'entryTime', 'entry_time', 'entrytime',
    'paymentTime', 'payment_time', 'paymenttime',
    'exitTime', 'exit_time', 'exittime',
    'overtimeStartedAt', 'overtime_started_at', 'overtimestarted_at',
    'timestamp',
    'createdAt', 'created_at', 'createdat',
    'updatedAt', 'updated_at', 'updatedat'
  ];

  for (const field of timestampFields) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = new SupabaseTimestamp(result[field]);
    }
  }

  return result;
}

export function mapToSupabase(item: any): any {
  if (!item) return item;
  const result = { ...item };
  
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (val && typeof val === 'object') {
      if (typeof val.toDate === 'function') {
        result[key] = val.toDate().toISOString();
      } else if (val._methodName === 'serverTimestamp') {
        result[key] = new Date().toISOString();
      }
    }
  }
  return result;
}

export const REVERSE_KEY_MAPPINGS: Record<string, string> = {
  last_updated: 'lastUpdated',
  last_changed_by: 'lastChangedBy',
  sensor_entry: 'sensorEntry',
  sensor_exit: 'sensorExit',
  active_booking_id: 'activeBookingId',
  sensor_active: 'sensorActive',
  user_id: 'userId',
  slot_id: 'slotId',
  start_time: 'startTime',
  entry_time: 'entryTime',
  payment_time: 'paymentTime',
  exit_time: 'exitTime',
  total_bill: 'totalBill',
  base_amount: 'baseAmount',
  overtime_bill: 'overtimeBill',
  vehicle_type: 'vehicleType',
  time_limit: 'timeLimit',
  remaining_time: 'remainingTime',
  current_bill: 'currentBill',
  overtime_minutes: 'overtimeMinutes',
  overtime_charge: 'overtimeCharge',
  warning_sent_30: 'warningSent30',
  warning_sent_10: 'warningSent10',
  overtime_started: 'overtimeStarted',
  overtime_cycle: 'overtimeCycle',
  overtime_blocks: 'overtimeBlocks',
  overtime_started_at: 'overtimeStartedAt',
  last_notification_sent: 'lastNotificationSent',
  vehicle_number: 'vehicleNumber',
  original_booking_id: 'originalBookingId',
  profile_completed: 'profileCompleted',
  mobile_number: 'mobileNumber',
  vehicle_plate: 'vehiclePlate',
  display_name: 'displayName',
  full_name: 'fullName',
  payment_status: 'paymentStatus',
  session_status: 'sessionStatus',
  final_amount: 'finalAmount'
};

export const KEY_MAPPINGS: Record<string, string[]> = {
  lastUpdated: ['last_updated', 'lastupdated'],
  lastChangedBy: ['last_changed_by', 'lastchangedby'],
  sensorEntry: ['sensor_entry', 'sensorentry'],
  sensorExit: ['sensor_exit', 'sensorexit'],
  activeBookingId: ['active_booking_id', 'activebookingid'],
  sensorActive: ['sensor_active', 'sensoractive'],
  userId: ['user_id', 'userid'],
  slotId: ['slot_id', 'slotid'],
  startTime: ['start_time', 'starttime'],
  entryTime: ['entry_time', 'entrytime'],
  paymentTime: ['payment_time', 'paymenttime'],
  exitTime: ['exit_time', 'exittime'],
  totalBill: ['total_bill', 'totalbill'],
  baseAmount: ['base_amount', 'baseamount'],
  overtimeBill: ['overtime_bill', 'overtimebill'],
  vehicleType: ['vehicle_type', 'vehicletype'],
  timeLimit: ['time_limit', 'timelimit'],
  remainingTime: ['remaining_time', 'remainingtime'],
  currentBill: ['current_bill', 'currentbill'],
  overtimeMinutes: ['overtime_minutes', 'overtimeminutes'],
  overtimeCharge: ['overtime_charge', 'overtimecharge'],
  warningSent30: ['warning_sent_30', 'warningsent30'],
  warningSent10: ['warning_sent_10', 'warningsent10'],
  overtimeStarted: ['overtime_started', 'overtimestarted'],
  overtimeCycle: ['overtime_cycle', 'overtimecycle'],
  overtimeBlocks: ['overtime_blocks', 'overtimeblocks'],
  overtimeStartedAt: ['overtime_started_at', 'overtimestarted_at'],
  lastNotificationSent: ['last_notification_sent', 'lastnotificationsent'],
  vehicleNumber: ['vehicle_number', 'vehiclenumber'],
  originalBookingId: ['original_booking_id', 'originalbookingid'],
  profileCompleted: ['profile_completed', 'profilecompleted'],
  mobileNumber: ['mobile_number', 'mobilenumber'],
  vehiclePlate: ['vehicle_plate', 'vehicleplate'],
  displayName: ['display_name', 'displayname'],
  fullName: ['full_name', 'fullname'],
  paymentStatus: ['payment_status', 'paymentstatus'],
  sessionStatus: ['session_status', 'sessionstatus'],
  finalAmount: ['final_amount', 'finalamount']
};

export async function safeUpdate(tableName: string, data: any, matchField: string, matchValue: any) {
  let attemptData = { ...data };
  const maxRetries = 20;
  const triedMismatches = new Set<string>();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data: resData, error } = await supabase
        .from(tableName)
        .update(attemptData)
        .eq(matchField, matchValue)
        .select();

      if (!error) {
        return { data: resData, error: null };
      }

      console.error(`[safeUpdate] Error in ${tableName}:`, error);

      if (error.code === '42703' || (error.message && error.message.includes('does not exist'))) {
        const match = error.message.match(/column "([^"]+)"/);
        if (match && match[1]) {
          const colName = match[1];
          triedMismatches.add(colName);
          
          let replaced = false;
          for (const [camelKey, alts] of Object.entries(KEY_MAPPINGS)) {
            if (camelKey === colName || alts.includes(colName)) {
              const originalValue = attemptData[camelKey] !== undefined ? attemptData[camelKey] : attemptData[colName];
              
              if (originalValue !== undefined) {
                delete attemptData[camelKey];
                delete attemptData[colName];
                
                const candidates = [camelKey, ...alts].filter(k => !triedMismatches.has(k));
                if (candidates.length > 0) {
                  const nextCandidate = candidates[0];
                  console.log(`[safeUpdate] ${tableName}: Mapping column ${colName} -> ${nextCandidate}`);
                  attemptData[nextCandidate] = originalValue;
                  replaced = true;
                }
                break;
              }
            }
          }

          if (!replaced) {
            console.warn(`[safeUpdate] ${tableName}: Column ${colName} registry not found or fully exhausted. Skipping.`);
            delete attemptData[colName];
            for (const key of Object.keys(attemptData)) {
              if (key.toLowerCase() === colName.toLowerCase()) {
                delete attemptData[key];
              }
            }
          }

          if (Object.keys(attemptData).length === 0) {
            console.log(`[safeUpdate] No columns left to update for ${tableName}. Treating as no-op.`);
            return { data: [], error: null };
          }
          continue;
        }
      }

      return { data: null, error };
    } catch (err: any) {
      console.error(`[safeUpdate] Fatal catch for ${tableName}:`, err);
      return { data: null, error: err };
    }
  }

  return { data: null, error: new Error(`safeUpdate on ${tableName} exhausted max retries.`) };
}

export async function safeInsert(tableName: string, data: any) {
  let attemptData = { ...data };
  const maxRetries = 20;
  const triedMismatches = new Set<string>();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data: resData, error } = await supabase
        .from(tableName)
        .insert(attemptData)
        .select();

      if (!error) {
        return { data: resData, error: null };
      }

      console.error(`[safeInsert] Error in ${tableName}:`, error);

      if (error.code === '42703' || (error.message && error.message.includes('does not exist'))) {
        const match = error.message.match(/column "([^"]+)"/);
        if (match && match[1]) {
          const colName = match[1];
          triedMismatches.add(colName);
          
          let replaced = false;
          for (const [camelKey, alts] of Object.entries(KEY_MAPPINGS)) {
            if (camelKey === colName || alts.includes(colName)) {
              const originalValue = attemptData[camelKey] !== undefined ? attemptData[camelKey] : attemptData[colName];
              
              if (originalValue !== undefined) {
                delete attemptData[camelKey];
                delete attemptData[colName];
                
                const candidates = [camelKey, ...alts].filter(k => !triedMismatches.has(k));
                if (candidates.length > 0) {
                  const nextCandidate = candidates[0];
                  console.log(`[safeInsert] ${tableName}: Mapping column ${colName} -> ${nextCandidate}`);
                  attemptData[nextCandidate] = originalValue;
                  replaced = true;
                }
                break;
              }
            }
          }

          if (!replaced) {
            console.warn(`[safeInsert] ${tableName}: Column ${colName} registry not found or fully exhausted. Skipping.`);
            delete attemptData[colName];
            for (const key of Object.keys(attemptData)) {
              if (key.toLowerCase() === colName.toLowerCase()) {
                delete attemptData[key];
              }
            }
          }

          continue;
        }
      }

      return { data: null, error };
    } catch (err: any) {
      console.error(`[safeInsert] Fatal catch for ${tableName}:`, err);
      return { data: null, error: err };
    }
  }

  return { data: null, error: new Error(`safeInsert on ${tableName} exhausted max retries.`) };
}

export async function safeUpsert(tableName: string, data: any) {
  let attemptData = { ...data };
  const maxRetries = 20;
  const triedMismatches = new Set<string>();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data: resData, error } = await supabase
        .from(tableName)
        .upsert(attemptData)
        .select();

      if (!error) {
        return { data: resData, error: null };
      }

      console.error(`[safeUpsert] Error in ${tableName}:`, error);

      if (error.code === '42703' || (error.message && error.message.includes('does not exist'))) {
        const match = error.message.match(/column "([^"]+)"/);
        if (match && match[1]) {
          const colName = match[1];
          triedMismatches.add(colName);
          
          let replaced = false;
          for (const [camelKey, alts] of Object.entries(KEY_MAPPINGS)) {
            if (camelKey === colName || alts.includes(colName)) {
              const originalValue = attemptData[camelKey] !== undefined ? attemptData[camelKey] : attemptData[colName];
              
              if (originalValue !== undefined) {
                delete attemptData[camelKey];
                delete attemptData[colName];
                
                const candidates = [camelKey, ...alts].filter(k => !triedMismatches.has(k));
                if (candidates.length > 0) {
                  const nextCandidate = candidates[0];
                  console.log(`[safeUpsert] ${tableName}: Mapping column ${colName} -> ${nextCandidate}`);
                  attemptData[nextCandidate] = originalValue;
                  replaced = true;
                }
                break;
              }
            }
          }

          if (!replaced) {
            console.warn(`[safeUpsert] ${tableName}: Column ${colName} registry not found or fully exhausted. Skipping.`);
            delete attemptData[colName];
            for (const key of Object.keys(attemptData)) {
              if (key.toLowerCase() === colName.toLowerCase()) {
                delete attemptData[key];
              }
            }
          }

          continue;
        }
      }

      return { data: null, error };
    } catch (err: any) {
      console.error(`[safeUpsert] Fatal catch for ${tableName}:`, err);
      return { data: null, error: err };
    }
  }

  return { data: null, error: new Error(`safeUpsert on ${tableName} exhausted max retries.`) };
}

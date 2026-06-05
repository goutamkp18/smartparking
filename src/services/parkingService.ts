import { supabase, SupabaseTimestamp, mapFromSupabase, mapToSupabase, safeUpdate, safeInsert, safeUpsert } from '../lib/supabase';
import { 
  ParkingSlot, 
  SlotStatus, 
  Booking, 
  BookingStatus, 
  OperationType,
  GateState,
  VehicleType 
} from '../types';
import { handleFirestoreError } from '../lib/utils';

const VEHICLE_HOURLY_RATES: Record<VehicleType, number> = {
  [VehicleType.BIKE]: 10,
  [VehicleType.THREE_WHEELER]: 15,
  [VehicleType.FOUR_WHEELER]: 20,
  [VehicleType.TRUCK]: 50
};

// Realtime User Synchronization
export let _supabaseUser: any = null;

supabase.auth.onAuthStateChange((event, session) => {
  _supabaseUser = session?.user || null;
  if (_supabaseUser) {
    // Inject uid for backward-compatibility with screens pointing to the older user.uid format
    _supabaseUser.uid = _supabaseUser.id;
  }
});

// Sync wrapper to simulate onSnapshot behavior in Supabase
function subscribeToTable<T extends { id: string }>(
  tableName: string,
  queryBuilder: (query: any) => any,
  callback: (data: T[]) => void,
  filterColumn?: string,
  filterValue?: any
) {
  let cache: T[] = [];

  // 1. Fetch initial state
  let baseQuery = supabase.from(tableName).select('*');
  baseQuery = queryBuilder(baseQuery);

  const performInitialFetch = async () => {
    try {
      const { data, error } = await baseQuery;
      if (error) {
        console.error(`Sub initial fetch error for ${tableName}:`, error);
        return;
      }
      cache = (data || []).map(item => mapFromSupabase(item)) as T[];
      callback([...cache]);
    } catch (e) {
      console.error(`Sub initial fetch fail for ${tableName}:`, e);
    }
  };

  performInitialFetch();

  // 2. Realtime listener
  let filterStr = undefined;
  if (filterColumn && filterValue !== undefined) {
    filterStr = `${filterColumn}=eq.${filterValue}`;
  }

  const channel = supabase
    .channel(`${tableName}-rt-${Math.random().toString(36).substr(2, 9)}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: tableName,
        filter: filterStr
      },
      (payload: any) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        if (eventType === 'INSERT') {
          const transformed = mapFromSupabase(newRecord) as T;
          const index = cache.findIndex(item => item.id === transformed.id);
          if (index === -1) {
            cache.push(transformed);
          } else {
            cache[index] = transformed;
          }
        } else if (eventType === 'UPDATE') {
          const transformed = mapFromSupabase(newRecord) as T;
          const index = cache.findIndex(item => item.id === transformed.id);
          if (index !== -1) {
            cache[index] = transformed;
          } else {
            cache.push(transformed);
          }
        } else if (eventType === 'DELETE') {
          cache = cache.filter(item => item.id !== oldRecord.id);
        }
        
        callback([...cache]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export const getUserId = () => {
  return _supabaseUser?.id || 'guest';
};

export const parkingService = {
  // State management and locks
  _paymentLock: new Set<string>(),
  _seeded: false,
  _lastSyncs: new Map<string, number>(),
  _lastState: new Map<string, string>(), // bookingId -> stringified state of important markers

  // Seed default slots if none exist
  async seedSlots() {
    if (this._seeded || !getUserId() || getUserId() === 'guest') return;
    this._seeded = true;
    try {
      const { data: existingSlots, error } = await supabase.from('slots').select('id');
      if (error) {
        console.error('Error fetching slots during seed check:', error);
        return;
      }

      if (!existingSlots || existingSlots.length === 0) {
        console.log('Seeding slots in Supabase...');
        const slotsToInsert = [];
        for (let i = 1; i <= 4; i++) {
          slotsToInsert.push({
            id: `slot-S${i}`,
            number: `S${i}`,
            floor: 'Ground',
            status: SlotStatus.EMPTY,
            type: 'Premium',
            lastUpdated: new Date().toISOString()
          });
        }
        const { error: insertError } = await supabase.from('slots').insert(slotsToInsert);
        if (insertError) {
          console.error('Error seeding slots:', insertError);
        } else {
          console.log('Slots seeded successfully in Supabase.');
        }
      }

      // Ensure system gate exists
      const { data: gateSnap } = await supabase.from('system').select('*').eq('id', 'gate').maybeSingle();
      if (!gateSnap) {
        await supabase.from('system').insert({
          id: 'gate',
          status: 'Closed',
          lastChangedBy: 'system',
          timestamp: new Date().toISOString(),
          sensorEntry: false,
          sensorExit: false
        });
      }
    } catch (e) {
      console.error('Failed to seed slots', e);
    }
  },

  // Subscribe to all slots
  subscribeToSlots(callback: (slots: ParkingSlot[]) => void) {
    return subscribeToTable<ParkingSlot>(
      'slots',
      (q) => q.order('number', { ascending: true }),
      callback
    );
  },

  // Subscribe to user bookings
  subscribeToUserBookings(callback: (bookings: Booking[]) => void) {
    const userId = getUserId();
    return subscribeToTable<Booking>(
      'bookings',
      (q) => q.eq('userId', userId).order('startTime', { ascending: false }),
      callback,
      'userId',
      userId
    );
  },

  // Book a slot
  async bookSlot(slotId: string, vehicleType?: VehicleType, timeLimit?: number): Promise<string> {
    const userId = getUserId();
    const rate = VEHICLE_HOURLY_RATES[vehicleType || VehicleType.FOUR_WHEELER] || 20;
    const baseAmount = rate * (timeLimit || 4);

    // Fetch user profile from Supabase
    const { data: userProfile } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();

    try {
      // 1. Enforce only one active slot per user at the same time
      const { data: activeUserBookings, error: activeErr } = await supabase
        .from('bookings')
        .select('id')
        .eq('userId', userId)
        .in('status', [
          BookingStatus.RESERVED,
          BookingStatus.ACTIVE,
          BookingStatus.TIME_ENDING,
          BookingStatus.OVERTIME_ACTIVE,
          BookingStatus.PAYMENT_PENDING
        ]);

      if (activeErr) throw activeErr;
      if (activeUserBookings && activeUserBookings.length > 0) {
        throw new Error('You already have an active reservation or session. Only one active slot is allowed per user.');
      }

      // 2. Verify Slot is Empty
      const { data: slot, error: slotErr } = await supabase.from('slots').select('*').eq('id', slotId).single();
      if (slotErr || !slot) throw new Error('Slot does not exist');
      if (slot.status !== SlotStatus.EMPTY) throw new Error('Slot already taken');

      const bookingId = 'booking-' + Math.random().toString(36).substr(2, 9);
      const nowString = new Date().toISOString();

      const bookingData = {
        id: bookingId,
        userId,
        slotId,
        startTime: nowString,
        status: BookingStatus.RESERVED,
        baseAmount,
        totalBill: baseAmount,
        currentBill: baseAmount,
        overtimeBill: 0,
        overtimeMinutes: 0,
        overtimeCharge: 0,
        overtimeCycle: 0,
        overtimeBlocks: 0,
        vehicleType: vehicleType || VehicleType.FOUR_WHEELER,
        vehicleNumber: userProfile?.vehicleNumber || 'N/A',
        timeLimit: timeLimit || 4,
        remainingTime: (timeLimit || 4) * 3600,
        warningSent30: false,
        warningSent10: false,
        overtimeStarted: false
      };

      // 2. Perform inserts and updates sequentially
      const { error: bookingErr } = await safeInsert('bookings', bookingData);
      if (bookingErr) throw bookingErr;

      const { error: slotUpdateErr } = await safeUpdate('slots', {
        status: SlotStatus.RESERVED,
        currentUserId: userId,
        lastUpdated: nowString
      }, 'id', slotId);
      if (slotUpdateErr) throw slotUpdateErr;

      this.notify('Booking Successful', `Slot S${slotId?.replace(/\D/g, '') || '?'} booked successfully`, 'booking');

      return bookingId;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `slots/${slotId}`);
      throw error;
    }
  },

  // Subscribe to all active bookings (for predictor panel)
  subscribeToAllActiveBookings(callback: (bookings: Booking[]) => void) {
    return subscribeToTable<Booking>(
      'bookings',
      (q) => q.in('status', [
        BookingStatus.ACTIVE, 
        BookingStatus.TIME_ENDING, 
        BookingStatus.OVERTIME_ACTIVE,
        BookingStatus.RESERVED
      ]),
      callback
    );
  },

  // Update status when vehicle enters (Reserved -> Occupied)
  async vehicleEntry(bookingId: string, slotId: string) {
    try {
      const nowString = new Date().toISOString();
      await safeUpdate('bookings', {
        status: BookingStatus.ACTIVE,
        entryTime: nowString
      }, 'id', bookingId);

      await safeUpdate('slots', {
        status: SlotStatus.OCCUPIED,
        lastUpdated: nowString
      }, 'id', slotId);

    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  },

  // Subscribe to user parking history
  subscribeToHistory(callback: (history: Booking[]) => void) {
    const userId = getUserId();
    return subscribeToTable<Booking>(
      'history',
      (q) => q.eq('userId', userId).order('timestamp', { ascending: false }),
      callback,
      'userId',
      userId
    );
  },

  // Process payment
  async processPayment(bookingId: string) {
    const userId = getUserId();
    if (!userId || userId === 'guest') throw new Error('Authentication required');
    
    if (this._paymentLock.has(bookingId)) {
      console.warn('Payment already in progress for:', bookingId);
      return false;
    }
    this._paymentLock.add(bookingId);

    try {
      const { data: bookingRaw, error: bookingErr } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
      if (bookingErr || !bookingRaw) throw new Error('Booking not found');

      const bookingData = mapFromSupabase(bookingRaw) as Booking;
      if (bookingData.status === BookingStatus.COMPLETED || bookingData.status === BookingStatus.PAID) {
        this._paymentLock.delete(bookingId);
        return true; 
      }

      const now = new Date();
      const isCancellation = bookingData.sessionStatus === 'cancellation_pending';
      const startTime = bookingData.startTime?.toDate ? bookingData.startTime.toDate() : new Date(bookingData.startTime as any || Date.now());
      const rate = VEHICLE_HOURLY_RATES[bookingData.vehicleType || VehicleType.FOUR_WHEELER] || 20;
      const baseAmount = bookingData.baseAmount || (rate * (bookingData.timeLimit || 4));
      const baseDuration = (bookingData.timeLimit || 4) * 60 * 60 * 1000;
      const expiryTime = new Date(startTime.getTime() + baseDuration);
      
      let finalAmount = baseAmount;
      let overtimeCharge = 0;
      let overtimeMins = 0;
      
      if (isCancellation) {
        finalAmount = bookingData.totalBill ?? Math.round(baseAmount * 0.5);
      } else if (now > expiryTime) {
        overtimeMins = Math.floor((now.getTime() - expiryTime.getTime()) / (1000 * 60));
        const overtimeCycle = Math.ceil((overtimeMins + 0.1) / 30);
        overtimeCharge = overtimeCycle * 10;
        finalAmount = baseAmount + overtimeCharge;
      }

      const nowString = now.toISOString();

      // 1. Update active booking status
      const { error: upBookErr } = await safeUpdate('bookings', {
        status: isCancellation ? BookingStatus.CANCELLED : BookingStatus.COMPLETED,
        paymentStatus: 'Paid',
        sessionStatus: isCancellation ? 'Cancelled' : 'Completed',
        paymentTime: nowString,
        exitTime: nowString,
        totalBill: finalAmount,
        currentBill: finalAmount,
        finalAmount,
        overtimeCharge,
        overtimeMinutes: overtimeMins,
        overtimeBill: overtimeCharge
      }, 'id', bookingId);
      if (upBookErr) throw upBookErr;

      // 2. Insert IMMUTABLE history record (NEW record query, insert NOT update)
      const historyId = `history-${bookingId}-${Date.now()}`;
      const historyData = {
        id: historyId,
        originalBookingId: bookingId,
        userId: bookingData.userId,
        slotId: bookingData.slotId,
        startTime: (bookingData.startTime?.toDate ? bookingData.startTime.toDate() : new Date(bookingData.startTime as any || Date.now())).toISOString(),
        entryTime: bookingData.entryTime ? (bookingData.entryTime.toDate ? bookingData.entryTime.toDate() : new Date(bookingData.entryTime as any)).toISOString() : null,
        status: isCancellation ? BookingStatus.CANCELLED : BookingStatus.COMPLETED,
        paymentStatus: 'Paid',
        sessionStatus: isCancellation ? 'Cancelled' : 'Completed',
        paymentTime: nowString,
        exitTime: nowString,
        totalBill: finalAmount,
        currentBill: finalAmount,
        finalAmount,
        overtimeCharge,
        overtimeMinutes: overtimeMins,
        timestamp: nowString,
        vehicleType: bookingData.vehicleType,
        vehicleNumber: bookingData.vehicleNumber,
        timeLimit: bookingData.timeLimit
      };

      const { error: insHistErr } = await safeInsert('history', historyData);
      if (insHistErr) throw insHistErr;

      // 3. Reset Slot
      if (bookingData.slotId) {
        const { error: slotResetErr } = await safeUpdate('slots', {
          status: SlotStatus.EMPTY,
          currentUserId: null,
          lastUpdated: nowString
        }, 'id', bookingData.slotId);
        if (slotResetErr) throw slotResetErr;
      }

      // 4. Send payment successful notification only, DO NOT auto-open gate.
      if (!isCancellation) {
        this.notify('Payment Successful', `Session balance paid. Please head to the Exit Gate and click Open.`, 'payment');
      } else {
        this.notify('Booking Cancelled', 'Your reservation was cancelled successfully', 'booking');
      }

      this._paymentLock.delete(bookingId);
      return true;
    } catch (error: any) {
      this._paymentLock.delete(bookingId);
      console.error('Payment Error:', error);
      throw error;
    }
  },

  // Initiate cancellation
  async initiateCancellation(bookingId: string, slotId: string, isFree: boolean) {
    try {
      const { data: bookingRaw } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
      if (!bookingRaw) return;

      const bookingData = mapFromSupabase(bookingRaw) as Booking;
      let penalty = 0;
      if (!isFree) {
        const rate = VEHICLE_HOURLY_RATES[bookingData.vehicleType || VehicleType.FOUR_WHEELER] || 20;
        const baseAmount = bookingData.baseAmount || (rate * (bookingData.timeLimit || 4));
        penalty = Math.round(baseAmount * 0.5);
      }

      // Set booking status to PAYMENT_PENDING with sessionStatus = 'cancellation_pending'
      await safeUpdate('bookings', {
        status: BookingStatus.PAYMENT_PENDING,
        sessionStatus: 'cancellation_pending',
        totalBill: penalty,
        currentBill: penalty
      }, 'id', bookingId);
      
      if (penalty > 0) {
        this.notify('Payment Required', `Cancellation fee of ₹${penalty} applies (50%)`, 'booking');
      } else {
        this.notify('Payment Required', `Free cancellation initiated. Please confirm to proceed.`, 'booking');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  },

  // Cancel registration
  async cancelBooking(bookingId: string, slotId: string) {
    try {
      const { data: bookingRaw } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
      if (!bookingRaw) return;

      const bookingData = mapFromSupabase(bookingRaw) as Booking;
      const nowString = new Date().toISOString();

      const startTime = (bookingData.startTime as any).toDate ? (bookingData.startTime as any).toDate() : new Date(bookingData.startTime as any);
      const elapsedMs = Date.now() - startTime.getTime();
      if (elapsedMs > 10 * 60 * 1000) {
        throw new Error('Cancellation window of 10 minutes has expired');
      }

      const penalty = 0; // Free cancellation within 10 minutes of reservation

      // 1. Update Booking
      await safeUpdate('bookings', {
        status: BookingStatus.CANCELLED,
        totalBill: penalty,
        currentBill: penalty
      }, 'id', bookingId);

      // 2. Insert into history
      const historyId = `history-${bookingId}-${Date.now()}`;
      await safeInsert('history', {
        id: historyId,
        originalBookingId: bookingId,
        userId: bookingData.userId,
        slotId: bookingData.slotId,
        startTime: (bookingData.startTime?.toDate ? bookingData.startTime.toDate() : new Date(bookingData.startTime as any || Date.now())).toISOString(),
        status: BookingStatus.CANCELLED,
        totalBill: penalty,
        currentBill: penalty,
        timestamp: nowString,
        vehicleType: bookingData.vehicleType,
        vehicleNumber: bookingData.vehicleNumber,
        timeLimit: bookingData.timeLimit
      });

      // 3. Reset Slot
      await safeUpdate('slots', {
        status: SlotStatus.EMPTY,
        currentUserId: null,
        lastUpdated: nowString
      }, 'id', slotId);

      this.notify('Booking Cancelled', 'Your reservation was cancelled successfully', 'booking');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  },

  // Final Exit
  async vehicleExit(bookingId: string, slotId: string) {
    try {
      const nowString = new Date().toISOString();
      await safeUpdate('bookings', {
        status: BookingStatus.COMPLETED,
        exitTime: nowString
      }, 'id', bookingId);

      await safeUpdate('slots', {
        status: SlotStatus.EMPTY,
        currentUserId: null,
        lastUpdated: nowString
      }, 'id', slotId);

      this.notify('Session Completed', 'Thank you for parking with us', 'booking');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  },

  _gateCallbacks: [] as ((state: GateState) => void)[],

  // Control Gate
  async controlGate(status: 'Open' | 'Closed', bookingId?: string) {
    const userId = getUserId();
    const timestamp = new Date().toISOString() as any;

    const optimisticState: GateState = {
      status,
      lastChangedBy: userId,
      timestamp,
      activeBookingId: bookingId || null,
      sensorEntry: false,
      sensorExit: false
    } as any;

    // Immediately notify all local subscribers to make the UI transition instantaneous
    this._gateCallbacks.forEach(cb => {
      try {
        cb(optimisticState);
      } catch (err) {
        console.error("Local gate callback err:", err);
      }
    });

    try {
      await safeUpdate('system', {
        status,
        lastChangedBy: userId,
        timestamp,
        activeBookingId: bookingId || null
      }, 'id', 'gate');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'system/gate');
    }
  },

  // Update Gate Sensor
  async updateGateSensor(sensor: 'entry' | 'exit', active: boolean) {
    try {
      const { data: gateSnap } = await supabase.from('system').select('*').eq('id', 'gate').maybeSingle();
      const updateData: any = {
        [sensor === 'entry' ? 'sensorEntry' : 'sensorExit']: active,
        timestamp: new Date().toISOString()
      };

      if (gateSnap) {
        if (gateSnap.status === 'Open' && sensor === 'exit' && active === true) {
          updateData.status = 'Closed';
        }
      }

      await safeUpdate('system', updateData, 'id', 'gate');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'system/gate');
    }
  },

  // Update Slot Sensor
  async updateSlotSensor(slotId: string, active: boolean) {
    try {
      const { data: slotSnap } = await supabase.from('slots').select('*').eq('id', slotId).maybeSingle();
      const updateData: any = {
        sensorActive: active,
        lastUpdated: new Date().toISOString()
      };

      if (slotSnap && active === true) {
        if (slotSnap.status === SlotStatus.RESERVED) {
          updateData.status = SlotStatus.OCCUPIED;
        }
      }

      await safeUpdate('slots', updateData, 'id', slotId);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `slots/${slotId}`);
    }
  },

  // Subscribe to gate state
  subscribeToGate(callback: (state: GateState) => void) {
    this._gateCallbacks.push(callback);

    const fetchAndCallback = async () => {
      try {
        const { data } = await supabase.from('system').select('*').eq('id', 'gate').maybeSingle();
        if (data) {
          callback(mapFromSupabase(data) as GateState);
        }
      } catch(e) {}
    };

    fetchAndCallback();

    const channel = supabase
      .channel('gate-sys')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'system', filter: 'id=eq.gate' },
        (payload) => {
          if (payload.new) {
            callback(mapFromSupabase(payload.new) as GateState);
          }
        }
      )
      .subscribe();

    return () => {
      this._gateCallbacks = this._gateCallbacks.filter(c => c !== callback);
      supabase.removeChannel(channel);
    };
  },

  // Notification service
  _notificationCallbacks: [] as ((title: string, message: string, type: 'booking' | 'payment' | 'reminder') => void)[],
  
  subscribeToNotifications(callback: (title: string, message: string, type: 'booking' | 'payment' | 'reminder') => void) {
    this._notificationCallbacks.push(callback);
    return () => {
      this._notificationCallbacks = this._notificationCallbacks.filter(c => c !== callback);
    };
  },

  async notify(title: string, message: string, type: 'booking' | 'payment' | 'reminder') {
    const profile = await this.getUserProfile();
    const shouldNotify = 
      !profile?.notifications || 
      (type === 'booking' && profile.notifications.bookingAlerts) ||
      (type === 'payment' && profile.notifications.paymentAlerts) ||
      (type === 'reminder' && profile.notifications.parkingReminders);

    if (shouldNotify) {
      this._notificationCallbacks.forEach(cb => cb(title, message, type));
      
      if (type === 'reminder') {
        try { 
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              console.debug('Audio play blocked pending interaction');
            });
          }
        } catch(e){}
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      }
    }
  },

  // Get current user profile with localStorage fallback
  async getUserProfile() {
    const userId = getUserId();
    if (userId === 'guest') return null;
    
    const cached = localStorage.getItem(`user_profile_${userId}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        localStorage.removeItem(`user_profile_${userId}`);
      }
    }

    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
      if (!error && data) {
        localStorage.setItem(`user_profile_${userId}`, JSON.stringify(data));
        return data;
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch profile', error);
      return null;
    }
  },

  // Update user profile with localStorage sync
  async updateProfile(data: { 
    displayName?: string, 
    fullName?: string,
    vehicleNumber?: string, 
    vehiclePlate?: string,
    mobileNumber?: string, 
    profileCompleted?: boolean,
    theme?: 'light' | 'dark',
    notifications?: {
      bookingAlerts: boolean,
      paymentAlerts: boolean,
      parkingReminders: boolean
    }
  }) {
    const userId = getUserId();
    if (userId === 'guest') throw new Error('Not authenticated');

    const cached = localStorage.getItem(`user_profile_${userId}`);
    let current: any = {};
    if (cached) {
      current = JSON.parse(cached);
      localStorage.setItem(`user_profile_${userId}`, JSON.stringify({ ...current, ...data }));
    }

    try {
      const profileData = {
        id: userId,
        uid: userId,
        ...current,
        ...data,
        updatedAt: new Date().toISOString()
      };

      const { error } = await safeUpsert('users', profileData);
      if (error) throw error;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `user/${userId}`);
      throw error;
    }
  },

  // Calculate current bill purely client-side for UI display
  calculateCurrentBill(booking: Booking): number {
    const now = new Date();
    const startTime = (booking.startTime as any).toDate ? (booking.startTime as any).toDate() : new Date(booking.startTime as any);
    const rate = VEHICLE_HOURLY_RATES[booking.vehicleType || VehicleType.FOUR_WHEELER] || 20;
    const baseAmount = booking.baseAmount || (rate * (booking.timeLimit || 4));
    const baseDuration = (booking.timeLimit || 4) * 60 * 60 * 1000;
    const expiryTime = new Date(startTime.getTime() + baseDuration);
    
    if (now <= expiryTime) {
      return baseAmount;
    } else {
      const overtimeMs = now.getTime() - expiryTime.getTime();
      const overtimeMins = Math.floor(overtimeMs / (1000 * 60));
      const overtimeCycle = Math.ceil((overtimeMins + 0.1) / 30);
      const overtimeCharge = overtimeCycle * 10;
      return baseAmount + overtimeCharge;
    }
  },

  // Live status update handle - Optimized to reduce writes drastically
  async processLiveStatus(booking: Booking, force: boolean = false) {
    if (!booking || 
        booking.status === BookingStatus.RESERVED || 
        booking.status === BookingStatus.COMPLETED || 
        booking.status === BookingStatus.CANCELLED || 
        booking.status === BookingStatus.PAID) return;
    
    const now = new Date();
    const startTime = (booking.startTime as any).toDate ? (booking.startTime as any).toDate() : new Date(booking.startTime as any);
    const baseDuration = (booking.timeLimit || 4) * 60 * 60 * 1000;
    const expiryTime = new Date(startTime.getTime() + baseDuration);
    
    const diffToExpiryMs = expiryTime.getTime() - now.getTime();
    const diffMins = diffToExpiryMs / (1000 * 60);

    const overtimeMs = diffToExpiryMs <= 0 ? Math.abs(diffToExpiryMs) : 0;
    const overtimeMins = Math.floor(overtimeMs / (1000 * 60));
    const overtimeCycle = diffToExpiryMs <= 0 ? Math.ceil((overtimeMins + 0.1) / 30) : 0;

    const expectedStatus = (diffMins <= 15 && diffMins > 0) ? BookingStatus.TIME_ENDING : (diffToExpiryMs <= 0 ? BookingStatus.OVERTIME_ACTIVE : booking.status);
    const stateFingerprint = `${expectedStatus}|${diffMins <= 15}|${diffMins <= 10}|${overtimeCycle}`;

    if (!force && this._lastState.get(booking.id) === stateFingerprint) {
      return;
    }

    // Debounce: Minimum 30 seconds wait between updates unless forced
    const nowTime = Date.now();
    const lastSync = this._lastSyncs.get(booking.id) || 0;
    if (!force && nowTime - lastSync < 30000) return;
    
    let updateData: any = {};
    let shouldUpdate = false;

    // 1. Warnings logic
    if (diffMins <= 15 && diffMins > 0 && !booking.warningSent30) {
      this.notify('Parking session ending in 15 minutes', 'Please head back or overtime charges will apply.', 'reminder');
      updateData.warningSent30 = true;
      updateData.status = BookingStatus.TIME_ENDING;
      shouldUpdate = true;
    }
    
    if (diffMins <= 10 && diffMins > 0 && !booking.warningSent10) {
      this.notify('CRITICAL WARNING: 10 MINS LEFT', 'Please exit or overtime charges will apply immediately.', 'reminder');
      updateData.warningSent10 = true;
      updateData.status = BookingStatus.TIME_ENDING;
      shouldUpdate = true;
    }

    // 2. Overtime logic
    if (diffToExpiryMs <= 0) {
      if (!booking.overtimeStarted || booking.status !== BookingStatus.OVERTIME_ACTIVE) {
        this.notify('OVERTIME ACTIVE', 'Extra charges (₹10/30 min) applied.', 'reminder');
        updateData.overtimeStarted = true;
        updateData.overtimeStartedAt = new Date().toISOString();
        updateData.status = BookingStatus.OVERTIME_ACTIVE;
        shouldUpdate = true;
      }

      const currentOTCycle = (booking as any).overtimeCycle || 0;
      if (overtimeCycle > currentOTCycle) {
        const rate = VEHICLE_HOURLY_RATES[booking.vehicleType || VehicleType.FOUR_WHEELER] || 20;
        const baseAmount = booking.baseAmount || (rate * (booking.timeLimit || 4));
        const overtimeCharge = overtimeCycle * 10;
        const total = baseAmount + overtimeCharge;

        updateData.overtimeCharge = overtimeCharge;
        updateData.overtimeBill = overtimeCharge;
        updateData.overtimeCycle = overtimeCycle;
        updateData.totalBill = total;
        updateData.currentBill = total;
        updateData.finalAmount = total;
        updateData.overtimeMinutes = overtimeMins; 
        shouldUpdate = true;
      }
    }

    if (shouldUpdate && Object.keys(updateData).length > 0) {
      try {
        await safeUpdate('bookings', updateData, 'id', booking.id);
        this._lastState.set(booking.id, stateFingerprint);
        this._lastSyncs.set(booking.id, Date.now());
      } catch (e: any) {
        console.error('Failed to sync live status', e);
      }
    } else if (!force) {
      this._lastState.set(booking.id, stateFingerprint);
    }
  }
};

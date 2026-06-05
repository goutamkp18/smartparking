import { SupabaseTimestamp as Timestamp } from './lib/supabase';

export enum SlotStatus {
  EMPTY = 'Empty',
  RESERVED = 'Reserved',
  OCCUPIED = 'Occupied'
}

export interface ParkingSlot {
  id: string;
  number: string;
  floor: string;
  status: SlotStatus;
  type?: string;
  currentUserId?: string;
  lastUpdated: Timestamp;
  sensorActive?: boolean; // IR Sensor state for slot occupancy
}

export enum BookingStatus {
  RESERVED = 'Reserved',
  ACTIVE = 'Active',
  TIME_ENDING = 'Time Ending',
  OVERTIME_ACTIVE = 'Overtime Active',
  PAYMENT_PENDING = 'Payment Pending',
  PAID = 'Paid',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled'
}

export enum VehicleType {
  BIKE = 'Bike',
  THREE_WHEELER = '3 Wheeler',
  FOUR_WHEELER = '4 Wheeler',
  TRUCK = 'Truck'
}

export interface Booking {
  id: string;
  userId: string;
  slotId: string;
  startTime: Timestamp;
  entryTime?: Timestamp;
  paymentTime?: Timestamp;
  exitTime?: Timestamp;
  status: BookingStatus;
  totalBill: number;
  baseAmount?: number;
  overtimeBill?: number;
  vehicleType?: VehicleType;
  timeLimit?: number; // hours
  remainingTime?: number; // seconds
  currentBill?: number;
  overtimeMinutes?: number;
  overtimeCharge?: number;
  warningSent30?: boolean;
  warningSent10?: boolean;
  overtimeStarted?: boolean;
  overtimeCycle?: number;
  overtimeBlocks?: number;
  overtimeStartedAt?: Timestamp;
  lastNotificationSent?: string; // To prevent spam
  vehicleNumber?: string;
  originalBookingId?: string;
  sessionStatus?: string;
  paymentStatus?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  fullName?: string;
  vehicleNumber?: string;
  vehiclePlate?: string;
  mobileNumber?: string;
  profileCompleted?: boolean;
  role: 'user' | 'admin';
  createdAt: Timestamp;
  theme?: 'light' | 'dark';
  notifications?: {
    bookingAlerts: boolean;
    paymentAlerts: boolean;
    parkingReminders: boolean;
  };
}

export interface GateState {
  status: 'Open' | 'Closed';
  lastChangedBy: string;
  timestamp: Timestamp;
  activeBookingId?: string;
  sensorEntry?: boolean; // IR Sensor 1 (Entry/Outer)
  sensorExit?: boolean;  // IR Sensor 2 (Inside/Exit)
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

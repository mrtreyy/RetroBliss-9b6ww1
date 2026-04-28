export type AppState =
  | 'splash'
  | 'role-select'
  | 'rider-signin'
  | 'rider-signup'
  | 'rider-onboarding'
  | 'rider-home'
  | 'driver-signin'
  | 'driver-signup'
  | 'driver-pending'
  | 'driver-home'
  | 'ceo-password'
  | 'ceo-dashboard';

export interface Rider {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  dob: string;
  location: string;
  state: string;
  country: string;
  profilePic: string | null;
  walletBalance: number;
  createdAt: string;
  role: 'rider';
  status: 'active' | 'frozen' | 'closed';
}

export interface Driver {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  dob: string;
  location: string;
  state: string;
  country: string;
  profilePic: string | null;
  walletBalance: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehiclePlate: string;
  vehicleColor: string;
  idUpload: string | null;
  createdAt: string;
  role: 'driver';
  status: 'pending' | 'active' | 'frozen' | 'declined';
  declineReason?: string;
  bankName: string;
  bankAccount: string;
  bankAccountName: string;
}

export interface Ride {
  id: string;
  riderId: string;
  riderName: string;
  driverId: string | null;
  driverName: string | null;
  pickup: string;
  destination: string;
  fare: number;
  status: 'searching' | 'active' | 'completed' | 'cancelled';
  createdAt: string;
  completedAt: string | null;
  riderPaid: number;
  driverReceived: number;
  commissionAmount: number;
}

export interface Transaction {
  id: string;
  userId: string;
  userRole: 'rider' | 'driver' | 'ceo';
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  createdAt: string;
  reference: string;
}

export interface AuditLog {
  id: string;
  performer: string;
  performerRole: 'rider' | 'driver' | 'admin';
  action: string;
  targetId: string;
  details: Record<string, unknown>;
  ip: string;
  location: string;
  device: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  userRole: 'rider' | 'driver';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  linkedRideId?: string;
  linkedTransactionId?: string;
}

export interface WithdrawalRequest {
  id: string;
  driverId: string;
  driverName: string;
  amount: number;
  bankName: string;
  bankAccount: string;
  bankAccountName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface PlatformSettings {
  baseFare: number;
  perKmRate: number;
  surgeEnabled: boolean;
  scheduledRidesEnabled: boolean;
  driverRetentionPercentage: number;
  availableStates: string[];
  stateRates: Record<string, number>;
}

export interface CEOWallet {
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
}

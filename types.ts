export enum UserRole {
  STUDENT = 'STUDENT',
  GATE_STAFF = 'GATE_STAFF',
  COUNCIL = 'COUNCIL'
}

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED'
}

export enum MovementType {
  ENTRY = 'ENTRY',
  EXIT = 'EXIT'
}

export interface User {
  id: string; // System ID
  role: UserRole;
  name: string; // Display Name (Full Name)
  
  // Detailed Student Fields
  studentId?: string; // Alphanumeric unique ID
  firstName?: string;
  middleName?: string;
  lastName?: string;
  gender?: 'Male' | 'Female' | 'Other';
  instituteEmail?: string;
  personalEmail?: string;
  mobileNumber?: string;
  hostelRoomNo?: string;
  emergencyContact?: string;
  department?: 'PGP' | 'PGP-ABM' | 'PHD' | string;

  avatar?: string;
}

export interface MovementLog {
  id: string;
  userId: string;
  userName: string;
  studentId?: string; // College unique identifier (for students only)
  type: MovementType;
  timestamp: string; // ISO String
  status: RequestStatus;
  approvedBy?: string;
  isVendor?: boolean;
  isGuest?: boolean;
  details?: string; // Remarks, Vehicle No, etc.
}

export interface GuestInfo {
  id: string;
  name: string;
  relation: string;
  mobile: string;
  entryCode?: string; // Generated individually upon approval
}

export interface GuestRequest {
  id: string;
  studentId: string;
  studentName: string;
  
  // Detailed Fields
  hostelRoom: string;
  studentMobile: string;
  purpose: string;
  
  arrivalDate: string; // Date of visit
  tentativeEntryTime: string;
  tentativeExitTime: string;
  vehicleNumbers: string;
  
  guests: GuestInfo[]; // List of guests in this request

  status: RequestStatus;
  approvedBy?: string;
}

export interface Vendor {
  id: string;
  name: string;
  company: string;
  category: string;
  lastEntry?: string;
}

export interface StudentMovementRequest {
  id: string;
  studentId: string;
  studentName: string;
  type: MovementType; // ENTRY or EXIT
  status: RequestStatus; // PENDING, APPROVED, REJECTED, COMPLETED
  createdAt: string; // ISO String
  approvedBy?: string;
  approvedAt?: string; // ISO String
  rejectionReason?: string; // Only set when status is REJECTED
  details?: string; // Optional remarks / vehicle info from request
}
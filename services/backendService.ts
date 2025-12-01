import { MovementLog, GuestRequest, Vendor, RequestStatus, MovementType, StudentMovementRequest } from '../types';

const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3001/api';

export interface BackendUser {
  id: string;
  studentId?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: string;
  instituteEmail?: string;
  personalEmail?: string; // From profile_data JSONB
  mobileNumber?: string; // From profile_data JSONB
  hostelRoomNo?: string; // From profile_data JSONB
  emergencyContact?: string; // From profile_data JSONB
  gender?: string;
  department?: string; // From direct column
  profileData?: any;
}

export const backendService = {
  // ========== USER APIs ==========
  // Get user by ID
  getUserById: async (userId: string): Promise<BackendUser> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch user');
    }
    return response.json();
  },

  // Get user by email
  getUserByEmail: async (email: string): Promise<BackendUser> => {
    const response = await fetch(`${API_BASE_URL}/users/email/${encodeURIComponent(email)}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch user');
    }
    return response.json();
  },

  // Update user profile
  updateUserProfile: async (
    userId: string,
    updates: {
      mobileNumber?: string;
      hostelRoomNo?: string;
      emergencyContact?: string;
    }
  ): Promise<BackendUser> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update profile');
    }
    return response.json();
  },

  // ========== MOVEMENT LOGS APIs ==========
  // Get movement logs with optional filters
  // IMPORTANT: By default, backend returns only COMPLETED logs (for ledger)
  // Pass status='PENDING' explicitly to get pending requests
  getMovementLogs: async (filters?: {
    studentId?: string;
    entityType?: 'STUDENT' | 'GUEST' | 'VENDOR';
    movementType?: MovementType;
    status?: RequestStatus;
    limit?: number;
  }): Promise<MovementLog[]> => {
    const params = new URLSearchParams();
    if (filters?.studentId) params.append('studentId', filters.studentId);
    if (filters?.entityType) params.append('entityType', filters.entityType);
    if (filters?.movementType) params.append('movementType', filters.movementType);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const url = `${API_BASE_URL}/movement-logs${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch movement logs');
    }
    return response.json();
  },

  // Get student status (inside/outside) - uses v_campus_occupancy view
  getStudentStatus: async (studentId: string): Promise<{ 
    isInside: boolean; 
    lastMovementTime: string | null; 
    lastMovementType: string | null;
  }> => {
    const response = await fetch(`${API_BASE_URL}/movement-logs/student/${studentId}/status`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch student status');
    }
    return response.json();
  },

  // Get occupancy status for all students (or filtered list)
  getAllStudentsOccupancy: async (studentIds?: string[]): Promise<{
    occupancy: Record<string, { isInside: boolean; lastMovementTime: string | null; lastMovementType: string | null }>;
    total: number;
  }> => {
    const params = new URLSearchParams();
    if (studentIds && studentIds.length > 0) {
      params.append('studentIds', studentIds.join(','));
    }

    const url = `${API_BASE_URL}/movement-logs/occupancy${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch students occupancy');
    }
    return response.json();
  },

  // Create a new movement log
  createMovementLog: async (logData: {
    movementType: MovementType;
    entityType: 'STUDENT' | 'GUEST' | 'VENDOR';
    gateUserId: string;
    studentId?: string;
    guestId?: string;
    vendorId?: string;
    remarks?: string;
  }): Promise<MovementLog> => {
    const response = await fetch(`${API_BASE_URL}/movement-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create movement log');
    }
    return response.json();
  },

  // ========== VENDORS APIs ==========
  // Get all vendors
  getVendors: async (isActive?: boolean): Promise<Vendor[]> => {
    const params = new URLSearchParams();
    if (isActive !== undefined) params.append('isActive', isActive.toString());

    const url = `${API_BASE_URL}/vendors${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch vendors');
    }
    return response.json();
  },

  // Get vendor by ID
  getVendorById: async (vendorId: string): Promise<Vendor> => {
    const response = await fetch(`${API_BASE_URL}/vendors/${vendorId}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch vendor');
    }
    return response.json();
  },

  // Create a new vendor
  createVendor: async (vendorData: {
    name: string;
    companyName?: string;
    category?: string;
    isActive?: boolean;
  }): Promise<Vendor> => {
    const response = await fetch(`${API_BASE_URL}/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vendorData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create vendor');
    }
    return response.json();
  },

  // Update an existing vendor (e.g. toggle active status or edit details)
  updateVendor: async (
    vendorId: string,
    updates: {
      name?: string;
      companyName?: string;
      category?: string;
      isActive?: boolean;
    }
  ): Promise<Vendor> => {
    const response = await fetch(`${API_BASE_URL}/vendors/${vendorId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update vendor');
    }
    return response.json();
  },

  // Delete vendor
  deleteVendor: async (vendorId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/vendors/${vendorId}`, {
      method: 'DELETE',
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to delete vendor');
    }
  },

  // Record vendor movement (Flow 3: Direct INSERT into movement_logs)
  recordVendorMovement: async (movementData: {
    vendorId: string;
    actionType: 'ENTRY' | 'EXIT';
    gateUserId: string;
    vehicleNumber?: string;
    remarks?: string;
  }): Promise<{ success: boolean; message: string; vendor?: any }> => {
    const response = await fetch(`${API_BASE_URL}/vendors/${movementData.vendorId}/movement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vendorId: movementData.vendorId,
        actionType: movementData.actionType,
        gateUserId: movementData.gateUserId,
        vehicleNumber: movementData.vehicleNumber,
        remarks: movementData.remarks
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to record vendor movement');
    }
    return response.json();
  },

  // ========== GUEST REQUESTS APIs ==========
  // Get guest requests with optional filters
  getGuestRequests: async (filters?: {
    studentId?: string;
    status?: RequestStatus;
  }): Promise<GuestRequest[]> => {
    const params = new URLSearchParams();
    if (filters?.studentId) params.append('studentId', filters.studentId);
    if (filters?.status) params.append('status', filters.status);

    const url = `${API_BASE_URL}/guest-requests${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch guest requests');
    }
    return response.json();
  },

  // Get guest request by ID
  getGuestRequestById: async (requestId: string): Promise<GuestRequest> => {
    const response = await fetch(`${API_BASE_URL}/guest-requests/${requestId}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch guest request');
    }
    return response.json();
  },

  // Create a new guest request
  createGuestRequest: async (requestData: {
    studentId: string;
    purpose: string;
    arrivalDate: string; // ISO date string
    entryTimeStart: string; // Time string like '10:00'
    exitTimeEnd: string; // Time string like '18:00'
    vehicleNumbers?: string;
    hostelRoom?: string;
    studentMobile?: string;
    guests: Array<{
      name: string;
      relation: string;
      mobile?: string;
    }>;
  }): Promise<GuestRequest> => {
    const response = await fetch(`${API_BASE_URL}/guest-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create guest request');
    }
    return response.json();
  },

  // Update guest request status (for approval/rejection)
  updateGuestRequestStatus: async (
    requestId: string,
    statusData: {
      status: RequestStatus;
      approvedBy?: string;
      rejectionReason?: string;
    }
  ): Promise<GuestRequest> => {
    const response = await fetch(`${API_BASE_URL}/guest-requests/${requestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(statusData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update guest request status');
    }
    return response.json();
  },

  // ========== STUDENT MOVEMENT REQUESTS APIs (Flow 1: Using movement_logs) ==========
  // Get student movement requests (PENDING status in movement_logs)
  getStudentMovementRequests: async (filters?: {
    studentId?: string;
    status?: RequestStatus;
  }): Promise<StudentMovementRequest[]> => {
    const params = new URLSearchParams();
    params.append('entityType', 'STUDENT');
    if (filters?.studentId) params.append('studentId', filters.studentId);
    if (filters?.status) params.append('status', filters.status);
    else params.append('status', 'PENDING'); // Default to PENDING for requests

    const url = `${API_BASE_URL}/movement-logs${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch student movement requests');
    }
    const logs = await response.json();
    // Transform movement logs to StudentMovementRequest format
    return logs.map((log: MovementLog) => ({
      id: log.id,
      studentId: log.userId,
      studentName: log.userName,
      type: log.type,
      status: log.status as RequestStatus,
      createdAt: log.timestamp,
      approvedBy: log.approvedBy,
      approvedAt: log.status === 'COMPLETED' ? log.timestamp : undefined,
      rejectionReason: undefined
    }));
  },

  // Create a new student movement request (Flow 1: Creates PENDING log)
  createStudentMovementRequest: async (requestData: {
    studentId: string;
    movementType: MovementType;
  }): Promise<StudentMovementRequest> => {
    const response = await fetch(`${API_BASE_URL}/movement-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        movementType: requestData.movementType,
        entityType: 'STUDENT',
        studentId: requestData.studentId,
        // gateUserId is NULL for PENDING requests
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create student movement request');
    }
    const log = await response.json();
    return {
      id: log.id,
      studentId: log.userId,
      studentName: log.userName,
      type: log.type,
      status: log.status as RequestStatus,
      createdAt: log.timestamp,
      approvedBy: log.approvedBy,
      approvedAt: log.status === 'COMPLETED' ? log.timestamp : undefined,
      rejectionReason: undefined
    };
  },

  // Update student movement request status (Flow 1: Guard approves/rejects)
  updateStudentMovementRequestStatus: async (
    requestId: string,
    statusData: {
      status: 'COMPLETED' | 'REJECTED';
      gateUserId: string;
      rejectionReason?: string;
    }
  ): Promise<StudentMovementRequest> => {
    const response = await fetch(`${API_BASE_URL}/movement-logs/student/${requestId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(statusData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update student movement request status');
    }
    const log = await response.json();
    return {
      id: log.id,
      studentId: log.userId,
      studentName: log.userName,
      type: log.type,
      status: log.status as RequestStatus,
      createdAt: log.timestamp,
      approvedBy: log.approvedBy,
      approvedAt: log.status === 'COMPLETED' ? log.timestamp : undefined,
      rejectionReason: statusData.rejectionReason
    };
  },
};

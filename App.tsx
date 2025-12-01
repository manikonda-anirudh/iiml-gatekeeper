import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, MovementLog, GuestRequest, Vendor, StudentMovementRequest, RequestStatus } from './types';
import { Layout } from './components/Layout';
import { RoleSelector } from './components/RoleSelector';
import { StudentDashboard } from './components/StudentDashboard';
import { GateDashboard } from './components/GateDashboard';
import { CouncilDashboard } from './components/CouncilDashboard';
import { supabase, getSession, signOut, onAuthStateChange } from './services/supabaseService';
import { backendService } from './services/backendService';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  
  // App State acting as "Backend Data"
  const [logs, setLogs] = useState<MovementLog[]>([]);
  const [guestRequests, setGuestRequests] = useState<GuestRequest[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [studentMovementRequests, setStudentMovementRequests] = useState<StudentMovementRequest[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const realtimeDebounceRef = useRef<number | null>(null);

  // Load data helper - fetches from backend APIs
  const loadData = async () => {
    setIsLoadingData(true);
    setDataError(null);
    
    try {
      console.log('[App] Loading data from backend...');
      
      // Fetch all data in parallel
      // IMPORTANT: Fetch COMPLETED logs for ledger, and PENDING logs for Live Requests
      const [completedLogsData, pendingLogsData, requestsData, vendorsData, movementRequestsData] = await Promise.all([
        backendService.getMovementLogs({ limit: 1000, status: RequestStatus.COMPLETED }).catch(err => {
          console.error('[App] Error fetching completed movement logs:', err);
          return [];
        }),
        backendService.getMovementLogs({ limit: 100, status: RequestStatus.PENDING }).catch(err => {
          console.error('[App] Error fetching pending movement logs:', err);
          return [];
        }),
        backendService.getGuestRequests().catch(err => {
          console.error('[App] Error fetching guest requests:', err);
          return [];
        }),
        backendService.getVendors().catch(err => {
          console.error('[App] Error fetching vendors:', err);
          return [];
        }),
        backendService.getStudentMovementRequests().catch(err => {
          console.error('[App] Error fetching student movement requests:', err);
          return [];
        })
      ]);

      // Combine completed and pending logs for GateDashboard (it filters them appropriately)
      // But for ledger display, we only want COMPLETED logs
      setLogs([...completedLogsData, ...pendingLogsData]);
      setGuestRequests(requestsData);
      setVendors(vendorsData);
      setStudentMovementRequests(movementRequestsData);
      
      console.log('[App] Data loaded successfully:', {
        logs: completedLogsData.length + pendingLogsData.length,
        requests: requestsData.length,
        vendors: vendorsData.length,
        movementRequests: movementRequestsData.length
      });
    } catch (error: any) {
      console.error('[App] Error loading data:', error);
      setDataError(error.message || 'Failed to load data');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Helper function to fetch user from backend and map to app User type
  const fetchUserFromBackend = async (supabaseUser: any): Promise<User | null> => {
    console.log('[App] fetchUserFromBackend called with:', {
      userId: supabaseUser?.id,
      email: supabaseUser?.email,
      metadata: supabaseUser?.user_metadata
    });
    
    if (!supabaseUser) {
      console.error('[App] fetchUserFromBackend: supabaseUser is null/undefined');
      return null;
    }
    
    try {
      // Try to get user by email first (institute_mail)
      const email = supabaseUser.email || '';
      let backendUser;
      
      try {
        console.log('[App] Attempting to fetch user by email:', email);
        backendUser = await backendService.getUserByEmail(email);
        console.log('[App] Successfully fetched user by email:', backendUser);
      } catch (error) {
        console.warn('[App] Failed to fetch user by email, trying by ID:', error);
        // If not found by email, try by ID (auth.users.id might match public.users.id)
        try {
          console.log('[App] Attempting to fetch user by ID:', supabaseUser.id);
          backendUser = await backendService.getUserById(supabaseUser.id);
          console.log('[App] Successfully fetched user by ID:', backendUser);
        } catch (idError) {
          console.warn('[App] User not found in backend, using fallback data. Error:', idError);
          // Fallback to basic user data if not found in backend
          const fallbackUser = {
            id: supabaseUser.id,
            name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || email.split('@')[0],
            role: UserRole.STUDENT,
            instituteEmail: email.includes('@iiml.ac.in') ? email : undefined,
            personalEmail: !email.includes('@iiml.ac.in') ? email : undefined,
            avatar: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture,
          };
          console.log('[App] Returning fallback user:', fallbackUser);
          return fallbackUser;
        }
      }
      
      // Map backend user to app User type
      // Normalize role to uppercase to match UserRole enum
      const normalizedRole = backendUser.role 
        ? (backendUser.role.toUpperCase() as UserRole)
        : UserRole.STUDENT;
      
      const mappedUser = {
        id: backendUser.id,
        studentId: backendUser.studentId,
        name: backendUser.name || '',
        firstName: backendUser.firstName,
        lastName: backendUser.lastName,
        role: normalizedRole,
        instituteEmail: backendUser.instituteEmail,
        personalEmail: backendUser.personalEmail, // Now comes from profile_data JSONB
        mobileNumber: backendUser.mobileNumber, // From profile_data JSONB
        hostelRoomNo: backendUser.hostelRoomNo, // From profile_data JSONB
        emergencyContact: backendUser.emergencyContact, // From profile_data JSONB
        gender: backendUser.gender as 'Male' | 'Female' | 'Other' | undefined,
        department: backendUser.department, // From direct column
        avatar: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture,
      };
      
      console.log('[App] Mapped user object:', mappedUser);
      return mappedUser;
    } catch (error) {
      console.error('[App] Error fetching user from backend:', error);
      console.error('[App] Error details:', error instanceof Error ? error.stack : String(error));
      // Fallback to basic user data
      const email = supabaseUser.email || '';
      const fallbackUser = {
        id: supabaseUser.id,
        name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || email.split('@')[0],
        role: UserRole.STUDENT,
        instituteEmail: email.includes('@iiml.ac.in') ? email : undefined,
        personalEmail: !email.includes('@iiml.ac.in') ? email : undefined,
        avatar: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture,
      };
      console.log('[App] Returning error fallback user:', fallbackUser);
      return fallbackUser;
    }
  };

  // Check for OAuth callback and handle session
  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('[App] Checking session...');
        // Handle OAuth callback - Supabase uses URL hash fragments
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[App] Error getting session:', sessionError);
        }
        
        if (session?.user) {
          console.log('[App] Session found, fetching user data...');
          const appUser = await fetchUserFromBackend(session.user);
          if (appUser) {
            console.log('[App] User fetched successfully, setting user state');
            setUser(appUser);
          } else {
            console.error('[App] Failed to fetch user data - appUser is null');
          }
        } else {
          console.log('[App] No session found');
        }

        // Listen to auth state changes
        const { data: { subscription } } = onAuthStateChange(async (session) => {
          console.log('[App] Auth state changed:', session ? 'Logged in' : 'Logged out');
          if (session?.user) {
            const appUser = await fetchUserFromBackend(session.user);
            if (appUser) {
              setUser(appUser);
            } else {
              console.error('[App] Failed to fetch user on auth state change');
            }
          } else {
            setUser(null);
          }
        });

        // Clean up subscription on unmount
        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('[App] Error checking session:', error);
        console.error('[App] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      }
    };

    checkSession();
  }, []);

  // Load data when user is logged in
  useEffect(() => {
    if (user) {
      loadData();
    } else {
      // Clear data when user logs out
      setLogs([]);
      setGuestRequests([]);
      setVendors([]);
      setStudentMovementRequests([]);
    }
  }, [user?.id]); // Reload when user changes

  // Subscribe to Supabase Realtime changes to keep dashboards in sync without polling
  useEffect(() => {
    if (!user) return;

    const triggerReload = () => {
      if (realtimeDebounceRef.current) {
        clearTimeout(realtimeDebounceRef.current);
      }
      realtimeDebounceRef.current = window.setTimeout(() => {
        loadData();
      }, 300); // Debounce multiple rapid DB changes
    };

    const channel = supabase
      .channel('realtime-movements-and-guests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movement_logs' },
        (payload) => {
          console.log('[App] Realtime movement_logs change:', payload.eventType, payload.new || payload.old);
          triggerReload();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guest_requests' },
        (payload) => {
          console.log('[App] Realtime guest_requests change:', payload.eventType, payload.new || payload.old);
          triggerReload();
        }
      )
      .subscribe((status) => {
        console.log('[App] Supabase realtime channel status:', status);
      });

    return () => {
      if (realtimeDebounceRef.current) {
        clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Log user data for debugging only when key values change (must be before early return to follow Rules of Hooks)
  useEffect(() => {
    if (user) {
      // Use a ref to track previous values and only log when they actually change
      const userKey = `${user.id}-${user.mobileNumber}-${user.hostelRoomNo}-${user.emergencyContact}`;
      const logsKey = logs.length;
      const requestsKey = guestRequests.length;
      
      console.log('[App] User data updated:', {
        id: user.id,
        name: user.name,
        role: user.role,
        studentId: user.studentId,
        profileComplete: !!(user.mobileNumber && user.hostelRoomNo && user.emergencyContact),
        logsCount: logsKey,
        requestsCount: requestsKey
      });
    }
  }, [user?.id, user?.mobileNumber, user?.hostelRoomNo, user?.emergencyContact, logs.length, guestRequests.length]);

  const handleLogout = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
      // Still clear local state even if sign out fails
      setUser(null);
    }
  };

  if (!user) {
    // Unauthenticated: show Google Sign-In screen
    return <RoleSelector />;
  }

  // Wrap rendering in try-catch for error handling
  try {
    return (
      <Layout user={user} onLogout={handleLogout}>
        {user.role === UserRole.STUDENT && (
          <StudentDashboard 
            user={user} 
            refreshData={loadData} 
            logs={logs}
            requests={guestRequests.filter(r => r.studentId === user.id)}
            movementRequests={studentMovementRequests.filter(r => r.studentId === user.id)}
            onUserUpdate={(updatedUser) => {
              console.log('[App] User update received:', updatedUser);
              setUser(updatedUser);
            }}
          />
        )}
      
      {user.role === UserRole.GATE_STAFF && (
        <GateDashboard 
          user={user} 
          refreshData={loadData} 
          logs={logs}
          vendors={vendors}
          guestRequests={guestRequests}
          studentMovementRequests={studentMovementRequests}
        />
      )}

      {user.role === UserRole.COUNCIL && (
        <CouncilDashboard 
          user={user} 
          refreshData={loadData} 
          requests={guestRequests}
          vendors={vendors}
        />
      )}

      </Layout>
    );
  } catch (error) {
    console.error('[App] ERROR rendering app:', error);
    console.error('[App] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="p-6 bg-white rounded-lg shadow-lg max-w-md">
          <h2 className="text-xl font-bold text-red-800 mb-4">Application Error</h2>
          <p className="text-red-600 mb-4">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <pre className="text-xs bg-red-100 p-2 rounded overflow-auto max-h-40 mb-4">
            {error instanceof Error ? error.stack : String(error)}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }
};

export default App;

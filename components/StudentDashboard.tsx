import React, { useState, useEffect, useMemo } from 'react';
import { User, MovementLog, GuestRequest, MovementType, RequestStatus, GuestInfo, StudentMovementRequest } from '../types';
import { backendService } from '../services/backendService';
import { Button } from './Button';
import { Profile } from './Profile';

interface Props {
  user: User;
  refreshData: () => void;
  logs: MovementLog[];
  requests: GuestRequest[];
  movementRequests: StudentMovementRequest[];
  onUserUpdate?: (updatedUser: User) => void;
}

interface NewGuestForm {
  name: string;
  relation: string;
  mobile: string;
}

export const StudentDashboard: React.FC<Props> = ({ user, refreshData, logs, requests, movementRequests, onUserUpdate }) => {
  // Validate user object
  if (!user) {
    console.error('[StudentDashboard] ERROR: user prop is null or undefined');
    return <div className="p-6 text-red-600">Error: User data is missing. Please try logging in again.</div>;
  }

  if (!user.id) {
    console.error('[StudentDashboard] ERROR: user.id is missing');
    return <div className="p-6 text-red-600">Error: User ID is missing. Please try logging in again.</div>;
  }

  // All useState calls must be at the top level
  const [currentView, setCurrentView] = useState<'dashboard' | 'profile'>('dashboard');
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'movements' | 'guests'>('movements');
  const [isInside, setIsInside] = useState<boolean>(true); // Default to inside
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // Student movement request modal (vehicle/remarks) 
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementTypePending, setMovementTypePending] = useState<MovementType | null>(null);
  const [movementVehicleNumber, setMovementVehicleNumber] = useState('');
  const [movementRemarks, setMovementRemarks] = useState('');

  // Form States - initialize with safe defaults
  const [tripDetails, setTripDetails] = useState({
    purpose: '',
    hostelRoom: '',
    studentMobile: '',
    arrivalDate: '',
    tentativeEntryTime: '',
    tentativeExitTime: '',
    vehicleNumbers: ''
  });

  const [guestList, setGuestList] = useState<NewGuestForm[]>([
    { name: '', relation: '', mobile: '' }
  ]);

  // Update form state when user data changes (especially after profile update)
  useEffect(() => {
    if (user) {
      setTripDetails(prev => {
        const newHostelRoom = user.hostelRoomNo || prev.hostelRoom || '';
        const newStudentMobile = user.mobileNumber || prev.studentMobile || '';
        
        // Only update if values actually changed
        if (newHostelRoom !== prev.hostelRoom || newStudentMobile !== prev.studentMobile) {
          return {
            ...prev,
            hostelRoom: newHostelRoom,
            studentMobile: newStudentMobile,
          };
        }
        return prev;
      });
    }
  }, [user?.hostelRoomNo, user?.mobileNumber]);

  // Validate logs and requests arrays - memoize to prevent unnecessary recalculations
  const safeLogs = useMemo(() => Array.isArray(logs) ? logs : [], [logs]);
  const safeRequests = useMemo(() => Array.isArray(requests) ? requests : [], [requests]);
  const safeMovementRequests = useMemo(() => Array.isArray(movementRequests) ? movementRequests : [], [movementRequests]);

  // Filter logs for this student - memoize to prevent unnecessary recalculations
  const myLogs = useMemo(() => {
    return safeLogs.filter(l => {
      if (!l || !l.userId) {
        return false;
      }
      return l.userId === user.id;
    });
  }, [safeLogs, user.id]);

  // Combine movement requests and completed logs for display in My Movements
  // Now both come from movement_logs (PENDING = request, COMPLETED = log)
  const myMovements = useMemo(() => {
    // Get all student movement logs (both PENDING and COMPLETED)
    // PENDING shows as request awaiting approval, COMPLETED shows as actual movement
    const studentLogs = safeLogs.filter(l => {
      if (!l || !l.userId) return false;
      return l.userId === user.id && !l.isVendor && !l.isGuest;
    });
    
    // Sort by timestamp (newest first)
    return studentLogs.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [safeLogs, user.id]);

  // Fetch student status from backend using v_campus_occupancy view
  useEffect(() => {
    const fetchStudentStatus = async () => {
      if (!user?.id) return;
      
      setIsLoadingStatus(true);
      try {
        const status = await backendService.getStudentStatus(user.id);
        setIsInside(status.isInside);
        console.log('[StudentDashboard] Student status fetched:', status);
      } catch (error: any) {
        console.error('[StudentDashboard] Error fetching student status:', error);
        // Default to inside on error
        setIsInside(true);
      } finally {
        setIsLoadingStatus(false);
      }
    };

    fetchStudentStatus();
    // Refresh status when logs change (after a movement is logged)
    // Also refresh periodically or after data refresh
  }, [user?.id, safeLogs.length]); // Refresh when user changes or logs are updated

  // Log component initialization and data processing only when key values change
  useEffect(() => {
    console.log('[StudentDashboard] Component initialized/updated:', {
      userId: user?.id,
      userName: user?.name,
      logsCount: safeLogs.length,
      requestsCount: safeRequests.length,
      myLogsCount: myLogs.length,
      isInside,
      profileComplete: !!(user?.mobileNumber && user?.hostelRoomNo && user?.emergencyContact)
    });
  }, [user?.id, user?.name, safeLogs.length, safeRequests.length, myLogs.length, isInside, user?.mobileNumber, user?.hostelRoomNo, user?.emergencyContact]);

  const openMovementModal = (type: MovementType) => {
    console.log('[StudentDashboard] Movement request clicked:', { type, userId: user.id });
    // Check if there's already a pending request (Flow 1: PENDING status in movement_logs)
    const existingPending = myMovements.find(
      req => req.userId === user.id && 
             req.type === type && 
             req.status === RequestStatus.PENDING
    );
    
    if (existingPending) {
      alert(`You already have a pending ${type} request. Please wait for gate staff approval.`);
      return;
    }

    setMovementTypePending(type);
    setMovementVehicleNumber('');
    setMovementRemarks('');
    setShowMovementModal(true);
  };

  const submitMovementRequest = async () => {
    if (!movementTypePending) return;
    try {
      const vehicleText = movementVehicleNumber.trim()
        ? `Vehicle: ${movementVehicleNumber.trim()}`
        : '';
      const remarksText = movementRemarks.trim();
      const combinedRemarks = [vehicleText, remarksText].filter(Boolean).join(' | ') || undefined;

      // Create movement request (Flow 1: INSERT into movement_logs with status PENDING)
      await backendService.createStudentMovementRequest({
        studentId: user.id,
        movementType: movementTypePending,
        remarks: combinedRemarks,
      });

      console.log('[StudentDashboard] Movement request created successfully');
      setShowMovementModal(false);
      setMovementTypePending(null);
      setMovementVehicleNumber('');
      setMovementRemarks('');
      
      // Refresh data to show the new request
      refreshData();
    } catch (error: any) {
      console.error('[StudentDashboard] Error handling movement request:', error);
      alert(error.message || 'Failed to create movement request. Please try again.');
    }
  };

  const handleAddGuestRow = () => {
    setGuestList([...guestList, { name: '', relation: '', mobile: '' }]);
  };

  const handleRemoveGuestRow = (index: number) => {
    const newList = [...guestList];
    newList.splice(index, 1);
    setGuestList(newList);
  };

  const handleGuestChange = (index: number, field: keyof NewGuestForm, value: string) => {
    setGuestList(prevList => prevList.map((guest, i) => 
      i === index ? { ...guest, [field]: value } : guest
    ));
  };

  const submitGuestRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      console.log('[StudentDashboard] Submitting guest request:', { tripDetails, guestCount: guestList.length });
      
      // Validate required fields
      if (!tripDetails.purpose || !tripDetails.arrivalDate || !tripDetails.tentativeEntryTime || !tripDetails.tentativeExitTime) {
        alert('Please fill in all required fields: Purpose, Arrival Date, Entry Time, and Exit Time');
        return;
      }

      if (guestList.length === 0 || guestList.some(g => !g.name || !g.relation)) {
        alert('Please add at least one guest with name and relation');
        return;
      }

      // Convert form guests to backend format
      const guests = guestList.map((g) => ({
        name: g.name,
        relation: g.relation,
        mobile: g.mobile || undefined
      }));

      // Create guest request via backend API
      const newRequest = await backendService.createGuestRequest({
        studentId: user.id,
        purpose: tripDetails.purpose,
        arrivalDate: tripDetails.arrivalDate,
        entryTimeStart: tripDetails.tentativeEntryTime,
        exitTimeEnd: tripDetails.tentativeExitTime,
        vehicleNumbers: tripDetails.vehicleNumbers || undefined,
        hostelRoom: tripDetails.hostelRoom || undefined,
        studentMobile: tripDetails.studentMobile || undefined,
        guests: guests
      });

      console.log('[StudentDashboard] Guest request created successfully:', newRequest);

      setShowGuestModal(false);
      // Reset Form (keep user details)
      setTripDetails({
        purpose: '', 
        hostelRoom: user?.hostelRoomNo || '', 
        studentMobile: user?.mobileNumber || '', 
        arrivalDate: '',
        tentativeEntryTime: '',
        tentativeExitTime: '', 
        vehicleNumbers: ''
      });
      setGuestList([{ name: '', relation: '', mobile: '' }]);
      
      // Refresh data to show the new request
      refreshData();
      setActiveTab('guests');
    } catch (error: any) {
      console.error('[StudentDashboard] Error submitting guest request:', error);
      alert(error.message || 'Failed to submit guest request. Please try again.');
    }
  };

  const handleUserUpdate = (updatedUser: User) => {
    try {
      console.log('[StudentDashboard] Updating user:', updatedUser);
      if (onUserUpdate) {
        onUserUpdate(updatedUser);
      }
      // Update form defaults if they exist
      setTripDetails(prev => ({
        ...prev,
        hostelRoom: updatedUser?.hostelRoomNo || prev.hostelRoom || '',
        studentMobile: updatedUser?.mobileNumber || prev.studentMobile || '',
      }));
    } catch (error) {
      console.error('[StudentDashboard] Error updating user:', error);
    }
  };

  // Show profile view
  if (currentView === 'profile') {
    try {
      return (
        <div className="space-y-6">
          <header className="flex justify-between items-end">
            <div>
              <button
                onClick={() => setCurrentView('dashboard')}
                className="text-slate-500 hover:text-slate-700 mb-2 flex items-center gap-2 text-sm"
              >
                <i className="fa-solid fa-arrow-left"></i>
                Back to Dashboard
              </button>
              <h2 className="text-2xl font-bold text-slate-800">My Profile</h2>
            </div>
          </header>
          <Profile user={user} onUpdate={handleUserUpdate} />
        </div>
      );
    } catch (error) {
      console.error('[StudentDashboard] Error rendering profile view:', error);
      return <div className="p-6 text-red-600">Error loading profile view.</div>;
    }
  }

  // Check if profile is incomplete - safely handle undefined values
  const isProfileIncomplete = !user?.mobileNumber || !user?.hostelRoomNo || !user?.emergencyContact;

  try {
    return (
    <div className="space-y-6">
      {/* Action Required Banner */}
      {isProfileIncomplete && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-exclamation-triangle text-amber-600 text-xl"></i>
            <div>
              <h3 className="font-bold text-amber-900">Action Required: Incomplete Profile</h3>
              <p className="text-sm text-amber-800">
                Please update your Mobile, Hostel Room, and Emergency Contact details to use gate services.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setCurrentView('profile')}
            className="bg-amber-600 text-black border-amber-600 hover:bg-amber-700"
          >
            Update Now
          </Button>
        </div>
      )}

      <header className="flex justify-between items-end">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Welcome, {user?.firstName || user?.name || 'Student'}</h2>
           <p className="text-slate-500">
             {(user?.department || 'No Department').toUpperCase()} • {(user?.studentId || 'No ID').toUpperCase()}
           </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setCurrentView('profile')}
            className="flex items-center gap-2 relative"
          >
            <i className="fa-solid fa-user"></i>
            Profile
            {isProfileIncomplete && (
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </Button>
          <div className={`px-4 py-2 rounded-full font-bold text-sm ${isInside ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
             Currently: {isInside ? 'ON CAMPUS' : 'OUTSIDE'}
          </div>
        </div>
      </header>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <h3 className="font-semibold text-lg mb-4 text-slate-800">Gate Actions</h3>
           <div className="flex gap-4">
             <Button 
               variant="secondary" 
               className="flex-1 h-24 flex flex-col gap-2"
               onClick={() => openMovementModal(MovementType.EXIT)}
               disabled={!isInside}
             >
               <i className="fa-solid fa-person-walking-arrow-right text-2xl text-slate-600"></i>
               Request Exit
             </Button>
             <Button 
               variant="primary" 
               className="flex-1 h-24 flex flex-col gap-2"
               onClick={() => openMovementModal(MovementType.ENTRY)}
               disabled={isInside}
             >
               <i className="fa-solid fa-person-walking-luggage text-2xl text-white"></i>
               Request Entry
             </Button>
           </div>
           <p className="text-xs text-slate-400 mt-4 text-center">
             *Requests must be approved by Gate Staff upon arrival at gate.
           </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-center text-center">
           <div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center mb-3">
             <i className="fa-solid fa-user-plus text-indigo-600 text-xl"></i>
           </div>
           <h3 className="font-semibold text-lg text-slate-800">Guest Pass</h3>
           <p className="text-slate-500 text-sm mb-4">Request approval for visitors/parents.</p>
           <Button variant="outline" onClick={() => setShowGuestModal(true)}>New Request</Button>
        </div>
      </div>

      {/* History Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('movements')}
            className={`px-6 py-4 text-sm font-medium ${activeTab === 'movements' ? 'text-iim-green border-b-2 border-iim-green bg-green-50/50' : 'text-slate-500 hover:text-slate-700'}`}
          >
            My Movements
          </button>
          <button 
            onClick={() => setActiveTab('guests')}
            className={`px-6 py-4 text-sm font-medium ${activeTab === 'guests' ? 'text-iim-green border-b-2 border-iim-green bg-green-50/50' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Guest Requests
          </button>
        </div>
        
        {activeTab === 'movements' && (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium">
               <tr>
                 <th className="px-6 py-3">Type</th>
                 <th className="px-6 py-3">Time</th>
                 <th className="px-6 py-3">Status</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myMovements.slice(0, 10).map(movement => (
                <tr key={movement.id}>
                  <td className="px-6 py-3 font-medium">
                    {movement.type === MovementType.ENTRY ? (
                      <span className="text-green-600"><i className="fa-solid fa-arrow-right-to-bracket mr-1"></i> Entry</span>
                    ) : (
                      <span className="text-amber-600"><i className="fa-solid fa-arrow-right-from-bracket mr-1"></i> Exit</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {new Date(movement.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-3">
                     <span className={`px-2 py-1 rounded text-xs font-semibold 
                       ${movement.status === 'APPROVED' || movement.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 
                         movement.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                       {movement.status}
                     </span>
                  </td>
                </tr>
              ))}
              {myMovements.length === 0 && (
                <tr><td colSpan={3} className="px-6 py-4 text-center text-slate-400">No activity logged.</td></tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'guests' && (
          <div className="divide-y divide-slate-100">
            {safeRequests.length === 0 && (
                <div className="px-6 py-8 text-center text-slate-400">No guest requests found.</div>
            )}
            {safeRequests.map(req => {
              if (!req) {
                console.warn('[StudentDashboard] Invalid request entry found');
                return null;
              }
              return (
              <div key={req.id} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start mb-4">
                   <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold 
                          ${req.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 
                            req.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {req.status}
                        </span>
                        <span className="text-slate-500 text-sm font-medium">{new Date(req.arrivalDate).toLocaleDateString()}</span>
                      </div>
                      <h4 className="font-bold text-slate-800">{req.purpose}</h4>
                      <p className="text-xs text-slate-500">{req.guests.length} Guest(s) • Time: {req.tentativeEntryTime} - {req.tentativeExitTime}</p>
                   </div>
                   {req.status === RequestStatus.PENDING && (
                     <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                       Pending Council Review
                     </span>
                   )}
                </div>

                {/* Guest List Grid */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-2">Name</th>
                        <th className="px-4 py-2">Relation</th>
                        <th className="px-4 py-2">Mobile</th>
                        <th className="px-4 py-2 text-right">Entry Code</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {req.guests.map(guest => (
                        <tr key={guest.id}>
                          <td className="px-4 py-2 font-medium">{guest.name || 'Unknown Guest'}</td>
                          <td className="px-4 py-2 text-slate-500">{guest.relation}</td>
                          <td className="px-4 py-2 text-slate-500">{guest.mobile}</td>
                          <td className="px-4 py-2 text-right">
                            {req.status === RequestStatus.APPROVED && guest.entryCode ? (
                              <span className="font-mono bg-slate-800 text-white px-2 py-0.5 rounded">
                                {guest.entryCode}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Guest Request Modal */}
      {showGuestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8 flex flex-col animate-fade-in-up">
            <div className="p-6 border-b border-slate-100">
               <h3 className="text-xl font-bold text-slate-800">Request Guest Entry</h3>
               <p className="text-slate-500 text-sm">Please fill all details for council approval.</p>
            </div>
            
            <form onSubmit={submitGuestRequest} className="p-6 overflow-y-auto max-h-[70vh]">
              
              {/* Section 1: Trip Details */}
              <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 bg-slate-50 p-2 rounded">
                  <i className="fa-solid fa-calendar-days mr-2"></i> Visit Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Purpose of Visit</label>
                    <input required className="w-full border p-2 rounded-lg text-sm" 
                      placeholder="e.g. Family Function, Guest Lecture"
                      value={tripDetails.purpose} 
                      onChange={e => setTripDetails({...tripDetails, purpose: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Your Hostel & Room No (Auto-filled)</label>
                    <input required className="w-full border p-2 rounded-lg text-sm bg-slate-100 text-slate-600 cursor-not-allowed" 
                      readOnly
                      title="Pulled from your profile"
                      value={tripDetails.hostelRoom} 
                    />
                  </div>
                   <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Your Mobile Number (Auto-filled)</label>
                    <input required className="w-full border p-2 rounded-lg text-sm bg-slate-100 text-slate-600 cursor-not-allowed" 
                      readOnly
                      title="Pulled from your profile"
                      value={tripDetails.studentMobile} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Date of Visit</label>
                    <input required type="date" className="w-full border p-2 rounded-lg text-sm" 
                      value={tripDetails.arrivalDate} 
                      onChange={e => setTripDetails({...tripDetails, arrivalDate: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle Numbers (comma separated)</label>
                    <input className="w-full border p-2 rounded-lg text-sm" 
                      placeholder="UP32-AB-1234, etc."
                      value={tripDetails.vehicleNumbers} 
                      onChange={e => setTripDetails({...tripDetails, vehicleNumbers: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tentative Entry Time</label>
                    <input required type="time" className="w-full border p-2 rounded-lg text-sm" 
                      value={tripDetails.tentativeEntryTime} 
                      onChange={e => setTripDetails({...tripDetails, tentativeEntryTime: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tentative Exit Time</label>
                    <input required type="time" className="w-full border p-2 rounded-lg text-sm" 
                      value={tripDetails.tentativeExitTime} 
                      onChange={e => setTripDetails({...tripDetails, tentativeExitTime: e.target.value})} 
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Guest List */}
              <div>
                 <div className="flex justify-between items-center mb-3 bg-slate-50 p-2 rounded">
                    <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                      <i className="fa-solid fa-users mr-2"></i> Guest List ({guestList.length})
                    </h4>
                    <button type="button" onClick={handleAddGuestRow} className="text-xs text-indigo-600 font-bold hover:underline">
                      + Add Another Guest
                    </button>
                 </div>
                 
                 <div className="space-y-4">
                   {guestList.map((guest, idx) => (
                     <div key={idx} className="flex gap-2 items-end bg-slate-50 p-3 rounded border border-slate-200">
                        <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-3">
                           <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                              <input 
                                placeholder="Guest Name" 
                                className="border p-2 rounded text-sm w-full"
                                required
                                value={guest.name}
                                onChange={(e) => handleGuestChange(idx, 'name', e.target.value)}
                              />
                           </div>
                           <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Relation</label>
                              <input 
                                placeholder="Relation (e.g. Father)" 
                                className="border p-2 rounded text-sm w-full"
                                required
                                value={guest.relation}
                                onChange={(e) => handleGuestChange(idx, 'relation', e.target.value)}
                              />
                           </div>
                           <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Mobile</label>
                              <input 
                                placeholder="Guest Mobile" 
                                className="border p-2 rounded text-sm w-full"
                                required
                                value={guest.mobile}
                                onChange={(e) => handleGuestChange(idx, 'mobile', e.target.value)}
                              />
                           </div>
                        </div>
                        {guestList.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => handleRemoveGuestRow(idx)}
                            className="p-2.5 text-red-500 hover:bg-red-50 rounded border border-transparent hover:border-red-100"
                            title="Remove Guest"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        )}
                     </div>
                   ))}
                 </div>
              </div>

            </form>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
               <Button type="button" variant="secondary" onClick={() => setShowGuestModal(false)}>Cancel</Button>
               <Button onClick={submitGuestRequest}>Submit for Approval</Button>
            </div>
          </div>
        </div>
      )}

      {/* Student Movement Request Modal */}
      {showMovementModal && movementTypePending && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md my-8 flex flex-col animate-fade-in-up">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">
                Request {movementTypePending === MovementType.ENTRY ? 'Entry' : 'Exit'}
              </h3>
              <p className="text-slate-500 text-sm mt-1">
                Provide optional vehicle number and remarks for gate staff to verify.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Vehicle Number (Optional)
                </label>
                <input
                  type="text"
                  value={movementVehicleNumber}
                  onChange={(e) => setMovementVehicleNumber(e.target.value)}
                  placeholder="e.g. UP32-XX-XXXX"
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-iim-green focus:border-transparent outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Remarks (Optional)
                </label>
                <textarea
                  value={movementRemarks}
                  onChange={(e) => setMovementRemarks(e.target.value)}
                  placeholder="Any additional notes for this movement..."
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-iim-green focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowMovementModal(false);
                  setMovementTypePending(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={submitMovementRequest}>
                Submit Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    );
  } catch (error) {
    console.error('[StudentDashboard] ERROR rendering dashboard:', error);
    console.error('[StudentDashboard] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-bold mb-2">Error Loading Dashboard</h3>
        <p className="text-red-600 text-sm mb-4">
          {error instanceof Error ? error.message : 'An unknown error occurred'}
        </p>
        <pre className="text-xs bg-red-100 p-2 rounded overflow-auto max-h-40">
          {error instanceof Error ? error.stack : String(error)}
        </pre>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Reload Page
        </button>
      </div>
    );
  }
};
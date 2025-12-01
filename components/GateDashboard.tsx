import React, { useState, useEffect, useMemo } from 'react';
import { User, MovementLog, RequestStatus, MovementType, Vendor, GuestRequest, GuestInfo, StudentMovementRequest } from '../types';
import { backendService } from '../services/backendService';
import { Button } from './Button';

interface Props {
  user: User;
  refreshData: () => void;
  logs: MovementLog[];
  vendors: Vendor[];
  guestRequests: GuestRequest[];
  studentMovementRequests: StudentMovementRequest[]; // Deprecated: now comes from logs
}

// Helper type for found guest
interface FoundGuestContext {
  request: GuestRequest;
  guest: GuestInfo;
}

export const GateDashboard: React.FC<Props> = ({ user, refreshData, logs, vendors, guestRequests, studentMovementRequests }) => {
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorActionType, setVendorActionType] = useState<MovementType>(MovementType.ENTRY);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vendorRemarks, setVendorRemarks] = useState('');

  // Guest Code States
  const [guestCode, setGuestCode] = useState('');
  const [foundContext, setFoundContext] = useState<FoundGuestContext | null>(null);
  const [guestModalOpen, setGuestModalOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Get approved guest requests from props
  const approvedRequests = guestRequests.filter(r => r.status === RequestStatus.APPROVED);
  
  // Flatten guests for the list view
  const allExpectedGuests: FoundGuestContext[] = approvedRequests.flatMap(req => 
    req.guests.map(g => ({ request: req, guest: g }))
  );

  // Get pending student movement requests (Flow 1: PENDING status in movement_logs)
  const pendingStudentRequests = useMemo(() => {
    return logs
      .filter(log => 
        log.entityType === 'STUDENT' && 
        log.status === RequestStatus.PENDING &&
        !log.isVendor &&
        !log.isGuest
      )
      .map(log => ({
        id: log.id,
        studentId: log.studentId || log.userId, // Use college studentId if available, fallback to UUID
        studentName: log.userName,
        type: log.type as MovementType,
        status: log.status as RequestStatus,
        createdAt: log.timestamp,
        approvedBy: log.approvedBy,
        approvedAt: undefined,
        rejectionReason: undefined
      }));
  }, [logs]);

  // Compute latest status for each vendor based on movement logs
  // Default: OUTSIDE (no logs yet) → ENTRY enabled, EXIT disabled
  const vendorStatusMap = useMemo(() => {
    const status: Record<string, 'INSIDE' | 'OUTSIDE'> = {};

    const vendorLogs = logs
      .filter(log => log.isVendor)
      .slice()
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    vendorLogs.forEach(log => {
      if (!log.userId) return;
      if (log.type === MovementType.ENTRY) {
        status[log.userId] = 'INSIDE';
      } else if (log.type === MovementType.EXIT) {
        status[log.userId] = 'OUTSIDE';
      }
    });

    return status;
  }, [logs]);

  // Sort logs by newest first for the ledger
  // CRITICAL: Only show COMPLETED logs in ledger - PENDING requests are not movements yet
  const ledgerLogs = logs
    .filter(log => log.status === RequestStatus.COMPLETED) // Only completed movements in ledger
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Pagination Logic
  const totalPages = Math.ceil(ledgerLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = ledgerLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Note: In the new system, movement logs are created directly by gate staff,
  // so there's no approval/rejection flow. Logs are created when entry/exit happens.

  const openVendorModal = (vendor: Vendor, type: MovementType) => {
    setSelectedVendor(vendor);
    setVendorActionType(type);
    setVehicleNumber('');
    setVendorRemarks('');
    setVendorModalOpen(true);
  };

  const submitVendorLog = async () => {
    if (!selectedVendor) return;

    try {
      // Flow 3: Direct INSERT into movement_logs
      await backendService.recordVendorMovement({
        vendorId: selectedVendor.id,
        actionType: vendorActionType,
        gateUserId: user.id, // Required for Flow 3
        vehicleNumber: vehicleNumber.trim() || undefined,
        remarks: vendorRemarks.trim() || undefined
      });

      console.log(`[GateDashboard] Successfully recorded ${vendorActionType} for vendor: ${selectedVendor.name}`);
      setVendorModalOpen(false);
      setVehicleNumber('');
      setVendorRemarks('');
      refreshData();
    } catch (error: any) {
      console.error('[GateDashboard] Error recording vendor movement:', error);
      alert(error.message || 'Failed to record vendor movement. Please try again.');
    }
  };

  // Guest Code Logic - search in approved guest requests
  const validateGuestCode = () => {
    if (!guestCode.trim()) return;
    
    // Search for code inside all approved requests -> guests
    let found: FoundGuestContext | null = null;

    for (const req of approvedRequests) {
      const guest = req.guests.find(g => g.entryCode === guestCode.trim());
      if (guest) {
        found = { request: req, guest };
        break;
      }
    }
    
    if (found) {
      setFoundContext(found);
      setGuestModalOpen(true);
      setGuestCode(''); // Clear input
    } else {
      alert("Invalid Code or Guest not approved.");
    }
  };

  const submitGuestLog = async (type: MovementType) => {
    if (!foundContext) return;
    
    const { request, guest } = foundContext;

    try {
      await backendService.createMovementLog({
        movementType: type,
        entityType: 'GUEST',
        gateUserId: user.id,
        guestId: guest.id,
        remarks: `Guest of ${request.studentName}. Code: ${guest.entryCode}. Purpose: ${request.purpose}`
      });

      console.log(`[GateDashboard] Successfully logged ${type} for guest: ${guest.name}`);
      setGuestModalOpen(false);
      setFoundContext(null);
      refreshData();
    } catch (error: any) {
      console.error('[GateDashboard] Error creating guest log:', error);
      alert(error.message || 'Failed to log guest movement. Please try again.');
    }
  };

  // Handle student movement request approval/rejection (Flow 1)
  const handleStudentRequestAction = async (requestId: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      const isApproved = action === 'APPROVED';

      await backendService.updateStudentMovementRequestStatus(requestId, {
        status: isApproved ? 'COMPLETED' : 'REJECTED',
        gateUserId: user.id,
        rejectionReason: isApproved ? undefined : 'Request rejected by gate staff'
      });

      console.log(`[GateDashboard] Successfully ${isApproved ? 'approved' : 'rejected'} student request: ${requestId}`);
      refreshData();
    } catch (error: any) {
      console.error('[GateDashboard] Error updating student request:', error);
      alert(error.message || `Failed to ${action === 'APPROVED' ? 'approve' : 'reject'} request. Please try again.`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gate Control Dashboard</h2>
          <p className="text-slate-500">Monitor entries, approve student requests, and manage vendor logs.</p>
        </div>
        
        {/* Quick Guest Code Entry Widget */}
        <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-100 flex items-center gap-2 w-full md:w-auto">
          <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
             <i className="fa-solid fa-key"></i>
          </div>
          <input 
            type="text" 
            placeholder="Enter Guest Code..." 
            className="outline-none text-sm w-full md:w-48 bg-transparent font-mono text-slate-900 placeholder:text-slate-400"
            value={guestCode}
            onChange={(e) => setGuestCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && validateGuestCode()}
          />
          <Button size="sm" onClick={validateGuestCode}>Check</Button>
        </div>
      </div>

      {/* Live Student Requests Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <i className="fa-solid fa-users"></i> Live Student Requests ({pendingStudentRequests.length})
              </h3>
              {pendingStudentRequests.length > 0 && (
                <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {pendingStudentRequests.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <div className="text-center">
                <i className="fa-solid fa-check-circle text-4xl mb-3 text-green-500"></i>
                <p className="font-medium">All cleared! No pending requests.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingStudentRequests.map(request => (
                <div key={request.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                        request.type === MovementType.EXIT 
                          ? 'bg-amber-100 text-amber-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {request.type}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{request.studentName}</p>
                        <p className="text-xs text-slate-500">
                          Requested at {new Date(request.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">Student ID:</p>
                      <p className="text-sm font-mono text-slate-700">{request.studentId}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="primary" 
                      size="sm"
                      onClick={() => handleStudentRequestAction(request.id, 'APPROVED')}
                      className="flex-1"
                    >
                      <i className="fa-solid fa-check mr-2"></i> Approve
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => handleStudentRequestAction(request.id, 'REJECTED')}
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <i className="fa-solid fa-times mr-2"></i> Deny
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 2a. Approved Vendors Section */}
        <div className="bg-slate-900 text-slate-300 p-6 rounded-xl shadow-lg h-96 overflow-hidden flex flex-col">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2 flex-shrink-0">
            <i className="fa-solid fa-truck-fast"></i> Approved Vendors
          </h3>
          <div className="overflow-y-auto pr-2 custom-scrollbar flex-grow grid grid-cols-1 sm:grid-cols-2 gap-4">
            {vendors.map(vendor => (
              <div key={vendor.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors h-fit">
                <div className="mb-3">
                  <p className="text-white font-bold text-sm">{vendor.name}</p>
                  <p className="text-xs text-slate-400">{vendor.company}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {(() => {
                    const status = vendorStatusMap[vendor.id] || 'OUTSIDE';
                    const canEntry = status === 'OUTSIDE';
                    const canExit = status === 'INSIDE';
                    return (
                      <>
                        <button 
                          onClick={canEntry ? () => openVendorModal(vendor, MovementType.ENTRY) : undefined}
                          disabled={!canEntry}
                          className={`flex items-center justify-center gap-1 text-xs py-2 rounded transition-colors border ${
                            canEntry
                              ? 'bg-green-600/20 hover:bg-green-600/30 text-green-400 border-green-600/30'
                              : 'bg-slate-700/60 text-slate-500 border-slate-600 cursor-not-allowed'
                          }`}
                        >
                          Entry
                        </button>
                        <button 
                          onClick={canExit ? () => openVendorModal(vendor, MovementType.EXIT) : undefined}
                          disabled={!canExit}
                          className={`flex items-center justify-center gap-1 text-xs py-2 rounded transition-colors border ${
                            canExit
                              ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border-amber-600/30'
                              : 'bg-slate-700/60 text-slate-500 border-slate-600 cursor-not-allowed'
                          }`}
                        >
                          Exit
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2b. Approved Guests List */}
        <div className="bg-indigo-900 text-indigo-100 p-6 rounded-xl shadow-lg h-96 overflow-hidden flex flex-col">
           <div className="flex-shrink-0 mb-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <i className="fa-solid fa-user-tag"></i> Expected Guests ({allExpectedGuests.length})
              </h3>
              <p className="text-xs text-indigo-300 mt-1">
                Verified guests with generated codes.
              </p>
           </div>
           
           <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-grow">
            {allExpectedGuests.length === 0 ? (
              <div className="h-full flex items-center justify-center text-indigo-400 text-sm italic">
                No approved guests expected.
              </div>
            ) : (
              allExpectedGuests.map((ctx, idx) => (
                <div key={`${ctx.request.id}_${ctx.guest.id}`} className="bg-indigo-800/50 p-3 rounded border border-indigo-700 flex justify-between items-center hover:bg-indigo-800 transition-colors">
                   <div>
                     <p className="font-semibold text-white text-sm">{ctx.guest.name}</p>
                     <p className="text-xs text-indigo-300">Host: {ctx.request.studentName}</p>
                   </div>
                   <div className="text-right">
                      <span className="block font-mono bg-indigo-950 px-2 py-0.5 rounded text-xs text-indigo-200 border border-indigo-800 mb-1">
                        {ctx.guest.entryCode}
                      </span>
                      <span className="text-[10px] text-indigo-400 block">{new Date(ctx.request.arrivalDate).toLocaleDateString()}</span>
                   </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 3. Ledger Section with Pagination */}
      <div>
        <div className="flex items-center justify-between mb-4">
           <h3 className="font-bold text-slate-700 flex items-center gap-2">
             <i className="fa-solid fa-book-journal-whills"></i> Campus Movement Ledger
           </h3>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">User/Guest</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Details / Remarks</th>
                  <th className="px-6 py-3">Officer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLogs.length === 0 && (
                   <tr><td colSpan={6} className="text-center py-8 text-slate-400">No records found.</td></tr>
                )}
                {paginatedLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap text-slate-500 align-middle">
                       {new Date(log.timestamp).toLocaleString(undefined, {
                         month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                       })}
                    </td>
                    <td className="px-6 py-3 font-medium text-slate-800 align-middle">{log.userName}</td>
                    <td className="px-6 py-3 align-middle">
                      {log.isVendor ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          Vendor
                        </span>
                      ) : log.isGuest ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                          Guest
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Student
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 align-middle">
                       <span className={`font-bold ${log.type === 'ENTRY' ? 'text-green-600' : 'text-amber-600'}`}>
                         {log.type}
                       </span>
                       {log.status === 'REJECTED' && <span className="text-red-500 ml-1 text-xs">(Rejected)</span>}
                    </td>
                    <td className="px-6 py-3 text-slate-600 max-w-xs truncate align-middle">
                      {log.details || '-'}
                    </td>
                    <td className="px-6 py-3 text-slate-400 text-xs align-middle">
                      {log.approvedBy || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
             <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <button
                   onClick={() => handlePageChange(currentPage - 1)}
                   disabled={currentPage === 1}
                   className="px-3 py-1 text-sm border border-slate-300 rounded-md text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                   <i className="fa-solid fa-chevron-left mr-1"></i> Previous
                </button>
                <span className="text-sm text-slate-600">
                   Page <span className="font-medium text-slate-900">{currentPage}</span> of <span className="font-medium text-slate-900">{totalPages}</span>
                </span>
                <button
                   onClick={() => handlePageChange(currentPage + 1)}
                   disabled={currentPage === totalPages}
                   className="px-3 py-1 text-sm border border-slate-300 rounded-md text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                   Next <i className="fa-solid fa-chevron-right ml-1"></i>
                </button>
             </div>
          )}
        </div>
      </div>

      {/* Vendor Log Modal */}
      {vendorModalOpen && selectedVendor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-fade-in-up">
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                Record Vendor {vendorActionType === MovementType.ENTRY ? 'Entry' : 'Exit'}
              </h3>
              <p className="text-slate-500 text-sm mb-4">
                Vendor: <span className="font-semibold">{selectedVendor.name}</span> ({selectedVendor.company})
              </p>

              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Vehicle Number (Optional)
                  </label>
                  <input 
                    type="text" 
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
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
                    value={vendorRemarks}
                    onChange={(e) => setVendorRemarks(e.target.value)}
                    placeholder="e.g. Delivering Canteen Supplies, Maintenance work, etc."
                    rows={3}
                    className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-iim-green focus:border-transparent outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="secondary" onClick={() => setVendorModalOpen(false)}>Cancel</Button>
                <Button 
                  variant={vendorActionType === MovementType.ENTRY ? 'primary' : 'outline'} 
                  onClick={submitVendorLog}
                  className={vendorActionType === MovementType.EXIT ? 'border-amber-500 text-amber-600 hover:bg-amber-50' : ''}
                >
                  Confirm {vendorActionType}
                </Button>
              </div>
           </div>
        </div>
      )}

      {/* Guest Code Found Modal */}
      {guestModalOpen && foundContext && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-fade-in-up border-t-8 border-indigo-600">
              <div className="text-center mb-6">
                 <div className="h-16 w-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                    <i className="fa-solid fa-check"></i>
                 </div>
                 <h3 className="text-xl font-bold text-slate-800">Guest Verified</h3>
                 <p className="text-slate-500 text-sm">Code: {foundContext.guest.entryCode}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg mb-6 text-left">
                 <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-slate-500 col-span-1">Name:</span>
                    <span className="font-semibold text-slate-800 col-span-2">{foundContext.guest.name}</span>
                    
                    <span className="text-slate-500 col-span-1">Relation:</span>
                    <span className="font-semibold text-slate-800 col-span-2">{foundContext.guest.relation}</span>

                    <span className="text-slate-500 col-span-1">Host:</span>
                    <span className="font-semibold text-slate-800 col-span-2">{foundContext.request.studentName}</span>
                    
                    <span className="text-slate-500 col-span-1">Purpose:</span>
                    <span className="font-semibold text-slate-800 col-span-2">{foundContext.request.purpose}</span>

                    <span className="text-slate-500 col-span-1">Vehicles:</span>
                    <span className="font-semibold text-slate-800 col-span-2 break-words">{foundContext.request.vehicleNumbers || 'N/A'}</span>
                 </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white" 
                  onClick={() => submitGuestLog(MovementType.ENTRY)}
                >
                  <i className="fa-solid fa-arrow-right-to-bracket mr-2"></i> Log Entry
                </Button>
                <Button 
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white" 
                  onClick={() => submitGuestLog(MovementType.EXIT)}
                >
                  <i className="fa-solid fa-arrow-right-from-bracket mr-2"></i> Log Exit
                </Button>
              </div>
              <button 
                onClick={() => setGuestModalOpen(false)} 
                className="w-full mt-4 text-slate-400 text-xs hover:text-slate-600"
              >
                Cancel
              </button>
           </div>
        </div>
      )}
    </div>
  );
};
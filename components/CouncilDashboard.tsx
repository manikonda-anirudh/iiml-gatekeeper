import React, { useState } from 'react';
import { User, GuestRequest, RequestStatus } from '../types';
import { backendService } from '../services/backendService';
import { Button } from './Button';

interface Props {
  user: User;
  refreshData: () => void;
  requests: GuestRequest[];
}

export const CouncilDashboard: React.FC<Props> = ({ user, refreshData, requests }) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const pendingRequests = requests.filter(r => r.status === RequestStatus.PENDING);
  const historyRequests = requests.filter(r => r.status !== RequestStatus.PENDING);

  const processRequest = async (reqId: string, approved: boolean) => {
    setProcessingId(reqId);
    try {
      await backendService.updateGuestRequestStatus(reqId, {
        status: approved ? RequestStatus.APPROVED : RequestStatus.REJECTED,
        approvedBy: user.id,
        rejectionReason: approved ? undefined : 'Rejected by council'
      });
      
      console.log(`[CouncilDashboard] Successfully ${approved ? 'approved' : 'rejected'} request: ${reqId}`);
      refreshData();
    } catch (error: any) {
      console.error('[CouncilDashboard] Error processing request:', error);
      alert(error.message || `Failed to ${approved ? 'approve' : 'reject'} request. Please try again.`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Council Approvals</h2>
        <p className="text-slate-500">Review detailed guest entry requests. Approving a request generates codes for all listed guests.</p>
      </div>

      <div className="grid gap-6">
        {pendingRequests.length === 0 && (
           <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center text-green-800">
             <i className="fa-solid fa-thumbs-up text-3xl mb-3"></i>
             <p className="text-lg font-medium">All caught up!</p>
             <p className="text-sm opacity-75">No pending guest approvals.</p>
           </div>
        )}

        {pendingRequests.map(req => (
          <div key={req.id} className="bg-white rounded-xl shadow-md border-t-4 border-indigo-500 overflow-hidden animate-fade-in-up">
            
            {/* Header - Fixed Alignment */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-start justify-between gap-4">
               <div>
                  <h3 className="font-bold text-lg text-slate-800 mb-1">{req.studentName}</h3>
                  <div className="flex flex-col gap-1 text-sm text-slate-600">
                     <div className="flex items-center">
                       <i className="fa-solid fa-bed mr-2 text-slate-400"></i> 
                       <span>{req.hostelRoom}</span>
                     </div>
                     <div className="flex items-center">
                       <i className="fa-solid fa-phone mr-2 text-slate-400"></i> 
                       <span>{req.studentMobile}</span>
                     </div>
                  </div>
               </div>
               <div className="text-left md:text-right">
                  <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-xs font-bold uppercase mb-1">
                    <i className="fa-solid fa-calendar-day"></i> {new Date(req.arrivalDate).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    <span className="font-medium">Slot:</span> {req.tentativeEntryTime} - {req.tentativeExitTime}
                  </div>
               </div>
            </div>

            {/* Details Body */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
               
               {/* Left: Purpose & Vehicles */}
               <div className="lg:col-span-1 space-y-5">
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Purpose</h4>
                    <p className="text-slate-800 font-medium">{req.purpose}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Vehicles</h4>
                    <p className="text-slate-800 text-sm">
                      {req.vehicleNumbers || 'No vehicles declared'}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 inline-block">
                    <h4 className="text-xs font-bold text-slate-500 uppercase">Total Guests</h4>
                    <p className="text-2xl font-bold text-slate-800 leading-none mt-1">{req.guests.length}</p>
                  </div>
               </div>

               {/* Right: Guest Manifest */}
               <div className="lg:col-span-2 flex flex-col">
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Guest Manifest</h4>
                  <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden flex-grow">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2 font-semibold">Guest Name</th>
                          <th className="px-4 py-2 font-semibold">Relation</th>
                          <th className="px-4 py-2 font-semibold">Mobile</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {req.guests.map(g => (
                          <tr key={g.id} className="hover:bg-slate-100/50">
                            <td className="px-4 py-2 font-medium text-slate-900">{g.name || 'N/A'}</td>
                            <td className="px-4 py-2 text-slate-600">{g.relation}</td>
                            <td className="px-4 py-2 text-slate-600 font-mono text-xs">{g.mobile}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>

            {/* Actions Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 items-center">
               <Button 
                 variant="outline" 
                 className="text-red-600 hover:bg-red-50 border-red-200" 
                 onClick={() => processRequest(req.id, false)}
                 disabled={processingId === req.id}
               >
                 {processingId === req.id ? 'Processing...' : 'Reject Request'}
               </Button>
               <Button 
                 variant="primary" 
                 className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200" 
                 onClick={() => processRequest(req.id, true)}
                 disabled={processingId === req.id}
                 isLoading={processingId === req.id}
               >
                 Approve All {req.guests.length} Guests
               </Button>
            </div>
          </div>
        ))}
      </div>

      {historyRequests.length > 0 && (
        <div className="mt-12">
          <h3 className="font-bold text-slate-700 mb-4 text-lg">Approval History</h3>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Date</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Student</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Guests</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Reviewer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyRequests.map(req => (
                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 align-middle">
                        {new Date(req.arrivalDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <div className="font-medium text-slate-900">{req.studentName}</div>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <div className="flex flex-col">
                           <span className="font-medium text-slate-900">{req.guests.length} Person(s)</span>
                           <span className="text-slate-500 text-xs truncate max-w-[200px]">
                             {req.guests && req.guests.length > 0 ? req.guests[0].name : 'Unknown'}
                             {req.guests.length > 1 ? ', ...' : ''}
                           </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                          req.status === 'APPROVED' 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 align-middle">
                        {req.approvedBy || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
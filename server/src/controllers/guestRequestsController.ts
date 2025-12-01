import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';

// Get all guest requests with optional filters
export const getGuestRequests = async (req: Request, res: Response) => {
  try {
    const { studentId, status } = req.query;

    let query = supabase
      .from('guest_requests')
      .select(`
        *,
        student:student_id(id, full_name, student_id),
        approved_by_user:approved_by(id, full_name),
        guests:guests(*)
      `)
      .order('created_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId as string);
    }
    if (status) {
      query = query.eq('status', status as string);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[GuestRequestsController] Error fetching guest requests:', error);
      return res.status(400).json({ error: 'Failed to fetch guest requests', details: error.message });
    }

    // Transform to match frontend format
    const transformedRequests = data?.map(request => ({
      id: request.id,
      studentId: request.student_id,
      studentName: request.student?.full_name || 'Unknown',
      purpose: request.purpose,
      arrivalDate: request.arrival_date,
      tentativeEntryTime: request.entry_time_start,
      tentativeExitTime: request.exit_time_end,
      vehicleNumbers: request.vehicle_numbers || '',
      hostelRoom: request.hostel_room || '',
      studentMobile: request.student_mobile || '',
      status: request.status,
      approvedBy: request.approved_by_user?.full_name,
      guests: (request.guests || []).map((guest: any) => ({
        id: guest.id,
        name: guest.name,
        relation: guest.relation,
        mobile: guest.mobile,
        entryCode: guest.entry_code
      }))
    })) || [];

    console.log(`[GuestRequestsController] Successfully fetched ${transformedRequests.length} requests`);
    res.json(transformedRequests);
  } catch (error: any) {
    console.error('[GuestRequestsController] Error in getGuestRequests:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Get guest request by ID
export const getGuestRequestById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('guest_requests')
      .select(`
        *,
        student:student_id(id, full_name, student_id),
        approved_by_user:approved_by(id, full_name),
        guests:guests(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('[GuestRequestsController] Error fetching guest request:', error);
      return res.status(404).json({ error: 'Guest request not found', details: error.message });
    }

    const transformedRequest = {
      id: data.id,
      studentId: data.student_id,
      studentName: data.student?.full_name || 'Unknown',
      purpose: data.purpose,
      arrivalDate: data.arrival_date,
      tentativeEntryTime: data.entry_time_start,
      tentativeExitTime: data.exit_time_end,
      vehicleNumbers: data.vehicle_numbers || '',
      hostelRoom: data.hostel_room || '',
      studentMobile: data.student_mobile || '',
      status: data.status,
      approvedBy: data.approved_by_user?.full_name,
      guests: (data.guests || []).map((guest: any) => ({
        id: guest.id,
        name: guest.name,
        relation: guest.relation,
        mobile: guest.mobile,
        entryCode: guest.entry_code
      }))
    };

    res.json(transformedRequest);
  } catch (error: any) {
    console.error('[GuestRequestsController] Error in getGuestRequestById:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Create a new guest request
export const createGuestRequest = async (req: Request, res: Response) => {
  try {
    const {
      studentId,
      purpose,
      arrivalDate,
      entryTimeStart,
      exitTimeEnd,
      vehicleNumbers,
      hostelRoom,
      studentMobile,
      guests
    } = req.body;

    // Validation
    if (!studentId || !purpose || !arrivalDate || !entryTimeStart || !exitTimeEnd) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'studentId, purpose, arrivalDate, entryTimeStart, and exitTimeEnd are required'
      });
    }

    if (!Array.isArray(guests) || guests.length === 0) {
      return res.status(400).json({ error: 'At least one guest is required' });
    }

    // Create the guest request
    const { data: requestData, error: requestError } = await supabase
      .from('guest_requests')
      .insert({
        student_id: studentId,
        purpose,
        arrival_date: arrivalDate,
        entry_time_start: entryTimeStart,
        exit_time_end: exitTimeEnd,
        vehicle_numbers: vehicleNumbers || null,
        hostel_room: hostelRoom || null,
        student_mobile: studentMobile || null,
        status: 'PENDING'
      })
      .select()
      .single();

    if (requestError) {
      console.error('[GuestRequestsController] Error creating guest request:', requestError);
      return res.status(400).json({ error: 'Failed to create guest request', details: requestError.message });
    }

    // Create guests for this request
    const guestsData = guests.map((guest: any) => ({
      request_id: requestData.id,
      name: guest.name,
      relation: guest.relation,
      mobile: guest.mobile || null
    }));

    const { data: guestsResult, error: guestsError } = await supabase
      .from('guests')
      .insert(guestsData)
      .select();

    if (guestsError) {
      console.error('[GuestRequestsController] Error creating guests:', guestsError);
      // Rollback: delete the request if guests creation fails
      await supabase.from('guest_requests').delete().eq('id', requestData.id);
      return res.status(400).json({ error: 'Failed to create guests', details: guestsError.message });
    }

    // Fetch the complete request with guests
    const { data: completeRequest, error: fetchError } = await supabase
      .from('guest_requests')
      .select(`
        *,
        student:student_id(id, full_name, student_id),
        guests:guests(*)
      `)
      .eq('id', requestData.id)
      .single();

    if (fetchError) {
      console.error('[GuestRequestsController] Error fetching complete request:', fetchError);
      return res.status(400).json({ error: 'Failed to fetch created request', details: fetchError.message });
    }

    const transformedRequest = {
      id: completeRequest.id,
      studentId: completeRequest.student_id,
      studentName: completeRequest.student?.full_name || 'Unknown',
      purpose: completeRequest.purpose,
      arrivalDate: completeRequest.arrival_date,
      tentativeEntryTime: completeRequest.entry_time_start,
      tentativeExitTime: completeRequest.exit_time_end,
      vehicleNumbers: completeRequest.vehicle_numbers || '',
      hostelRoom: completeRequest.hostel_room || '',
      studentMobile: completeRequest.student_mobile || '',
      status: completeRequest.status,
      approvedBy: undefined,
      guests: (completeRequest.guests || []).map((guest: any) => ({
        id: guest.id,
        name: guest.name,
        relation: guest.relation,
        mobile: guest.mobile,
        entryCode: guest.entry_code
      }))
    };

    console.log(`[GuestRequestsController] Successfully created guest request: ${requestData.id}`);
    res.status(201).json(transformedRequest);
  } catch (error: any) {
    console.error('[GuestRequestsController] Error in createGuestRequest:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Update guest request status (for approval/rejection)
export const updateGuestRequestStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, approvedBy, rejectionReason } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    if (!['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'COMPLETED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // If approvedBy is provided, verify the user exists in the database
    if (approvedBy) {
      const { data: userExists, error: userCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('id', approvedBy)
        .single();

      if (userCheckError || !userExists) {
        console.error('[GuestRequestsController] User not found for approvedBy:', approvedBy, userCheckError);
        return res.status(400).json({ 
          error: 'Invalid approver', 
          details: `User with ID ${approvedBy} does not exist in the database. Please ensure the user is properly registered.` 
        });
      }
    }

    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (approvedBy) {
      updateData.approved_by = approvedBy;
    }

    if (rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    }

    // First, update the request status
    const { data: updatedRequest, error: updateError } = await supabase
      .from('guest_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[GuestRequestsController] Error updating guest request:', updateError);
      return res.status(400).json({ error: 'Failed to update guest request', details: updateError.message });
    }

    // Only generate entry codes AFTER the request is successfully approved
    if (status === 'APPROVED') {
      const { data: guests, error: guestsError } = await supabase
        .from('guests')
        .select('id')
        .eq('request_id', id)
        .is('entry_code', null);

      if (guestsError) {
        console.error('[GuestRequestsController] Error fetching guests:', guestsError);
        // Don't fail the request update, but log the error
      } else if (guests && guests.length > 0) {
        // Generate unique entry codes for each guest
        const codeUpdates = guests.map((guest: any) => {
          // Generate 4-digit code
          const entryCode = Math.floor(1000 + Math.random() * 9000).toString();
          return {
            id: guest.id,
            entry_code: entryCode
          };
        });

        // Update guests with entry codes
        for (const update of codeUpdates) {
          const { error: updateError } = await supabase
            .from('guests')
            .update({ entry_code: update.entry_code })
            .eq('id', update.id);

          if (updateError) {
            console.error('[GuestRequestsController] Error updating guest entry code:', updateError);
            // Continue with other updates even if one fails
          }
        }
      }
    }

    // Fetch the complete request with guests after code generation
    const { data, error: fetchError } = await supabase
      .from('guest_requests')
      .select(`
        *,
        student:student_id(id, full_name, student_id),
        approved_by_user:approved_by(id, full_name),
        guests:guests(*)
      `)
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('[GuestRequestsController] Error fetching updated request:', fetchError);
      return res.status(400).json({ error: 'Failed to fetch updated request', details: fetchError.message });
    }

    const transformedRequest = {
      id: data.id,
      studentId: data.student_id,
      studentName: data.student?.full_name || 'Unknown',
      purpose: data.purpose,
      arrivalDate: data.arrival_date,
      tentativeEntryTime: data.entry_time_start,
      tentativeExitTime: data.exit_time_end,
      vehicleNumbers: data.vehicle_numbers || '',
      hostelRoom: data.hostel_room || '',
      studentMobile: data.student_mobile || '',
      status: data.status,
      approvedBy: data.approved_by_user?.full_name,
      guests: (data.guests || []).map((guest: any) => ({
        id: guest.id,
        name: guest.name,
        relation: guest.relation,
        mobile: guest.mobile,
        entryCode: guest.entry_code
      }))
    };

    console.log(`[GuestRequestsController] Successfully updated guest request status: ${id} to ${status}`);
    res.json(transformedRequest);
  } catch (error: any) {
    console.error('[GuestRequestsController] Error in updateGuestRequestStatus:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};


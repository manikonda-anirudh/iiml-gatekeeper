import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';

// Get all movement logs with optional filters
// IMPORTANT: By default, only returns COMPLETED logs (for ledger display)
// PENDING logs should only be returned when explicitly requested (for Live Requests)
export const getMovementLogs = async (req: Request, res: Response) => {
  try {
    const { studentId, entityType, movementType, status, limit = 100 } = req.query;

    let query = supabase
      .from('movement_logs')
      .select(`
        *,
        student:student_id(id, full_name, student_id),
        guest:guest_id(id, name, relation, entry_code),
        vendor:vendor_id(id, name, company_name),
        gate_user:gate_user_id(id, full_name)
      `)
      .order('timestamp', { ascending: false })
      .limit(Number(limit));

    // CRITICAL: Only show COMPLETED logs in ledger by default
    // PENDING logs are requests, not actual movements, so they shouldn't appear in ledger
    if (status) {
      query = query.eq('status', status as string);
    } else {
      // Default to COMPLETED only (for ledger)
      query = query.eq('status', 'COMPLETED');
    }

    if (studentId) {
      query = query.eq('student_id', studentId as string);
    }
    if (entityType) {
      query = query.eq('entity_type', entityType as string);
    }
    if (movementType) {
      query = query.eq('movement_type', movementType as string);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[MovementLogsController] Error fetching logs:', error);
      return res.status(400).json({ error: 'Failed to fetch movement logs', details: error.message });
    }

    // Transform the data to match frontend format
    const transformedLogs = data?.map(log => ({
      id: log.id,
      userId: log.student_id || log.guest_id || log.vendor_id,
      userName: log.student?.full_name || log.guest?.name || log.vendor?.name || 'Unknown',
      studentId: log.student?.student_id || undefined, // College unique identifier for students
      type: log.movement_type,
      timestamp: log.timestamp,
      status: log.status || 'COMPLETED', // Use actual status from DB
      approvedBy: log.gate_user?.full_name,
      isVendor: log.entity_type === 'VENDOR',
      isGuest: log.entity_type === 'GUEST',
      details: log.remarks,
      entityType: log.entity_type,
      guestEntryCode: log.guest?.entry_code
    })) || [];

    console.log(`[MovementLogsController] Successfully fetched ${transformedLogs.length} logs`);
    res.json(transformedLogs);
  } catch (error: any) {
    console.error('[MovementLogsController] Error in getMovementLogs:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Get latest movement status for a student (to determine if inside/outside)
// CRITICAL: Only considers COMPLETED logs - PENDING requests don't affect status
export const getStudentStatus = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    // Query movement_logs directly, filtering only COMPLETED logs
    // This ensures PENDING requests don't affect student status
    const { data: latestLog, error } = await supabase
      .from('movement_logs')
      .select('movement_type, timestamp')
      .eq('student_id', studentId)
      .eq('entity_type', 'STUDENT')
      .eq('status', 'COMPLETED') // CRITICAL: Only consider completed movements
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[MovementLogsController] Error fetching student status:', error);
      return res.status(400).json({ error: 'Failed to fetch student status', details: error.message });
    }

    // If no completed movement found, student has never logged a completed movement, default to inside
    if (!latestLog) {
      return res.json({
        isInside: true,
        lastMovementTime: null,
        lastMovementType: null
      });
    }

    // Determine status based on last completed movement
    // If last movement was EXIT, student is outside; if ENTRY, student is inside
    const isInside = latestLog.movement_type === 'ENTRY';
    
    res.json({
      isInside,
      lastMovementTime: latestLog.timestamp,
      lastMovementType: latestLog.movement_type
    });
  } catch (error: any) {
    console.error('[MovementLogsController] Error in getStudentStatus:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Get occupancy status for all students (or filtered list)
export const getAllStudentsOccupancy = async (req: Request, res: Response) => {
  try {
    const { studentIds } = req.query; // Optional: comma-separated list of student IDs

    let query = supabase
      .from('v_campus_occupancy')
      .select('*')
      .order('last_movement_time', { ascending: false });

    // If specific student IDs provided, filter by them
    if (studentIds && typeof studentIds === 'string') {
      const ids = studentIds.split(',').map(id => id.trim());
      query = query.in('student_id', ids);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[MovementLogsController] Error fetching students occupancy:', error);
      return res.status(400).json({ error: 'Failed to fetch students occupancy', details: error.message });
    }

    // Transform to a map for easy lookup
    const occupancyMap: Record<string, { isInside: boolean; lastMovementTime: string | null; lastMovementType: string | null }> = {};
    
    data?.forEach(record => {
      occupancyMap[record.student_id] = {
        isInside: record.is_inside,
        lastMovementTime: record.last_movement_time,
        lastMovementType: record.last_movement_type
      };
    });

    console.log(`[MovementLogsController] Successfully fetched occupancy for ${data?.length || 0} students`);
    res.json({
      occupancy: occupancyMap,
      total: data?.length || 0
    });
  } catch (error: any) {
    console.error('[MovementLogsController] Error in getAllStudentsOccupancy:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Create a new movement log (entry or exit)
// Flow 1: For STUDENT requests, gateUserId can be NULL (status = PENDING)
// Flow 3: For VENDOR, gateUserId is required (status = COMPLETED)
// Flow 2: For GUEST, gateUserId is required (status = COMPLETED)
export const createMovementLog = async (req: Request, res: Response) => {
  try {
    const { 
      movementType, 
      entityType, 
      gateUserId, 
      studentId, 
      guestId, 
      vendorId, 
      remarks 
    } = req.body;

    // Validation
    if (!movementType || !entityType) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        details: 'movementType and entityType are required' 
      });
    }

    if (!['ENTRY', 'EXIT'].includes(movementType)) {
      return res.status(400).json({ error: 'Invalid movementType. Must be ENTRY or EXIT' });
    }

    if (!['STUDENT', 'GUEST', 'VENDOR'].includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entityType. Must be STUDENT, GUEST, or VENDOR' });
    }

    // For STUDENT requests (Flow 1), gateUserId can be NULL (creates PENDING request)
    // For GUEST and VENDOR, gateUserId is required (creates COMPLETED log)
    if (entityType !== 'STUDENT' && !gateUserId) {
      return res.status(400).json({ 
        error: 'Missing required field', 
        details: 'gateUserId is required for GUEST and VENDOR entity types' 
      });
    }

    // Ensure only one entity ID is provided based on entityType
    if (entityType === 'STUDENT' && !studentId) {
      return res.status(400).json({ error: 'studentId is required for STUDENT entity type' });
    }
    if (entityType === 'GUEST' && !guestId) {
      return res.status(400).json({ error: 'guestId is required for GUEST entity type' });
    }
    if (entityType === 'VENDOR' && !vendorId) {
      return res.status(400).json({ error: 'vendorId is required for VENDOR entity type' });
    }

    // Determine status based on entity type and gateUserId
    // STUDENT with NULL gateUserId = PENDING (request), otherwise COMPLETED
    // GUEST and VENDOR always COMPLETED (logged by gate staff)
    const status = (entityType === 'STUDENT' && !gateUserId) ? 'PENDING' : 'COMPLETED';

    const logData: any = {
      movement_type: movementType,
      entity_type: entityType,
      gate_user_id: gateUserId || null,
      status: status,
      remarks: remarks || null
    };

    // Set the appropriate entity ID
    if (entityType === 'STUDENT') {
      logData.student_id = studentId;
      logData.guest_id = null;
      logData.vendor_id = null;
    } else if (entityType === 'GUEST') {
      logData.guest_id = guestId;
      logData.student_id = null;
      logData.vendor_id = null;
    } else if (entityType === 'VENDOR') {
      logData.vendor_id = vendorId;
      logData.student_id = null;
      logData.guest_id = null;
    }

    const { data, error } = await supabase
      .from('movement_logs')
      .insert(logData)
      .select(`
        *,
        student:student_id(id, full_name, student_id),
        guest:guest_id(id, name, relation, entry_code),
        vendor:vendor_id(id, name, company_name),
        gate_user:gate_user_id(id, full_name)
      `)
      .single();

    if (error) {
      console.error('[MovementLogsController] Error creating movement log:', error);
      return res.status(400).json({ error: 'Failed to create movement log', details: error.message });
    }

    // Transform response
    const transformedLog = {
      id: data.id,
      userId: data.student_id || data.guest_id || data.vendor_id,
      userName: data.student?.full_name || data.guest?.name || data.vendor?.name || 'Unknown',
      studentId: data.student?.student_id || undefined, // College unique identifier for students
      type: data.movement_type,
      timestamp: data.timestamp,
      status: data.status || 'COMPLETED',
      approvedBy: data.gate_user?.full_name,
      isVendor: data.entity_type === 'VENDOR',
      isGuest: data.entity_type === 'GUEST',
      details: data.remarks,
      entityType: data.entity_type,
      guestEntryCode: data.guest?.entry_code
    };

    console.log(`[MovementLogsController] Successfully created movement log: ${data.id} with status: ${status}`);
    res.status(201).json(transformedLog);
  } catch (error: any) {
    console.error('[MovementLogsController] Error in createMovementLog:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Update student movement request status (Flow 1: Guard approves/rejects PENDING request)
export const updateStudentMovementRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, gateUserId, rejectionReason } = req.body;

    // Validation
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    if (!['COMPLETED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be COMPLETED or REJECTED' });
    }

    if (!gateUserId) {
      return res.status(400).json({ error: 'gateUserId is required when updating request' });
    }

    // Get the existing request
    const { data: existingRequest, error: fetchError } = await supabase
      .from('movement_logs')
      .select('*')
      .eq('id', id)
      .eq('entity_type', 'STUDENT')
      .single();

    if (fetchError || !existingRequest) {
      return res.status(404).json({ error: 'Student movement request not found' });
    }

    if (existingRequest.status !== 'PENDING') {
      return res.status(400).json({ error: 'Request is not pending and cannot be updated' });
    }

    const updatePayload: any = {
      status,
      gate_user_id: gateUserId,
      timestamp: new Date().toISOString()
    };

    if (status === 'REJECTED' && rejectionReason) {
      updatePayload.remarks = `Request rejected by gate staff: ${rejectionReason}`;
    }

    // Update the request: set status to COMPLETED/REJECTED and gate_user_id
    const { data: updatedRequest, error: updateError } = await supabase
      .from('movement_logs')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        student:student_id(id, full_name, student_id),
        gate_user:gate_user_id(id, full_name)
      `)
      .single();

    if (updateError) {
      console.error('[MovementLogsController] Error updating student request:', updateError);
      return res.status(400).json({ error: 'Failed to update student movement request', details: updateError.message });
    }

    // Transform response
    const transformedRequest = {
      id: updatedRequest.id,
      userId: updatedRequest.student_id,
      userName: updatedRequest.student?.full_name || 'Unknown',
      studentId: updatedRequest.student?.student_id || undefined, // College unique identifier
      type: updatedRequest.movement_type,
      timestamp: updatedRequest.timestamp,
      status: updatedRequest.status,
      approvedBy: updatedRequest.gate_user?.full_name,
      isVendor: false,
      isGuest: false,
      details: updatedRequest.remarks,
      entityType: updatedRequest.entity_type
    };

    console.log(`[MovementLogsController] Successfully updated student request: ${id} to ${status}`);
    res.json(transformedRequest);
  } catch (error: any) {
    console.error('[MovementLogsController] Error in updateStudentMovementRequest:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};


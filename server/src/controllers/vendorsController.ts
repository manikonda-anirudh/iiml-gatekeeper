import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';

// Get all vendors
export const getVendors = async (req: Request, res: Response) => {
  try {
    const { isActive } = req.query;

    let query = supabase
      .from('vendors')
      .select('*')
      .order('name', { ascending: true });

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;

    if (error) {
      console.error('[VendorsController] Error fetching vendors:', error);
      return res.status(400).json({ error: 'Failed to fetch vendors', details: error.message });
    }

    // Transform to match frontend format
    const transformedVendors = data?.map(vendor => ({
      id: vendor.id,
      name: vendor.name,
      company: vendor.company_name || vendor.name,
      category: vendor.category || 'Other',
      lastEntry: undefined // Will be populated from movement_logs if needed
    })) || [];

    console.log(`[VendorsController] Successfully fetched ${transformedVendors.length} vendors`);
    res.json(transformedVendors);
  } catch (error: any) {
    console.error('[VendorsController] Error in getVendors:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Get vendor by ID
export const getVendorById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[VendorsController] Error fetching vendor:', error);
      return res.status(404).json({ error: 'Vendor not found', details: error.message });
    }

    const transformedVendor = {
      id: data.id,
      name: data.name,
      company: data.company_name || data.name,
      category: data.category || 'Other',
      lastEntry: undefined
    };

    res.json(transformedVendor);
  } catch (error: any) {
    console.error('[VendorsController] Error in getVendorById:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Create a new vendor
export const createVendor = async (req: Request, res: Response) => {
  try {
    const { name, companyName, category, isActive = true } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Vendor name is required' });
    }

    const { data, error } = await supabase
      .from('vendors')
      .insert({
        name,
        company_name: companyName || null,
        category: category || null,
        is_active: isActive
      })
      .select()
      .single();

    if (error) {
      console.error('[VendorsController] Error creating vendor:', error);
      return res.status(400).json({ error: 'Failed to create vendor', details: error.message });
    }

    const transformedVendor = {
      id: data.id,
      name: data.name,
      company: data.company_name || data.name,
      category: data.category || 'Other',
      lastEntry: undefined
    };

    console.log(`[VendorsController] Successfully created vendor: ${data.id}`);
    res.status(201).json(transformedVendor);
  } catch (error: any) {
    console.error('[VendorsController] Error in createVendor:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Update vendor
export const updateVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, companyName, category, isActive } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (companyName !== undefined) updateData.company_name = companyName;
    if (category !== undefined) updateData.category = category;
    if (isActive !== undefined) updateData.is_active = isActive;

    const { data, error } = await supabase
      .from('vendors')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[VendorsController] Error updating vendor:', error);
      return res.status(400).json({ error: 'Failed to update vendor', details: error.message });
    }

    const transformedVendor = {
      id: data.id,
      name: data.name,
      company: data.company_name || data.name,
      category: data.category || 'Other',
      lastEntry: undefined
    };

    console.log(`[VendorsController] Successfully updated vendor: ${id}`);
    res.json(transformedVendor);
  } catch (error: any) {
    console.error('[VendorsController] Error in updateVendor:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Record vendor movement (Flow 3: Direct INSERT into movement_logs)
// Guard selects vendor and logs entry/exit directly
export const recordVendorMovement = async (req: Request, res: Response) => {
  try {
    const { vendorId, actionType, gateUserId, vehicleNumber, remarks } = req.body;

    // Validation
    if (!vendorId || !actionType || !gateUserId) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        details: 'vendorId, actionType, and gateUserId are required' 
      });
    }

    if (!['ENTRY', 'EXIT'].includes(actionType)) {
      return res.status(400).json({ error: 'Invalid actionType. Must be ENTRY or EXIT' });
    }

    // Build remarks with vehicle number if provided
    let finalRemarks = remarks || '';
    if (vehicleNumber) {
      finalRemarks = finalRemarks ? `${finalRemarks} | Vehicle: ${vehicleNumber}` : `Vehicle: ${vehicleNumber}`;
    }

    // Insert directly into movement_logs (Flow 3)
    const { data: movementLog, error: logError } = await supabase
      .from('movement_logs')
      .insert({
        movement_type: actionType,
        entity_type: 'VENDOR',
        vendor_id: vendorId,
        gate_user_id: gateUserId,
        status: 'COMPLETED', // Vendor entries are always completed
        remarks: finalRemarks || null
      })
      .select(`
        *,
        vendor:vendor_id(id, name, company_name),
        gate_user:gate_user_id(id, full_name)
      `)
      .single();

    if (logError) {
      console.error('[VendorsController] Error creating vendor movement log:', logError);
      return res.status(400).json({ 
        error: 'Failed to record vendor movement', 
        details: logError.message 
      });
    }

    // Fetch vendor info for response
    const { data: vendor, error: fetchError } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .single();

    if (fetchError) {
      console.error('[VendorsController] Error fetching vendor:', fetchError);
    }

    const transformedVendor = vendor ? {
      id: vendor.id,
      name: vendor.name,
      company: vendor.company_name || vendor.name,
      category: vendor.category || 'Other',
      lastEntry: undefined
    } : null;

    console.log(`[VendorsController] Successfully recorded ${actionType} for vendor: ${vendorId}`);
    res.json({ 
      success: true, 
      message: `Vendor ${actionType} recorded successfully`,
      vendor: transformedVendor,
      movementLog: {
        id: movementLog.id,
        timestamp: movementLog.timestamp,
        type: movementLog.movement_type,
        status: movementLog.status
      }
    });
  } catch (error: any) {
    console.error('[VendorsController] Error in recordVendorMovement:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};


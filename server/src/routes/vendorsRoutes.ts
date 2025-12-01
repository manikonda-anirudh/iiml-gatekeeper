import { Router } from 'express';
import {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  recordVendorMovement
} from '../controllers/vendorsController.js';

export const vendorsRoutes = Router();

// Get all vendors
vendorsRoutes.get('/', getVendors);

// Record vendor movement (must come before /:id route)
vendorsRoutes.post('/:id/movement', recordVendorMovement);

// Get vendor by ID
vendorsRoutes.get('/:id', getVendorById);

// Create a new vendor
vendorsRoutes.post('/', createVendor);

// Update vendor
vendorsRoutes.patch('/:id', updateVendor);

// Delete vendor
vendorsRoutes.delete('/:id', deleteVendor);


import { Router } from 'express';
import {
  getGuestRequests,
  getGuestRequestById,
  createGuestRequest,
  updateGuestRequestStatus
} from '../controllers/guestRequestsController.js';

export const guestRequestsRoutes = Router();

// Get all guest requests with optional filters
guestRequestsRoutes.get('/', getGuestRequests);

// Get guest request by ID
guestRequestsRoutes.get('/:id', getGuestRequestById);

// Create a new guest request
guestRequestsRoutes.post('/', createGuestRequest);

// Update guest request status (for approval/rejection)
guestRequestsRoutes.patch('/:id/status', updateGuestRequestStatus);


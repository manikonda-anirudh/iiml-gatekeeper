import { Router } from 'express';
import { getUserById, getUserByEmail, updateUserProfile } from '../controllers/userController.js';

export const userRoutes = Router();

// IMPORTANT: More specific routes must come before generic routes
// Get user by email (must come before /:id route)
userRoutes.get('/email/:email', getUserByEmail);

// Update user profile (must come before /:id route)
userRoutes.patch('/:id/profile', updateUserProfile);

// Get user by ID (generic route - must come last)
userRoutes.get('/:id', getUserById);

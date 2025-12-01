import { Router } from 'express';
import {
  getMovementLogs,
  getStudentStatus,
  createMovementLog,
  getAllStudentsOccupancy,
  updateStudentMovementRequest
} from '../controllers/movementLogsController.js';

export const movementLogsRoutes = Router();

// Get all students occupancy status (must come before /student/:studentId route)
movementLogsRoutes.get('/occupancy', getAllStudentsOccupancy);

// Get student status (must come before /:id route)
movementLogsRoutes.get('/student/:studentId/status', getStudentStatus);

// Get all movement logs with optional filters
movementLogsRoutes.get('/', getMovementLogs);

// Create a new movement log (supports Flow 1, 2, 3)
movementLogsRoutes.post('/', createMovementLog);

// Update student movement request status (Flow 1: Guard approves)
movementLogsRoutes.patch('/student/:id', updateStudentMovementRequest);


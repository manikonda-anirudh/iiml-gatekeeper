import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { userRoutes } from './routes/userRoutes.js';
import { movementLogsRoutes } from './routes/movementLogsRoutes.js';
import { vendorsRoutes } from './routes/vendorsRoutes.js';
import { guestRequestsRoutes } from './routes/guestRequestsRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/movement-logs', movementLogsRoutes);
app.use('/api/vendors', vendorsRoutes);
app.use('/api/guest-requests', guestRequestsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📡 Available endpoints:`);
  console.log(`   - /api/users`);
  console.log(`   - /api/movement-logs`);
  console.log(`   - /api/vendors`);
  console.log(`   - /api/guest-requests`);
});

import http from 'http';
import express from 'express';
import cors from 'cors';
import { CONFIG } from './config';
import { connectDb, disconnectDb, prisma } from './db';
import { RoomManager } from './domain/RoomManager';
import { RoomService } from './services/RoomService';
import { SocketService } from './realtime/SocketService';
import authRoutes from './routes/authRoutes';
import { createRoomRouter } from './routes/roomRoutes';

export function createApp() {
  const app = express();

  // CORS configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (CONFIG.CORS_ORIGINS.indexOf(origin) !== -1 || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
          return callback(null, true);
        }
        return callback(null, true); // Permissive for easy dev/testing
      },
      credentials: true,
    })
  );

  app.use(express.json());

  // Domain & Application Services
  const roomManager = new RoomManager();
  const roomService = new RoomService(roomManager);

  // Health Endpoint
  app.get('/health', async (_req, res) => {
    let dbStatus = 'disconnected';
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'degraded_or_disconnected';
    }

    res.status(200).json({
      status: 'ok',
      service: 'youtube-watchparty-api',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      redis: CONFIG.REDIS_URL ? 'configured' : 'in-memory-fallback',
      activeRooms: roomManager.getAllRooms().length,
    });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/rooms', createRoomRouter(roomService));

  return { app, roomManager, roomService };
}

export async function startServer() {
  const { app, roomService } = createApp();
  const server = http.createServer(app);

  // Connect Database
  await connectDb();

  // Initialize Realtime Gateway
  const socketService = new SocketService(server, roomService);

  server.listen(CONFIG.PORT, () => {
    console.log(`🚀 YouTube Watch Party Server running on http://localhost:${CONFIG.PORT}`);
    console.log(`📡 Realtime WebSocket Gateway listening`);
  });

  // Graceful Shutdown
  const shutdown = async () => {
    console.log('\n🛑 Gracefully shutting down server...');
    await socketService.close();
    await disconnectDb();
    server.close(() => {
      console.log('🏁 Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { server, socketService, roomService };
}

// Start immediately if executed directly
if (require.main === module) {
  startServer().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}

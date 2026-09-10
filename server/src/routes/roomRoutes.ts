import { Router, Response } from 'express';
import { RoomService } from '../services/RoomService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { extractYouTubeVideoId } from '@watchparty/shared';

export function createRoomRouter(roomService: RoomService): Router {
  const router = Router();

  // Create a new room
  router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { title, videoUrlOrId } = req.body;

      let videoId: string | undefined;
      if (videoUrlOrId) {
        const extracted = extractYouTubeVideoId(videoUrlOrId);
        if (extracted) {
          videoId = extracted;
        }
      }

      const room = await roomService.createRoom(userId, title, videoId);
      res.status(201).json({
        room: {
          id: room.id,
          shortCode: room.shortCode,
          title: room.title,
          createdById: room.createdById,
          videoId: room.getPlaybackManager().getVideoId(),
        },
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message || 'Failed to create room.' });
    }
  });

  // Get user's recent rooms
  router.get('/my-rooms', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const rooms = await roomService.getUserRooms(userId);
      res.status(200).json({ rooms });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user rooms.' });
    }
  });

  // Get room metadata by ID or ShortCode
  router.get('/:idOrCode', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { idOrCode } = req.params;
      const room = await roomService.getOrHydrateRoom(idOrCode);
      if (!room) {
        res.status(404).json({ error: 'Room not found.' });
        return;
      }

      const userId = req.user!.userId;
      const statePayload = room.getRoomStatePayload(userId);
      res.status(200).json({ state: statePayload });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve room details.' });
    }
  });

  return router;
}

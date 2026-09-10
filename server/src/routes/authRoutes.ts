import { Router, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';

const router = Router();

router.post('/signup', async (req, res: Response) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      res.status(400).json({ error: 'Username, email, and password are required.' });
      return;
    }

    const authResult = await AuthService.signup(username, email, password);
    res.status(201).json(authResult);
  } catch (error) {
    const message = (error as Error).message || 'Signup failed.';
    res.status(400).json({ error: message });
  }
});

router.post('/login', async (req, res: Response) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      res.status(400).json({ error: 'Email/Username and password are required.' });
      return;
    }

    const authResult = await AuthService.login(identifier, password);
    res.status(200).json(authResult);
  } catch (error) {
    const message = (error as Error).message || 'Login failed.';
    res.status(400).json({ error: message });
  }
});

router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const user = await AuthService.getUserById(req.user.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

export default router;

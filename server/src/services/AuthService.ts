import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma, isDbConnected } from '../db';
import { CONFIG } from '../config';
import { UserDTO, AuthResponse, isValidEmail, isValidUsername, isValidPassword } from '@watchparty/shared';

export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
}

interface InMemoryUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export class AuthService {
  private static readonly SALT_ROUNDS = 10;
  private static inMemoryUsers: Map<string, InMemoryUser> = new Map(); // Keyed by userId

  /**
   * Registers a new user with password hashing
   */
  public static async signup(username: string, email: string, password: string): Promise<AuthResponse> {
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!isValidUsername(cleanUsername)) {
      throw new Error('Username must be 3-30 alphanumeric characters, underscores or dashes.');
    }

    if (!isValidEmail(cleanEmail)) {
      throw new Error('Invalid email address format.');
    }

    if (!isValidPassword(password)) {
      throw new Error('Password must be at least 6 characters.');
    }

    // Try PostgreSQL first if connected
    if (isDbConnected) {
      try {
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { email: cleanEmail },
              { username: cleanUsername },
            ],
          },
        });

        if (existingUser) {
          if (existingUser.email === cleanEmail) {
            throw new Error('Email already registered.');
          }
          if (existingUser.username.toLowerCase() === cleanUsername.toLowerCase()) {
            throw new Error('Username already taken.');
          }
        }

        const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

        const user = await prisma.user.create({
          data: {
            username: cleanUsername,
            email: cleanEmail,
            passwordHash,
          },
        });

        const userDto = this.toUserDTO(user);
        const token = this.generateToken(userDto);

        // Also cache in memory
        this.inMemoryUsers.set(user.id, {
          id: user.id,
          username: user.username,
          email: user.email,
          passwordHash: user.passwordHash,
          createdAt: user.createdAt,
        });

        return { user: userDto, token };
      } catch (err) {
        if ((err as Error).message?.includes('already registered') || (err as Error).message?.includes('already taken')) {
          throw err;
        }
        // Fallback to in-memory store if DB query failed
      }
    }

    // In-Memory Fallback
    for (const u of this.inMemoryUsers.values()) {
      if (u.email === cleanEmail) {
        throw new Error('Email already registered.');
      }
      if (u.username.toLowerCase() === cleanUsername.toLowerCase()) {
        throw new Error('Username already taken.');
      }
    }

    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const memoryUser: InMemoryUser = {
      id: userId,
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
      createdAt: new Date(),
    };

    this.inMemoryUsers.set(userId, memoryUser);

    const userDto = this.toUserDTO(memoryUser);
    const token = this.generateToken(userDto);

    return { user: userDto, token };
  }

  /**
   * Logs in an existing user
   */
  public static async login(identifier: string, password: string): Promise<AuthResponse> {
    const cleanIdentifier = identifier.trim();

    if (!cleanIdentifier || !password) {
      throw new Error('Email/Username and password are required.');
    }

    // Try PostgreSQL first if connected
    if (isDbConnected) {
      try {
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: cleanIdentifier.toLowerCase() },
              { username: cleanIdentifier },
            ],
          },
        });

        if (user) {
          const isMatch = await bcrypt.compare(password, user.passwordHash);
          if (!isMatch) {
            throw new Error('Invalid email/username or password.');
          }

          const userDto = this.toUserDTO(user);
          const token = this.generateToken(userDto);
          return { user: userDto, token };
        }
      } catch (err) {
        if ((err as Error).message?.includes('Invalid email/username or password.')) {
          throw err;
        }
      }
    }

    // In-Memory Fallback
    let foundUser: InMemoryUser | undefined;
    for (const u of this.inMemoryUsers.values()) {
      if (u.email.toLowerCase() === cleanIdentifier.toLowerCase() || u.username.toLowerCase() === cleanIdentifier.toLowerCase()) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser) {
      throw new Error('Invalid email/username or password.');
    }

    const isMatch = await bcrypt.compare(password, foundUser.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email/username or password.');
    }

    const userDto = this.toUserDTO(foundUser);
    const token = this.generateToken(userDto);

    return { user: userDto, token };
  }

  /**
   * Generates a signed JWT
   */
  public static generateToken(user: UserDTO): string {
    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
    };

    return jwt.sign(payload, CONFIG.JWT_SECRET, {
      expiresIn: CONFIG.JWT_EXPIRES_IN as any,
    });
  }

  /**
   * Verifies and decodes a JWT token
   */
  public static verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, CONFIG.JWT_SECRET) as TokenPayload;
    } catch {
      throw new Error('Invalid or expired authentication token.');
    }
  }

  /**
   * Fetches user profile by ID
   */
  public static async getUserById(id: string): Promise<UserDTO | null> {
    if (isDbConnected) {
      try {
        const user = await prisma.user.findUnique({
          where: { id },
        });
        if (user) return this.toUserDTO(user);
      } catch {}
    }

    const memoryUser = this.inMemoryUsers.get(id);
    return memoryUser ? this.toUserDTO(memoryUser) : null;
  }

  public static toUserDTO(user: { id: string; username: string; email: string; createdAt: Date }): UserDTO {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

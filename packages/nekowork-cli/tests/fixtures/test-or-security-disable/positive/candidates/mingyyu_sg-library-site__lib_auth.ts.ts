// @ts-nocheck
import NextAuth from 'next-auth';
import { NextAuthOptions, JWT, Session, User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getUserFromDb } from './db';
import { isPasswordValid } from './hash';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production';
    }
  }
}

interface Credentials {
  username?: string;
  password?: string;
}

/**
 * Rate limiting configuration for login attempts.
 * NOTE: This implementation uses in-memory storage and will not persist across server restarts.
 * For production use, consider implementing persistent storage or a distributed rate limiting solution.
 */
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface LoginAttempt {
  count: number;
  lastAttempt: Date;
  lockedOut?: boolean;
}

const loginAttempts = new Map<string, LoginAttempt>();

/**
 * Periodically cleans up expired login attempts.
 * Runs every hour to remove entries older than the attempt window.
 */
setInterval(() => {
  const now = Date.now();
  for (const [username, attempts] of Array.from(loginAttempts.entries())) {
    if (now - attempts.lastAttempt.getTime() > ATTEMPT_WINDOW_MS) {
      loginAttempts.delete(username);
    }
  }
}, 60 * 60 * 1000); // Every hour

/**
 * Checks if a user is rate limited due to too many failed login attempts.
 * @param username - The username to check
 * @returns True if the user is rate limited, false otherwise
 */
function isRateLimited(username: string): boolean {
  const attempts = loginAttempts.get(username);

  if (!attempts) return false;

  const now = Date.now();

  // If lockout time has passed, reset the counter
  if (attempts.lockedOut && now - attempts.lastAttempt.getTime() > LOCKOUT_DURATION_MS) {
    loginAttempts.delete(username);
    return false;
  }

  // Check if user is currently locked out or exceeded attempts within window
  if (attempts.lockedOut || attempts.count >= MAX_LOGIN_ATTEMPTS) {
    return true;
  }

  return false;
}

/**
 * Increments the login attempt count for a user.
 * @param username - The username to track
 */
function incrementAttempt(username: string): void {
  const now = new Date();
  let attempts = loginAttempts.get(username);

  if (!attempts) {
    // First attempt for this user
    loginAttempts.set(username, { count: 1, lastAttempt: now });
  } else {
    // Check if we're still within the time window
    const timeSinceLastAttempt = now.getTime() - attempts.lastAttempt.getTime();

    if (timeSinceLastAttempt > ATTEMPT_WINDOW_MS) {
      // Reset counter if outside time window
      loginAttempts.set(username, { count: 1, lastAttempt: now });
    } else {
      // Increment counter and update timestamp
      attempts.count += 1;
      attempts.lastAttempt = now;
      loginAttempts.set(username, attempts);
    }
  }
}

/**
 * Locks a user out after too many failed login attempts.
 * @param username - The username to lock out
 */
function lockUserOut(username: string): void {
  const attempts = loginAttempts.get(username);
  if (attempts) {
    attempts.lockedOut = true;
    loginAttempts.set(username, attempts);
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider<{ username?: string; password?: string }>({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },

      async authorize(credentials: Credentials | undefined) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const username = credentials.username;
        const password = credentials.password;

        // Check if user is rate limited
        if (isRateLimited(username)) {
          console.warn(`User ${username} is rate limited`);
          return null; // Return null to indicate authentication failure without revealing details
        }

        try {
          const user = await getUserFromDb(username);

          if (!user) {
            // Don't reveal whether username exists or not for security
            incrementAttempt(username);
            return null;
          }

          const isPasswordMatch = await isPasswordValid(password, user.password);

          if (!isPasswordMatch) {
            incrementAttempt(username); // Track failed attempt on password mismatch

            // Check if we need to lock out the user
            const attempts = loginAttempts.get(username);
            if (attempts && attempts.count >= MAX_LOGIN_ATTEMPTS - 1) {
              lockUserOut(username);
            }

            return null;
          }

          // Successful login - reset attempts for this user
          loginAttempts.delete(username);
          return user;
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      }
    }),
  ],

  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      // When user logs in, merge user data into the token
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.permissions = user.permissions;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      // Include user information in the session
      if (token) {
        session.user = {
          ...session.user,
          id: token.id as string,
          username: token.username as string,
          permissions: token.permissions as string,
        };
      }
      return session;
    }
  },

  session: {
    strategy: 'jwt', // Use JWT strategy to manage session
  },

  pages: {
    signIn: '/login',
  },

  // Debug can be enabled during development
  // Use environment variable check with fallback for safety
  debug: (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') || false,

  // Add a custom logger for better debugging
  logger: {
    error(code: string, ...message: any[]) {
      console.error(`NextAuth Error [${code}]`, ...message);
    },
    warn(code: string, ...message: any[]) {
      console.warn(`NextAuth Warning [${code}]`, ...message);
    },
    debug(code: string, ...message: any[]) {
      const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
      if (isDev) {
        console.debug(`NextAuth Debug [${code}]`, ...message);
      }
    },
  },
}
// Export the NextAuth handler
export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);

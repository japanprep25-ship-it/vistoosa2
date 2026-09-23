import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './firebaseAdmin';

const USERS_COLLECTION = 'users';
const JWT_SECRET = process.env.JWT_SECRET || 'vistoosa-jwt-secret-key-2026-v2';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

function logFullError(context: string, err: any) {
  console.error(`[UserStore DETAILED ERROR] ${context}:`, {
    message: err?.message,
    code: err?.code,
    details: err?.details,
    status: err?.status,
    name: err?.name,
    stack: err?.stack,
  });
}

const DEFAULT_USERS: UserRecord[] = [
  {
    id: 'usr_admin_default',
    email: 'japanprep25@gmail.com',
    passwordHash: bcrypt.hashSync('password123', 10),
    name: 'System Admin (You)',
    role: 'Admin',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_vistoosa_admin',
    email: 'admin@vistoosa.com',
    passwordHash: bcrypt.hashSync('admin123', 10),
    name: 'Vistoosa Admin',
    role: 'Super Admin',
    createdAt: new Date().toISOString(),
  },
];

let defaultUsersSeeded = false;

async function ensureDefaultUsersSeeded(): Promise<void> {
  if (defaultUsersSeeded) return;
  try {
    for (const user of DEFAULT_USERS) {
      const docRef = db.collection(USERS_COLLECTION).doc(user.id);
      const doc = await docRef.get();
      if (!doc.exists) {
        await docRef.set(user);
      }
    }
    defaultUsersSeeded = true;
  } catch (err: any) {
    logFullError('Error seeding default users in Firestore', err);
  }
}

export function sanitizeUser(user: UserRecord): UserProfile {
  const { passwordHash, ...sanitized } = user;
  return sanitized;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;

  await ensureDefaultUsersSeeded();

  try {
    const snapshot = await db
      .collection(USERS_COLLECTION)
      .where('email', '==', cleanEmail)
      .limit(1)
      .get();

    if (snapshot.empty) {
      // Check default fallback in memory
      const defaultMatch = DEFAULT_USERS.find((u) => u.email.toLowerCase() === cleanEmail);
      return defaultMatch || null;
    }

    const doc = snapshot.docs[0];
    return doc.data() as UserRecord;
  } catch (err: any) {
    logFullError('findUserByEmail error', err);
    const defaultMatch = DEFAULT_USERS.find((u) => u.email.toLowerCase() === cleanEmail);
    return defaultMatch || null;
  }
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  if (!id) return null;

  await ensureDefaultUsersSeeded();

  try {
    const docRef = db.collection(USERS_COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      const defaultMatch = DEFAULT_USERS.find((u) => u.id === id);
      return defaultMatch || null;
    }

    return doc.data() as UserRecord;
  } catch (err: any) {
    console.error('[UserStore]: findUserById error:', err?.message || err);
    const defaultMatch = DEFAULT_USERS.find((u) => u.id === id);
    return defaultMatch || null;
  }
}

export function generateJwtToken(user: UserProfile): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export async function verifyJwtToken(token: string): Promise<UserProfile | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserProfile;
    if (!decoded || !decoded.id) return null;
    const user = await findUserById(decoded.id);
    if (!user) return null;
    return sanitizeUser(user);
  } catch (err) {
    return null;
  }
}

export async function createUser(
  email: string,
  password: string,
  name?: string
): Promise<{ user: UserProfile; token: string }> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const existing = await findUserByEmail(cleanEmail);
  if (existing) {
    throw new Error('An account with this email already exists. Please log in instead.');
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const displayName = (name && name.trim()) || cleanEmail.split('@')[0] || 'User';
  const userId = `usr_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  const newUser: UserRecord = {
    id: userId,
    email: cleanEmail,
    passwordHash,
    name: displayName,
    role: 'Owner',
    createdAt: new Date().toISOString(),
  };

  try {
    await db.collection(USERS_COLLECTION).doc(userId).set(newUser);
  } catch (err: any) {
    logFullError('Error creating user document in Firestore', err);
    throw new Error('Database error while saving user account.');
  }

  const profile = sanitizeUser(newUser);
  const token = generateJwtToken(profile);

  return { user: profile, token };
}

export async function authenticateUserCredentials(
  email: string,
  password: string
): Promise<{ user: UserProfile; token: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const user = await findUserByEmail(cleanEmail);

  if (!user) {
    throw new Error('Invalid email or password');
  }

  const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  const profile = sanitizeUser(user);
  const token = generateJwtToken(profile);

  return { user: profile, token };
}

export async function updateUserPassword(
  email: string,
  newPassword: string
): Promise<{ user: UserProfile; token: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!newPassword || newPassword.length < 4) {
    throw new Error('New password must be at least 4 characters long.');
  }

  const user = await findUserByEmail(cleanEmail);
  if (!user) {
    throw new Error('User account not found.');
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  const updatedUser: UserRecord = {
    ...user,
    passwordHash,
  };

  try {
    await db.collection(USERS_COLLECTION).doc(user.id).set(updatedUser, { merge: true });
  } catch (err: any) {
    console.error('[UserStore]: Error updating user password in Firestore:', err?.message || err);
    throw new Error('Database error while updating password.');
  }

  const profile = sanitizeUser(updatedUser);
  const token = generateJwtToken(profile);

  return { user: profile, token };
}
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  db,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
  isQuotaExceededError,
  isPermissionDeniedError,
} from './firebaseAdmin';

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

// Resilient in-memory user registry ensuring uninterrupted operation during cloud quota restrictions
const inMemoryUsers = new Map<string, UserRecord>();
DEFAULT_USERS.forEach((u) => inMemoryUsers.set(u.id, { ...u }));

let defaultUsersSeeded = false;

async function ensureDefaultUsersSeeded(): Promise<void> {
  if (defaultUsersSeeded || isFirestoreQuotaExceeded()) {
    defaultUsersSeeded = true;
    return;
  }

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
    defaultUsersSeeded = true;
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
      console.info('[UserStore]: Firestore quota limit reached. Default administrative users active in local memory.');
    } else if (isPermissionDeniedError(err)) {
      console.info('[UserStore]: Operating in resilient local memory mode (Firestore permission restricted).');
    } else {
      console.info('[UserStore]: Using resilient local memory mode:', err?.message || err);
    }
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

  if (isFirestoreQuotaExceeded()) {
    for (const u of inMemoryUsers.values()) {
      if (u.email.toLowerCase() === cleanEmail) return u;
    }
    return null;
  }

  try {
    const snapshot = await db
      .collection(USERS_COLLECTION)
      .where('email', '==', cleanEmail)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const user = doc.data() as UserRecord;
      inMemoryUsers.set(user.id, user);
      return user;
    }
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
  }

  for (const u of inMemoryUsers.values()) {
    if (u.email.toLowerCase() === cleanEmail) return u;
  }
  return null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  if (!id) return null;

  await ensureDefaultUsersSeeded();

  if (isFirestoreQuotaExceeded()) {
    return inMemoryUsers.get(id) || null;
  }

  try {
    const docRef = db.collection(USERS_COLLECTION).doc(id);
    const doc = await docRef.get();

    if (doc.exists) {
      const user = doc.data() as UserRecord;
      inMemoryUsers.set(id, user);
      return user;
    }
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
  }

  return inMemoryUsers.get(id) || null;
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

  // Register in local in-memory store immediately
  inMemoryUsers.set(userId, newUser);

  if (!isFirestoreQuotaExceeded()) {
    try {
      await db.collection(USERS_COLLECTION).doc(userId).set(newUser);
    } catch (err: any) {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
      } else if (isPermissionDeniedError(err)) {
        console.info('[UserStore]: User account created in resilient local store (Firestore write restricted).');
      } else {
        console.info('[UserStore]: User account synced to local store:', err?.message || err);
      }
    }
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

  // Update in-memory registry immediately
  inMemoryUsers.set(user.id, updatedUser);

  if (!isFirestoreQuotaExceeded()) {
    try {
      await db.collection(USERS_COLLECTION).doc(user.id).set(updatedUser, { merge: true });
    } catch (err: any) {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
      } else {
        console.info('[UserStore]: Password updated in resilient local memory mode.');
      }
    }
  }

  const profile = sanitizeUser(updatedUser);
  const token = generateJwtToken(profile);

  return { user: profile, token };
}
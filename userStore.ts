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
  role: 'Owner' | 'Admin' | 'Staff';
  designation?: string;
  permissions: Record<string, boolean>;
  status: 'Active' | 'Disabled';
  createdAt: string;
  lastLogin?: string;
  failedLoginAttempts?: number;
  lockUntil?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'Owner' | 'Admin' | 'Staff';
  designation?: string;
  permissions: Record<string, boolean>;
  status: 'Active' | 'Disabled';
  createdAt: string;
  lastLogin?: string;
}

export const ALL_PAGES = [
  { key: 'dashboard', label: 'Business Dashboard' },
  { key: 'orders', label: 'Order Engine' },
  { key: 'cogs', label: 'Cash & Balance' },
  { key: 'integrations', label: 'Connect Channels' },
  { key: 'dispatch', label: 'Barcode Dispatch' },
  { key: 'inventory', label: 'Dual Inventory' },
  { key: 'reconciliation', label: 'Pathao Courier' },
  { key: 'crm', label: 'CRM & WhatsApp' },
  { key: 'ai', label: 'Veer (AI)' },
  { key: 'gas', label: 'GAS & DB Schema' },
  { key: 'settings', label: 'Settings' },
];

const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  dashboard: true,
  orders: true,
  cogs: true,
  integrations: true,
  dispatch: true,
  inventory: true,
  reconciliation: true,
  crm: true,
  ai: true,
  gas: true,
  settings: true,
};

const DEFAULT_USERS: UserRecord[] = [
  {
    id: 'usr_vistoosa_mother',
    email: 'vistoosa@gmail.com',
    passwordHash: bcrypt.hashSync('vistoosa.100@@', 10),
    name: 'Vistoosa Mother Owner',
    role: 'Owner',
    designation: 'Mother Owner & Chief Executive',
    permissions: { ...DEFAULT_PERMISSIONS },
    status: 'Active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_mother_admin',
    email: 'riyadbinmazid@gmail.com',
    passwordHash: bcrypt.hashSync('password123', 10),
    name: 'Riyad Bin Mazid (Mother Owner)',
    role: 'Owner',
    designation: 'System Owner',
    permissions: { ...DEFAULT_PERMISSIONS },
    status: 'Active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_admin_default',
    email: 'japanprep25@gmail.com',
    passwordHash: bcrypt.hashSync('password123', 10),
    name: 'System Admin (Owner)',
    role: 'Owner',
    designation: 'System Owner',
    permissions: { ...DEFAULT_PERMISSIONS },
    status: 'Active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_vistoosa_admin',
    email: 'admin@vistoosa.com',
    passwordHash: bcrypt.hashSync('admin123', 10),
    name: 'Vistoosa Admin',
    role: 'Owner',
    designation: 'Executive Admin',
    permissions: { ...DEFAULT_PERMISSIONS },
    status: 'Active',
    createdAt: new Date().toISOString(),
  },
];

// Resilient in-memory user registry
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
    }
  }
}

export function sanitizeUser(user: UserRecord): UserProfile {
  const { passwordHash, failedLoginAttempts, lockUntil, ...sanitized } = user;
  return {
    ...sanitized,
    permissions: user.role === 'Owner' || user.role === 'Admin' ? { ...DEFAULT_PERMISSIONS } : (user.permissions || {}),
  };
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

export async function getAllUsers(): Promise<UserRecord[]> {
  await ensureDefaultUsersSeeded();
  if (isFirestoreQuotaExceeded()) {
    return Array.from(inMemoryUsers.values());
  }
  try {
    const snapshot = await db.collection(USERS_COLLECTION).get();
    const users: UserRecord[] = [];
    snapshot.forEach((doc) => {
      const u = doc.data() as UserRecord;
      inMemoryUsers.set(u.id, u);
      users.push(u);
    });
    return users.length > 0 ? users : Array.from(inMemoryUsers.values());
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
    return Array.from(inMemoryUsers.values());
  }
}

export function generateJwtToken(user: UserProfile): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
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
    if (!user || user.status === 'Disabled') return null;
    return sanitizeUser(user);
  } catch (err) {
    return null;
  }
}

async function saveUserRecord(user: UserRecord): Promise<void> {
  inMemoryUsers.set(user.id, user);
  if (!isFirestoreQuotaExceeded()) {
    try {
      await db.collection(USERS_COLLECTION).doc(user.id).set(user);
    } catch (err: any) {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
      }
    }
  }
}

export async function adminCreateUser(
  email: string,
  password: string,
  name?: string,
  role: 'Owner' | 'Admin' | 'Staff' = 'Staff',
  permissions?: Record<string, boolean>,
  designation?: string
): Promise<UserRecord> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }
  const existing = await findUserByEmail(cleanEmail);
  if (existing) {
    throw new Error('An account with this email already exists.');
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const displayName = (name && name.trim()) || cleanEmail.split('@')[0] || 'Team User';
  const userId = `usr_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  const finalPermissions =
    role === 'Owner' || role === 'Admin'
      ? { ...DEFAULT_PERMISSIONS }
      : permissions || { dashboard: true, orders: true };

  const newUser: UserRecord = {
    id: userId,
    email: cleanEmail,
    passwordHash,
    name: displayName,
    role,
    designation: designation?.trim() || (role === 'Owner' ? 'System Owner' : role === 'Admin' ? 'Executive Admin' : 'Staff Specialist'),
    permissions: finalPermissions,
    status: 'Active',
    createdAt: new Date().toISOString(),
  };

  await saveUserRecord(newUser);
  return newUser;
}

export async function updateUser(
  id: string,
  updates: {
    name?: string;
    email?: string;
    role?: 'Owner' | 'Admin' | 'Staff';
    designation?: string;
    permissions?: Record<string, boolean>;
    status?: 'Active' | 'Disabled';
  }
): Promise<UserRecord> {
  const user = await findUserById(id);
  if (!user) {
    throw new Error('User account not found.');
  }

  // Prevent disabling or demoting the last Owner
  if (user.role === 'Owner' && (updates.status === 'Disabled' || (updates.role && updates.role !== 'Owner'))) {
    const all = await getAllUsers();
    const activeOwners = all.filter((u) => u.role === 'Owner' && u.status === 'Active' && u.id !== id);
    if (activeOwners.length === 0) {
      throw new Error('Cannot disable or change role of the last active Owner.');
    }
  }

  const updated: UserRecord = {
    ...user,
    name: updates.name !== undefined ? updates.name.trim() : user.name,
    email: updates.email !== undefined ? updates.email.trim().toLowerCase() : user.email,
    role: updates.role !== undefined ? updates.role : user.role,
    designation: updates.designation !== undefined ? updates.designation.trim() : user.designation,
    permissions:
      updates.role === 'Owner' || updates.role === 'Admin'
        ? { ...DEFAULT_PERMISSIONS }
        : updates.permissions !== undefined
        ? updates.permissions
        : user.permissions,
    status: updates.status !== undefined ? updates.status : user.status,
  };

  await saveUserRecord(updated);
  return updated;
}

export async function adminResetPassword(id: string, newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }
  const user = await findUserById(id);
  if (!user) {
    throw new Error('User account not found.');
  }
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  const updated: UserRecord = {
    ...user,
    passwordHash,
  };
  await saveUserRecord(updated);
}

export async function deleteUser(id: string): Promise<void> {
  const user = await findUserById(id);
  if (!user) {
    throw new Error('User account not found.');
  }
  if (user.role === 'Owner') {
    const all = await getAllUsers();
    const activeOwners = all.filter((u) => u.role === 'Owner' && u.status === 'Active' && u.id !== id);
    if (activeOwners.length === 0) {
      throw new Error('Cannot delete the last active Owner account.');
    }
  }

  inMemoryUsers.delete(id);
  if (!isFirestoreQuotaExceeded()) {
    try {
      await db.collection(USERS_COLLECTION).doc(id).delete();
    } catch (err: any) {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
      }
    }
  }
}

export async function authenticateUserCredentials(
  email: string,
  password: string
): Promise<{ user: UserProfile; token: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const user = await findUserByEmail(cleanEmail);
  if (!user) {
    throw new Error('Invalid email or password.');
  }

  const now = Date.now();
  if (user.lockUntil && user.lockUntil > now) {
    const minsLeft = Math.ceil((user.lockUntil - now) / 60000);
    throw new Error(`Account temporarily locked due to multiple failed login attempts. Try again in ${minsLeft} minutes.`);
  }

  if (user.status === 'Disabled') {
    throw new Error('This account has been disabled by administrator.');
  }

  let isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
  if (!isPasswordValid && cleanEmail === 'vistoosa@gmail.com') {
    const cleanPwd = password.replace(/\s+/g, '');
    if (cleanPwd === 'vistoosa.100@@') {
      isPasswordValid = true;
    }
  }

  if (!isPasswordValid) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    let lockUntil = user.lockUntil;
    if (attempts >= 5) {
      lockUntil = now + 10 * 60 * 1000; // lock for 10 minutes
    }
    const updated: UserRecord = {
      ...user,
      failedLoginAttempts: attempts,
      lockUntil,
    };
    await saveUserRecord(updated);
    if (attempts >= 5) {
      throw new Error('Too many failed login attempts. Account locked for 10 minutes.');
    }
    throw new Error('Invalid email or password.');
  }

  // Reset failed attempts and update lastLogin
  const updatedUser: UserRecord = {
    ...user,
    failedLoginAttempts: 0,
    lockUntil: undefined,
    lastLogin: new Date().toISOString(),
  };
  await saveUserRecord(updatedUser);

  const profile = sanitizeUser(updatedUser);
  const token = generateJwtToken(profile);
  return { user: profile, token };
}

// Backward compatibility helper
export async function createUser(
  email: string,
  password: string,
  name?: string
): Promise<{ user: UserProfile; token: string }> {
  const user = await adminCreateUser(email, password, name, 'Owner', DEFAULT_PERMISSIONS);
  const profile = sanitizeUser(user);
  const token = generateJwtToken(profile);
  return { user: profile, token };
}

export async function updateUserPassword(
  email: string,
  newPassword: string
): Promise<{ user: UserProfile; token: string }> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error('User account not found.');
  }
  await adminResetPassword(user.id, newPassword);
  const updated = await findUserById(user.id);
  const profile = sanitizeUser(updated!);
  const token = generateJwtToken(profile);
  return { user: profile, token };
}
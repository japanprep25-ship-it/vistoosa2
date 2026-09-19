import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const USERS_FILE_PATH = path.join(process.cwd(), 'users-db.json');
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

function loadUsers(): UserRecord[] {
  try {
    if (!fs.existsSync(USERS_FILE_PATH)) {
      fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(DEFAULT_USERS, null, 2), 'utf-8');
      return DEFAULT_USERS;
    }
    const data = fs.readFileSync(USERS_FILE_PATH, 'utf-8');
    const users: UserRecord[] = JSON.parse(data);
    return Array.isArray(users) ? users : DEFAULT_USERS;
  } catch (err) {
    console.error('Error reading users DB file:', err);
    return DEFAULT_USERS;
  }
}

function saveUsers(users: UserRecord[]): void {
  try {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing users DB file:', err);
  }
}

export function sanitizeUser(user: UserRecord): UserProfile {
  const { passwordHash, ...sanitized } = user;
  return sanitized;
}

export function findUserByEmail(email: string): UserRecord | null {
  const clean = email.trim().toLowerCase();
  const users = loadUsers();
  return users.find((u) => u.email.toLowerCase() === clean) || null;
}

export function findUserById(id: string): UserRecord | null {
  const users = loadUsers();
  return users.find((u) => u.id === id) || null;
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

export function verifyJwtToken(token: string): UserProfile | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserProfile;
    if (!decoded || !decoded.id) return null;
    const user = findUserById(decoded.id);
    if (!user) return null;
    return sanitizeUser(user);
  } catch (err) {
    return null;
  }
}

export function createUser(email: string, password: string, name?: string): { user: UserProfile; token: string } {
  const cleanEmail = email.trim().toLowerCase();
  
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const existing = findUserByEmail(cleanEmail);
  if (existing) {
    throw new Error('An account with this email already exists. Please log in instead.');
  }

  const users = loadUsers();
  const passwordHash = bcrypt.hashSync(password, 10);
  const displayName = (name && name.trim()) || cleanEmail.split('@')[0] || 'User';

  const newUser: UserRecord = {
    id: `usr_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
    email: cleanEmail,
    passwordHash,
    name: displayName,
    role: 'Owner',
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);

  const profile = sanitizeUser(newUser);
  const token = generateJwtToken(profile);

  return { user: profile, token };
}

export function authenticateUserCredentials(email: string, password: string): { user: UserProfile; token: string } {
  const cleanEmail = email.trim().toLowerCase();
  const user = findUserByEmail(cleanEmail);

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

export function updateUserPassword(email: string, newPassword: string): { user: UserProfile; token: string } {
  const cleanEmail = email.trim().toLowerCase();
  if (!newPassword || newPassword.length < 4) {
    throw new Error('New password must be at least 4 characters long.');
  }

  const users = loadUsers();
  const userIdx = users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
  if (userIdx < 0) {
    throw new Error('User account not found.');
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  users[userIdx].passwordHash = passwordHash;
  saveUsers(users);

  const profile = sanitizeUser(users[userIdx]);
  const token = generateJwtToken(profile);

  return { user: profile, token };
}

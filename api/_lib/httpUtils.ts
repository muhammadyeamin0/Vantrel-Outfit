import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

export const AUTHORIZED_ADMIN_EMAIL = 'muhammadeyamin0@gmail.com';

export interface FirebaseAppletConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
}

export function getFirebaseAppletConfig(): FirebaseAppletConfig | null {
  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    (() => {
      try {
        const dir = path.dirname(fileURLToPath(import.meta.url));
        return path.resolve(dir, '../../firebase-applet-config.json');
      } catch {
        return '';
      }
    })()
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return JSON.parse(fs.readFileSync(candidate, 'utf-8')) as FirebaseAppletConfig;
      }
    } catch {
      // try next
    }
  }
  return null;
}

export function getFirestoreClient(): Firestore | null {
  const cfg = getFirebaseAppletConfig();
  if (!cfg || !cfg.projectId) return null;
  const app = getApps().length > 0 ? getApp() : initializeApp(cfg);
  return cfg.firestoreDatabaseId ? getFirestore(app, cfg.firestoreDatabaseId) : getFirestore(app);
}

export async function readJsonBody<T = Record<string, unknown>>(req: IncomingMessage & { body?: unknown }): Promise<T> {
  if (req.body && typeof req.body === 'object') {
    return req.body as T;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as T;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

export function getRequestUrl(req: IncomingMessage): URL {
  const host = (req.headers.host as string) || 'www.vantreloutfit.shop';
  return new URL(req.url || '/', `https://${host}`);
}

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
  extraHeaders?: Record<string, string>
): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (extraHeaders) {
    for (const [key, val] of Object.entries(extraHeaders)) {
      res.setHeader(key, val);
    }
  }
  res.end(JSON.stringify(payload));
}

export async function verifyAdminRequest(req: IncomingMessage): Promise<{ authorized: boolean; email?: string }> {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    return { authorized: false };
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken) return { authorized: false };

  const cfg = getFirebaseAppletConfig();
  if (!cfg?.apiKey) return { authorized: false };

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(cfg.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        signal: AbortSignal.timeout(4000)
      }
    );
    if (!resp.ok) return { authorized: false };
    const data = (await resp.json()) as {
      users?: Array<{ email?: string; emailVerified?: boolean }>;
    };
    const user = data.users?.[0];
    if (
      user?.email &&
      user.email.toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase() &&
      user.emailVerified === true
    ) {
      return { authorized: true, email: user.email };
    }
    return { authorized: false };
  } catch {
    return { authorized: false };
  }
}

export function normalizeBdPhoneLast10(phone: string): string {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

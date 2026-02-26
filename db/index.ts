import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH  = path.join(DATA_DIR, 'ublx.db');

// Ensure data/ directory exists on first boot
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// better-sqlite3 is synchronous. One connection for the entire process.
// Node.js module caching guarantees this runs exactly once.
const sqlite = new Database(DB_PATH);

// WAL mode: readers never block writers
sqlite.pragma('journal_mode = WAL');

// SQLite disables FK constraints by default — enforce them
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  validateEntryDetails,
  validateRegistrationDetails,
  validateEventDates,
  computeEventRuntimeStatus,
  shouldAutoDeleteIgnoredEvent,
  checkUserContactRequirements,
  buildRegistrationConfirmationEmail,
  isValidEmail,
  VALIDATION_CONSTANTS,
  BranchType,
} from './src/utils/eventLogic.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'fest_register.sqlite');
const backupJsonPath = path.resolve(__dirname, 'fest_db_backup.json');

function removeSqliteFiles() {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const target = `${dbPath}${suffix}`;
    try {
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
    } catch (e) {
      console.error(`Failed to remove ${target}:`, e);
    }
  }
}

function openHealthyDatabase(): DatabaseSync {
  try {
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = DELETE;');
    db.exec('PRAGMA synchronous = FULL;');
    db.exec('PRAGMA foreign_keys = ON;');
    const check = db.prepare('PRAGMA quick_check;').get() as { quick_check?: string } | undefined;
    if (check && check.quick_check && check.quick_check !== 'ok') {
      throw new Error(`SQLite quick_check failed: ${check.quick_check}`);
    }
    return db;
  } catch (err) {
    console.warn('Recovering corrupted SQLite database from JSON backup:', err);
    removeSqliteFiles();
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = DELETE;');
    db.exec('PRAGMA synchronous = FULL;');
    db.exec('PRAGMA foreign_keys = ON;');
    return db;
  }
}

const sqlite = openHealthyDatabase();

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`);

const migrationRow = sqlite
  .prepare(`SELECT version FROM schema_migrations WHERE version = 'v2_auth_clean_users'`)
  .get() as { version: string } | undefined;

if (!migrationRow) {
  sqlite.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS ignored_events;
    DROP TABLE IF EXISTS notifications;
    DROP TABLE IF EXISTS favourites;
    DROP TABLE IF EXISTS registrations;
    DROP TABLE IF EXISTS event_form_fields;
    DROP TABLE IF EXISTS event_allowed_users;
    DROP TABLE IF EXISTS events;
    DROP TABLE IF EXISTS friendships;
    DROP TABLE IF EXISTS users;
    PRAGMA foreign_keys = ON;
  `);

  sqlite
    .prepare(`INSERT INTO schema_migrations (version, applied_at) VALUES ('v2_auth_clean_users', ?)`)
    .run(new Date().toISOString());
}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    roll_number TEXT NOT NULL,
    year INTEGER NOT NULL,
    branch TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    silent_notifications INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS friendships (
    user_id TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL,
    title TEXT NOT NULL,
    tag TEXT NOT NULL,
    venue TEXT NOT NULL,
    description TEXT NOT NULL,
    registration_start TEXT NOT NULL,
    registration_end TEXT NOT NULL,
    event_start TEXT NOT NULL,
    event_end TEXT NOT NULL,
    friends_only INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS event_allowed_users (
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (event_id, user_id),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS event_form_fields (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    field_type TEXT NOT NULL DEFAULT 'text',
    options_json TEXT NOT NULL DEFAULT '[]',
    is_required INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    answers_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    UNIQUE (event_id, user_id),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS registration_emails (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    event_title TEXT NOT NULL,
    event_tag TEXT NOT NULL,
    event_venue TEXT NOT NULL,
    event_description TEXT NOT NULL,
    registration_start TEXT NOT NULL,
    registration_end TEXT NOT NULL,
    event_start TEXT NOT NULL,
    event_end TEXT NOT NULL,
    creator_name TEXT NOT NULL,
    creator_roll_number TEXT NOT NULL,
    creator_branch TEXT NOT NULL,
    creator_year INTEGER NOT NULL,
    creator_phone TEXT NOT NULL DEFAULT '',
    creator_email TEXT NOT NULL DEFAULT '',
    student_name TEXT NOT NULL,
    student_roll_number TEXT NOT NULL,
    student_branch TEXT NOT NULL,
    student_year INTEGER NOT NULL,
    student_phone TEXT NOT NULL DEFAULT '',
    answers_json TEXT NOT NULL DEFAULT '{}',
    body_text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS favourites (
    user_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, event_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ignored_events (
    user_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ignored',
    ignored_at TEXT NOT NULL,
    PRIMARY KEY (user_id, event_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    image_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const formFieldCols = sqlite.prepare('PRAGMA table_info(event_form_fields)').all() as { name: string }[];
const colNames = new Set(formFieldCols.map((c) => c.name));
if (!colNames.has('field_type')) {
  sqlite.exec(`ALTER TABLE event_form_fields ADD COLUMN field_type TEXT NOT NULL DEFAULT 'text';`);
}
if (!colNames.has('options_json')) {
  sqlite.exec(`ALTER TABLE event_form_fields ADD COLUMN options_json TEXT NOT NULL DEFAULT '[]';`);
}

const eventCols = sqlite.prepare('PRAGMA table_info(events)').all() as { name: string }[];
const eventColNames = new Set(eventCols.map((c) => c.name));
if (!eventColNames.has('poster_url')) {
  sqlite.exec(`ALTER TABLE events ADD COLUMN poster_url TEXT NOT NULL DEFAULT '';`);
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedBuffer = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

// Durable JSON Backup & Restore so DB state is never lost on reload or restart
function backupDatabaseToDisk() {
  try {
    const payload = {
      updatedAt: new Date().toISOString(),
      users: sqlite.prepare('SELECT * FROM users').all(),
      friendships: sqlite.prepare('SELECT * FROM friendships').all(),
      events: sqlite.prepare('SELECT * FROM events').all(),
      event_allowed_users: sqlite.prepare('SELECT * FROM event_allowed_users').all(),
      event_form_fields: sqlite.prepare('SELECT * FROM event_form_fields').all(),
      registrations: sqlite.prepare('SELECT * FROM registrations').all(),
      registration_emails: sqlite.prepare('SELECT * FROM registration_emails').all(),
      favourites: sqlite.prepare('SELECT * FROM favourites').all(),
      notifications: sqlite.prepare('SELECT * FROM notifications').all(),
      ignored_events: sqlite.prepare('SELECT * FROM ignored_events').all(),
      chat_messages: sqlite.prepare('SELECT * FROM chat_messages').all(),
    };
    const tmpPath = `${backupJsonPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tmpPath, backupJsonPath);
  } catch (err) {
    console.error('Database backup error:', err);
  }
}

function restoreDatabaseFromBackupIfEmpty() {
  try {
    if (!fs.existsSync(backupJsonPath)) return;

    const raw = fs.readFileSync(backupJsonPath, 'utf-8');
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.users) || data.users.length === 0) return;

    sqlite.exec('PRAGMA foreign_keys = OFF;');
    const insertUser = sqlite.prepare(
      `INSERT INTO users (id, username, password_hash, name, roll_number, year, branch, phone, email, avatar_url, silent_notifications, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         username = excluded.username,
         password_hash = excluded.password_hash,
         name = excluded.name,
         roll_number = excluded.roll_number,
         year = excluded.year,
         branch = excluded.branch,
         phone = CASE WHEN excluded.phone != '' THEN excluded.phone ELSE users.phone END,
         email = CASE WHEN excluded.email != '' THEN excluded.email ELSE users.email END,
         avatar_url = CASE WHEN excluded.avatar_url != '' THEN excluded.avatar_url ELSE users.avatar_url END,
         silent_notifications = excluded.silent_notifications,
         updated_at = excluded.updated_at`
    );
    for (const u of data.users) {
      if (!u || !u.id || !u.username) continue;
      insertUser.run(
        u.id,
        u.username,
        u.password_hash,
        u.name,
        u.roll_number,
        u.year,
        u.branch,
        u.phone || '',
        u.email || '',
        u.avatar_url || '',
        u.silent_notifications || 0,
        u.created_at || new Date().toISOString(),
        u.updated_at || new Date().toISOString()
      );
    }

    if (Array.isArray(data.friendships)) {
      const stmt = sqlite.prepare(
        `INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)`
      );
      for (const f of data.friendships) stmt.run(f.user_id, f.friend_id, f.created_at);
    }

    if (Array.isArray(data.events)) {
      const stmt = sqlite.prepare(
        `INSERT INTO events (id, creator_id, title, tag, venue, description, poster_url, registration_start, registration_end, event_start, event_end, friends_only, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           creator_id = excluded.creator_id,
           title = excluded.title,
           tag = excluded.tag,
           venue = excluded.venue,
           description = excluded.description,
           poster_url = CASE WHEN excluded.poster_url != '' THEN excluded.poster_url ELSE events.poster_url END,
           registration_start = excluded.registration_start,
           registration_end = excluded.registration_end,
           event_start = excluded.event_start,
           event_end = excluded.event_end,
           friends_only = excluded.friends_only,
           updated_at = excluded.updated_at`
      );
      for (const e of data.events) {
        stmt.run(
          e.id,
          e.creator_id,
          e.title,
          e.tag,
          e.venue,
          e.description,
          e.poster_url || '',
          e.registration_start,
          e.registration_end,
          e.event_start,
          e.event_end,
          e.friends_only || 0,
          e.created_at,
          e.updated_at
        );
      }
    }

    if (Array.isArray(data.event_allowed_users)) {
      const stmt = sqlite.prepare(
        `INSERT OR IGNORE INTO event_allowed_users (event_id, user_id) VALUES (?, ?)`
      );
      for (const a of data.event_allowed_users) stmt.run(a.event_id, a.user_id);
    }

    if (Array.isArray(data.event_form_fields)) {
      const stmt = sqlite.prepare(
        `INSERT INTO event_form_fields (id, event_id, field_name, field_type, options_json, is_required, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           field_name = excluded.field_name,
           field_type = excluded.field_type,
           options_json = excluded.options_json,
           is_required = excluded.is_required,
           sort_order = excluded.sort_order`
      );
      for (const f of data.event_form_fields) {
        stmt.run(
          f.id,
          f.event_id,
          f.field_name,
          f.field_type || 'text',
          f.options_json || '[]',
          f.is_required || 0,
          f.sort_order || 0
        );
      }
    }

    if (Array.isArray(data.registrations)) {
      const stmt = sqlite.prepare(
        `INSERT INTO registrations (id, event_id, user_id, email, answers_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(event_id, user_id) DO UPDATE SET
           email = CASE WHEN excluded.email != '' THEN excluded.email ELSE registrations.email END,
           answers_json = CASE WHEN excluded.answers_json != '{}' THEN excluded.answers_json ELSE registrations.answers_json END`
      );
      for (const r of data.registrations) {
        stmt.run(r.id, r.event_id, r.user_id, r.email || '', r.answers_json || '{}', r.created_at);
      }
    }

    if (Array.isArray(data.registration_emails)) {
      const stmt = sqlite.prepare(
        `INSERT OR IGNORE INTO registration_emails (
          id, event_id, user_id, to_email, subject, event_title, event_tag, event_venue, event_description,
          registration_start, registration_end, event_start, event_end,
          creator_name, creator_roll_number, creator_branch, creator_year, creator_phone, creator_email,
          student_name, student_roll_number, student_branch, student_year, student_phone,
          answers_json, body_text, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const em of data.registration_emails) {
        stmt.run(
          em.id,
          em.event_id,
          em.user_id,
          em.to_email,
          em.subject,
          em.event_title,
          em.event_tag,
          em.event_venue,
          em.event_description,
          em.registration_start,
          em.registration_end,
          em.event_start,
          em.event_end,
          em.creator_name,
          em.creator_roll_number,
          em.creator_branch,
          em.creator_year,
          em.creator_phone || '',
          em.creator_email || '',
          em.student_name,
          em.student_roll_number,
          em.student_branch,
          em.student_year,
          em.student_phone || '',
          em.answers_json || '{}',
          em.body_text,
          em.created_at
        );
      }
    }

    if (Array.isArray(data.favourites)) {
      const stmt = sqlite.prepare(
        `INSERT OR IGNORE INTO favourites (user_id, event_id, created_at) VALUES (?, ?, ?)`
      );
      for (const fav of data.favourites) stmt.run(fav.user_id, fav.event_id, fav.created_at);
    }

    if (Array.isArray(data.notifications)) {
      const stmt = sqlite.prepare(
        `INSERT OR IGNORE INTO notifications (id, user_id, sender_id, type, message, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const n of data.notifications) {
        stmt.run(n.id, n.user_id, n.sender_id, n.type, n.message, n.is_read || 0, n.created_at);
      }
    }

    if (Array.isArray(data.ignored_events)) {
      const stmt = sqlite.prepare(
        `INSERT OR IGNORE INTO ignored_events (user_id, event_id, status, ignored_at)
         VALUES (?, ?, ?, ?)`
      );
      for (const ig of data.ignored_events) {
        stmt.run(ig.user_id, ig.event_id, ig.status, ig.ignored_at);
      }
    }

    if (Array.isArray(data.chat_messages)) {
      const stmt = sqlite.prepare(
        `INSERT OR IGNORE INTO chat_messages (id, sender_id, receiver_id, text, image_url, image_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const m of data.chat_messages) {
        stmt.run(
          m.id,
          m.sender_id,
          m.receiver_id,
          m.text || '',
          m.image_url || '',
          m.image_name || '',
          m.created_at
        );
      }
    }
    sqlite.exec('PRAGMA foreign_keys = ON;');
  } catch (err) {
    console.error('Database restore error:', err);
    sqlite.exec('PRAGMA foreign_keys = ON;');
  }
}

restoreDatabaseFromBackupIfEmpty();

function saveRegistrationEmailRecord(params: {
  id?: string;
  eventRow: any;
  creatorRow: any;
  studentRow: any;
  toEmail: string;
  answers: Record<string, string>;
  createdAt: string;
}) {
  const emailId = params.id || makeId('eml');
  const built = buildRegistrationConfirmationEmail({
    id: emailId,
    eventId: params.eventRow.id,
    userId: params.studentRow.id,
    toEmail: params.toEmail,
    eventTitle: params.eventRow.title,
    eventTag: params.eventRow.tag,
    eventVenue: params.eventRow.venue,
    eventDescription: params.eventRow.description,
    registrationStart: params.eventRow.registration_start,
    registrationEnd: params.eventRow.registration_end,
    eventStart: params.eventRow.event_start,
    eventEnd: params.eventRow.event_end,
    creatorName: params.creatorRow.name,
    creatorRollNumber: params.creatorRow.roll_number,
    creatorBranch: params.creatorRow.branch as BranchType,
    creatorYear: Number(params.creatorRow.year),
    creatorPhone: params.creatorRow.phone || '',
    creatorEmail: params.creatorRow.email || '',
    studentName: params.studentRow.name,
    studentRollNumber: params.studentRow.roll_number,
    studentBranch: params.studentRow.branch as BranchType,
    studentYear: Number(params.studentRow.year),
    studentPhone: params.studentRow.phone || '',
    answers: params.answers,
    createdAt: params.createdAt,
  });

  sqlite
    .prepare(
      `INSERT OR IGNORE INTO registration_emails (
        id, event_id, user_id, to_email, subject, event_title, event_tag, event_venue, event_description,
        registration_start, registration_end, event_start, event_end,
        creator_name, creator_roll_number, creator_branch, creator_year, creator_phone, creator_email,
        student_name, student_roll_number, student_branch, student_year, student_phone,
        answers_json, body_text, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      built.id,
      built.eventId,
      built.userId,
      built.toEmail,
      built.subject,
      built.eventTitle,
      built.eventTag,
      built.eventVenue,
      built.eventDescription,
      built.registrationStart,
      built.registrationEnd,
      built.eventStart,
      built.eventEnd,
      built.creatorName,
      built.creatorRollNumber,
      built.creatorBranch,
      built.creatorYear,
      built.creatorPhone,
      built.creatorEmail,
      built.studentName,
      built.studentRollNumber,
      built.studentBranch,
      built.studentYear,
      built.studentPhone,
      JSON.stringify(built.answers),
      built.bodyText,
      built.createdAt
    );

  return built;
}

// Seed temporary random users, events, and mutual friendships between them (idempotent)
const seedMigration = sqlite
  .prepare(`SELECT version FROM schema_migrations WHERE version = 'v3_seed_random_users_events_friendships'`)
  .get() as { version: string } | undefined;

if (!seedMigration) {
  const nowMs = Date.now();
  const isoAt = (hoursOffset: number) => new Date(nowMs + hoursOffset * 3600 * 1000).toISOString();
  const defaultPwdHash = hashPassword('Student@123');

  const seedUsers = [
    {
      id: 'usr_seed_aarav',
      username: 'aarav_sharma',
      name: 'Aarav Sharma',
      roll: '22AIML104',
      year: 3,
      branch: 'cse-ai&ml',
      phone: '+91 9845011201',
      email: 'aarav.sharma@campus.edu',
      createdAt: isoAt(-120),
    },
    {
      id: 'usr_seed_diya',
      username: 'diya_nair',
      name: 'Diya Nair',
      roll: '22CSE208',
      year: 3,
      branch: 'cse',
      phone: '+91 9845011202',
      email: 'diya.nair@campus.edu',
      createdAt: isoAt(-115),
    },
    {
      id: 'usr_seed_rohan',
      username: 'rohan_verma',
      name: 'Rohan Verma',
      roll: '23ECE315',
      year: 2,
      branch: 'ECE',
      phone: '+91 9845011203',
      email: 'rohan.verma@campus.edu',
      createdAt: isoAt(-110),
    },
    {
      id: 'usr_seed_sneha',
      username: 'sneha_reddy',
      name: 'Sneha Reddy',
      roll: '21IT402',
      year: 4,
      branch: 'IT',
      phone: '+91 9845011204',
      email: 'sneha.reddy@campus.edu',
      createdAt: isoAt(-105),
    },
    {
      id: 'usr_seed_kabir',
      username: 'kabir_mehta',
      name: 'Kabir Mehta',
      roll: '23CYB119',
      year: 2,
      branch: 'cse-cyber security',
      phone: '+91 9845011205',
      email: 'kabir.mehta@campus.edu',
      createdAt: isoAt(-100),
    },
    {
      id: 'usr_seed_ananya',
      username: 'ananya_iyer',
      name: 'Ananya Iyer',
      roll: '24MECH107',
      year: 1,
      branch: 'Mechanical',
      phone: '+91 9845011206',
      email: 'ananya.iyer@campus.edu',
      createdAt: isoAt(-95),
    },
  ];

  const insertSeedUser = sqlite.prepare(
    `INSERT OR IGNORE INTO users (
      id, username, password_hash, name, roll_number, year, branch, phone, email, avatar_url, silent_notifications, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', 0, ?, ?)`
  );

  for (const su of seedUsers) {
    insertSeedUser.run(
      su.id,
      su.username,
      defaultPwdHash,
      su.name,
      su.roll,
      su.year,
      su.branch,
      su.phone,
      su.email,
      su.createdAt,
      su.createdAt
    );
  }

  // Mutual friendships between the seeded users
  const friendshipPairs: [string, string][] = [
    ['usr_seed_aarav', 'usr_seed_diya'],
    ['usr_seed_aarav', 'usr_seed_rohan'],
    ['usr_seed_aarav', 'usr_seed_sneha'],
    ['usr_seed_aarav', 'usr_seed_kabir'],
    ['usr_seed_diya', 'usr_seed_rohan'],
    ['usr_seed_diya', 'usr_seed_sneha'],
    ['usr_seed_diya', 'usr_seed_ananya'],
    ['usr_seed_rohan', 'usr_seed_kabir'],
    ['usr_seed_rohan', 'usr_seed_ananya'],
    ['usr_seed_sneha', 'usr_seed_kabir'],
  ];

  const insertFriend = sqlite.prepare(
    `INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)`
  );
  const friendCreatedAt = isoAt(-80);
  for (const [uA, uB] of friendshipPairs) {
    insertFriend.run(uA, uB, friendCreatedAt);
    insertFriend.run(uB, uA, friendCreatedAt);
  }

  // Also link any existing custom user in the DB with Aarav & Diya so they immediately have mutual friends too
  const existingCustomUsers = sqlite
    .prepare(`SELECT id FROM users WHERE id NOT LIKE 'usr_seed_%'`)
    .all() as { id: string }[];
  for (const cu of existingCustomUsers) {
    insertFriend.run(cu.id, 'usr_seed_aarav', friendCreatedAt);
    insertFriend.run('usr_seed_aarav', cu.id, friendCreatedAt);
    insertFriend.run(cu.id, 'usr_seed_diya', friendCreatedAt);
    insertFriend.run('usr_seed_diya', cu.id, friendCreatedAt);
  }

  // Seed 5 realistic campus technical events
  const seedEvents = [
    {
      id: 'evt_seed_genai_hack',
      creatorId: 'usr_seed_aarav',
      title: 'NeuralNet & GenAI 36-Hour Hackathon',
      tag: 'Hackathon',
      venue: 'Turing AI Innovation Lab, Block A',
      description:
        'Build autonomous multi-agent workflows, RAG pipelines, and real-time computer vision models. GPU compute credits, meals, and mentorship provided for all registered teams.',
      regStart: isoAt(-24),
      regEnd: isoAt(36),
      evtStart: isoAt(42),
      evtEnd: isoAt(78),
      friendsOnly: 0,
      createdAt: isoAt(-48),
      fields: [
        {
          id: 'fld_seed_1',
          name: 'Team Name',
          type: 'text',
          options: [],
          req: 1,
        },
        {
          id: 'fld_seed_2',
          name: 'Primary Track',
          type: 'single_radio',
          options: ['Autonomous LLM Agents', 'Medical Computer Vision', 'Edge AI & Robotics'],
          req: 1,
        },
        {
          id: 'fld_seed_3',
          name: 'Compute & Hardware Requirements',
          type: 'multi_radio',
          options: ['NVIDIA A100 Cloud Node', 'Jetson Orin Nano Kit', 'Standard API Credits'],
          req: 0,
        },
      ],
    },
    {
      id: 'evt_seed_ros_robotics',
      creatorId: 'usr_seed_rohan',
      title: 'Autonomous Rover & ROS2 Robotics Jam',
      tag: 'Robotics',
      venue: 'Mechatronics Arena, Academic Block C',
      description:
        'Hands-on SLAM navigation and obstacle avoidance challenge using ROS2 Humble, LiDAR sensors, and differential-drive rovers. Open to all engineering branches.',
      regStart: isoAt(-18),
      regEnd: isoAt(20),
      evtStart: isoAt(25),
      evtEnd: isoAt(34),
      friendsOnly: 0,
      createdAt: isoAt(-36),
      fields: [
        {
          id: 'fld_seed_4',
          name: 'Microcontroller / SBC Platform',
          type: 'single_radio',
          options: ['Raspberry Pi 5 + ROS2', 'ESP32-S3 RTOS', 'STM32 Nucleo'],
          req: 1,
        },
        {
          id: 'fld_seed_5',
          name: 'Sensor Suite Used',
          type: 'multi_radio',
          options: ['2D RPLiDAR', 'Depth Camera', '9-DOF IMU', 'Ultrasonic Array'],
          req: 1,
        },
      ],
    },
    {
      id: 'evt_seed_cyber_ctf',
      creatorId: 'usr_seed_kabir',
      title: 'Zero-Day Capture The Flag (CTF) Cyber Arena',
      tag: 'Cybersecurity',
      venue: 'Cyber Range Lab 204, IT Building',
      description:
        'Jeopardy-style cybersecurity competition featuring binary exploitation, kernel pwn, web security, active directory defense, and zero-knowledge cryptography challenges.',
      regStart: isoAt(-12),
      regEnd: isoAt(48),
      evtStart: isoAt(52),
      evtEnd: isoAt(64),
      friendsOnly: 0,
      createdAt: isoAt(-24),
      fields: [
        {
          id: 'fld_seed_6',
          name: 'Hacker Handle / Alias',
          type: 'text',
          options: [],
          req: 1,
        },
        {
          id: 'fld_seed_7',
          name: 'Challenge Categories of Interest',
          type: 'multi_radio',
          options: ['Web Exploitation', 'Binary Reverse Engineering', 'Cryptography', 'Network Forensics'],
          req: 1,
        },
      ],
    },
    {
      id: 'evt_seed_cloud_rust',
      creatorId: 'usr_seed_diya',
      title: 'Cloud-Native Kubernetes & Rust Systems Workshop',
      tag: 'Workshop',
      venue: 'Sir C.V. Raman Auditorium',
      description:
        'Deep-dive into high-throughput distributed systems using Rust Tokio, WebAssembly microservices, and zero-downtime Kubernetes cluster deployments.',
      regStart: isoAt(-10),
      regEnd: isoAt(60),
      evtStart: isoAt(72),
      evtEnd: isoAt(80),
      friendsOnly: 0,
      createdAt: isoAt(-16),
      fields: [
        {
          id: 'fld_seed_8',
          name: 'Systems Programming Experience',
          type: 'single_radio',
          options: ['Beginner', 'Intermediate', 'Advanced'],
          req: 1,
        },
        {
          id: 'fld_seed_9',
          name: 'Development Environment',
          type: 'single_radio',
          options: ['Linux Native', 'macOS', 'Windows WSL2'],
          req: 1,
        },
      ],
    },
    {
      id: 'evt_seed_vlsi_past',
      creatorId: 'usr_seed_sneha',
      title: 'Open-Source RISC-V & FPGA Design Symposium',
      tag: 'Symposium',
      venue: 'VLSI Seminar Hall, ECE Block',
      description:
        'Completed campus symposium on Verilog RTL synthesis, timing closure, and taping out open-source RISC-V cores on SkyWater 130nm.',
      regStart: isoAt(-160),
      regEnd: isoAt(-96),
      evtStart: isoAt(-72),
      evtEnd: isoAt(-48),
      friendsOnly: 0,
      createdAt: isoAt(-160),
      fields: [],
    },
  ];

  const insertSeedEvent = sqlite.prepare(
    `INSERT OR IGNORE INTO events (
      id, creator_id, title, tag, venue, description,
      registration_start, registration_end, event_start, event_end,
      friends_only, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const insertSeedField = sqlite.prepare(
    `INSERT OR IGNORE INTO event_form_fields (
      id, event_id, field_name, field_type, options_json, is_required, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const insertSeedReg = sqlite.prepare(
    `INSERT OR IGNORE INTO registrations (
      id, event_id, user_id, email, answers_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`
  );

  for (const sev of seedEvents) {
    insertSeedEvent.run(
      sev.id,
      sev.creatorId,
      sev.title,
      sev.tag,
      sev.venue,
      sev.description,
      sev.regStart,
      sev.regEnd,
      sev.evtStart,
      sev.evtEnd,
      sev.friendsOnly,
      sev.createdAt,
      sev.createdAt
    );

    sev.fields.forEach((f, idx) => {
      insertSeedField.run(
        f.id,
        sev.id,
        f.name,
        f.type,
        JSON.stringify(f.options),
        f.req,
        idx
      );
    });

    // Auto-participate creator
    const creatorUser = seedUsers.find((u) => u.id === sev.creatorId)!;
    const creatorAnswers = { Role: 'Event Creator / Member' };
    insertSeedReg.run(
      `reg_creator_${sev.id}`,
      sev.id,
      sev.creatorId,
      creatorUser.email,
      JSON.stringify(creatorAnswers),
      sev.createdAt
    );
  }

  // Cross-register friends in seeded events so mutual friend rosters & participations are populated
  const sampleRegistrations = [
    {
      id: 'reg_seed_1',
      eventId: 'evt_seed_genai_hack',
      userId: 'usr_seed_diya',
      email: 'diya.nair@campus.edu',
      answers: {
        'Team Name': 'TensorPulse',
        'Primary Track': 'Autonomous LLM Agents',
        'Compute & Hardware Requirements': 'NVIDIA A100 Cloud Node, Standard API Credits',
      },
      createdAt: isoAt(-20),
    },
    {
      id: 'reg_seed_2',
      eventId: 'evt_seed_genai_hack',
      userId: 'usr_seed_rohan',
      email: 'rohan.verma@campus.edu',
      answers: {
        'Team Name': 'VisionEdge',
        'Primary Track': 'Edge AI & Robotics',
        'Compute & Hardware Requirements': 'Jetson Orin Nano Kit',
      },
      createdAt: isoAt(-18),
    },
    {
      id: 'reg_seed_3',
      eventId: 'evt_seed_ros_robotics',
      userId: 'usr_seed_aarav',
      email: 'aarav.sharma@campus.edu',
      answers: {
        'Microcontroller / SBC Platform': 'Raspberry Pi 5 + ROS2',
        'Sensor Suite Used': '2D RPLiDAR, Depth Camera',
      },
      createdAt: isoAt(-14),
    },
    {
      id: 'reg_seed_4',
      eventId: 'evt_seed_ros_robotics',
      userId: 'usr_seed_ananya',
      email: 'ananya.iyer@campus.edu',
      answers: {
        'Microcontroller / SBC Platform': 'STM32 Nucleo',
        'Sensor Suite Used': '9-DOF IMU, Ultrasonic Array',
      },
      createdAt: isoAt(-12),
    },
    {
      id: 'reg_seed_5',
      eventId: 'evt_seed_cyber_ctf',
      userId: 'usr_seed_sneha',
      email: 'sneha.reddy@campus.edu',
      answers: {
        'Hacker Handle / Alias': '0xSneha',
        'Challenge Categories of Interest': 'Web Exploitation, Cryptography',
      },
      createdAt: isoAt(-10),
    },
    {
      id: 'reg_seed_6',
      eventId: 'evt_seed_cloud_rust',
      userId: 'usr_seed_aarav',
      email: 'aarav.sharma@campus.edu',
      answers: {
        'Systems Programming Experience': 'Intermediate',
        'Development Environment': 'Linux Native',
      },
      createdAt: isoAt(-8),
    },
  ];

  for (const sr of sampleRegistrations) {
    insertSeedReg.run(sr.id, sr.eventId, sr.userId, sr.email, JSON.stringify(sr.answers), sr.createdAt);
    const evRow = sqlite.prepare('SELECT * FROM events WHERE id = ?').get(sr.eventId) as any;
    const creatorRow = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(evRow.creator_id) as any;
    const studentRow = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(sr.userId) as any;
    if (evRow && creatorRow && studentRow) {
      saveRegistrationEmailRecord({
        id: `eml_${sr.id}`,
        eventRow: evRow,
        creatorRow,
        studentRow,
        toEmail: sr.email,
        answers: sr.answers,
        createdAt: sr.createdAt,
      });
    }
  }

  sqlite
    .prepare(`INSERT INTO schema_migrations (version, applied_at) VALUES ('v3_seed_random_users_events_friendships', ?)`)
    .run(new Date().toISOString());

  backupDatabaseToDisk();
}

sqlite.exec(`DELETE FROM notifications WHERE type = 'email_sent';`);

function createNotification(userId: string, senderId: string, type: string, message: string) {
  const id = makeId('ntf');
  const now = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT INTO notifications (id, user_id, sender_id, type, message, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`
    )
    .run(id, userId, senderId, type, message.slice(0, VALIDATION_CONSTANTS.MAX_NOTIFICATION_LEN), now);
  return {
    id,
    userId,
    senderId,
    type,
    message,
    isRead: false,
    createdAt: now,
  };
}

function mapUserRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username || '',
    name: row.name,
    rollNumber: row.roll_number,
    year: Number(row.year),
    branch: row.branch as BranchType,
    phone: row.phone || '',
    email: row.email || '',
    avatarUrl: row.avatar_url || '',
    silentNotifications: Boolean(row.silent_notifications),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEmailRow(row: any) {
  if (!row) return null;
  let parsedAnswers: Record<string, string> = {};
  try {
    parsedAnswers = JSON.parse(row.answers_json || '{}');
  } catch {
    parsedAnswers = {};
  }
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    toEmail: row.to_email,
    subject: row.subject,
    eventTitle: row.event_title,
    eventTag: row.event_tag,
    eventVenue: row.event_venue,
    eventDescription: row.event_description,
    registrationStart: row.registration_start,
    registrationEnd: row.registration_end,
    eventStart: row.event_start,
    eventEnd: row.event_end,
    creatorName: row.creator_name,
    creatorRollNumber: row.creator_roll_number,
    creatorBranch: row.creator_branch as BranchType,
    creatorYear: Number(row.creator_year),
    creatorPhone: row.creator_phone || '',
    creatorEmail: row.creator_email || '',
    studentName: row.student_name,
    studentRollNumber: row.student_roll_number,
    studentBranch: row.student_branch as BranchType,
    studentYear: Number(row.student_year),
    studentPhone: row.student_phone || '',
    answers: parsedAnswers,
    bodyText: row.body_text,
    createdAt: row.created_at,
  };
}

function ensureCountdownNotificationsForUser(userId: string) {
  const existingRows = sqlite
    .prepare(`SELECT message FROM notifications WHERE user_id = ? AND type = 'countdown'`)
    .all(userId) as { message: string }[];
  const existingMessages = new Set(existingRows.map((r) => r.message));

  const userEvents = sqlite
    .prepare(
      `SELECT DISTINCT e.id, e.title, e.registration_start, e.registration_end, e.event_start, e.event_end
       FROM events e
       LEFT JOIN registrations r ON r.event_id = e.id
       WHERE e.creator_id = ? OR r.user_id = ?`
    )
    .all(userId, userId) as any[];

  for (const ev of userEvents) {
    const { countdownLabel } = computeEventRuntimeStatus({
      registrationStart: ev.registration_start,
      registrationEnd: ev.registration_end,
      eventStart: ev.event_start,
      eventEnd: ev.event_end,
    });
    if (countdownLabel) {
      const msg = `Reminder: '${ev.title}' has ${countdownLabel}!`;
      if (!existingMessages.has(msg)) {
        createNotification(userId, userId, 'countdown', msg);
        existingMessages.add(msg);
      }
    }
  }
}

function getFullStateForUser(userId: string) {
  ensureCountdownNotificationsForUser(userId);

  const userRows = sqlite.prepare('SELECT * FROM users ORDER BY name ASC').all() as any[];
  const users = userRows.map(mapUserRow).filter(Boolean);
  const currentUser = users.find((u) => u!.id === userId) || null;

  const allFriendshipRows = sqlite.prepare('SELECT user_id, friend_id FROM friendships').all() as {
    user_id: string;
    friend_id: string;
  }[];

  const friendIdsByCreator: Record<string, string[]> = {};
  for (const row of allFriendshipRows) {
    if (!friendIdsByCreator[row.user_id]) friendIdsByCreator[row.user_id] = [];
    friendIdsByCreator[row.user_id].push(row.friend_id);
  }

  const friendIds = friendIdsByCreator[userId] || [];

  const favRows = sqlite.prepare('SELECT event_id FROM favourites WHERE user_id = ?').all(userId) as {
    event_id: string;
  }[];
  const favSet = new Set(favRows.map((r) => r.event_id));

  const eventRows = sqlite
    .prepare(
      `SELECT e.*,
              u.name as creator_name,
              u.roll_number as creator_roll_number,
              u.year as creator_year,
              u.branch as creator_branch,
              u.phone as creator_phone,
              u.email as creator_email,
              u.avatar_url as creator_avatar_url
       FROM events e
       INNER JOIN users u ON u.id = e.creator_id
       ORDER BY e.created_at DESC`
    )
    .all() as any[];

  const allowedRows = sqlite.prepare('SELECT event_id, user_id FROM event_allowed_users').all() as {
    event_id: string;
    user_id: string;
  }[];
  const allowedByEvent: Record<string, string[]> = {};
  for (const r of allowedRows) {
    if (!allowedByEvent[r.event_id]) allowedByEvent[r.event_id] = [];
    allowedByEvent[r.event_id].push(r.user_id);
  }

  // Ensure every event creator is automatically added as a registered member of their event
  const ensureCreatorRegStmt = sqlite.prepare(
    `INSERT OR IGNORE INTO registrations (id, event_id, user_id, email, answers_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const e of eventRows) {
    ensureCreatorRegStmt.run(
      `reg_creator_${e.id}`,
      e.id,
      e.creator_id,
      e.creator_email || '',
      JSON.stringify({ Role: 'Event Creator / Member' }),
      e.created_at
    );
  }

  const fieldRows = sqlite
    .prepare('SELECT * FROM event_form_fields ORDER BY sort_order ASC')
    .all() as any[];
  const fieldsByEvent: Record<string, any[]> = {};
  for (const f of fieldRows) {
    if (!fieldsByEvent[f.event_id]) fieldsByEvent[f.event_id] = [];
    let parsedOptions: string[] = [];
    try {
      const raw = JSON.parse(f.options_json || '[]');
      if (Array.isArray(raw)) {
        parsedOptions = raw.map((item) => String(item));
      }
    } catch {
      parsedOptions = [];
    }
    fieldsByEvent[f.event_id].push({
      id: f.id,
      fieldName: f.field_name,
      fieldType: f.field_type || 'text',
      options: parsedOptions,
      isRequired: Boolean(f.is_required),
    });
  }

  const regRows = sqlite
    .prepare(
      `SELECT r.*,
              u.name as student_name,
              u.roll_number as student_roll,
              u.year as student_year,
              u.branch as student_branch,
              u.phone as student_phone,
              u.avatar_url as student_avatar
       FROM registrations r
       INNER JOIN users u ON u.id = r.user_id
       ORDER BY r.created_at ASC`
    )
    .all() as any[];

  const regsByEvent: Record<string, any[]> = {};
  for (const r of regRows) {
    if (!regsByEvent[r.event_id]) regsByEvent[r.event_id] = [];
    let parsedAnswers: Record<string, string> = {};
    try {
      parsedAnswers = JSON.parse(r.answers_json || '{}');
    } catch {
      parsedAnswers = {};
    }
    regsByEvent[r.event_id].push({
      id: r.id,
      eventId: r.event_id,
      userId: r.user_id,
      studentName: r.student_name,
      rollNumber: r.student_roll,
      year: Number(r.student_year),
      branch: r.student_branch,
      phone: r.student_phone || '',
      avatarUrl: r.student_avatar || '',
      email: r.email || '',
      answers: parsedAnswers,
      createdAt: r.created_at,
    });
  }

  const ignoredRows = sqlite
    .prepare('SELECT event_id, status, ignored_at FROM ignored_events WHERE user_id = ?')
    .all(userId) as {
    event_id: string;
    status: string;
    ignored_at: string;
  }[];
  const ignoredByEvent: Record<string, { status: string; ignoredAt: string }> = {};
  for (const ir of ignoredRows) {
    ignoredByEvent[ir.event_id] = { status: ir.status, ignoredAt: ir.ignored_at };
  }

  const updateIgnoredStatusStmt = sqlite.prepare(
    `UPDATE ignored_events SET status = 'deleted' WHERE user_id = ? AND event_id = ?`
  );

  const nowMs = Date.now();
  const events = eventRows.map((e) => {
    const baseEvent = {
      id: e.id,
      creatorId: e.creator_id,
      creatorName: e.creator_name,
      creatorRollNumber: e.creator_roll_number,
      creatorYear: Number(e.creator_year),
      creatorBranch: e.creator_branch,
      creatorPhone: e.creator_phone || '',
      creatorEmail: e.creator_email || '',
      creatorAvatarUrl: e.creator_avatar_url || '',
      title: e.title,
      tag: e.tag,
      venue: e.venue,
      description: e.description,
      posterUrl: e.poster_url || '',
      registrationStart: e.registration_start,
      registrationEnd: e.registration_end,
      eventStart: e.event_start,
      eventEnd: e.event_end,
      friendsOnly: Boolean(e.friends_only),
      allowedUserIds: allowedByEvent[e.id] || [],
      formFields: fieldsByEvent[e.id] || [],
      registrations: regsByEvent[e.id] || [],
      isFavourite: favSet.has(e.id),
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    };

    const ig = ignoredByEvent[e.id];
    let currentIgStatus = ig ? ig.status : null;
    const ignoredAt = ig ? ig.ignoredAt : null;

    if (currentIgStatus === 'ignored' && ignoredAt) {
      const check = shouldAutoDeleteIgnoredEvent(baseEvent, ignoredAt, nowMs);
      if (check.shouldDelete) {
        updateIgnoredStatusStmt.run(userId, e.id);
        currentIgStatus = 'deleted';
      }
    }

    return {
      ...baseEvent,
      isIgnored: currentIgStatus === 'ignored',
      ignoredAt: currentIgStatus === 'ignored' ? ignoredAt : null,
      isDismissedFromHome: currentIgStatus === 'ignored' || currentIgStatus === 'deleted',
    };
  });

  const notifRows = sqlite
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as any[];

  const notifications = notifRows.map((n) => ({
    id: n.id,
    userId: n.user_id,
    senderId: n.sender_id,
    type: n.type,
    message: n.message,
    isRead: Boolean(n.is_read),
    createdAt: n.created_at,
  }));

  const emailRows = sqlite
    .prepare('SELECT * FROM registration_emails WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as any[];
  const emails = emailRows.map(mapEmailRow).filter(Boolean);

  const currentUserRawRow = userRows.find((r) => r.id === userId) || null;
  const vaultEntry = currentUserRawRow
    ? {
        id: currentUserRawRow.id,
        username: currentUserRawRow.username,
        passwordHash: currentUserRawRow.password_hash,
        name: currentUserRawRow.name,
        rollNumber: currentUserRawRow.roll_number,
        year: Number(currentUserRawRow.year),
        branch: currentUserRawRow.branch,
        phone: currentUserRawRow.phone || '',
        email: currentUserRawRow.email || '',
        avatarUrl: currentUserRawRow.avatar_url || '',
        silentNotifications: Boolean(currentUserRawRow.silent_notifications),
        createdAt: currentUserRawRow.created_at,
        updatedAt: currentUserRawRow.updated_at,
      }
    : null;

  const msgRows = sqlite
    .prepare(
      `SELECT * FROM chat_messages
       WHERE sender_id = ? OR receiver_id = ?
       ORDER BY created_at ASC`
    )
    .all(userId, userId) as any[];

  const messages = msgRows.map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    receiverId: m.receiver_id,
    text: m.text || '',
    imageUrl: m.image_url || '',
    imageName: m.image_name || '',
    createdAt: m.created_at,
  }));

  return {
    currentUser,
    vaultEntry,
    users,
    friendIds,
    friendIdsByCreator,
    events,
    notifications,
    emails,
    messages,
  };
}

function upsertVaultUsersFromClient(vaultUsers: any[], skipDefaultSeedFriends = false): Map<string, string> {
  const userIdMap = new Map<string, string>();
  if (!Array.isArray(vaultUsers) || vaultUsers.length === 0) return userIdMap;
  let modified = false;
  const now = new Date().toISOString();
  const insertFriend = sqlite.prepare(
    `INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)`
  );

  for (const vu of vaultUsers) {
    if (!vu || !vu.username || !vu.name || !vu.rollNumber) continue;
    const trimmedUsername = String(vu.username).trim();
    if (!trimmedUsername) continue;

    const existingByUsername = sqlite
      .prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)')
      .get(trimmedUsername) as any;
    const existingById = vu.id
      ? (sqlite.prepare('SELECT * FROM users WHERE id = ?').get(String(vu.id)) as any)
      : null;
    const existing = existingByUsername || existingById;

    const resolvedHash =
      vu.passwordHash && String(vu.passwordHash).includes(':')
        ? String(vu.passwordHash)
        : vu.passwordPlain
        ? hashPassword(String(vu.passwordPlain))
        : '';

    if (!existing) {
      if (!resolvedHash) continue;
      const newId = vu.id ? String(vu.id) : makeId('usr');
      sqlite
        .prepare(
          `INSERT OR IGNORE INTO users (
            id, username, password_hash, name, roll_number, year, branch, phone, email, avatar_url, silent_notifications, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          newId,
          trimmedUsername,
          resolvedHash,
          String(vu.name).trim(),
          String(vu.rollNumber).trim(),
          Number(vu.year) || 3,
          String(vu.branch || 'cse'),
          String(vu.phone || ''),
          String(vu.email || ''),
          String(vu.avatarUrl || ''),
          vu.silentNotifications ? 1 : 0,
          String(vu.createdAt || now),
          String(vu.updatedAt || now)
        );

      userIdMap.set(newId, newId);
      if (vu.id) userIdMap.set(String(vu.id), newId);

      if (!skipDefaultSeedFriends) {
        for (const seedFriendId of ['usr_seed_aarav', 'usr_seed_diya']) {
          const existsSeed = sqlite.prepare('SELECT id FROM users WHERE id = ?').get(seedFriendId);
          if (existsSeed) {
            insertFriend.run(newId, seedFriendId, now);
            insertFriend.run(seedFriendId, newId, now);
          }
        }
      }
      modified = true;
    } else {
      if (vu.id) {
        userIdMap.set(String(vu.id), existing.id);
      }
      userIdMap.set(existing.id, existing.id);

      // Ensure profile contact fields/avatar/username/password from vault are up to date
      const nextPhone = String(vu.phone || existing.phone || '');
      const nextEmail = String(vu.email || existing.email || '');
      const nextAvatar = String(vu.avatarUrl || existing.avatar_url || '');
      const nextPasswordHash = resolvedHash || existing.password_hash;
      const nextUsername = trimmedUsername || existing.username;
      const nextName = String(vu.name || existing.name).trim();
      const nextRoll = String(vu.rollNumber || existing.roll_number).trim();
      const nextYear = Number(vu.year) || Number(existing.year) || 3;
      const nextBranch = String(vu.branch || existing.branch || 'cse');

      if (
        nextPhone !== existing.phone ||
        nextEmail !== existing.email ||
        nextAvatar !== existing.avatar_url ||
        nextPasswordHash !== existing.password_hash ||
        nextUsername !== existing.username ||
        nextName !== existing.name ||
        nextRoll !== existing.roll_number ||
        nextYear !== Number(existing.year) ||
        nextBranch !== existing.branch
      ) {
        sqlite
          .prepare(
            `UPDATE users
             SET username = ?, password_hash = ?, name = ?, roll_number = ?, year = ?, branch = ?, phone = ?, email = ?, avatar_url = ?
             WHERE id = ?`
          )
          .run(
            nextUsername,
            nextPasswordHash,
            nextName,
            nextRoll,
            nextYear,
            nextBranch,
            nextPhone,
            nextEmail,
            nextAvatar,
            existing.id
          );
        modified = true;
      }
    }
  }

  if (modified) {
    backupDatabaseToDisk();
  }
  return userIdMap;
}

function upsertPortalVaultFromClient(params: {
  activeUserId?: string;
  userIdMap: Map<string, string>;
  vaultEvents?: any[];
  vaultFriendIds?: string[];
  vaultFriendIdsByCreator?: Record<string, string[]>;
  vaultRemovedFriendIds?: string[];
  vaultCancelledEventIds?: string[];
  vaultMessages?: any[];
}) {
  const {
    activeUserId,
    userIdMap,
    vaultEvents,
    vaultFriendIds,
    vaultFriendIdsByCreator,
    vaultRemovedFriendIds,
    vaultCancelledEventIds,
    vaultMessages,
  } = params;

  const allDbUsers = sqlite.prepare('SELECT id, username, roll_number, name FROM users').all() as {
    id: string;
    username: string;
    roll_number: string;
    name: string;
  }[];
  const validUserIds = new Set(allDbUsers.map((u) => u.id));
  const byRoll = new Map(allDbUsers.map((u) => [String(u.roll_number || '').toLowerCase(), u.id]));
  const byName = new Map(allDbUsers.map((u) => [String(u.name || '').toLowerCase(), u.id]));

  const resolveUid = (rawId?: string, roll?: string, name?: string): string | null => {
    if (rawId) {
      const mapped = userIdMap.get(String(rawId));
      if (mapped && validUserIds.has(mapped)) return mapped;
      if (validUserIds.has(String(rawId))) return String(rawId);
    }
    if (roll) {
      const foundRoll = byRoll.get(String(roll).trim().toLowerCase());
      if (foundRoll) return foundRoll;
    }
    if (name) {
      const foundName = byName.get(String(name).trim().toLowerCase());
      if (foundName) return foundName;
    }
    return null;
  };

  let modified = false;
  const now = new Date().toISOString();

  const cancelledSet = new Set<string>(
    Array.isArray(vaultCancelledEventIds) ? vaultCancelledEventIds.map((id) => String(id)) : []
  );
  if (cancelledSet.size > 0) {
    const delEventStmt = sqlite.prepare('DELETE FROM events WHERE id = ?');
    for (const cid of cancelledSet) {
      const info = delEventStmt.run(cid);
      if (info.changes > 0) modified = true;
    }
  }

  const removedFriendSet = new Set<string>(
    Array.isArray(vaultRemovedFriendIds)
      ? vaultRemovedFriendIds.map((fid) => resolveUid(String(fid)) || String(fid))
      : []
  );

  if (activeUserId && validUserIds.has(activeUserId) && removedFriendSet.size > 0) {
    const delFriendStmt = sqlite.prepare(
      'DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
    );
    for (const rfid of removedFriendSet) {
      const info = delFriendStmt.run(activeUserId, rfid, rfid, activeUserId);
      if (info.changes > 0) modified = true;
    }
  }

  const insertFriendStmt = sqlite.prepare(
    'INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)'
  );

  if (vaultFriendIdsByCreator && typeof vaultFriendIdsByCreator === 'object') {
    for (const [rawOwnerId, rawList] of Object.entries(vaultFriendIdsByCreator)) {
      const ownerId = resolveUid(rawOwnerId);
      if (!ownerId || !Array.isArray(rawList)) continue;
      for (const rawFid of rawList) {
        const fid = resolveUid(String(rawFid));
        if (!fid || fid === ownerId) continue;
        if (
          (ownerId === activeUserId && removedFriendSet.has(fid)) ||
          (fid === activeUserId && removedFriendSet.has(ownerId))
        ) {
          continue;
        }
        const r1 = insertFriendStmt.run(ownerId, fid, now);
        const r2 = insertFriendStmt.run(fid, ownerId, now);
        if (r1.changes > 0 || r2.changes > 0) modified = true;
      }
    }
  }

  if (activeUserId && validUserIds.has(activeUserId) && Array.isArray(vaultFriendIds)) {
    for (const rawFid of vaultFriendIds) {
      const fid = resolveUid(String(rawFid));
      if (!fid || fid === activeUserId || removedFriendSet.has(fid)) continue;
      const r1 = insertFriendStmt.run(activeUserId, fid, now);
      const r2 = insertFriendStmt.run(fid, activeUserId, now);
      if (r1.changes > 0 || r2.changes > 0) modified = true;
    }
  }

  if (Array.isArray(vaultEvents) && vaultEvents.length > 0) {
    const upsertEventStmt = sqlite.prepare(
      `INSERT INTO events (
        id, creator_id, title, tag, venue, description, poster_url,
        registration_start, registration_end, event_start, event_end,
        friends_only, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        tag = excluded.tag,
        venue = excluded.venue,
        description = excluded.description,
        poster_url = CASE WHEN excluded.poster_url != '' THEN excluded.poster_url ELSE events.poster_url END,
        registration_start = excluded.registration_start,
        registration_end = excluded.registration_end,
        event_start = excluded.event_start,
        event_end = excluded.event_end,
        friends_only = excluded.friends_only,
        updated_at = excluded.updated_at`
    );

    const insertAllowedStmt = sqlite.prepare(
      'INSERT OR IGNORE INTO event_allowed_users (event_id, user_id) VALUES (?, ?)'
    );
    const upsertFieldStmt = sqlite.prepare(
      `INSERT INTO event_form_fields (id, event_id, field_name, field_type, options_json, is_required, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         field_name = excluded.field_name,
         field_type = excluded.field_type,
         options_json = excluded.options_json,
         is_required = excluded.is_required,
         sort_order = excluded.sort_order`
    );
    const upsertRegStmt = sqlite.prepare(
      `INSERT INTO registrations (id, event_id, user_id, email, answers_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(event_id, user_id) DO UPDATE SET
         email = CASE WHEN excluded.email != '' THEN excluded.email ELSE registrations.email END,
         answers_json = CASE WHEN excluded.answers_json != '{}' THEN excluded.answers_json ELSE registrations.answers_json END`
    );
    const insertFavStmt = sqlite.prepare(
      'INSERT OR IGNORE INTO favourites (user_id, event_id, created_at) VALUES (?, ?, ?)'
    );
    const upsertIgnoredStmt = sqlite.prepare(
      `INSERT INTO ignored_events (user_id, event_id, status, ignored_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, event_id) DO UPDATE SET status = excluded.status, ignored_at = excluded.ignored_at`
    );

    for (const ev of vaultEvents) {
      if (!ev || !ev.id || !ev.title || cancelledSet.has(String(ev.id))) continue;
      const eventId = String(ev.id);
      const creatorId =
        resolveUid(ev.creatorId, ev.creatorRollNumber, ev.creatorName) ||
        (activeUserId && validUserIds.has(activeUserId) ? activeUserId : null);
      if (!creatorId) continue;

      upsertEventStmt.run(
        eventId,
        creatorId,
        String(ev.title),
        String(ev.tag || 'Technical'),
        String(ev.venue || 'Campus Venue'),
        String(ev.description || ''),
        String(ev.posterUrl || ''),
        String(ev.registrationStart || now),
        String(ev.registrationEnd || now),
        String(ev.eventStart || now),
        String(ev.eventEnd || now),
        ev.friendsOnly ? 1 : 0,
        String(ev.createdAt || now),
        String(ev.updatedAt || now)
      );
      modified = true;

      if (Array.isArray(ev.allowedUserIds)) {
        for (const rawAllowed of ev.allowedUserIds) {
          const auid = resolveUid(String(rawAllowed));
          if (auid) insertAllowedStmt.run(eventId, auid);
        }
      }

      if (Array.isArray(ev.formFields)) {
        ev.formFields.forEach((f: any, idx: number) => {
          if (!f || !f.fieldName) return;
          const fid = f.id ? String(f.id) : `fld_${eventId}_${idx}`;
          const ftype =
            f.fieldType === 'single_radio' || f.fieldType === 'multi_radio' ? f.fieldType : 'text';
          const opts = Array.isArray(f.options) ? f.options.map((o: any) => String(o)) : [];
          upsertFieldStmt.run(
            fid,
            eventId,
            String(f.fieldName),
            ftype,
            JSON.stringify(opts),
            f.isRequired ? 1 : 0,
            idx
          );
        });
      }

      if (Array.isArray(ev.registrations)) {
        for (const reg of ev.registrations) {
          if (!reg) continue;
          const regUid = resolveUid(reg.userId, reg.rollNumber, reg.studentName);
          if (!regUid) continue;
          const regId = reg.id ? String(reg.id) : `reg_${eventId}_${regUid}`;
          const answersJson =
            reg.answers && typeof reg.answers === 'object'
              ? JSON.stringify(reg.answers)
              : '{}';
          upsertRegStmt.run(
            regId,
            eventId,
            regUid,
            String(reg.email || ''),
            answersJson,
            String(reg.createdAt || now)
          );
        }
      }

      if (activeUserId && validUserIds.has(activeUserId)) {
        if (ev.isFavourite) {
          insertFavStmt.run(activeUserId, eventId, now);
        }
        if (ev.isIgnored && ev.ignoredAt) {
          upsertIgnoredStmt.run(activeUserId, eventId, 'ignored', String(ev.ignoredAt));
        } else if (ev.isDismissedFromHome && !ev.isIgnored) {
          upsertIgnoredStmt.run(activeUserId, eventId, 'deleted', String(ev.ignoredAt || now));
        }
      }
    }
  }

  if (Array.isArray(vaultMessages) && vaultMessages.length > 0) {
    const insertMsgStmt = sqlite.prepare(
      `INSERT OR IGNORE INTO chat_messages (id, sender_id, receiver_id, text, image_url, image_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const m of vaultMessages) {
      if (!m || !m.id) continue;
      const sId = resolveUid(m.senderId);
      const rId = resolveUid(m.receiverId);
      if (!sId || !rId) continue;
      const info = insertMsgStmt.run(
        String(m.id),
        sId,
        rId,
        String(m.text || ''),
        String(m.imageUrl || ''),
        String(m.imageName || ''),
        String(m.createdAt || now)
      );
      if (info.changes > 0) modified = true;
    }
  }

  if (modified) {
    backupDatabaseToDisk();
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/chat' });
  const clientsByUserId = new Map<string, Set<WebSocket>>();
  const socketToUserId = new Map<WebSocket, string>();

  function sendToUser(userId: string, payload: any) {
    const sockets = clientsByUserId.get(userId);
    if (!sockets) return;
    const raw = JSON.stringify(payload);
    for (const sock of sockets) {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(raw);
      }
    }
  }

  function broadcastPresence() {
    const onlineUserIds = Array.from(clientsByUserId.keys());
    const raw = JSON.stringify({ type: 'presence', onlineUserIds });
    for (const sockets of clientsByUserId.values()) {
      for (const sock of sockets) {
        if (sock.readyState === WebSocket.OPEN) {
          sock.send(raw);
        }
      }
    }
  }

  function saveAndBroadcastChatMessage(params: {
    senderId: string;
    receiverId: string;
    text?: string;
    imageUrl?: string;
    imageName?: string;
  }) {
    const senderId = String(params.senderId || '').trim();
    const receiverId = String(params.receiverId || '').trim();
    const text = String(params.text || '').trim();
    const imageUrl = String(params.imageUrl || '').trim();
    const imageName = String(params.imageName || '').trim() || (imageUrl ? 'shared-picture.png' : '');

    if (!senderId || !receiverId) {
      throw new Error('Sender and receiver are required.');
    }
    if (!text && !imageUrl) {
      throw new Error('Please enter a message or attach a picture.');
    }

    const id = makeId('msg');
    const createdAt = new Date().toISOString();

    sqlite
      .prepare(
        `INSERT INTO chat_messages (id, sender_id, receiver_id, text, image_url, image_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, senderId, receiverId, text.slice(0, 4000), imageUrl, imageName.slice(0, 200), createdAt);

    let receiverNotification: any = null;
    if (receiverId !== senderId) {
      const senderRow = sqlite
        .prepare('SELECT name FROM users WHERE id = ?')
        .get(senderId) as { name?: string } | undefined;
      const senderName = senderRow?.name || 'Your friend';
      const notifMessage = text
        ? `${senderName} said "${text}"`
        : `${senderName} sent a picture`;
      receiverNotification = createNotification(
        receiverId,
        senderId,
        'friend_message',
        notifMessage
      );
    }

    backupDatabaseToDisk();

    const messageRecord = {
      id,
      senderId,
      receiverId,
      text: text.slice(0, 4000),
      imageUrl,
      imageName: imageName.slice(0, 200),
      createdAt,
    };

    sendToUser(senderId, { type: 'message:new', message: messageRecord });
    if (receiverId !== senderId) {
      sendToUser(receiverId, {
        type: 'message:new',
        message: messageRecord,
        notification: receiverNotification,
      });
    }

    return messageRecord;
  }

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(String(data));
        if (!parsed || typeof parsed !== 'object') return;

        if (parsed.type === 'auth' && parsed.userId) {
          const uid = String(parsed.userId).trim();
          if (!uid) return;

          const prevUid = socketToUserId.get(ws);
          if (prevUid && prevUid !== uid) {
            const prevSet = clientsByUserId.get(prevUid);
            if (prevSet) {
              prevSet.delete(ws);
              if (prevSet.size === 0) clientsByUserId.delete(prevUid);
            }
          }

          socketToUserId.set(ws, uid);
          if (!clientsByUserId.has(uid)) {
            clientsByUserId.set(uid, new Set());
          }
          clientsByUserId.get(uid)!.add(ws);

          const msgRows = sqlite
            .prepare(
              `SELECT * FROM chat_messages
               WHERE sender_id = ? OR receiver_id = ?
               ORDER BY created_at ASC`
            )
            .all(uid, uid) as any[];
          const messages = msgRows.map((m) => ({
            id: m.id,
            senderId: m.sender_id,
            receiverId: m.receiver_id,
            text: m.text || '',
            imageUrl: m.image_url || '',
            imageName: m.image_name || '',
            createdAt: m.created_at,
          }));

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'messages:sync', messages }));
          }
          broadcastPresence();
        } else if (parsed.type === 'typing') {
          const senderId = String(parsed.senderId || socketToUserId.get(ws) || '').trim();
          const receiverId = String(parsed.receiverId || '').trim();
          const isTyping = Boolean(parsed.isTyping);
          if (senderId && receiverId) {
            sendToUser(receiverId, {
              type: 'typing',
              senderId,
              receiverId,
              isTyping,
            });
          }
        } else if (parsed.type === 'send_message') {
          const senderId = String(parsed.senderId || socketToUserId.get(ws) || '').trim();
          const receiverId = String(parsed.receiverId || '').trim();
          saveAndBroadcastChatMessage({
            senderId,
            receiverId,
            text: parsed.text,
            imageUrl: parsed.imageUrl,
            imageName: parsed.imageName,
          });
          // Clear typing state on send
          if (senderId && receiverId) {
            sendToUser(receiverId, {
              type: 'typing',
              senderId,
              receiverId,
              isTyping: false,
            });
          }
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      const uid = socketToUserId.get(ws);
      if (uid) {
        socketToUserId.delete(ws);
        const set = clientsByUserId.get(uid);
        if (set) {
          set.delete(ws);
          if (set.size === 0) {
            clientsByUserId.delete(uid);
          }
        }
        broadcastPresence();
      }
    });
  });

  // 1a. Register New Student (Name can have duplicates; Username must be unique)
  app.post('/api/auth/register', (req, res) => {
    try {
      const { name, year, branch, rollNumber, username, password, confirmPassword } = req.body || {};

      const trimmedUsername = String(username || '').trim();
      const existingByUsername = sqlite
        .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)')
        .get(trimmedUsername) as any;

      if (existingByUsername) {
        return res.status(409).json({
          error: 'User already registered. Please sign in.',
          code: 'ALREADY_REGISTERED',
        });
      }

      const validation = validateRegistrationDetails({
        name: String(name || ''),
        year: Number(year),
        branch: String(branch || ''),
        rollNumber: String(rollNumber || ''),
        username: trimmedUsername,
        password: String(password || ''),
        confirmPassword: String(confirmPassword || ''),
      });

      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const trimmedName = String(name).trim();
      const trimmedRoll = String(rollNumber).trim();
      const numericYear = Number(year);
      const validBranch = String(branch) as BranchType;
      const passwordHash = hashPassword(String(password));
      const now = new Date().toISOString();
      const userId = makeId('usr');

      sqlite
        .prepare(
          `INSERT INTO users (
            id, username, password_hash, name, roll_number, year, branch, phone, email, avatar_url, silent_notifications, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, '', '', '', 0, ?, ?)`
        )
        .run(
          userId,
          trimmedUsername,
          passwordHash,
          trimmedName,
          trimmedRoll,
          numericYear,
          validBranch,
          now,
          now
        );

      // Connect newly registered student with seeded campus peers so mutual friendships are immediately testable
      const insertFriend = sqlite.prepare(
        `INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)`
      );
      for (const seedFriendId of ['usr_seed_aarav', 'usr_seed_diya']) {
        const existsSeed = sqlite.prepare('SELECT id FROM users WHERE id = ?').get(seedFriendId);
        if (existsSeed) {
          insertFriend.run(userId, seedFriendId, now);
          insertFriend.run(seedFriendId, userId, now);
        }
      }

      backupDatabaseToDisk();
      const state = getFullStateForUser(userId);
      return res.json(state);
    } catch (error: any) {
      console.error('Register error:', error);
      return res.status(500).json({ error: 'Failed to register student account.' });
    }
  });

  // 1b. Sign In Existing Student
  app.post('/api/auth/signin', (req, res) => {
    try {
      const {
        username,
        password,
        vaultUsers,
        vaultEvents,
        vaultFriendIds,
        vaultFriendIdsByCreator,
        vaultRemovedFriendIds,
        vaultCancelledEventIds,
        vaultMessages,
      } = req.body || {};

      const hasExplicitFriends = Array.isArray(vaultFriendIds) || Boolean(vaultFriendIdsByCreator);
      const userIdMap = Array.isArray(vaultUsers)
        ? upsertVaultUsersFromClient(vaultUsers, hasExplicitFriends)
        : new Map<string, string>();

      const trimmedUsername = String(username || '').trim();
      const rawPassword = String(password || '');

      if (!trimmedUsername || !rawPassword) {
        return res.status(400).json({ error: 'Please enter both your username and password.' });
      }

      const existing = sqlite
        .prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)')
        .get(trimmedUsername) as any;

      if (!existing || !verifyPassword(rawPassword, existing.password_hash)) {
        return res.status(401).json({
          error: 'Invalid username or password. Please check your credentials or register if you are new.',
        });
      }

      upsertPortalVaultFromClient({
        activeUserId: existing.id,
        userIdMap,
        vaultEvents,
        vaultFriendIds,
        vaultFriendIdsByCreator,
        vaultRemovedFriendIds,
        vaultCancelledEventIds,
        vaultMessages,
      });

      const state = getFullStateForUser(existing.id);
      return res.json(state);
    } catch (error: any) {
      console.error('Sign-in error:', error);
      return res.status(500).json({ error: 'Failed to sign in.' });
    }
  });

  // 1c. Sync Client Account Vault & Restore Active Session across server restarts
  app.post('/api/auth/sync-vault', (req, res) => {
    try {
      const {
        userId,
        username,
        vaultUsers,
        vaultEvents,
        vaultFriendIds,
        vaultFriendIdsByCreator,
        vaultRemovedFriendIds,
        vaultCancelledEventIds,
        vaultMessages,
      } = req.body || {};

      const hasExplicitFriends = Array.isArray(vaultFriendIds) || Boolean(vaultFriendIdsByCreator);
      const userIdMap = Array.isArray(vaultUsers)
        ? upsertVaultUsersFromClient(vaultUsers, hasExplicitFriends)
        : new Map<string, string>();

      const trimmedUserId = String(userId || '').trim();
      const trimmedUsername = String(username || '').trim();

      let resolvedUserId = trimmedUserId ? userIdMap.get(trimmedUserId) || trimmedUserId : '';
      if (resolvedUserId) {
        const foundById = sqlite.prepare('SELECT id FROM users WHERE id = ?').get(resolvedUserId) as any;
        if (!foundById && trimmedUsername) {
          const foundByUsername = sqlite
            .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)')
            .get(trimmedUsername) as any;
          if (foundByUsername) {
            resolvedUserId = foundByUsername.id;
          }
        }
      } else if (trimmedUsername) {
        const foundByUsername = sqlite
          .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)')
          .get(trimmedUsername) as any;
        if (foundByUsername) {
          resolvedUserId = foundByUsername.id;
        }
      }

      upsertPortalVaultFromClient({
        activeUserId: resolvedUserId || undefined,
        userIdMap,
        vaultEvents,
        vaultFriendIds,
        vaultFriendIdsByCreator,
        vaultRemovedFriendIds,
        vaultCancelledEventIds,
        vaultMessages,
      });

      if (!trimmedUserId && !trimmedUsername) {
        const allUsers = sqlite
          .prepare('SELECT * FROM users ORDER BY name ASC')
          .all()
          .map(mapUserRow);
        return res.json({ users: allUsers });
      }

      const state = getFullStateForUser(resolvedUserId);
      if (!state.currentUser) {
        return res.status(404).json({ error: 'Student profile not found.' });
      }
      return res.json(state);
    } catch (error) {
      console.error('Sync vault error:', error);
      return res.status(500).json({ error: 'Failed to sync portal data.' });
    }
  });

  // 2. Get full state for current user (with fallback lookup by username if needed)
  app.get('/api/state', (req, res) => {
    try {
      const userId = String(req.query.userId || '');
      const username = String(req.query.username || '');
      if (!userId && !username) {
        const allUsers = sqlite
          .prepare('SELECT * FROM users ORDER BY name ASC')
          .all()
          .map(mapUserRow);
        return res.json({ users: allUsers });
      }

      let resolvedUserId = userId;
      if (resolvedUserId) {
        const foundById = sqlite.prepare('SELECT id FROM users WHERE id = ?').get(resolvedUserId) as any;
        if (!foundById && username) {
          const foundByUsername = sqlite
            .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)')
            .get(username) as any;
          if (foundByUsername) {
            resolvedUserId = foundByUsername.id;
          }
        }
      } else if (username) {
        const foundByUsername = sqlite
          .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)')
          .get(username) as any;
        if (foundByUsername) {
          resolvedUserId = foundByUsername.id;
        }
      }

      const state = getFullStateForUser(resolvedUserId);
      if (!state.currentUser) {
        return res.status(404).json({ error: 'Student profile not found.' });
      }
      return res.json(state);
    } catch (error) {
      console.error('State fetch error:', error);
      return res.status(500).json({ error: 'Failed to load portal data.' });
    }
  });

  // 3. Update Profile Details (duplicate names allowed; username must be unique; optional password update)
  app.put('/api/users/:id', (req, res) => {
    try {
      const userId = req.params.id;
      const existing = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (!existing) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const nextName = req.body.name !== undefined ? String(req.body.name).trim() : existing.name;
      const nextUsername =
        req.body.username !== undefined ? String(req.body.username).trim() : existing.username;
      const nextRoll =
        req.body.rollNumber !== undefined ? String(req.body.rollNumber).trim() : existing.roll_number;
      const nextYear = req.body.year !== undefined ? Number(req.body.year) : Number(existing.year);
      const nextBranch = req.body.branch !== undefined ? String(req.body.branch) : existing.branch;
      const nextPhone = req.body.phone !== undefined ? String(req.body.phone).trim() : existing.phone;
      const nextEmail = req.body.email !== undefined ? String(req.body.email).trim() : existing.email;
      const nextAvatar =
        req.body.avatarUrl !== undefined ? String(req.body.avatarUrl) : existing.avatar_url;
      const nextSilent =
        req.body.silentNotifications !== undefined
          ? req.body.silentNotifications
            ? 1
            : 0
          : existing.silent_notifications;

      const validation = validateEntryDetails({
        name: nextName,
        year: nextYear,
        branch: nextBranch,
        rollNumber: nextRoll,
      });
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      if (
        nextUsername.length < VALIDATION_CONSTANTS.MIN_USERNAME_LEN ||
        nextUsername.length > VALIDATION_CONSTANTS.MAX_USERNAME_LEN
      ) {
        return res.status(400).json({ error: 'Username must be between 3 and 40 characters.' });
      }

      // Ensure unique username across all other users (duplicate student names ARE allowed)
      const duplicateUsername = sqlite
        .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?')
        .get(nextUsername, userId) as any;

      if (duplicateUsername) {
        return res.status(409).json({
          error: `The username "${nextUsername}" is already used by another student. Please choose a unique username.`,
        });
      }

      let nextPasswordHash = existing.password_hash;
      const newPassword = req.body.newPassword !== undefined ? String(req.body.newPassword) : '';
      const confirmNewPassword =
        req.body.confirmNewPassword !== undefined ? String(req.body.confirmNewPassword) : '';

      if (newPassword.length > 0) {
        if (newPassword.length < VALIDATION_CONSTANTS.MIN_PASSWORD_LEN) {
          return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
        }
        if (newPassword.length > VALIDATION_CONSTANTS.MAX_PASSWORD_LEN) {
          return res.status(400).json({ error: 'New password cannot exceed 128 characters.' });
        }
        if (req.body.confirmNewPassword !== undefined && newPassword !== confirmNewPassword) {
          return res.status(400).json({ error: 'Confirm password does not match the new password.' });
        }
        if (verifyPassword(newPassword, existing.password_hash)) {
          return res.status(400).json({
            error: 'New password cannot be the same as your current password. Please choose a different password.',
          });
        }
        nextPasswordHash = hashPassword(newPassword);
      }

      const now = new Date().toISOString();
      sqlite
        .prepare(
          `UPDATE users
           SET username = ?, password_hash = ?, name = ?, roll_number = ?, year = ?, branch = ?, phone = ?, email = ?, avatar_url = ?, silent_notifications = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          nextUsername,
          nextPasswordHash,
          nextName,
          nextRoll,
          nextYear,
          nextBranch,
          nextPhone.slice(0, VALIDATION_CONSTANTS.MAX_PHONE_LEN),
          nextEmail.slice(0, VALIDATION_CONSTANTS.MAX_EMAIL_LEN),
          nextAvatar,
          nextSilent,
          now,
          userId
        );

      backupDatabaseToDisk();
      return res.json(getFullStateForUser(userId));
    } catch (error) {
      console.error('Update user error:', error);
      return res.status(500).json({ error: 'Failed to update profile.' });
    }
  });

  // 3b. Delete Student Account Permanently
  app.delete('/api/users/:id', (req, res) => {
    try {
      const userId = String(req.params.id || '').trim();
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required.' });
      }
      const existing = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (!existing) {
        return res.status(404).json({ error: 'User not found.' });
      }

      sqlite
        .prepare('DELETE FROM chat_messages WHERE sender_id = ? OR receiver_id = ?')
        .run(userId, userId);
      sqlite
        .prepare('DELETE FROM notifications WHERE user_id = ? OR sender_id = ?')
        .run(userId, userId);
      sqlite.prepare('DELETE FROM favourites WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM ignored_events WHERE user_id = ?').run(userId);
      sqlite
        .prepare('DELETE FROM friendships WHERE user_id = ? OR friend_id = ?')
        .run(userId, userId);
      sqlite.prepare('DELETE FROM event_allowed_users WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM registration_emails WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM registrations WHERE user_id = ?').run(userId);
      sqlite.prepare('DELETE FROM events WHERE creator_id = ?').run(userId);
      sqlite.prepare('DELETE FROM users WHERE id = ?').run(userId);

      backupDatabaseToDisk();
      return res.json({ ok: true, deletedUserId: userId, deletedUsername: existing.username });
    } catch (error) {
      console.error('Delete user account error:', error);
      return res.status(500).json({ error: 'Failed to delete student account.' });
    }
  });

  // 4. Add Friend (Mutual + Notify BOTH users)
  app.post('/api/friends/add', (req, res) => {
    try {
      const { userId, friendId } = req.body || {};
      if (!userId || !friendId || userId === friendId) {
        return res.status(400).json({ error: 'Invalid friend request.' });
      }

      const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      const friend = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(friendId) as any;
      if (!user || !friend) {
        return res.status(404).json({ error: 'Student not found.' });
      }

      const now = new Date().toISOString();
      sqlite
        .prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)')
        .run(userId, friendId, now);
      sqlite
        .prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)')
        .run(friendId, userId, now);

      // Notify both users
      const latestNotification = createNotification(
        userId,
        userId,
        'friend_added',
        `You and ${friend.name} (${friend.roll_number}) are now friends.`
      );
      createNotification(
        friendId,
        userId,
        'friend_added',
        `${user.name} (${user.roll_number}) added you as a friend.`
      );

      backupDatabaseToDisk();
      return res.json({
        ...getFullStateForUser(userId),
        latestNotification,
      });
    } catch (error) {
      console.error('Add friend error:', error);
      return res.status(500).json({ error: 'Failed to add friend.' });
    }
  });

  // 5. Remove Friend (Silently remove from other user, notify ONLY the person who removed)
  app.post('/api/friends/remove', (req, res) => {
    try {
      const { userId, friendId } = req.body || {};
      if (!userId || !friendId) {
        return res.status(400).json({ error: 'Invalid friend removal request.' });
      }

      const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      const friend = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(friendId) as any;
      if (!user || !friend) {
        return res.status(404).json({ error: 'Student not found.' });
      }

      sqlite
        .prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)')
        .run(userId, friendId, friendId, userId);

      // Notify ONLY the person who removed
      const latestNotification = createNotification(
        userId,
        userId,
        'friend_removed',
        `You removed ${friend.name} (${friend.roll_number}) from your friends.`
      );

      backupDatabaseToDisk();
      return res.json({
        ...getFullStateForUser(userId),
        latestNotification,
      });
    } catch (error) {
      console.error('Remove friend error:', error);
      return res.status(500).json({ error: 'Failed to remove friend.' });
    }
  });

  // 6. Create New Event (Step 1 + Step 2 Form Fields + Automatically add Creator as Member)
  app.post('/api/events', (req, res) => {
    try {
      const {
        creatorId,
        title,
        tag,
        venue,
        description,
        posterUrl,
        registrationStart,
        registrationEnd,
        eventStart,
        eventEnd,
        friendsOnly,
        allowedUserIds,
        formFields,
      } = req.body || {};

      const creator = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(creatorId) as any;
      if (!creator) {
        return res.status(404).json({ error: 'Creator profile not found.' });
      }

      const contactCheck = checkUserContactRequirements(
        { phone: String(creator.phone || ''), email: String(creator.email || '') },
        'create or host an event'
      );
      if (!contactCheck.valid) {
        return res.status(400).json({
          error: contactCheck.error,
          code: 'CONTACT_REQUIRED',
        });
      }

      const trimmedTitle = String(title || '').trim();
      const trimmedTag = String(tag || 'Technical').trim();
      const trimmedVenue = String(venue || '').trim();
      const trimmedDesc = String(description || '').trim();
      const trimmedPosterUrl = String(posterUrl || '').trim();

      if (trimmedTitle.length < VALIDATION_CONSTANTS.MIN_TITLE_LEN || trimmedTitle.length > VALIDATION_CONSTANTS.MAX_TITLE_LEN) {
        return res.status(400).json({ error: 'Event title must be between 2 and 120 characters.' });
      }
      if (trimmedVenue.length < VALIDATION_CONSTANTS.MIN_VENUE_LEN || trimmedVenue.length > VALIDATION_CONSTANTS.MAX_VENUE_LEN) {
        return res.status(400).json({ error: 'Venue must be between 2 and 120 characters.' });
      }
      if (trimmedDesc.length < VALIDATION_CONSTANTS.MIN_DESC_LEN || trimmedDesc.length > VALIDATION_CONSTANTS.MAX_DESC_LEN) {
        return res.status(400).json({ error: 'Description must be between 5 and 4000 characters.' });
      }

      const dateCheck = validateEventDates({
        registrationStart: String(registrationStart || ''),
        registrationEnd: String(registrationEnd || ''),
        eventStart: String(eventStart || ''),
        eventEnd: String(eventEnd || ''),
      });

      if (!dateCheck.valid) {
        return res.status(400).json({ error: dateCheck.error });
      }

      const eventId = makeId('evt');
      const now = new Date().toISOString();

      sqlite
        .prepare(
          `INSERT INTO events (
            id, creator_id, title, tag, venue, description, poster_url,
            registration_start, registration_end, event_start, event_end,
            friends_only, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          eventId,
          creatorId,
          trimmedTitle,
          trimmedTag,
          trimmedVenue,
          trimmedDesc,
          trimmedPosterUrl,
          registrationStart,
          registrationEnd,
          eventStart,
          eventEnd,
          friendsOnly ? 1 : 0,
          now,
          now
        );

      if (Array.isArray(allowedUserIds)) {
        const insertAllowed = sqlite.prepare(
          'INSERT OR IGNORE INTO event_allowed_users (event_id, user_id) VALUES (?, ?)'
        );
        for (const uid of allowedUserIds) {
          if (typeof uid === 'string' && uid.trim()) {
            insertAllowed.run(eventId, uid.trim());
          }
        }
      }

      if (Array.isArray(formFields)) {
        const insertField = sqlite.prepare(
          'INSERT INTO event_form_fields (id, event_id, field_name, field_type, options_json, is_required, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        formFields.forEach((f: any, idx: number) => {
          const fname = String(f?.fieldName || '').trim();
          const ftype =
            f?.fieldType === 'single_radio' || f?.fieldType === 'multi_radio' ? f.fieldType : 'text';
          const foptions = Array.isArray(f?.options)
            ? f.options.map((opt: any) => String(opt || '').trim()).filter(Boolean)
            : [];
          if (fname) {
            insertField.run(
              makeId('fld'),
              eventId,
              fname.slice(0, 120),
              ftype,
              JSON.stringify(foptions),
              f?.isRequired ? 1 : 0,
              idx
            );
          }
        });
      }

      // Automatically add the event creator as a registered member of the event
      const creatorAnswers = { Role: 'Event Creator / Member' };
      sqlite
        .prepare(
          `INSERT OR IGNORE INTO registrations (id, event_id, user_id, email, answers_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          `reg_creator_${eventId}`,
          eventId,
          creatorId,
          String(creator.email || ''),
          JSON.stringify(creatorAnswers),
          now
        );

      const createdEventRow = sqlite.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
      if (createdEventRow && creator.email) {
        saveRegistrationEmailRecord({
          id: `eml_creator_${eventId}`,
          eventRow: createdEventRow,
          creatorRow: creator,
          studentRow: creator,
          toEmail: String(creator.email),
          answers: creatorAnswers,
          createdAt: now,
        });
      }

      const latestNotification = createNotification(
        creatorId,
        creatorId,
        'event_created',
        `Event created: '${trimmedTitle}' at ${trimmedVenue} is now live (auto-added to My Participations).`
      );

      backupDatabaseToDisk();
      return res.json({
        ...getFullStateForUser(creatorId),
        createdEventId: eventId,
        latestNotification,
      });
    } catch (error) {
      console.error('Create event error:', error);
      return res.status(500).json({ error: 'Failed to create event.' });
    }
  });

  // 7. Cancel / Delete Event
  app.delete('/api/events/:eventId', (req, res) => {
    try {
      const { eventId } = req.params;
      const userId = String(req.query.userId || '');
      const event = sqlite.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
      if (!event) {
        return res.status(404).json({ error: 'Event not found.' });
      }
      if (event.creator_id !== userId) {
        return res.status(403).json({ error: 'Only the event creator can cancel this event.' });
      }

      const regUsers = sqlite
        .prepare('SELECT user_id FROM registrations WHERE event_id = ?')
        .all(eventId) as { user_id: string }[];

      sqlite.prepare('DELETE FROM events WHERE id = ?').run(eventId);

      for (const r of regUsers) {
        if (r.user_id !== userId) {
          createNotification(
            r.user_id,
            userId,
            'event_cancelled',
            `Event cancelled: '${event.title}' has been cancelled by the organizer.`
          );
        }
      }

      const latestNotification = createNotification(
        userId,
        userId,
        'event_cancelled',
        `You cancelled the event '${event.title}'.`
      );

      backupDatabaseToDisk();
      return res.json({
        ...getFullStateForUser(userId),
        latestNotification,
      });
    } catch (error) {
      console.error('Cancel event error:', error);
      return res.status(500).json({ error: 'Failed to cancel event.' });
    }
  });

  // 8. Participate / Register for an Event + Send Email Message with Registration, Description, Event Creator & Details
  app.post('/api/events/:eventId/register', (req, res) => {
    try {
      const { eventId } = req.params;
      const { userId, email, answers } = req.body || {};

      const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (!user) {
        return res.status(404).json({ error: 'Student profile not found.' });
      }

      const contactCheck = checkUserContactRequirements(
        { phone: String(user.phone || ''), email: String(user.email || '') },
        'participate in an event'
      );
      if (!contactCheck.valid) {
        return res.status(400).json({
          error: contactCheck.error,
          code: 'CONTACT_REQUIRED',
        });
      }

      const event = sqlite.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
      if (!event) {
        return res.status(404).json({ error: 'Event not found.' });
      }

      const creator = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(event.creator_id) as any;

      const { status, isExpired } = computeEventRuntimeStatus({
        registrationStart: event.registration_start,
        registrationEnd: event.registration_end,
        eventStart: event.event_start,
        eventEnd: event.event_end,
      });

      if (status === 'outdated' || isExpired) {
        return res.status(400).json({ error: 'Cannot register expired event.' });
      }

      const trimmedEmail = String(email || user.email || '').trim();
      if (!isValidEmail(trimmedEmail)) {
        return res.status(400).json({ error: 'Please enter a valid student email address.' });
      }

      const fields = sqlite
        .prepare('SELECT * FROM event_form_fields WHERE event_id = ? ORDER BY sort_order ASC')
        .all(eventId) as any[];

      const sanitizedAnswers: Record<string, string> = {};
      for (const f of fields) {
        const val = String((answers && answers[f.field_name]) || '').trim();
        if (f.is_required && !val) {
          return res.status(400).json({ error: `Field "${f.field_name}" is required.` });
        }
        sanitizedAnswers[f.field_name] = val;
      }

      const existingReg = sqlite
        .prepare('SELECT id FROM registrations WHERE event_id = ? AND user_id = ?')
        .get(eventId, userId) as any;

      if (existingReg) {
        return res.status(409).json({ error: 'You are already registered for this event.' });
      }

      const now = new Date().toISOString();
      const regId = makeId('reg');
      sqlite
        .prepare(
          `INSERT INTO registrations (id, event_id, user_id, email, answers_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(regId, eventId, userId, trimmedEmail, JSON.stringify(sanitizedAnswers), now);

      // Generate & store the confirmation email sent to the participant's email address
      const latestEmail = saveRegistrationEmailRecord({
        id: `eml_${regId}`,
        eventRow: event,
        creatorRow: creator || {
          name: 'Campus Organizer',
          roll_number: 'N/A',
          branch: 'cse',
          year: 3,
          phone: '',
          email: '',
        },
        studentRow: user,
        toEmail: trimmedEmail,
        answers: sanitizedAnswers,
        createdAt: now,
      });

      // Notify the event creator with name and roll number
      if (event.creator_id !== userId) {
        createNotification(
          event.creator_id,
          userId,
          'event_participated',
          `${user.name} (${user.roll_number}) registered for your event '${event.title}'.`
        );
      }

      // Notify the registered user that registration succeeded
      const latestNotification = createNotification(
        userId,
        userId,
        'event_participated',
        `You registered for '${event.title}' at ${event.venue}.`
      );

      backupDatabaseToDisk();
      return res.json({
        ...getFullStateForUser(userId),
        latestNotification,
        latestEmail,
      });
    } catch (error) {
      console.error('Register event error:', error);
      return res.status(500).json({ error: 'Failed to submit registration.' });
    }
  });

  // 9. Creator deletes a registered user from an event
  // Creator does NOT get notified; deleted participant DOES get notified saying the event creator removed them!
  app.delete('/api/events/:eventId/registrations/:targetUserId', (req, res) => {
    try {
      const { eventId, targetUserId } = req.params;
      const creatorId = String(req.query.creatorId || '');

      const event = sqlite.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
      if (!event) {
        return res.status(404).json({ error: 'Event not found.' });
      }
      if (event.creator_id !== creatorId) {
        return res.status(403).json({ error: 'Only the event creator can remove participants.' });
      }

      sqlite
        .prepare('DELETE FROM registrations WHERE event_id = ? AND user_id = ?')
        .run(eventId, targetUserId);
      sqlite
        .prepare('DELETE FROM registration_emails WHERE event_id = ? AND user_id = ?')
        .run(eventId, targetUserId);

      // Notify ONLY the removed participant, NOT the event creator
      createNotification(
        targetUserId,
        creatorId,
        'participant_removed',
        `The event creator has removed you from '${event.title}'.`
      );

      backupDatabaseToDisk();
      return res.json(getFullStateForUser(creatorId));
    } catch (error) {
      console.error('Remove participant error:', error);
      return res.status(500).json({ error: 'Failed to remove participant.' });
    }
  });

  // 10. Toggle Favourite Star on Event Card
  app.post('/api/events/:eventId/favourite', (req, res) => {
    try {
      const { eventId } = req.params;
      const { userId } = req.body || {};
      if (!userId || !eventId) {
        return res.status(400).json({ error: 'Missing userId or eventId.' });
      }

      const ignoredRow = sqlite
        .prepare(`SELECT status FROM ignored_events WHERE user_id = ? AND event_id = ?`)
        .get(userId, eventId) as { status: string } | undefined;

      if (ignoredRow && ignoredRow.status === 'ignored') {
        return res.status(400).json({ error: 'Cannot favourite an event while it is in Ignored events.' });
      }

      const existing = sqlite
        .prepare('SELECT 1 FROM favourites WHERE user_id = ? AND event_id = ?')
        .get(userId, eventId);

      if (existing) {
        sqlite
          .prepare('DELETE FROM favourites WHERE user_id = ? AND event_id = ?')
          .run(userId, eventId);
      } else {
        sqlite
          .prepare('INSERT INTO favourites (user_id, event_id, created_at) VALUES (?, ?, ?)')
          .run(userId, eventId, new Date().toISOString());
      }

      backupDatabaseToDisk();
      return res.json(getFullStateForUser(userId));
    } catch (error) {
      console.error('Toggle favourite error:', error);
      return res.status(500).json({ error: 'Failed to update favourites.' });
    }
  });

  // 11. Delete single notification
  app.delete('/api/notifications/:notificationId', (req, res) => {
    try {
      const { notificationId } = req.params;
      const userId = String(req.query.userId || '');
      sqlite
        .prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?')
        .run(notificationId, userId);
      backupDatabaseToDisk();
      return res.json(getFullStateForUser(userId));
    } catch (error) {
      console.error('Delete notification error:', error);
      return res.status(500).json({ error: 'Failed to delete notification.' });
    }
  });

  // 12. Clear all notifications
  app.delete('/api/notifications', (req, res) => {
    try {
      const userId = String(req.query.userId || '');
      sqlite.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
      backupDatabaseToDisk();
      return res.json(getFullStateForUser(userId));
    } catch (error) {
      console.error('Clear notifications error:', error);
      return res.status(500).json({ error: 'Failed to clear notifications.' });
    }
  });

  // 13. Ignore / Remove Event Card from Home Screen -> Moves to Ignored Events (auto-deleted if expired) & removes from Favourites
  app.post('/api/events/:eventId/ignore', (req, res) => {
    try {
      const { eventId } = req.params;
      const { userId } = req.body || {};
      if (!userId) {
        return res.status(400).json({ error: 'userId is required.' });
      }

      const eventRow = sqlite.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
      if (!eventRow) {
        return res.status(404).json({ error: 'Event not found.' });
      }

      const nowIso = new Date().toISOString();
      const autoCheck = shouldAutoDeleteIgnoredEvent(
        {
          registrationStart: eventRow.registration_start,
          registrationEnd: eventRow.registration_end,
          eventStart: eventRow.event_start,
          eventEnd: eventRow.event_end,
        },
        nowIso,
        Date.now()
      );

      const initialStatus = autoCheck.shouldDelete ? 'deleted' : 'ignored';

      sqlite
        .prepare('DELETE FROM favourites WHERE user_id = ? AND event_id = ?')
        .run(userId, eventId);

      sqlite
        .prepare(
          `INSERT INTO ignored_events (user_id, event_id, status, ignored_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id, event_id) DO UPDATE SET status = excluded.status, ignored_at = excluded.ignored_at`
        )
        .run(userId, eventId, initialStatus, nowIso);

      backupDatabaseToDisk();
      return res.json(getFullStateForUser(userId));
    } catch (error) {
      console.error('Ignore event error:', error);
      return res.status(500).json({ error: 'Failed to ignore event.' });
    }
  });

  // 14. Restore Event Card from Ignored Events back to Home Screen
  app.post('/api/events/:eventId/restore', (req, res) => {
    try {
      const { eventId } = req.params;
      const { userId } = req.body || {};
      if (!userId) {
        return res.status(400).json({ error: 'userId is required.' });
      }

      sqlite
        .prepare('DELETE FROM ignored_events WHERE user_id = ? AND event_id = ?')
        .run(userId, eventId);

      backupDatabaseToDisk();
      return res.json(getFullStateForUser(userId));
    } catch (error) {
      console.error('Restore ignored event error:', error);
      return res.status(500).json({ error: 'Failed to restore ignored event.' });
    }
  });

  // 15. Permanently Delete Event from Ignored Events (keeps it dismissed from Home Screen)
  app.delete('/api/events/:eventId/ignore', (req, res) => {
    try {
      const { eventId } = req.params;
      const userId = String(req.query.userId || '');
      if (!userId) {
        return res.status(400).json({ error: 'userId is required.' });
      }

      const nowIso = new Date().toISOString();
      sqlite
        .prepare(
          `INSERT INTO ignored_events (user_id, event_id, status, ignored_at)
           VALUES (?, ?, 'deleted', ?)
           ON CONFLICT(user_id, event_id) DO UPDATE SET status = 'deleted'`
        )
        .run(userId, eventId, nowIso);

      backupDatabaseToDisk();
      return res.json(getFullStateForUser(userId));
    } catch (error) {
      console.error('Delete ignored event error:', error);
      return res.status(500).json({ error: 'Failed to delete ignored event.' });
    }
  });

  // 16. Friend Chat Messages REST API (Synced with WebSocket Broadcasts)
  app.get('/api/messages', (req, res) => {
    try {
      const userId = String(req.query.userId || '').trim();
      if (!userId) {
        return res.status(400).json({ error: 'userId is required.' });
      }
      const msgRows = sqlite
        .prepare(
          `SELECT * FROM chat_messages
           WHERE sender_id = ? OR receiver_id = ?
           ORDER BY created_at ASC`
        )
        .all(userId, userId) as any[];
      const messages = msgRows.map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        receiverId: m.receiver_id,
        text: m.text || '',
        imageUrl: m.image_url || '',
        imageName: m.image_name || '',
        createdAt: m.created_at,
      }));
      return res.json({ messages });
    } catch (error) {
      console.error('Fetch messages error:', error);
      return res.status(500).json({ error: 'Failed to load chat messages.' });
    }
  });

  app.post('/api/messages', (req, res) => {
    try {
      const { senderId, receiverId, text, imageUrl, imageName } = req.body || {};
      const message = saveAndBroadcastChatMessage({
        senderId,
        receiverId,
        text,
        imageUrl,
        imageName,
      });
      return res.json({ ok: true, message });
    } catch (error: any) {
      console.error('Send message error:', error);
      return res.status(400).json({ error: error?.message || 'Failed to send message.' });
    }
  });

  // Vite dev middleware or production static serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Fest-Register server listening on http://localhost:${PORT}`);
  });
}

startServer();

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.ts';

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    return initDatabase(config.dbPath);
  }
  return dbInstance;
}

export function setDbForTesting(db: DatabaseSync): void {
  dbInstance = db;
}

export function initDatabase(dbPath: string = config.dbPath): DatabaseSync {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath, { enableForeignKeyConstraints: true });
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone TEXT NOT NULL,
      city TEXT DEFAULT 'Bengaluru',
      area TEXT DEFAULT '',
      role TEXT NOT NULL CHECK (role IN ('CUSTOMER', 'PROVIDER', 'ADMIN')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS service_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL,
      description TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      business_name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      primary_category_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      city TEXT NOT NULL,
      area TEXT NOT NULL,
      pincode TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      service_areas_json TEXT NOT NULL DEFAULT '[]',
      verified INTEGER NOT NULL DEFAULT 0,
      verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REVOKED')),
      average_rating REAL NOT NULL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      response_time TEXT NOT NULL DEFAULT 'Within 30 mins',
      response_minutes INTEGER NOT NULL DEFAULT 30,
      years_experience INTEGER NOT NULL DEFAULT 5,
      profile_image_url TEXT DEFAULT '',
      cover_image_url TEXT DEFAULT '',
      gallery_json TEXT NOT NULL DEFAULT '[]',
      profile_views INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (primary_category_id) REFERENCES service_categories(id)
    );

    CREATE TABLE IF NOT EXISTS provider_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      base_price INTEGER NOT NULL,
      price_unit TEXT NOT NULL DEFAULT 'per visit',
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES service_categories(id)
    );

    CREATE TABLE IF NOT EXISTS availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
      start_time TEXT NOT NULL DEFAULT '09:00',
      end_time TEXT NOT NULL DEFAULT '19:00',
      is_available INTEGER NOT NULL DEFAULT 1,
      slots_json TEXT NOT NULL DEFAULT '["09:00 - 11:00","11:30 - 13:30","14:30 - 16:30","17:00 - 19:00"]',
      UNIQUE(provider_id, day_of_week),
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_code TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      provider_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      scheduled_date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      property_type TEXT NOT NULL DEFAULT 'Apartment',
      address_area TEXT NOT NULL,
      pincode TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      quoted_price INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED')),
      cancellation_reason TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES provider_services(id)
    );

    CREATE TABLE IF NOT EXISTS quote_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      provider_id INTEGER NOT NULL,
      service_id INTEGER,
      preferred_date TEXT NOT NULL,
      property_type TEXT NOT NULL DEFAULT 'Apartment',
      address_area TEXT NOT NULL,
      description TEXT NOT NULL,
      estimated_budget INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'QUOTED', 'ACCEPTED', 'DECLINED')),
      quoted_amount INTEGER,
      provider_note TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES provider_services(id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      provider_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL,
      provider_reply TEXT DEFAULT '',
      replied_at TEXT DEFAULT '',
      moderation_status TEXT NOT NULL DEFAULT 'VISIBLE' CHECK (moderation_status IN ('VISIBLE', 'HIDDEN')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      provider_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(customer_id, provider_id),
      FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER,
      customer_id INTEGER NOT NULL,
      provider_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
      FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link_url TEXT DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_providers_city ON providers(city);
    CREATE INDEX IF NOT EXISTS idx_providers_category ON providers(primary_category_id);
    CREATE INDEX IF NOT EXISTS idx_providers_verified ON providers(verified);
    CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_provider ON reviews(provider_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  `);

  dbInstance = db;
  return db;
}

export function recalculateProviderRating(db: DatabaseSync, providerId: number): void {
  const row = db
    .prepare(
      `SELECT COUNT(*) as cnt, COALESCE(AVG(rating), 0) as avg_rating
       FROM reviews
       WHERE provider_id = ? AND moderation_status = 'VISIBLE'`,
    )
    .get(providerId) as { cnt: number; avg_rating: number };

  const count = Number(row?.cnt ?? 0);
  const avg = count > 0 ? Math.round(Number(row.avg_rating) * 10) / 10 : 0;

  db.prepare(`UPDATE providers SET average_rating = ?, review_count = ? WHERE id = ?`).run(
    avg,
    count,
    providerId,
  );
}

export function calculateProfileCompleteness(db: DatabaseSync, providerId: number): number {
  const provider = db.prepare(`SELECT * FROM providers WHERE id = ?`).get(providerId) as
    | Record<string, unknown>
    | undefined;
  if (!provider) return 0;

  const serviceCount = Number(
    (db.prepare(`SELECT COUNT(*) as c FROM provider_services WHERE provider_id = ? AND active = 1`).get(providerId) as {
      c: number;
    }).c,
  );
  const availCount = Number(
    (db.prepare(`SELECT COUNT(*) as c FROM availability WHERE provider_id = ? AND is_available = 1`).get(providerId) as {
      c: number;
    }).c,
  );

  let score = 20; // account + basic business name
  if (typeof provider.description === 'string' && provider.description.trim().length >= 40) score += 20;
  if (typeof provider.cover_image_url === 'string' && provider.cover_image_url.trim().length > 0) score += 15;
  if (serviceCount >= 2) score += 20;
  else if (serviceCount === 1) score += 10;
  if (availCount >= 4) score += 15;
  else if (availCount >= 1) score += 8;
  if (Number(provider.verified) === 1) score += 10;

  return Math.min(100, score);
}

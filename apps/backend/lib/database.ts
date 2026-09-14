import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbPath = process.env.DATABASE_PATH ?? process.env.DB_PATH ?? path.join(process.cwd(), "../../data/advibe.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS Event (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        brandName TEXT,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS Photo (
        id TEXT PRIMARY KEY,
        eventId TEXT NOT NULL,
        idempotencyKey TEXT NOT NULL,
        clientId TEXT NOT NULL,
        filename TEXT NOT NULL,
        thumbFilename TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        bytes INTEGER NOT NULL,
        capturedAt TEXT,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (eventId) REFERENCES Event(id) ON DELETE CASCADE,
        UNIQUE (eventId, idempotencyKey)
      );
      CREATE INDEX IF NOT EXISTS Photo_event_createdAt_idx ON Photo(eventId, createdAt);
    `);
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export interface Event {
  id: string;
  slug: string;
  name: string;
  token: string;
  brandName: string | null;
  createdAt: Date;
}

export interface Photo {
  id: string;
  eventId: string;
  idempotencyKey: string;
  clientId: string;
  filename: string;
  thumbFilename: string;
  width: number;
  height: number;
  bytes: number;
  capturedAt: Date | null;
  createdAt: Date;
}

export const database = {
  event: {
    findUnique: (opts: { where: { slug?: string; token?: string; id?: string } }): Event | null => {
      const db = getDb();
      const where = opts.where;

      let stmt;
      let param;

      if (where.slug) {
        stmt = db.prepare("SELECT * FROM Event WHERE slug = ?");
        param = where.slug;
      } else if (where.token) {
        stmt = db.prepare("SELECT * FROM Event WHERE token = ?");
        param = where.token;
      } else if (where.id) {
        stmt = db.prepare("SELECT * FROM Event WHERE id = ?");
        param = where.id;
      } else {
        return null;
      }

      const row = stmt.get(param) as any;
      if (!row) return null;

      return {
        ...row,
        createdAt: new Date(row.createdAt),
      };
    },

    create: (opts: { data: Omit<Event, "createdAt"> }): Event => {
      const db = getDb();
      const { id, slug, name, token, brandName } = opts.data;

      const stmt = db.prepare(
        "INSERT INTO Event (id, slug, name, token, brandName, createdAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
      );
      stmt.run(id, slug, name, token, brandName || null);

      return database.event.findUnique({ where: { id } })!;
    },
  },

  photo: {
    findUnique: (opts: { where: { id?: string; eventId_idempotencyKey?: { eventId: string; idempotencyKey: string } } }): Photo | null => {
      const db = getDb();
      const where = opts.where;

      let stmt;
      let params;

      if (where.id) {
        stmt = db.prepare("SELECT * FROM Photo WHERE id = ?");
        params = [where.id];
      } else if (where.eventId_idempotencyKey) {
        stmt = db.prepare("SELECT * FROM Photo WHERE eventId = ? AND idempotencyKey = ?");
        const { eventId, idempotencyKey } = where.eventId_idempotencyKey;
        params = [eventId, idempotencyKey];
      } else {
        return null;
      }

      const row = stmt.get(...params) as any;
      if (!row) return null;

      return {
        ...row,
        capturedAt: row.capturedAt ? new Date(row.capturedAt) : null,
        createdAt: new Date(row.createdAt),
      };
    },

    findMany: (opts: { where: { eventId: string }; orderBy?: { createdAt: string }; take?: number }): Photo[] => {
      const db = getDb();
      const order = opts.orderBy?.createdAt === "desc" ? "DESC" : "ASC";
      const limit = opts.take ? `LIMIT ${opts.take}` : "";
      const query = `SELECT * FROM Photo WHERE eventId = ? ORDER BY createdAt ${order} ${limit}`;
      const stmt = db.prepare(query);
      const rows = stmt.all(opts.where.eventId) as any[];

      return rows.map((row) => ({
        ...row,
        capturedAt: row.capturedAt ? new Date(row.capturedAt) : null,
        createdAt: new Date(row.createdAt),
      }));
    },

    create: (opts: { data: Omit<Photo, "createdAt"> }): Photo => {
      const db = getDb();
      const { id, eventId, idempotencyKey, clientId, filename, thumbFilename, width, height, bytes, capturedAt } = opts.data;

      const stmt = db.prepare(
        "INSERT INTO Photo (id, eventId, idempotencyKey, clientId, filename, thumbFilename, width, height, bytes, capturedAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
      );
      // better-sqlite3 solo enlaza números, textos, bigints, buffers y null: un Date
      // hace fallar el INSERT entero. La PWA manda capturedAt en todas las subidas,
      // así que aquí se guarda como texto ISO y findUnique lo vuelve a leer como Date.
      const capturedAtValue = capturedAt ? new Date(capturedAt).toISOString() : null;
      stmt.run(id, eventId, idempotencyKey, clientId, filename, thumbFilename, width, height, bytes, capturedAtValue);

      return database.photo.findUnique({ where: { id } })!;
    },

    count: (opts: { where: { eventId: string } }): number => {
      const db = getDb();
      const stmt = db.prepare("SELECT COUNT(*) as count FROM Photo WHERE eventId = ?");
      const row = stmt.get(opts.where.eventId) as any;
      return row.count;
    },
  },
};

export default database;

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "../../data/advibe.db");
let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
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
      stmt.run(id, eventId, idempotencyKey, clientId, filename, thumbFilename, width, height, bytes, capturedAt ? new Date(capturedAt).toISOString() : null);

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

import Dexie, { type Table } from "dexie";

export interface Row { id: string; createdAt: string; updatedAt: string; [k: string]: unknown }

class FixxDB extends Dexie {
  users!: Table<Row, string>; professionals!: Table<Row, string>; requests!: Table<Row, string>;
  quotes!: Table<Row, string>; jobs!: Table<Row, string>; payments!: Table<Row, string>;
  cases!: Table<Row, string>; warranties!: Table<Row, string>; notifications!: Table<Row, string>;
  messages!: Table<Row, string>; homes!: Table<Row, string>; kv!: Table<Row, string>;
  zones!: Table<Row, string>; categories!: Table<Row, string>;
  constructor() {
    super("fixx-demo");
    this.version(1).stores({
      users: "id, role", professionals: "id, zoneId", requests: "id, status", quotes: "id, requestId",
      jobs: "id, state", payments: "id, jobId, status", cases: "id, jobId", warranties: "id, jobId",
      notifications: "id, channel, createdAt", messages: "id, jobId", homes: "id", kv: "id"
    });
    this.version(2).stores({ zones: "id", categories: "id" });
  }
}
export const db = new FixxDB();

/** Wipes every table. */
export async function resetAll(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
}

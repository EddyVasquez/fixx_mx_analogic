import { db, resetAll, type Row } from "./db";
import { loadSeed } from "./seedData";
export { loadSeed };

const stamp = (x: { id: string }): Row => {
  const at = new Date().toISOString();
  return { ...x, createdAt: at, updatedAt: at };
};

export async function seed(): Promise<void> {
  const s = loadSeed();
  await db.transaction("rw", db.tables, async () => {
    await db.zones.bulkPut(s.zones.map(stamp));
    await db.categories.bulkPut(s.categories.map(stamp));
    await db.users.bulkPut(s.users.map(stamp));
    await db.professionals.bulkPut(s.professionals.map(stamp));
    await db.homes.bulkPut(s.homes.map(stamp));
    await db.kv.put(stamp({ id: "seeded" }));
  });
}
export async function ensureSeeded(): Promise<void> {
  if (!(await db.kv.get("seeded"))) await seed();
}
export async function resetDemo(): Promise<void> {
  await resetAll();
  await seed();
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.local first.");
}

const projectsFile = path.join(process.cwd(), "data", "projects.json");
let projects;

try {
  projects = JSON.parse(await readFile(projectsFile, "utf8"));
} catch (error) {
  if (error.code === "ENOENT") {
    throw new Error("No data/projects.json file was found to migrate.");
  }
  throw error;
}

if (!Array.isArray(projects)) {
  throw new Error("data/projects.json must contain a JSON array.");
}

const rows = projects.map((project) => ({
  id: project.id,
  status: project.status,
  created_at: project.createdAt,
  payload: project,
}));

if (rows.some((row) =>
  typeof row.id !== "string" ||
  !["draft", "published"].includes(row.status) ||
  typeof row.created_at !== "string" ||
  typeof row.payload.projectTitle !== "string"
)) {
  throw new Error("One or more local project records are invalid; no records were imported.");
}

if (rows.length === 0) {
  console.log("There are no local projects to migrate.");
  process.exit(0);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { error } = await supabase.from("projects").upsert(rows, { onConflict: "id" });

if (error) {
  throw new Error(`Project migration failed: ${error.message}`);
}

console.log(`Migrated ${rows.length} project(s) to Supabase.`);

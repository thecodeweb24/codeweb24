import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isProject, type Project } from "@/lib/projects";

export const runtime = "nodejs";

const projectsFile = path.join(process.cwd(), "data", "projects.json");
let mutationQueue: Promise<void> = Promise.resolve();

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function readProjects(): Promise<Project[]> {
  try {
    const contents = await readFile(projectsFile, "utf8");
    const parsed: unknown = JSON.parse(contents);
    if (!Array.isArray(parsed) || !parsed.every(isProject)) {
      throw new Error("Saved project data is invalid.");
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeProjects(projects: Project[]) {
  const folder = path.dirname(projectsFile);
  const temporaryFile = `${projectsFile}.${randomUUID()}.tmp`;
  await mkdir(folder, { recursive: true });
  await writeFile(temporaryFile, JSON.stringify(projects, null, 2), "utf8");
  await rename(temporaryFile, projectsFile);
}

async function mutateProjects<T>(
  update: (current: Project[]) => { projects: Project[]; result: T },
): Promise<T> {
  const operation = mutationQueue.then(async () => {
    const current = await readProjects();
    const { projects, result } = update(current);
    await writeProjects(projects);
    return result;
  });
  mutationQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Project operation failed.";
  const status = error instanceof ApiError ? error.status : 500;
  if (status === 500) console.error("Project API request failed.", error);
  return NextResponse.json({ error: message }, { status });
}

function validateProject(value: unknown): Project {
  if (!isProject(value)) {
    throw new ApiError("Project details are incomplete or invalid.", 400);
  }
  return value;
}

export async function GET() {
  try {
    return NextResponse.json({ projects: await readProjects() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const project = validateProject(await request.json());
    const created = await mutateProjects((current) => {
      if (current.some((item) => item.id === project.id)) {
        throw new ApiError("A project with this ID already exists.", 409);
      }
      return { projects: [project, ...current], result: project };
    });
    return NextResponse.json({ project: created }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const project = validateProject(await request.json());
    const updated = await mutateProjects((current) => {
      if (!current.some((item) => item.id === project.id)) {
        throw new ApiError("Project not found.", 404);
      }
      return {
        projects: current.map((item) => (item.id === project.id ? project : item)),
        result: project,
      };
    });
    return NextResponse.json({ project: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string") {
      throw new ApiError("A project ID is required.", 400);
    }
    const id = body.id;
    await mutateProjects((current) => {
      if (!current.some((item) => item.id === id)) {
        throw new ApiError("Project not found.", 404);
      }
      return { projects: current.filter((item) => item.id !== id), result: undefined };
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

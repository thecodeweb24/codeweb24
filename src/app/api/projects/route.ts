import { NextResponse } from "next/server";
import { isProject, type Project } from "@/lib/projects";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

type ProjectRow = {
  id: string;
  status: Project["status"];
  created_at: string;
  payload: unknown;
};

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("Project API request failed.", error);
  const message =
    error instanceof Error && error.message.includes("Supabase is not configured")
      ? error.message
      : "Project database request failed. Check the Supabase connection and table setup.";
  return NextResponse.json({ error: message }, { status: 500 });
}

function validateProject(value: unknown): Project {
  if (!isProject(value)) {
    throw new ApiError("Project details are incomplete or invalid.", 400);
  }
  return value;
}

function projectFromRow(row: ProjectRow): Project {
  const project = row.payload;
  if (!isProject(project) || project.id !== row.id) {
    throw new Error(`Project record "${row.id}" is malformed in Supabase.`);
  }
  return project;
}

const toRow = (project: Project) => ({
  id: project.id,
  status: project.status,
  created_at: project.createdAt,
  payload: project,
});

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from("projects")
      .select("id,status,created_at,payload")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({
      projects: (data as ProjectRow[]).map(projectFromRow),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const project = validateProject(await request.json());
    const { data, error } = await getSupabase()
      .from("projects")
      .insert(toRow(project))
      .select("id,status,created_at,payload")
      .single();

    if (error) {
      if (error.code === "23505") throw new ApiError("A project with this ID already exists.", 409);
      throw error;
    }
    return NextResponse.json({ project: projectFromRow(data as ProjectRow) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const project = validateProject(await request.json());
    const { data, error } = await getSupabase()
      .from("projects")
      .update(toRow(project))
      .eq("id", project.id)
      .select("id,status,created_at,payload")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new ApiError("Project not found.", 404);
    return NextResponse.json({ project: projectFromRow(data as ProjectRow) });
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

    const { data, error } = await getSupabase()
      .from("projects")
      .delete()
      .eq("id", body.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new ApiError("Project not found.", 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

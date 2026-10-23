'use client';

import { useEffect, useMemo, useState } from "react";
import type { Project, ProjectForm } from "@/lib/projects";

type LogoCandidate = {
  url: string;
  source: string;
  score: number;
  width?: number;
  height?: number;
  alt?: string;
};

type ImportResult = {
  websiteTitle: string;
  companyName: string;
  description: string;
  url: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterImage?: string;
  favicon?: string;
  themeColor?: string;
  category?: string;
  businessSummary?: string;
  services?: string[];
  logoCandidates: LogoCandidate[];
  screenshotUrl: string;
  siteImages: string[];
  warnings: string[];
};

const fieldStyle =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const initialForm = {
  projectTitle: "",
  clientCompany: "",
  websiteUrl: "https://example.com",
  shortDescription: "",
  fullDescription: "",
  liveDemoUrl: "",
  projectCoverImage: "",
  companyLogo: "",
  technologies: "",
  category: "",
};

export default function Home() {
  const [websiteUrl, setWebsiteUrl] = useState("https://example.com");
  const [loading, setLoading] = useState(false);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [actionMessage, setActionMessage] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<"projects" | "form">("projects");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadProjects = async () => {
      try {
        const response = await fetch("/api/projects");
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load projects.");
        }
        if (!Array.isArray(payload.projects)) {
          throw new Error("The project service returned invalid data.");
        }
        if (active) setProjects(payload.projects as Project[]);
      } catch (error) {
        console.error("Unable to load projects.", error);
        if (active) {
          setActionMessage(error instanceof Error ? error.message : "Unable to load projects.");
        }
      } finally {
        if (active) setProjectsLoading(false);
      }
    };

    void loadProjects();
    return () => {
      active = false;
    };
  }, []);

  const persistProject = async (project: Project, method: "POST" | "PUT") => {
    try {
      const response = await fetch("/api/projects", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save the project.");
      }
      setProjects((current) =>
        method === "POST"
          ? [payload.project as Project, ...current]
          : current.map((item) => (item.id === project.id ? (payload.project as Project) : item)),
      );
      return true;
    } catch (error) {
      console.error("Unable to save projects.", error);
      setActionMessage(error instanceof Error ? error.message : "Project changes could not be saved.");
      return false;
    }
  };

  const logoCandidates = useMemo(
    () => result?.logoCandidates ?? [],
    [result],
  );

  const updateForm = (key: keyof ProjectForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const applyImportedData = (data: ImportResult) => {
    const title = data.websiteTitle || data.companyName || "New Project";
    setForm((current) => ({
      ...current,
      projectTitle: title,
      clientCompany: data.companyName || current.clientCompany,
      websiteUrl: data.url,
      shortDescription: data.businessSummary || data.description || current.shortDescription,
      fullDescription: data.businessSummary || data.description || current.fullDescription,
      liveDemoUrl: data.url,
      projectCoverImage: data.screenshotUrl,
      companyLogo: data.logoCandidates[0]?.url || current.companyLogo,
      category: data.category || current.category,
    }));

    setSelectedLogo(data.logoCandidates[0]?.url || null);
    setResult(data);
    setActionMessage("Website details loaded. Review the imported content before publishing.");
  };

  const fetchWebsiteDetails = async (urlToFetch = websiteUrl) => {
    if (!urlToFetch.trim()) {
      setActionMessage("Please add a valid website URL to begin the import.");
      return;
    }

    setLoading(true);
    setActionMessage("");
    setStatusMessages(["Connecting to website..."]);

    try {
      const response = await fetch("/api/import-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: urlToFetch }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "The website could not be analyzed.");
      }

      setStatusMessages(payload.statusMessages || ["Reading website information..."]);
      applyImportedData(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch website details.";
      setActionMessage(message);
      setStatusMessages(["Website import failed."]);
    } finally {
      setLoading(false);
    }
  };

  const refreshWebsiteDetails = () => {
    if (form.websiteUrl && form.websiteUrl !== "https://example.com") {
      setWebsiteUrl(form.websiteUrl);
      fetchWebsiteDetails(form.websiteUrl);
    }
  };

  const startNewProject = () => {
    setForm(initialForm);
    setWebsiteUrl("https://example.com");
    setResult(null);
    setSelectedLogo(null);
    setEditingProjectId(null);
    setActionMessage("");
    setCurrentView("form");
  };

  const editProject = (project: Project) => {
    const projectForm: ProjectForm = {
      projectTitle: project.projectTitle,
      clientCompany: project.clientCompany,
      websiteUrl: project.websiteUrl,
      shortDescription: project.shortDescription,
      fullDescription: project.fullDescription,
      liveDemoUrl: project.liveDemoUrl,
      projectCoverImage: project.projectCoverImage,
      companyLogo: project.companyLogo,
      technologies: project.technologies,
      category: project.category,
    };
    setForm(projectForm);
    setWebsiteUrl(project.websiteUrl || "https://example.com");
    setResult(null);
    setSelectedLogo(null);
    setEditingProjectId(project.id);
    setActionMessage("");
    setCurrentView("form");
  };

  const deleteProject = async (project: Project) => {
    if (!window.confirm(`Delete "${project.projectTitle}"? This cannot be undone.`)) return;
    try {
      const response = await fetch("/api/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to delete the project.");
      }
      setProjects((current) => current.filter((item) => item.id !== project.id));
    } catch (error) {
      console.error("Unable to delete project.", error);
      setActionMessage(error instanceof Error ? error.message : "Unable to delete the project.");
      return;
    }
    setActionMessage(`"${project.projectTitle}" was deleted.`);
  };

  const saveProject = async (mode: "draft" | "publish") => {
    if (!form.projectTitle.trim()) {
      setActionMessage("Add a project title before saving.");
      return;
    }

    const now = new Date().toISOString();
    const existing = projects.find((project) => project.id === editingProjectId);
    const project: Project = {
      ...form,
      projectTitle: form.projectTitle.trim(),
      id: editingProjectId || crypto.randomUUID(),
      status: mode === "publish" ? "published" : "draft",
      createdAt: existing?.createdAt || now,
    };

    const saved = await persistProject(project, editingProjectId ? "PUT" : "POST");
    if (!saved) return;

    setCurrentView("projects");
    setActionMessage(
      mode === "draft"
        ? "Project saved as a draft. Publish it when it is ready to appear on the website."
        : "Project published and added to the projects page.",
    );
    setEditingProjectId(null);
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">CODEWEB24</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                {currentView === "projects" ? "Projects" : editingProjectId ? "Edit Project" : "Add Project"}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentView("projects")}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${currentView === "projects" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Projects ({projects.length})
              </button>
              <button
                type="button"
                onClick={startNewProject}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Add Project
              </button>
            </div>
          </div>
        </header>

        {currentView === "projects" ? (
          <section className="space-y-5">
            {actionMessage && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">{actionMessage}</div>
            )}
            {projectsLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
                <h2 className="text-xl font-semibold">No projects yet</h2>
                <p className="mt-2 text-sm text-slate-500">Add a project to display it on the CODEWEB24 projects page.</p>
                <button
                  type="button"
                  onClick={startNewProject}
                  className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
                >
                  Add your first project
                </button>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {projects.map((project) => (
                  <article key={project.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {project.projectCoverImage ? (
                      <img src={project.projectCoverImage} alt={`${project.projectTitle} preview`} className="h-52 w-full bg-slate-100 object-cover" />
                    ) : (
                      <div className="flex h-52 items-center justify-center bg-slate-100 text-sm text-slate-400">No project preview</div>
                    )}
                    <div className="space-y-3 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-lg font-semibold">{project.projectTitle}</h2>
                          {project.clientCompany && <p className="mt-1 text-sm text-slate-500">{project.clientCompany}</p>}
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${project.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {project.status === "published" ? "Published" : "Draft"}
                        </span>
                      </div>
                      <p className="line-clamp-3 min-h-14 text-sm leading-6 text-slate-600">
                        {project.shortDescription || project.fullDescription || "No description added."}
                      </p>
                      {project.category && <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{project.category}</p>}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        {project.liveDemoUrl ? (
                          <a href={project.liveDemoUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-700 hover:underline">
                            View website ↗
                          </a>
                        ) : <span />}
                        <div className="flex gap-2">
                          <button type="button" onClick={() => editProject(project)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
                            Edit
                          </button>
                          <button type="button" onClick={() => deleteProject(project)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Import Project from Website</h2>
              <p className="mt-1 text-sm text-slate-500">Fetch website metadata, logo candidates, and a preview screenshot automatically.</p>
            </div>
            {result && (
              <button
                type="button"
                onClick={refreshWebsiteDetails}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Refresh Website Data
              </button>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <input
              aria-label="Website URL"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://example.com"
              className={`${fieldStyle} md:flex-1`}
            />
            <button
              type="button"
              onClick={() => fetchWebsiteDetails()}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {loading ? "Importing..." : "Fetch Website Details"}
            </button>
          </div>

          {loading && (
            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="inline-flex h-3 w-3 animate-pulse rounded-full bg-blue-600" />
                <span className="text-sm font-medium text-blue-700">Import in progress</span>
              </div>
              <ul className="space-y-2 text-sm text-blue-800">
                {statusMessages.map((message) => (
                  <li key={message}>• {message}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {result && (
          <section className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold">Website Preview</h3>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">Auto extracted</span>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <img
                  src={result.screenshotUrl}
                  alt={result.websiteTitle}
                  className="h-64 w-full object-cover"
                />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Website title</p>
                  <p className="mt-1 font-medium text-slate-900">{result.websiteTitle}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Company name</p>
                  <p className="mt-1 font-medium text-slate-900">{result.companyName}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Detected description</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{result.businessSummary || result.description || "No description could be identified from the website metadata."}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Submitted URL</p>
                  <p className="mt-1 text-sm text-slate-700">{result.url}</p>
                </div>
              </div>
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Detected logo</h3>
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Review</span>
              </div>

              {logoCandidates.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {logoCandidates.map((logo) => (
                    <button
                      key={`${logo.url}-${logo.source}`}
                      type="button"
                      onClick={() => {
                        setSelectedLogo(logo.url);
                        updateForm("companyLogo", logo.url);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                        selectedLogo === logo.url
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      <img src={logo.url} alt={logo.alt || "Logo candidate"} className="h-12 w-12 rounded-lg object-contain bg-white p-1" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">{logo.source}</div>
                        <div className="text-xs text-slate-500">Score {logo.score}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  No suitable logo found. Please select an image or upload the company logo.
                </div>
              )}

              {result.siteImages.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Available images</h4>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.siteImages.slice(0, 6).map((image) => (
                      <img
                        key={image}
                        src={image}
                        alt="Available gallery image"
                        className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Project Details</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Project title</span>
                <input value={form.projectTitle} onChange={(e) => updateForm("projectTitle", e.target.value)} className={fieldStyle} />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Client / company name</span>
                <input value={form.clientCompany} onChange={(e) => updateForm("clientCompany", e.target.value)} className={fieldStyle} />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Category</span>
                <input value={form.category} onChange={(e) => updateForm("category", e.target.value)} className={fieldStyle} />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Project URL</span>
                <input value={form.websiteUrl} onChange={(e) => updateForm("websiteUrl", e.target.value)} className={fieldStyle} />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Short description</span>
                <textarea value={form.shortDescription} onChange={(e) => updateForm("shortDescription", e.target.value)} rows={3} className={fieldStyle} />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Full description</span>
                <textarea value={form.fullDescription} onChange={(e) => updateForm("fullDescription", e.target.value)} rows={5} className={fieldStyle} />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Live demo URL</span>
                <input value={form.liveDemoUrl} onChange={(e) => updateForm("liveDemoUrl", e.target.value)} className={fieldStyle} />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Technologies</span>
                <input value={form.technologies} onChange={(e) => updateForm("technologies", e.target.value)} className={fieldStyle} placeholder="React, Next.js, Tailwind" />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Project cover image</span>
                <input value={form.projectCoverImage} onChange={(e) => updateForm("projectCoverImage", e.target.value)} className={fieldStyle} />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Company logo</span>
                <input value={form.companyLogo} onChange={(e) => updateForm("companyLogo", e.target.value)} className={fieldStyle} />
              </label>
            </div>
          </div>

          <aside className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h3 className="text-xl font-semibold">Import review</h3>
              <p className="mt-2 text-sm text-slate-600">Publishing adds this project to the projects page immediately. No account or approval step is required.</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Detected summary</div>
              <div className="space-y-2 text-sm text-slate-700">
                <p>Website title: {result?.websiteTitle || "Not available"}</p>
                <p>Company name: {result?.companyName || "Not available"}</p>
                <p>Category: {result?.category || "Not identified"}</p>
                <p>Live website link: {result?.url || "Not available"}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => saveProject("draft")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Save as Draft</button>
              <button type="button" onClick={() => saveProject("publish")} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
                {editingProjectId ? "Save Changes" : "Publish Project"}
              </button>
            </div>

            {actionMessage && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">{actionMessage}</div>
            )}

            {result?.warnings?.length ? (
              <ul className="space-y-2 text-sm text-amber-700">
                {result.warnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            ) : null}
          </aside>
        </section>
          </>
        )}
      </div>
    </main>
  );
}

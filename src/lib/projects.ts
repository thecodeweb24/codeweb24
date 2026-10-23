export type ProjectForm = {
  projectTitle: string;
  clientCompany: string;
  websiteUrl: string;
  shortDescription: string;
  fullDescription: string;
  liveDemoUrl: string;
  projectCoverImage: string;
  companyLogo: string;
  technologies: string;
  category: string;
};

export type Project = ProjectForm & {
  id: string;
  status: "draft" | "published";
  createdAt: string;
};

export const isProject = (value: unknown): value is Project => {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<Project>;
  const isWebUrl = (input: unknown) => {
    if (typeof input !== "string" || input === "") return input === "";
    try {
      const url = new URL(input);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  return (
    typeof project.id === "string" &&
    typeof project.projectTitle === "string" &&
    typeof project.clientCompany === "string" &&
    isWebUrl(project.websiteUrl) &&
    typeof project.shortDescription === "string" &&
    typeof project.fullDescription === "string" &&
    isWebUrl(project.liveDemoUrl) &&
    isWebUrl(project.projectCoverImage) &&
    isWebUrl(project.companyLogo) &&
    typeof project.technologies === "string" &&
    typeof project.category === "string" &&
    (project.status === "draft" || project.status === "published") &&
    typeof project.createdAt === "string"
  );
};

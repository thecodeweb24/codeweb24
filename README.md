# CODEWEB24 Projects Portal

The homepage is the public projects page. No login is required to add, edit, publish, save as a draft, or delete projects. Published projects appear in the listing; drafts are marked separately.

## Run locally

```bash
npm install
npm run dev -- --webpack
```

Open [http://localhost:3000](http://localhost:3000).

## Project storage and access

Projects are stored by the Node.js API in `data/projects.json`, so they remain available across browsers and server restarts when the host provides persistent writable storage. Back up this file. Hosts with ephemeral or read-only filesystems need a persistent database or mounted volume instead.

The project-management API intentionally has no authentication to match the requested workflow. Anyone who can access the site can create, edit, publish, or delete projects. Restrict network access or add authentication before exposing the portal to the public internet.

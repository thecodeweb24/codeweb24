# CODEWEB24 Projects Portal

The homepage is the public projects page. No login is required to add, edit, publish, save as a draft, or delete projects. Published projects appear in the listing; drafts are marked separately.

## Run locally

```bash
npm install
npm run dev -- --webpack
```

Open [http://localhost:3000](http://localhost:3000).

## Connect Supabase

1. In your Supabase organization, create a **project** and wait for provisioning to finish.
2. In the project dashboard, open **SQL Editor**, paste and run [`supabase/schema.sql`](./supabase/schema.sql).
3. Open **Project Settings → API Keys**. Copy the Project URL and the `Publishable key` (or legacy `anon` key).
4. In this folder, make `.env.local` by copying `env.example`, then replace the example values:

   ```powershell
   Copy-Item env.example .env.local
   ```

   Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Do not use or share a `service_role` or secret key.
5. Restart the development server:

   ```powershell
   npm run dev -- --webpack
   ```

The app stores project data in Supabase. The old local `data/projects.json` file is not automatically imported; use Supabase SQL Editor to migrate any projects you want to keep.

To migrate local project records after configuring `.env.local` and creating the table, run:

```powershell
npm run migrate:projects
```

The migration uses each project's ID, so rerunning it updates existing matching records rather than duplicating them.

### Access warning

To meet the no-login requirement, `supabase/schema.sql` permits anonymous visitors to read, create, edit, and delete every project. Anyone who can reach the site can modify the portfolio. Do not use these public write policies on a public production site unless that behavior is intentional. For production, restrict write access with Supabase Auth and narrower RLS policies.

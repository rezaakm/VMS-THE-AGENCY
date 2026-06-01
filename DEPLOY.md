# Deploy The Agency (Cost Sheet Maker + Quotation Flow)

You want one thing: an actual app that runs on its own.

After this deploy:
- You open a URL in your browser.
- No PowerShell windows.
- No local servers.
- The full Cost Sheet maker (with inline editing, Quick Add, History Suggest + variance) → big "Finish & Create Quotation" button that uses your templates.

---

## Step-by-step (Production)

### 1. Deploy the Backend (API)

1. Go to [Railway](https://railway.app)
2. Create a new project → Deploy from GitHub.
3. Point it at this folder: `artifacts/api-server` (or the whole monorepo and set the root to that folder).
4. Railway will use the `Dockerfile` that already exists in that folder.
5. Add one environment variable:
   - `DATABASE_URL` = your Supabase connection string (the same one you use for VMS)
6. Deploy.

When it's done, copy the URL. It will look like:
`https://your-app-name.railway.app`

Test it works: go to `https://your-app-name.railway.app/api/health`

### 2. Deploy the Frontend (The actual app with the Cost Sheet Maker)

1. Go to [Vercel](https://vercel.com)
2. Import the folder: `Creative-Agency-Only/Quotation-Wizard-Ready`
3. Vercel should detect it as a Vite project.
4. **Add this Environment Variable** (very important):
   - Name: `VITE_API_URL`
   - Value: `https://your-app-name.railway.app/api`   ← use the Railway URL from step 1
5. Deploy.

When it's done, you will get a URL like:
`https://your-project.vercel.app`

### 3. Open the app

Just go to:
`https://your-project.vercel.app/cost-sheets`

That's it.

- Create a new Cost Sheet
- Add items (use Quick Add or inline editing)
- Use the History Suggest (once you import some real data)
- Hit the big button: **"Finish Cost Sheet & Create Quotation / Estimate"**

### 4. (Optional but recommended) Load your real data

Run this once from your machine (it talks to the live database):

```powershell
cd "D:\Users\reza\Desktop\Quotation-Wizard\Quotation-Wizard"
pnpm import:accountant -- --drive-folder-id "YOUR_GOOGLE_DRIVE_FOLDER_ID"
```

This loads your actual cost sheets from Google Drive into the live app so the History Suggest shows real prices + variance.

---

## After this, you never need PowerShell again for normal use.

You just open the Vercel URL in any browser, on any device, from anywhere.

The only time you would run PowerShell is if you want to import more data from your Google Drive later.

---

If you hit any error during deploy, copy the exact error message here and I'll fix it immediately.
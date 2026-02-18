# Deploy to Vercel with GitHub CI/CD

## Step 1: Push to GitHub

```bash
cd "c:\Users\kavinda_d\Documents\travler company projects\369-website"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## Step 2: Setup Vercel

1. Go to https://vercel.com/signup
2. Sign up with GitHub
3. Click "Add New Project"
4. Import your GitHub repository
5. Configure:
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`

## Step 3: Add Environment Variables in Vercel

Go to Project Settings → Environment Variables and add:

```
DATABASE_URL=mysql://user:password@host:3306/database
JWT_SECRET=your-secret-key-here
ENCRYPTION_KEY=your-32-character-key
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## Step 4: Setup Database (Choose one)

### Option A: PlanetScale (Free MySQL)
1. Go to https://planetscale.com
2. Create database
3. Copy connection string
4. Add to Vercel env vars

### Option B: Railway (Free tier)
1. Go to https://railway.app
2. Create MySQL database
3. Copy connection string
4. Add to Vercel env vars

## Step 5: Setup GitHub Secrets (for CI/CD)

Go to GitHub repo → Settings → Secrets → Actions:

1. Get Vercel Token: https://vercel.com/account/tokens
2. Get Org ID & Project ID:
   ```bash
   npm i -g vercel
   vercel login
   vercel link
   cat .vercel/project.json
   ```

Add these secrets:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `DATABASE_URL`
- `JWT_SECRET`
- `ENCRYPTION_KEY`

## Step 6: Deploy

Push to main branch:
```bash
git add .
git commit -m "Deploy"
git push
```

Vercel will auto-deploy on every push!

## Quick Deploy (Without CI/CD)

```bash
npm i -g vercel
vercel login
vercel --prod
```

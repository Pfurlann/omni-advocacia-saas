# Projeto Renda Passiva — Advocacia (OMNI)

Aplicação SaaS em Next.js na pasta `saas/`.

## GitHub

Repositório: [github.com/Pfurlann/omni-advocacia-saas](https://github.com/Pfurlann/omni-advocacia-saas)

## Vercel

1. **Importar** o repositório em [vercel.com/new](https://vercel.com/new) (ou ligar o Git ao projeto já criado pela CLI).
2. **Root Directory:** `saas` (a app Next.js está nesta pasta). O ficheiro `vercel.json` na **raiz do repositório** fixa isso; confirma também em *Settings → General → Root Directory* se importaste o projeto à mão.
3. **Environment Variables:** copia de `saas/.env.local` (ou do `.env.example`) para **Production** e **Preview**:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **`SUPABASE_SERVICE_ROLE_KEY`** (secret *service_role* do Supabase — **não** a anon) — necessária para `/api/escritorio/membros`, Google Calendar (refresh de token) e cron.
   - **Google Calendar:** `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` — e no [Google Cloud Console](https://console.cloud.google.com/) OAuth, redirect autorizado: `https://<teu-projeto>.vercel.app/api/google-calendar/callback` (e o teu domínio em produção).
   - Resend, ZapSign, etc. conforme usares.
4. **Domínio:** após o primeiro deploy, em *Settings → Domains* podes apontar o teu domínio.
5. **Redirect Supabase / Auth:** em Supabase, adiciona `https://<teu-dominio-vercel>.vercel.app/auth/callback` (e produção final) em *Authentication → URL configuration*.

## Desenvolvimento local

```bash
cd saas && npm install && npm run dev
```

O servidor usa a porta **3001** (`package.json`).

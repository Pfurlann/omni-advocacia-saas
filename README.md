# Projeto Renda Passiva — Advocacia (OMNI)

Aplicação SaaS em Next.js na pasta `saas/`.

## GitHub

Repositório: [github.com/Pfurlann/omni-advocacia-saas](https://github.com/Pfurlann/omni-advocacia-saas)

## Vercel

1. **Importar** o repositório em [vercel.com/new](https://vercel.com/new) (ou ligar o Git ao projeto já criado pela CLI).
2. **Root Directory:** `saas` (a app Next.js está dentro desta pasta).
3. **Environment Variables** (mínimo para o *build* e a app): copiar de `saas/.env.local` ou de `saas/.env.example` — pelo menos:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (APIs e cron no servidor)  
   As restantes (Resend, Google, ZapSign, etc.) conforme fores a usar as integrações.
4. **Domínio:** após o primeiro deploy, em *Settings → Domains* podes apontar o teu domínio.
5. **Redirect Supabase / Auth:** em Supabase, adiciona `https://<teu-dominio-vercel>.vercel.app/auth/callback` (e produção final) em *Authentication → URL configuration*.

O deploy pela CLI com `npx vercel` falha o *build* no ambiente remoto se estas variáveis **não** estiverem definidas no projeto Vercel (o prerender de páginas com dados precisa do cliente Supabase).

## Desenvolvimento local

```bash
cd saas && npm install && npm run dev
```

O servidor usa a porta **3001** (`package.json`).

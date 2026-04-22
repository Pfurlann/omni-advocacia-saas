#!/bin/bash
# LexFlow — Setup inicial
# Execute este script na raiz da pasta saas/ após abrir o terminal no Cursor

echo "🚀 Instalando dependências..."
npm install

echo ""
echo "📝 Configurando variáveis de ambiente..."
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "✅ .env.local criado. Preencha com suas chaves do Supabase."
fi

echo ""
echo "📦 Gerando tipos TypeScript do Supabase (opcional, requer supabase CLI)..."
# npx supabase gen types typescript --project-id SEU_PROJECT_ID > src/types/supabase.ts

echo ""
echo "✅ Setup concluído!"
echo ""
echo "Próximos passos:"
echo "  1. Abra .env.local e preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "  2. Copie o conteúdo de supabase/migrations/001_initial_schema.sql"
echo "     e execute no SQL Editor do seu projeto Supabase"
echo "  3. npm run dev"
echo ""
echo "Abrindo no Cursor..."
cursor .

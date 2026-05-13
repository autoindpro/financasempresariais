# Finanças Empresariais (Finance OS)

## Rodar localmente

```powershell
npm install
npm run dev
```

## Usar Supabase como banco

### 1) Criar projeto no Supabase e aplicar o schema

- Use o arquivo `supabase/supabase-schema.sql`
- No Supabase: **SQL Editor** → cole/execute o conteúdo do `supabase/supabase-schema.sql`

### Administrador (menu "Administrador")

Para habilitar o menu e a rota `/admin` (visão global), adicione o seu usuário na tabela `public.app_admins`:

```sql
insert into public.app_admins (user_id) values ('SEU_USER_ID_UUID');
```

O `user_id` é o UUID do usuário em **Authentication → Users**.

### 2) Configurar variáveis de ambiente

Crie `.env.local` na raiz (use `.env.example` como base):

```env
VITE_SUPABASE_URL="https://xxxx.supabase.co"
VITE_SUPABASE_ANON_KEY="sua_anon_key"
VITE_SITE_URL="https://dre.fluxsolucoes.com.br"
```

### 3) Instalar dependência do Supabase

```powershell
npm install
```

### 4) Login e sincronização

- Abra `Configurações` → **Supabase (Banco de Dados)**
- Crie conta / faça login (email/senha)
- Crie uma empresa no Supabase (usa os dados da tela **Empresa**) ou selecione uma existente
- Use **Enviar (push)** para mandar os dados locais para o Supabase
- Use **Baixar (pull)** para trazer os dados do Supabase para o app

> Observação: a sincronização aqui é manual (push/pull) para acelerar a integração inicial.

create type public.app_role as enum ('admin', 'moderator', 'user');

create table public.user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    role public.app_role not null,
    unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

create table public.broker_symbol_uploads (
    id uuid primary key default gen_random_uuid(),
    filename text,
    source text,
    symbol_count integer not null default 0,
    mapped_count integer not null default 0,
    unmapped_count integer not null default 0,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
);

grant select, insert on public.broker_symbol_uploads to authenticated;
grant all on public.broker_symbol_uploads to service_role;

alter table public.broker_symbol_uploads enable row level security;

create policy "Admins can manage broker symbol uploads"
on public.broker_symbol_uploads
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create table public.broker_symbols (
    id uuid primary key default gen_random_uuid(),
    upload_id uuid not null references public.broker_symbol_uploads(id) on delete cascade,
    broker_symbol text not null,
    description text,
    path text,
    currency_profit text,
    trade_mode text,
    normalized_base text,
    mapped_app_ticker text,
    mapping_status text not null default 'unmapped',
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
);

grant select, insert, update on public.broker_symbols to authenticated;
grant all on public.broker_symbols to service_role;

alter table public.broker_symbols enable row level security;

create policy "Admins can manage broker symbols"
on public.broker_symbols
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create trigger update_broker_symbol_uploads_updated_at before update on public.broker_symbol_uploads for each row execute function public.update_updated_at_column();
create trigger update_broker_symbols_updated_at before update on public.broker_symbols for each row execute function public.update_updated_at_column();
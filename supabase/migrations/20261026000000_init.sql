-- Remember: items + settings, private per user via Row Level Security.

create table public.items (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('reminder','date','event','promise','idea')),
  title text not null,
  date date not null,
  time time,
  notes text,
  whose text check (whose in ('partner','me','us')),
  date_type text,
  yearly boolean not null default false,
  lead_days int[] not null default '{0}',
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index items_user_idx on public.items (user_id, date);

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  partner_name text not null default '',
  hide_previews boolean not null default false,
  default_time time not null default '09:00',
  timezone text not null default 'UTC',
  updated_at timestamptz not null default now()
);

alter table public.items enable row level security;
alter table public.settings enable row level security;

create policy "own items" on public.items for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own settings" on public.settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger items_touch before update on public.items for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();

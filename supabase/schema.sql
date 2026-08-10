-- Lucky Draw Pro cross-device public display schema.
-- Run this once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.draw_rooms (
  room_id uuid primary key,
  write_key_hash bytea not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create table if not exists public.draw_public_states (
  room_id uuid primary key references public.draw_rooms(room_id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.draw_rooms enable row level security;
alter table public.draw_public_states enable row level security;

revoke all on table public.draw_rooms from anon, authenticated;
revoke all on table public.draw_public_states from anon, authenticated;
grant select on table public.draw_public_states to anon, authenticated;

drop policy if exists "Read active public draw states" on public.draw_public_states;
create policy "Read active public draw states"
on public.draw_public_states
for select
to anon, authenticated
using (expires_at > now());

create or replace function public.create_draw_room(p_room_id uuid, p_write_key text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  supplied_hash bytea;
begin
  if p_write_key is null or length(p_write_key) < 64 then
    raise exception 'Invalid room credentials';
  end if;

  supplied_hash := digest(p_write_key, 'sha256');

  insert into public.draw_rooms (room_id, write_key_hash)
  values (p_room_id, supplied_hash)
  on conflict (room_id) do nothing;

  if not exists (
    select 1
    from public.draw_rooms
    where room_id = p_room_id
      and write_key_hash = supplied_hash
      and expires_at > now()
  ) then
    raise exception 'Room credentials were rejected';
  end if;
end;
$$;

create or replace function public.publish_draw_state(p_room_id uuid, p_write_key text, p_state jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  room_expiry timestamptz;
begin
  if p_state is null or octet_length(p_state::text) > 750000 then
    raise exception 'Public draw state is missing or too large';
  end if;

  select expires_at into room_expiry
  from public.draw_rooms
  where room_id = p_room_id
    and write_key_hash = digest(p_write_key, 'sha256')
    and expires_at > now()
  for update;

  if room_expiry is null then
    raise exception 'Room credentials were rejected';
  end if;

  insert into public.draw_public_states (room_id, state, updated_at, expires_at)
  values (p_room_id, p_state, now(), room_expiry)
  on conflict (room_id) do update
  set state = excluded.state,
      updated_at = excluded.updated_at,
      expires_at = excluded.expires_at;
end;
$$;

create or replace function public.close_draw_room(p_room_id uuid, p_write_key text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.draw_rooms
  set expires_at = now()
  where room_id = p_room_id
    and write_key_hash = digest(p_write_key, 'sha256');

  if not found then
    raise exception 'Room credentials were rejected';
  end if;

  delete from public.draw_public_states
  where room_id = p_room_id;
end;
$$;

revoke all on function public.create_draw_room(uuid, text) from public;
revoke all on function public.publish_draw_state(uuid, text, jsonb) from public;
revoke all on function public.close_draw_room(uuid, text) from public;
grant execute on function public.create_draw_room(uuid, text) to anon, authenticated;
grant execute on function public.publish_draw_state(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.close_draw_room(uuid, text) to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'draw_public_states'
  ) then
    alter publication supabase_realtime add table public.draw_public_states;
  end if;
end;
$$;

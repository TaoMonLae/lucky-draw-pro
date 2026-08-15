-- Lucky Draw Pro cross-device public display schema.
-- Run this once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.draw_rooms (
  room_id uuid primary key,
  write_key_hash bytea not null,
  remote_key_hash bytea,
  last_remote_request_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

alter table public.draw_rooms add column if not exists remote_key_hash bytea;
alter table public.draw_rooms add column if not exists last_remote_request_at timestamptz;

create table if not exists public.draw_public_states (
  room_id uuid primary key references public.draw_rooms(room_id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.draw_remote_commands (
  command_id uuid primary key,
  room_id uuid not null references public.draw_rooms(room_id) on delete cascade,
  command text not null check (command = 'draw'),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists draw_remote_commands_room_requested_idx
on public.draw_remote_commands (room_id, requested_at);

alter table public.draw_rooms enable row level security;
alter table public.draw_public_states enable row level security;
alter table public.draw_remote_commands enable row level security;

revoke all on table public.draw_rooms from anon, authenticated;
revoke all on table public.draw_public_states from anon, authenticated;
revoke all on table public.draw_remote_commands from anon, authenticated;
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

create or replace function public.enable_draw_remote_control(
  p_room_id uuid,
  p_write_key text,
  p_remote_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_remote_key is null or length(p_remote_key) < 64 then
    raise exception 'Invalid remote control credentials';
  end if;

  update public.draw_rooms
  set remote_key_hash = extensions.digest(p_remote_key, 'sha256'),
      last_remote_request_at = null
  where room_id = p_room_id
    and write_key_hash = extensions.digest(p_write_key, 'sha256')
    and expires_at > now();

  if not found then
    raise exception 'Room credentials were rejected';
  end if;

  delete from public.draw_remote_commands where room_id = p_room_id;
end;
$$;

create or replace function public.disable_draw_remote_control(
  p_room_id uuid,
  p_write_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.draw_rooms
  set remote_key_hash = null,
      last_remote_request_at = null
  where room_id = p_room_id
    and write_key_hash = extensions.digest(p_write_key, 'sha256');

  if not found then
    raise exception 'Room credentials were rejected';
  end if;

  delete from public.draw_remote_commands where room_id = p_room_id;
end;
$$;

create or replace function public.request_remote_draw(
  p_room_id uuid,
  p_remote_key text,
  p_command_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  room_expiry timestamptz;
  previous_request timestamptz;
  public_state jsonb;
begin
  if p_remote_key is null or length(p_remote_key) < 64 or p_command_id is null then
    raise exception 'Remote control credentials were rejected';
  end if;

  select rooms.expires_at, rooms.last_remote_request_at
  into room_expiry, previous_request
  from public.draw_rooms as rooms
  where rooms.room_id = p_room_id
    and rooms.remote_key_hash = extensions.digest(p_remote_key, 'sha256')
    and rooms.expires_at > now()
  for update;

  if room_expiry is null then
    raise exception 'Remote control credentials were rejected';
  end if;

  if previous_request is not null and previous_request > now() - interval '2 seconds' then
    raise exception 'Please wait before requesting another draw';
  end if;

  select states.state into public_state
  from public.draw_public_states as states
  where states.room_id = p_room_id
    and states.expires_at > now();

  if public_state is null then
    raise exception 'The host is not ready';
  end if;

  if not coalesce((public_state #>> '{live,remoteControlReady}')::boolean, false)
    or coalesce((public_state #>> '{live,drawing}')::boolean, false)
    or coalesce((public_state #>> '{live,remainingEntriesCount}')::integer, 0) <= 0
    or (
      coalesce(public_state ->> 'operationMode', 'standard') = 'standard'
      and
      coalesce((public_state #>> '{live,prizeCount}')::integer, 0) > 0
      and coalesce((public_state #>> '{live,completedPrizeCount}')::integer, 0)
        >= coalesce((public_state #>> '{live,prizeCount}')::integer, 0)
    ) then
    raise exception 'The host is not ready for another draw';
  end if;

  delete from public.draw_remote_commands
  where room_id = p_room_id and expires_at <= now();

  update public.draw_rooms
  set last_remote_request_at = now()
  where room_id = p_room_id;

  insert into public.draw_remote_commands (command_id, room_id, command, expires_at)
  values (p_command_id, p_room_id, 'draw', least(room_expiry, now() + interval '12 seconds'))
  on conflict (command_id) do nothing;

  return p_command_id;
end;
$$;

create or replace function public.claim_remote_draw_command(
  p_room_id uuid,
  p_write_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_command uuid;
begin
  if not exists (
    select 1 from public.draw_rooms
    where room_id = p_room_id
      and write_key_hash = extensions.digest(p_write_key, 'sha256')
      and expires_at > now()
  ) then
    raise exception 'Room credentials were rejected';
  end if;

  delete from public.draw_remote_commands
  where room_id = p_room_id and expires_at <= now();

  select command_id into claimed_command
  from public.draw_remote_commands
  where room_id = p_room_id
    and command = 'draw'
    and expires_at > now()
  order by requested_at
  for update skip locked
  limit 1;

  if claimed_command is not null then
    delete from public.draw_remote_commands where command_id = claimed_command;
  end if;

  return claimed_command;
end;
$$;

revoke all on function public.create_draw_room(uuid, text) from public;
revoke all on function public.publish_draw_state(uuid, text, jsonb) from public;
revoke all on function public.close_draw_room(uuid, text) from public;
grant execute on function public.create_draw_room(uuid, text) to anon, authenticated;
grant execute on function public.publish_draw_state(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.close_draw_room(uuid, text) to anon, authenticated;
revoke all on function public.enable_draw_remote_control(uuid, text, text) from public;
revoke all on function public.disable_draw_remote_control(uuid, text) from public;
revoke all on function public.request_remote_draw(uuid, text, uuid) from public;
revoke all on function public.claim_remote_draw_command(uuid, text) from public;
grant execute on function public.enable_draw_remote_control(uuid, text, text) to anon, authenticated;
grant execute on function public.disable_draw_remote_control(uuid, text) to anon, authenticated;
grant execute on function public.request_remote_draw(uuid, text, uuid) to anon, authenticated;
grant execute on function public.claim_remote_draw_command(uuid, text) to anon, authenticated;

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

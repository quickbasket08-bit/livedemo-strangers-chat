-- Omegle-clone MVP schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query > paste > Run)
-- Everything here is accessed ONLY from server-side Next.js API routes using the
-- service_role key. The browser (anon key) never touches these tables directly —
-- it only uses Supabase Realtime *broadcast* channels, which don't require table
-- grants. That's why every table below has Row Level Security enabled with NO
-- policies: anon/authenticated get a hard "deny all", service_role bypasses RLS.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists queue (
  session_id uuid primary key,
  username text not null,
  mode text not null check (mode in ('text', 'video')),
  created_at timestamptz not null default now()
);

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('text', 'video')),
  user1_id uuid not null,
  user1_name text not null,
  user2_id uuid not null,
  user2_name text not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  sender_id uuid not null,
  username text not null,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  room_id uuid,
  reporter_id uuid not null,
  reporter_name text,
  reported_id uuid,
  reported_name text,
  reason text not null,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

create index if not exists idx_queue_mode_created on queue (mode, created_at);
create index if not exists idx_rooms_user1 on rooms (user1_id) where ended_at is null;
create index if not exists idx_rooms_user2 on rooms (user2_id) where ended_at is null;
create index if not exists idx_messages_room on messages (room_id, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security: deny-all for anon/authenticated, service_role bypasses RLS
-- ---------------------------------------------------------------------------

alter table queue enable row level security;
alter table rooms enable row level security;
alter table messages enable row level security;
alter table reports enable row level security;
alter table blocks enable row level security;

-- ---------------------------------------------------------------------------
-- Matchmaking functions (SECURITY DEFINER, only ever called by the server
-- using the service_role key from API routes)
-- ---------------------------------------------------------------------------

-- Join (or re-join, e.g. after clicking "Next") the queue for a given mode.
create or replace function join_queue(p_session_id uuid, p_username text, p_mode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into queue (session_id, username, mode, created_at)
  values (p_session_id, p_username, p_mode, now())
  on conflict (session_id)
  do update set username = excluded.username,
                mode = excluded.mode,
                created_at = now();
end;
$$;

-- Try to find (or return an already-assigned) match for this session.
-- Returns the room id, or null if still waiting.
create or replace function find_match(p_session_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_username text;
  v_existing_room uuid;
  v_partner_id uuid;
  v_partner_name text;
  v_new_room_id uuid;
begin
  -- Already matched into an active room?
  select id into v_existing_room
  from rooms
  where ended_at is null
    and (user1_id = p_session_id or user2_id = p_session_id)
  order by created_at desc
  limit 1;

  if v_existing_room is not null then
    return v_existing_room;
  end if;

  select mode, username into v_mode, v_username
  from queue
  where session_id = p_session_id;

  if v_mode is null then
    return null; -- not queued (and not in a room) — caller should join_queue first
  end if;

  -- Look for the longest-waiting other queued user in the same mode,
  -- skipping anyone this session has blocked or who has blocked this session.
  select q.session_id, q.username into v_partner_id, v_partner_name
  from queue q
  where q.mode = v_mode
    and q.session_id <> p_session_id
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = p_session_id and b.blocked_id = q.session_id)
         or (b.blocker_id = q.session_id and b.blocked_id = p_session_id)
    )
  order by q.created_at asc
  limit 1
  for update skip locked;

  if v_partner_id is null then
    return null; -- still waiting
  end if;

  insert into rooms (mode, user1_id, user1_name, user2_id, user2_name)
  values (v_mode, p_session_id, v_username, v_partner_id, v_partner_name)
  returning id into v_new_room_id;

  delete from queue where session_id in (p_session_id, v_partner_id);

  return v_new_room_id;
end;
$$;

-- Leave the queue (e.g. user navigated away while waiting).
create or replace function leave_queue(p_session_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from queue where session_id = p_session_id;
$$;

-- End an active room (Next / Leave / disconnect).
create or replace function end_room(p_room_id uuid, p_session_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update rooms
  set ended_at = now()
  where id = p_room_id
    and ended_at is null
    and (user1_id = p_session_id or user2_id = p_session_id);
$$;

-- Periodically drop stale queue entries (client stopped polling: tab closed,
-- crashed, lost network). Call this from a cron/edge function, or simply let
-- find_match's "skip locked" + short poll interval keep things self-healing.
create or replace function purge_stale_queue(p_older_than_seconds int default 30)
returns void
language sql
security definer
set search_path = public
as $$
  delete from queue where created_at < now() - make_interval(secs => p_older_than_seconds);
$$;

grant execute on function join_queue(uuid, text, text) to service_role;
grant execute on function find_match(uuid) to service_role;
grant execute on function leave_queue(uuid) to service_role;
grant execute on function end_room(uuid, uuid) to service_role;
grant execute on function purge_stale_queue(int) to service_role;

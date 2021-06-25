CREATE EXTENSION IF NOT EXISTS CITEXT;

DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS forums CASCADE;
DROP TABLE IF EXISTS threads CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS votes CASCADE;

create table if not exists users
(
    id       serial not null,
    nickname citext not null
    constraint users_pk
    primary key,
    fullname citext,
    about    text,
    email    citext not null
);

create unique index if not exists users_email_uindex
    on users (email);

create unique index if not exists users_id_uindex
    on users (id);

create unique index if not exists users_nickname_uindex
    on users (nickname);

create table if not exists forums
(
    id      serial            not null,
    slug    citext            not null
    constraint forums_pk
    primary key,
    title   varchar           not null,
    "user"  citext            not null
    constraint forums_users_nickname_fk
    references users,
    threads integer default 0 not null
);

create unique index if not exists forums_id_uindex
    on forums (id);

create unique index if not exists forums_slug_uindex
    on forums (slug);

create table if not exists threads
(
    id         serial                                    not null,
    author     citext                                    not null
    constraint threads_users_nickname_fk
    references users,
    slug       citext,
    created    timestamp(3) with time zone default now() not null,
    forum_slug citext                                    not null
    constraint threads_forums_slug_fk
    references forums,
    title      varchar                                   not null,
    message    text                                      not null,
    votes      integer                     default 0     not null
    );

create unique index if not exists threads_id_uindex
    on threads (id);

create unique index if not exists threads_slug_uindex
    on threads (slug);

create table if not exists posts
(
    id         serial                                    not null
    constraint posts_pk
    primary key,
    message    text                                      not null,
    is_edited  boolean                     default false not null,
    parent     integer                     default 0     not null,
    author     citext                                    not null
    constraint posts_users_nickname_fk
    references users,
    thread_id  integer                                   not null,
    created    timestamp(3) with time zone default now() not null,
    path       integer[],
    forum_slug citext                                    not null
    );

create unique index if not exists posts_id_uindex
    on posts (id);

create table if not exists votes
(
    user_nickname citext             not null
    constraint votes_users_nickname_fk
    references users,
    thread_id     integer            not null
    constraint votes_threads_id_fk
    references threads (id),
    voice         smallint default 0 not null
    );


create function path() returns trigger
    language plpgsql
as
$$
DECLARE
parent_path      INT[];
    parent_thread_id INT;
BEGIN
    IF (NEW.parent is null) THEN
        NEW.path := NEW.path || NEW.id;
ELSE
SELECT path, thread_id
FROM posts
WHERE id = NEW.parent
    INTO parent_path, parent_thread_id;
IF parent_thread_id != NEW.thread_id THEN
            raise exception 'error228' using errcode = '00409';
end if;
        NEW.path := NEW.path || parent_path || NEW.id;
END IF;

RETURN NEW;
END;

$$;

create trigger path_trigger
    before insert
    on posts
    for each row
    execute procedure path();

create function threads_forum_counter() returns trigger
    language plpgsql
as
$$
BEGIN
UPDATE forums SET threads = threads + 1 WHERE slug = NEW.forum_slug;
RETURN NULL;
END;
$$;

create trigger threads_forum_counter
    after insert
    on threads
    for each row
    execute procedure threads_forum_counter();




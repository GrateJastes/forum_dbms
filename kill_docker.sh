sudo docker rmi -f $(sudo docker images -a -q)
sudo docker rm $(sudo docker ps -a -q)
sudo docker volume prune

-- Forums
INSERT INTO forums as f (title, user_id, slug) VALUES
(
    'provided_title',
    (SELECT id from users where nickname = 'provided_nickname'),
    'provided_slug123'
);

SELECT f.title, f.slug, u.nickname, f.threads, count(p.id) as posts
FROM forums as f
JOIN users u on u.id = f.user_id and f.slug='pirate-stories'
LEFT JOIN threads t on f.id = t.forum_id
LEFT JOIN posts p on p.thread_id = t.id
GROUP BY f.title, f.slug, u.nickname, f.threads;


SELECT t.id, t.title, u.nickname as author, f.slug as forum, t.message, t.votes, t.slug as slug, t.created
FROM threads as t
JOIN users as u on u.id = t.author_id
JOIN forums as f on t.forum_id = f.id and f.slug = 'provided_slug'
WHERE t.created >= '2021-05-04'
ORDER BY created DESC
LIMIT 100;


-- Threads
INSERT INTO threads as t (title, message, forum_id, author_id, created) VALUES
(
    'provided_title',
    'provided_message',
    (SELECT id from forums f where f.slug = 'provided_slug'),
    (SELECT id from users u where nickname = 'provided_nickname'),
    now() --provided_datetime
)
RETURNING t.id as id, t.title as title, t.message as message, t.votes as votes, t.slug as slug, t.created as created;


-- Posts
INSERT INTO posts (parent_id, author_id, thread_id, message) VALUES
(
    0, -- provided_parent_id
    (SELECT id from users where nickname = 'provided_nickname'),
    (SELECT id from threads where slug = 'provided_slug'),
    'provided_message'
);


-- Users
INSERT INTO users (nickname, fullname, about, email)
VALUES ('provided_nickname', 'provided_fullname', 'provided_about', 'provided_email');

SELECT nickname, fullname, about, email
FROM users
WHERE nickname = 'provided_nicknaame';

UPDATE users
SET (fullname, about, email) = ('provided_fullname', 'provided_about', 'provided_email')
WHERE nickname = 'provided_nicafdkname'
RETURNING *;

SELECT nickname, fullname, about, email
FROM users u
JOIN forums f on u.id = f.user_id
WHERE f.slug = 'provided_slug'
ORDER BY lower(nickname) -- DESC if provided
LIMIT 100; -- make it starts from provided_nickname

SELECT * FROM users;


-- Info
SELECT 'user' as users, count(*) from users
UNION
SELECT 'forum' as forums, count(*) from forums
UNION
SELECT 'thread' as threads, count(*) from threads
UNION
SELECT 'post' as posts, count(*) from posts;


SELECT *
FROM threads t
JOIN users u on t.author_id = u.id
JOIN forums f on t.forum_id = f.id
WHERE t.slug='abc';


SELECT u.nickname, u.fullname, u.about, u.email
FROM threads t
JOIN forums f on t.forum_id = f.id and f.slug = 'provided_slug'
JOIN posts p on t.id = p.thread_id
JOIN users u on t.author_id = u.id or p.author_id = u.id
GROUP BY u.nickname, u.fullname, u.about, u.email
ORDER BY LOWER(u.nickname);

SELECT u.id as user_id, t.id as thread_id
FROM users u
JOIN threads t on u.nickname = 'tester' and t.slug = 'abc';




BEGIN;
TRUNCATE users CASCADE;
TRUNCATE forums CASCADE;
ALTER SEQUENCE forums_id_seq RESTART WITH 1;
ALTER SEQUENCE posts_id_seq RESTART WITH 1;
ALTER SEQUENCE threads_id_seq RESTART WITH 1;
ALTER SEQUENCE users_id_seq RESTART WITH 1;
COMMIT;

CREATE EXTENSION IF NOT EXISTS CITEXT;

SELECT nickname FROM users WHERE nickname LIKE 'e.%';
SELECT slug FROM forums WHERE slug LIKE '9%';

SELECT t.id, t.title, u.nickname as author, f.slug as forum, t.message, t.votes, t.slug as slug, t.created
FROM threads as t
JOIN users as u on u.id = t.author_id
JOIN forums as f on t.forum_id = f.id
WHERE f.slug = 'lo-62_eLE6JcS' --AND t.created <= '2021-08-23T18:40:13.273Z'
ORDER BY created DESC;
-- LIMIT 4

SELECT * FROM forums WHERE slug = '8Wn-OwAMXO5FS';


INSERT INTO posts as p (author_id, message, parent_id, created, thread_id, forum_slug) VALUES
(
     (SELECT id FROM users as u WHERE nickname = 'huc.wQdA9fy8z6IC7D'),
     'blahblahblah',
     0,
     '2021-06-13T12:59:00.049Z',
     733,
     (
         SELECT f.slug
         FROM forums as f
         JOIN threads as t2 on t2.forum_id = f.id
         WHERE t2.id = 733
     )
) RETURNING p.id as id, p.parent_id as parent, p.is_edited as isEdited, p.created as created,
    p.thread_id as thread, p.message as message, p.forum_slug as forum;


SELECT * FROM threads WHERE slug LIKE 'tl%';

INSERT INTO threads as t (title, message, forum_id, author_id, created, slug) VALUES
(
 'Gustavi voce vi oceanum magni',
 'balbabl',
 (SELECT id FROM forums f WHERE f.slug = 'Vm6I0HKG-IJjK'),
 (SELECT id FROM users u WHERE u.nickname = 'casto.1l6Mny7e6m5IPV'),
 '2021-07-26T08:47:18.395+03:00',
 'tLio4B8Ti6CfS'
) RETURNING t.id as id, t.title as title, t.message as message, t.votes as votes, t.slug as slug, t.created as created;

SELECT slug from forums where slug like 'F%';



SELECT u.nickname, u.fullname, u.about, u.email
FROM threads t
JOIN forums f on t.forum_id = f.id and f.slug = 'h9AOgfnH-O5fK'
JOIN posts p on t.id = p.thread_id
JOIN users u on (t.author_id = u.id or p.author_id = u.id)
GROUP BY u.nickname, u.fullname, u.about, u.email
ORDER BY LOWER(u.nickname) COLLATE "C"
LIMIT 100;

SELECT p.id as postID , p.parent_id as postParent, u.nickname as postAuthor, p.message as postMessage,
       p.is_edited as isEdited, f.slug as forumSlug, p.thread_id as postThread, p.created as postCreated,
       u.fullname as fullname, u.about as about, u.email as email, t.id as threadID, t.title as threadTitle,
       u2.nickname as threadAuthor, t.slug as threadSlug, t.votes as threadVotes, t.message as threadMessage,
       t.created as threadCreated, f.title as forumTitle, f.threads as forumThreads

FROM posts p
JOIN users u on p.author_id = u.id
JOIN threads t on p.thread_id = t.id
JOIN users u2 on u2.id = t.author_id
JOIN forums f on t.forum_id = f.id
WHERE p.id = 1178;


SELECT count(p.id), u.nickname forumUser
FROM forums as f
JOIN users u on u.id = f.user_id and f.slug = 'wy0Vt8E0i6ccs2'
LEFT JOIN threads t on f.id = t.forum_id
JOIN posts p on p.thread_id = t.id
GROUP BY p.id, u.nickname;

CREATE INDEX idx_post_threadID_path ON posts(thread_id, path);
CREATE INDEX idx_posts_threadID_root_path ON posts (thread_id, (path[1]), path);


SELECT u.nickname as author, p.created, p.forum_slug as forum, p.id, p.message, p.thread_id as thread, p.parent_id as parent
    FROM posts p
    JOIN users u on u.id = p.author_id
    JOIN threads t on t.id = p.thread_id and t.slug = 'HjHen-cgFIjFs'
    JOIN (
      SELECT p2.id as sub_parent_id
      FROM posts p2
      JOIN threads t2 on t2.id = p2.thread_id and t2.slug = 'HjHen-cgFIjFs'
      WHERE p2.parent_id = 0
      ORDER BY p2.id DESC
      LIMIT 65
    ) AS sub
    ON sub.sub_parent_id = path[1]
    ORDER BY sub.sub_parent_id DESC, path ASC;


SELECT u.nickname as author, p.created, p.forum_slug as forum, p.id, p.message, p.thread_id as thread, p.parent_id as parent
    FROM posts p
    JOIN users u on u.id = p.author_id
    JOIN (
      SELECT p2.id as sub_parent_id
      FROM posts p2
      WHERE p2.parent_id = 0 AND thread_id = 35
      ORDER BY p2.id DESC
      LIMIT 65
    ) AS sub
    ON p.thread_id = 35 AND sub.sub_parent_id = path[1]
    ORDER BY sub.sub_parent_id DESC, path ASC;

SELECT count(*) FROM posts;


SELECT u.nickname, u.fullname, u.about, u.email
FROM threads t
JOIN forums f on t.forum_id = f.id and f.slug = '1ceyHMUFT-JCK'
LEFT JOIN posts p on t.id = p.thread_id
JOIN users u on t.author_id = u.id or p.author_id = u.id
GROUP BY u.nickname, u.fullname, u.about, u.email
ORDER BY u.nickname COLLATE "C"
LIMIT 10;


CREATE EXTENSION CITEXT;


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



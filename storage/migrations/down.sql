DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS forums CASCADE;
DROP TABLE IF EXISTS threads CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS users_forum CASCADE;

DROP FUNCTION IF EXISTS update_path();
DROP FUNCTION IF EXISTS update_threads_count();
DROP FUNCTION IF EXISTS insert_votes();
DROP FUNCTION IF EXISTS update_votes();
DROP FUNCTION IF EXISTS update_user_forum();

DROP TRIGGER IF EXISTS path_update_trigger ON posts;
DROP TRIGGER IF EXISTS add_thread_to_forum ON threads;
DROP TRIGGER IF EXISTS insert_votes ON votes;
DROP TRIGGER IF EXISTS update_votes ON votes;
DROP TRIGGER IF EXISTS thread_insert_user_forum ON threads;
DROP TRIGGER IF EXISTS post_insert_user_forum ON posts;
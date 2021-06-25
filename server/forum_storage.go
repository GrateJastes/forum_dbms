package server

import (
	"forum_dbms/models"
)

func InsertForum(forum models.Forum) (models.Forum, error) {
	var f models.Forum
	user, err := SelectUserByNickname(forum.User)
	if err != nil {
		return f, err
	}
	row := models.DB.QueryRow(`INSERT INTO forums(slug, title, username) VALUES ($1, $2, $3) RETURNING *;`,
		forum.Slug, forum.Title, user.Nickname)

	err = row.Scan(&f.User, &f.Posts, &f.Threads, &f.Slug, &f.Title)
	return f, err
}

func SelectForum(slug string) (models.Forum, error) {
	row := models.DB.QueryRow(`SELECT * FROM forums WHERE LOWER(slug)=LOWER($1) LIMIT 1;`, slug)
	var f models.Forum
	err := row.Scan(&f.User, &f.Posts, &f.Threads, &f.Slug, &f.Title)
	return f, err
}

func StatusForum() models.Status {
	var status models.Status
	models.DB.QueryRow(`SELECT COUNT(*) FROM users;`).Scan(&status.User)
	models.DB.QueryRow(`SELECT COUNT(*) FROM forums;`).Scan(&status.Forum)
	models.DB.QueryRow(`SELECT COUNT(*) FROM threads;`).Scan(&status.Thread)
	models.DB.QueryRow(`SELECT COUNT(*) FROM posts;`).Scan(&status.Post)
	return status
}

func ClearDB() error {
	var err error
	_, err = models.DB.Exec(`TRUNCATE users, forums, threads, posts, votes, users_forum;`)
	return err
}

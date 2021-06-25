package server

import (
	"fmt"
	"forum_dbms/models"
	"strings"
	"time"

	"github.com/jackc/pgx"
)

func InsertPosts(posts []models.Post, thread models.Thread) ([]models.Post, error) {
	var insertedPosts []models.Post
	query := `INSERT INTO posts(author, created, forum, message, parent, thread) VALUES `
	var values []interface{}
	timeCreated := time.Now()
	for i, post := range posts {
		value := fmt.Sprintf(
			"($%d, $%d, $%d, $%d, $%d, $%d),",
			i*6+1, i*6+2, i*6+3, i*6+4, i*6+5, i*6+6,
		)

		query += value
		values = append(values, post.Author, timeCreated, thread.Forum, post.Message, post.Parent, thread.ID)
	}

	query = strings.TrimSuffix(query, ",")
	query += ` RETURNING *`

	rows, err := models.DB.Query(query, values...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var p models.Post
		err := rows.Scan(&p.Author, &p.Created, &p.Forum, &p.ID, &p.IsEdited, &p.Message, &p.Parent, &p.Thread, &p.Path)
		if err != nil {
			return nil, models.ErrConflict
		}
		insertedPosts = append(insertedPosts, p)
	}

	if rows.Err() != nil {
		return nil, rows.Err()
	}
	return insertedPosts, nil
}

func SelectPosts(threadID int, limit, since int, sort string, desc bool) ([]models.Post, error) {
	var posts []models.Post
	var rows *pgx.Rows
	var err error

	if since == 0 {
		if sort == "flat" || sort == "" {
			if desc {
				rows, err = models.DB.Query(`SELECT * FROM posts WHERE thread=$1 ORDER BY id DESC LIMIT NULLIF($2, 0);`, threadID, limit)
			} else {
				rows, err = models.DB.Query(`SELECT * FROM posts WHERE thread=$1 ORDER BY id LIMIT NULLIF($2, 0);`, threadID, limit)
			}
		} else if sort == "tree" {
			if desc {
				rows, err = models.DB.Query(`SELECT * FROM posts WHERE thread=$1 ORDER BY path DESC LIMIT NULLIF($2, 0);`, threadID, limit)
			} else {
				rows, err = models.DB.Query(`SELECT * FROM posts WHERE thread=$1 ORDER BY path LIMIT NULLIF($2, 0);`, threadID, limit)
			}
		} else {
			if desc {
				rows, err = models.DB.Query(`SELECT * FROM posts WHERE path[1] IN
				(SELECT id FROM posts WHERE thread=$1 AND parent IS NULL ORDER BY id DESC LIMIT NULLIF($2, 0))
				ORDER BY path[1] DESC, path;`, threadID, limit)
			} else {
				rows, err = models.DB.Query(`SELECT * FROM posts WHERE path[1] IN
				(SELECT id FROM posts WHERE thread=$1 AND parent IS NULL ORDER BY id LIMIT NULLIF($2, 0))
				ORDER BY path;`, threadID, limit)
			}
		}
	} else {
		if sort == "flat" || sort == "" {
			if desc {
				rows, err = models.DB.Query(`SELECT * FROM posts WHERE thread=$1 AND id < $2
				ORDER BY id DESC LIMIT NULLIF($3, 0);`, threadID, since, limit)
			} else {
				rows, err = models.DB.Query(`SELECT * FROM posts WHERE thread=$1 AND id > $2
				ORDER BY id LIMIT NULLIF($3, 0);`, threadID, since, limit)
			}
		} else if sort == "tree" {
			if desc {
				rows, err = models.DB.Query(`SELECT * FROM posts WHERE thread=$1 AND PATH < (SELECT path FROM posts WHERE id = $2)
				ORDER BY path DESC LIMIT NULLIF($3, 0);`, threadID, since, limit)
			} else {
				rows, err = models.DB.Query(`SELECT * FROM posts WHERE thread=$1 AND PATH > (SELECT path FROM posts WHERE id = $2)
				ORDER BY path LIMIT NULLIF($3, 0);`, threadID, since, limit)
			}
		} else {
			if desc {
				rows, err = models.DB.Query(`SELECT * FROM posts WHERE path[1] IN (SELECT id FROM posts WHERE thread=$1 AND parent IS NULL AND PATH[1] <
				(SELECT path[1] FROM posts WHERE id = $2) ORDER BY id DESC LIMIT NULLIF($3, 0)) ORDER BY path[1] DESC, path;`, threadID, since, limit)
			} else {
				rows, err = models.DB.Query(`SELECT * FROM posts WHERE path[1] IN (SELECT id FROM posts WHERE thread=$1 AND parent IS NULL AND PATH[1] >
				(SELECT path[1] FROM posts WHERE id = $2) ORDER BY id LIMIT NULLIF($3, 0)) ORDER BY path;`, threadID, since, limit)
			}
		}
	}

	if err != nil {
		return posts, err
	}
	defer rows.Close()

	for rows.Next() {
		var p models.Post
		err = rows.Scan(&p.Author, &p.Created, &p.Forum, &p.ID, &p.IsEdited, &p.Message, &p.Parent, &p.Thread, &p.Path)
		if err != nil {
			return posts, err
		}

		posts = append(posts, p)
	}
	return posts, nil
}

func SelectPostByID(id int, related []string) (map[string]interface{}, error) {
	var post models.Post
	postFull := map[string]interface{}{}

	row := models.DB.QueryRow(`SELECT * FROM posts WHERE id = $1 LIMIT 1;`, id)
	err := row.Scan(&post.Author, &post.Created, &post.Forum, &post.ID, &post.IsEdited, &post.Message, &post.Parent, &post.Thread, &post.Path)
	if err != nil {
		return postFull, err
	}
	postFull["post"] = post

	for _, param := range related {
		switch param {
		case "user":
			author, err := SelectUserByNickname(post.Author)
			if err != nil {
				return postFull, err
			}
			postFull["author"] = author
		case "thread":
			thread, err := SelectThreadByID(post.Thread)
			if err != nil {
				return postFull, err
			}
			postFull["thread"] = thread
		case "forum":
			forum, err := SelectForum(post.Forum)
			if err != nil {
				return postFull, err
			}
			postFull["forum"] = forum
		}
	}

	return postFull, nil
}

func UpdatePost(postUpdate models.PostUpdate, id int) (models.Post, error) {
	var p models.Post
	row := models.DB.QueryRow(`UPDATE posts SET message=COALESCE(NULLIF($1, ''), message), 
		is_edited = CASE WHEN $1 = '' OR message = $1 THEN false ELSE true END WHERE id=$2 RETURNING *;`, postUpdate.Message, id)
	err := row.Scan(&p.Author, &p.Created, &p.Forum, &p.ID, &p.IsEdited, &p.Message, &p.Parent, &p.Thread, &p.Path)
	return p, err
}

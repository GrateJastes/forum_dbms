package server

import (
	"forum_dbms/models"

	"github.com/jackc/pgx"
)

func InsertUser(user models.User) error {
	_, err := models.DB.Exec(`INSERT INTO users(about, email, fullname, nickname) VALUES ($1, $2, $3, $4);`,
		user.About, user.Email, user.Fullname, user.Nickname)
	return err
}

func SelectUsers(email, nickname string) ([]models.User, error) {
	var users []models.User
	rows, err := models.DB.Query(`SELECT * FROM users WHERE LOWER(email)=LOWER($1)
	OR LOWER(nickname)=LOWER($2) LIMIT 2;`, email, nickname)
	if err != nil {
		return users, err
	}
	defer rows.Close()
	for rows.Next() {
		var u models.User
		err = rows.Scan(&u.About, &u.Email, &u.Fullname, &u.Nickname)
		if err != nil {
			return users, err
		}
		users = append(users, u)
	}
	return users, nil
}

func SelectUserByNickname(nickname string) (models.User, error) {
	row := models.DB.QueryRow(`SELECT * FROM users WHERE LOWER(nickname)=LOWER($1) LIMIT 1;`, nickname)
	var u models.User
	err := row.Scan(&u.About, &u.Email, &u.Fullname, &u.Nickname)
	return u, err
}

func UpdateUser(user models.User) (models.User, error) {
	row := models.DB.QueryRow(`UPDATE users SET about=COALESCE(NULLIF($1, ''), about),
				email=COALESCE(NULLIF($2, ''), email), 	fullname=COALESCE(NULLIF($3, ''), fullname)
				WHERE LOWER(nickname)=LOWER($4) RETURNING *;`, user.About, user.Email, user.Fullname, user.Nickname)

	var u models.User
	err := row.Scan(&u.About, &u.Email, &u.Fullname, &u.Nickname)
	return u, err
}

func SelectUsersByForum(slug, since string, limit int, desc bool) ([]models.User, error) {
	var users []models.User
	var rows *pgx.Rows
	var err error

	if desc {
		if since != "" {
			rows, err = models.DB.Query(`SELECT about, email, fullname, nickname FROM users_forum
				WHERE slug=$1 AND nickname < $2 ORDER BY nickname DESC LIMIT NULLIF($3, 0);`, slug, since, limit)
		} else {
			rows, err = models.DB.Query(`SELECT about, email, fullname, nickname FROM users_forum
				WHERE slug=$1 ORDER BY nickname DESC LIMIT NULLIF($2, 0);`, slug, limit)
		}
	} else {
		rows, err = models.DB.Query(`SELECT about, email, fullname, nickname FROM users_forum
			WHERE slug=$1 AND nickname > $2 ORDER BY nickname LIMIT NULLIF($3, 0);`, slug, since, limit)
	}

	if err != nil {
		return users, err
	}
	defer rows.Close()

	for rows.Next() {
		var u models.User
		err = rows.Scan(&u.About, &u.Email, &u.Fullname, &u.Nickname)
		if err != nil {
			return users, err
		}
		users = append(users, u)
	}

	return users, nil
}

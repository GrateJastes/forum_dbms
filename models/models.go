package models

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/jackc/pgtype"
	"github.com/jackc/pgx"
)

var DB *pgx.ConnPool

type User struct {
	About    string `json:"about"`
	Email    string `json:"email"`
	Fullname string `json:"fullname"`
	Nickname string `json:"nickname"`
}

type Forum struct {
	Posts   int    `json:"posts"`
	Slug    string `json:"slug"`
	Threads int    `json:"threads"`
	Title   string `json:"title"`
	User    string `json:"user"`
}

type Thread struct {
	Author  string         `json:"author"`
	Created time.Time      `json:"created"`
	Forum   string         `json:"forum"`
	ID      int            `json:"id"`
	Message string         `json:"message"`
	Slug    JsonNullString `json:"slug"`
	Title   string         `json:"title"`
	Votes   int            `json:"votes"`
}

type Post struct {
	Author   string           `json:"author"`
	Created  time.Time        `json:"created"`
	Forum    string           `json:"forum"`
	ID       int              `json:"id"`
	IsEdited bool             `json:"isEdited"`
	Message  string           `json:"message"`
	Parent   JsonNullInt64    `json:"parent"`
	Thread   int              `json:"thread,"`
	Path     pgtype.Int8Array `json:"-"`
}

type PostUpdate struct {
	Message string `json:"message"`
}

type JsonNullInt64 struct {
	sql.NullInt64
}

func (v JsonNullInt64) MarshalJSON() ([]byte, error) {
	if v.Valid {
		return json.Marshal(v.Int64)
	} else {
		return json.Marshal(nil)
	}
}

func (v *JsonNullInt64) UnmarshalJSON(data []byte) error {
	var x *int64
	if err := json.Unmarshal(data, &x); err != nil {
		return err
	}
	if x != nil {
		v.Valid = true
		v.Int64 = *x
	} else {
		v.Valid = false
	}
	return nil
}

type JsonNullString struct {
	sql.NullString
}

func (v JsonNullString) MarshalJSON() ([]byte, error) {
	if v.Valid {
		return json.Marshal(v.String)
	} else {
		return json.Marshal(nil)
	}
}

func (v *JsonNullString) UnmarshalJSON(data []byte) error {
	var x *string
	if err := json.Unmarshal(data, &x); err != nil {
		return err
	}
	if x != nil {
		v.Valid = true
		v.String = *x
	} else {
		v.Valid = false
	}
	return nil
}

type Vote struct {
	Nickname string `json:"nickname"`
	Voice    int    `json:"voice"`
	Thread   int    `json:"-"`
}

type Status struct {
	Forum  int `json:"forum"`
	Post   int `json:"post"`
	Thread int `json:"thread"`
	User   int `json:"user"`
}

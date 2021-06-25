package server

import (
	"bytes"
	"encoding/json"
	"forum_dbms/models"
	"github.com/valyala/fasthttp"
	"log"
	"net/http"
	"strconv"
	_ "strings"

	"github.com/jackc/pgx"
)

func StatusHandler(ctx *fasthttp.RequestCtx) {
	status := StatusForum()
	body, err := json.Marshal(status)
	if err != nil {
		log.Println(err)
		return
	}

	ctx.SetStatusCode(http.StatusOK)
	ctx.SetContentType("application/json")
	ctx.SetBody(body)
}

func ClearHandler(ctx *fasthttp.RequestCtx) {
	err := ClearDB()
	if err != nil {
		log.Println(err)
		return
	}

	ctx.SetStatusCode(http.StatusOK)
	ctx.SetContentType("application/json")
	ctx.SetBody([]byte("null"))
}

func CreateForum(ctx *fasthttp.RequestCtx) {
	var forum models.Forum
	err := json.NewDecoder(bytes.NewReader(ctx.Request.Body())).Decode(&forum)
	if err != nil {
		log.Println(err)
		return
	}

	forumInserted, err := InsertForum(forum)
	if pgErr, ok := err.(pgx.PgError); ok {
		switch pgErr.Code {
		case "23505":
			forum, err = SelectForum(forum.Slug)
			if err != nil {
				log.Println(err)
				return
			}

			body, err := json.Marshal(forum)
			if err != nil {
				log.Println(err)
				return
			}

			ctx.SetStatusCode(http.StatusConflict)
			ctx.SetContentType("application/json")
			ctx.SetBody(body)
			return
		}
	}

	if err == pgx.ErrNoRows {
		ctx.SetStatusCode(http.StatusNotFound)
		ctx.SetContentType("application/json")
		ctx.SetBody(jsonToMessage("Can't find user"))
		return
	}

	body, err := json.Marshal(forumInserted)
	if err != nil {
		log.Println(err)
		return
	}

	ctx.SetStatusCode(http.StatusCreated)
	ctx.SetContentType("application/json")
	ctx.SetBody(body)
}

func ForumDetails(ctx *fasthttp.RequestCtx) {
	forumnameInterface := ctx.UserValue("forumname")

	var slug string
	switch forumnameInterface.(type) {
	case string:
		slug = forumnameInterface.(string)
	default:
		ctx.SetStatusCode(http.StatusBadRequest)
		return
	}

	forum, err := SelectForum(slug)
	if err != nil {
		ctx.SetStatusCode(http.StatusNotFound)
		ctx.SetContentType("application/json")
		ctx.SetBody(jsonToMessage("Can't find forum"))
		return
	}

	body, err := json.Marshal(forum)
	if err != nil {
		log.Println(err)
		return
	}

	ctx.SetStatusCode(http.StatusOK)
	ctx.SetContentType("application/json")
	ctx.SetBody(body)

}

func ForumUsers(ctx *fasthttp.RequestCtx) {
	forumnameInterface := ctx.UserValue("forumname")

	var slug string
	switch forumnameInterface.(type) {
	case string:
		slug = forumnameInterface.(string)
	default:
		ctx.SetStatusCode(http.StatusBadRequest)
		return
	}

	queryParams := ctx.QueryArgs()

	limitParam := string(queryParams.Peek("limit"))
	limit := 0
	var err error
	if limitParam != "" {
		limit, err = strconv.Atoi(limitParam)
		if err != nil {
			ctx.SetStatusCode(http.StatusBadRequest)
			return
		}
	}

	descParam := string(queryParams.Peek("desc"))
	desc := false
	if descParam == "" {
		desc = false
	} else {
		if descParam == "true" {
			desc = true
		}
	}

	sinceParam := string(queryParams.Peek("since"))
	since := sinceParam

	users, err := SelectUsersByForum(slug, since, limit, desc)
	if err != nil {
		ctx.SetStatusCode(http.StatusNotFound)
		ctx.SetContentType("application/json")
		ctx.SetBody(jsonToMessage("Can't find forum"))
		return
	}

	if len(users) == 0 {
		if _, err := SelectForum(slug); err != nil {
			ctx.SetStatusCode(http.StatusNotFound)
			ctx.SetContentType("application/json")
			ctx.SetBody(jsonToMessage("Can't find forum"))
			return
		}
		ctx.SetStatusCode(http.StatusOK)
		ctx.SetContentType("application/json")
		ctx.SetBody([]byte("[]"))
		return
	}

	body, err := json.Marshal(users)
	if err != nil {
		log.Println(err)
		return
	}

	ctx.SetStatusCode(http.StatusOK)
	ctx.SetContentType("application/json")
	ctx.SetBody(body)
}

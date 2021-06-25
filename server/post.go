package server

import (
	"bytes"
	"encoding/json"
	"forum_dbms/models"
	"github.com/valyala/fasthttp"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx"
)

func CreatePosts(ctx *fasthttp.RequestCtx) {
	forumnameInterface := ctx.UserValue("threadnameOrID")
	var slug string
	switch forumnameInterface.(type) {
	case string:
		slug = forumnameInterface.(string)
	default:
		ctx.SetStatusCode(http.StatusBadRequest)
		return
	}
	slugID, err := strconv.Atoi(slug)
	var thread models.Thread
	switch err {
	case nil:
		thread, err = SelectThreadByID(slugID)
	default:
		thread, err = SelectThread(slug)
	}

	if err != nil {
		ctx.SetStatusCode(http.StatusNotFound)
		ctx.SetContentType("application/json")
		ctx.SetBody(jsonToMessage("Can't find thread by slug"))
		return
	}

	var posts []models.Post
	err = json.NewDecoder(bytes.NewReader(ctx.Request.Body())).Decode(&posts)
	if err != nil {
		log.Println(err)
		return
	}

	if len(posts) == 0 {
		ctx.SetStatusCode(http.StatusCreated)
		ctx.SetContentType("application/json")
		ctx.SetBody([]byte("[]"))
		return
	}

	postsCreated, err := InsertPosts(posts, thread)
	if err != nil {
		if pgErr, ok := err.(pgx.PgError); ok && pgErr.Code == "23503" {
			ctx.SetStatusCode(http.StatusNotFound)
			ctx.SetContentType("application/json")
			ctx.SetBody(jsonToMessage("Can't find post author by nickname"))
			return
		} else {
			ctx.SetStatusCode(http.StatusConflict)
			ctx.SetContentType("application/json")
			ctx.SetBody(jsonToMessage("Parent post was created in another thread"))
			return
		}
	}

	body, err := json.Marshal(postsCreated)
	if err != nil {
		log.Println(err)
		return
	}

	ctx.SetStatusCode(http.StatusCreated)
	ctx.SetContentType("application/json")
	ctx.SetBody(body)
}

func ThreadPosts(ctx *fasthttp.RequestCtx) {
	forumnameInterface := ctx.UserValue("threadnameOrID")
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
	limit := 100
	var err error
	if limitParam != "" {
		limit, err = strconv.Atoi(limitParam)
		if err != nil {
			ctx.SetStatusCode(http.StatusBadRequest)
			return
		}
	}

	sortParam := string(queryParams.Peek("sort"))
	sort := sortParam

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
	since := 0
	if sinceParam != "" {
		since, err = strconv.Atoi(sinceParam)
		if err != nil {
			ctx.SetStatusCode(http.StatusBadRequest)
			return
		}
	}

	slugID, err := strconv.Atoi(slug)
	id := 0
	switch err {
	case nil:
		id = slugID
		_, err = SelectThreadByID(id)
	default:
		id, err = SelectThreadID(slug)
	}

	if err != nil {
		ctx.SetStatusCode(http.StatusNotFound)
		ctx.SetContentType("application/json")
		ctx.SetBody(jsonToMessage("Can't find thread by slug"))
		return
	}

	posts, err := SelectPosts(id, limit, since, sort, desc)
	if err != nil {
		log.Println(err)
		return
	}

	if len(posts) == 0 {
		ctx.SetStatusCode(http.StatusOK)
		ctx.SetContentType("application/json")
		ctx.SetBody([]byte("[]"))
		return
	}

	body, err := json.Marshal(posts)
	if err != nil {
		log.Println(err)
		return
	}

	ctx.SetStatusCode(http.StatusOK)
	ctx.SetContentType("application/json")
	ctx.SetBody(body)
}

func GetPostDetails(ctx *fasthttp.RequestCtx) {
	postIDInterface := ctx.UserValue("postID")
	id := 0

	var err error
	switch postIDInterface.(type) {
	case string:
		id, err = strconv.Atoi(postIDInterface.(string))
		if err != nil {
			ctx.SetStatusCode(http.StatusBadRequest)
			return
		}
	default:
		ctx.SetStatusCode(http.StatusBadRequest)
		return
	}

	queryParams := ctx.QueryArgs()

	relatedParam := string(queryParams.Peek("related"))
	related := relatedParam

	postFull, err := SelectPostByID(id, strings.Split(related, ","))
	if err != nil {
		ctx.SetStatusCode(http.StatusNotFound)
		ctx.SetContentType("application/json")
		ctx.SetBody(jsonToMessage("Can't find post by id"))
		return
	}

	body, err := json.Marshal(postFull)
	if err != nil {
		log.Println(err)
		return
	}

	ctx.SetStatusCode(http.StatusOK)
	ctx.SetContentType("application/json")
	ctx.SetBody(body)
}

func EditPostDetails(ctx *fasthttp.RequestCtx) {
	postIDInterface := ctx.UserValue("postID")
	id := 0

	var err error
	switch postIDInterface.(type) {
	case string:
		id, err = strconv.Atoi(postIDInterface.(string))
		if err != nil {
			ctx.SetStatusCode(http.StatusBadRequest)
			return
		}
	default:
		ctx.SetStatusCode(http.StatusBadRequest)
		return
	}

	var postUpdate models.PostUpdate
	err = json.NewDecoder(bytes.NewReader(ctx.Request.Body())).Decode(&postUpdate)
	if err != nil {
		log.Println(err)
		return
	}

	post, err := UpdatePost(postUpdate, id)
	if err != nil {
		ctx.SetStatusCode(http.StatusNotFound)
		ctx.SetContentType("application/json")
		ctx.SetBody(jsonToMessage("Can't find post by id"))
		return
	}

	body, err := json.Marshal(post)
	if err != nil {
		log.Println(err)
		return
	}

	ctx.SetStatusCode(http.StatusOK)
	ctx.SetContentType("application/json")
	ctx.SetBody(body)
}

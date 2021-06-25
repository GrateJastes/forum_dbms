package server

import (
	"bytes"
	"encoding/json"
	"forum_dbms/models"
	"github.com/jackc/pgx"
	"github.com/valyala/fasthttp"
	"log"
	"net/http"
	"strconv"
)

func CreateThread(ctx *fasthttp.RequestCtx) {
	forumnameInterface := ctx.UserValue("forumname")

	var slug string
	switch forumnameInterface.(type) {
	case string:
		slug = forumnameInterface.(string)
	default:
		ctx.SetStatusCode(http.StatusBadRequest)
		return
	}

	var thread models.Thread
	err := json.NewDecoder(bytes.NewReader(ctx.Request.Body())).Decode(&thread)
	if err != nil {
		log.Println(err)
		return
	}

	thread.Forum = slug
	threadInsert, err := InsertThread(thread)
	if err != nil {
		if pgErr, ok := err.(pgx.PgError); ok && pgErr.Code == "23505" {
			thread, err := SelectThread(thread.Slug.String)
			if err != nil {
				log.Println(err)
				return
			}

			body, err := json.Marshal(thread)
			if err != nil {
				log.Println(err)
				return
			}

			ctx.SetStatusCode(http.StatusConflict)
			ctx.SetContentType("application/json")
			ctx.SetBody(body)
			return
		}
		ctx.SetStatusCode(http.StatusNotFound)
		ctx.SetContentType("application/json")
		ctx.SetBody(jsonToMessage("Can't find thread author"))
		return
	}

	body, err := json.Marshal(threadInsert)
	if err != nil {
		log.Println(err)
		return
	}

	ctx.SetStatusCode(http.StatusCreated)
	ctx.SetContentType("application/json")
	ctx.SetBody(body)
}

func ForumThreads(ctx *fasthttp.RequestCtx) {
	forumnameInterface := ctx.UserValue("forumname")

	var forum string
	switch forumnameInterface.(type) {
	case string:
		forum = forumnameInterface.(string)
	default:
		ctx.SetStatusCode(http.StatusBadRequest)
		return
	}

	queryParams := ctx.QueryArgs()

	limitParam := string(queryParams.Peek("limit"))
	var limit = 100
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

	threads, err := SelectThreads(forum, since, limit, desc)
	if len(threads) == 0 {
		if !CheckThread(forum) {
			ctx.SetStatusCode(http.StatusNotFound)
			ctx.SetContentType("application/json")
			ctx.SetBody(jsonToMessage("Can't find forum"))
			return
		}
		ctx.SetContentType("application/json")
		ctx.SetBody([]byte("[]"))
		return
	}

	body, err := json.Marshal(threads)
	if err != nil {
		log.Println(err)
		return
	}

	ctx.SetStatusCode(http.StatusOK)
	ctx.SetContentType("application/json")
	ctx.SetBody(body)

}

func VoteThread(ctx *fasthttp.RequestCtx) {
	forumnameInterface := ctx.UserValue("threadnameOrID")
	var slug string
	switch forumnameInterface.(type) {
	case string:
		slug = forumnameInterface.(string)
	default:
		ctx.SetStatusCode(http.StatusBadRequest)
		return
	}

	var vote models.Vote
	err := json.NewDecoder(bytes.NewReader(ctx.Request.Body())).Decode(&vote)
	if err != nil {
		log.Println(err)
		return
	}

	slugID, err := strconv.Atoi(slug)
	switch err {
	case nil:
		vote.Thread = slugID
	default:
		vote.Thread, err = SelectThreadID(slug)
	}

	if err != nil {
		ctx.SetStatusCode(http.StatusNotFound)
		ctx.SetContentType("application/json")
		ctx.SetBody(jsonToMessage("Can't find thread by slug"))
		return
	}

	err = InsertVote(vote)
	if err != nil {
		if pgErr, ok := err.(pgx.PgError); ok && pgErr.Code == "23505" {
			err = UpdateVote(vote)
			if err != nil {
				ctx.SetStatusCode(http.StatusNotFound)
				ctx.SetContentType("application/json")
				ctx.SetBody(jsonToMessage("Can't find thread by slug"))
				return
			}
		} else {
			ctx.SetStatusCode(http.StatusNotFound)
			ctx.SetContentType("application/json")
			ctx.SetBody(jsonToMessage("Can't find thread by slug"))
			return
		}
	}

	threadUpdate, err := SelectThreadByID(vote.Thread)
	if err != nil {
		log.Println(err)
		return
	}

	body, err := json.Marshal(threadUpdate)
	if err != nil {
		log.Println(err)
		return
	}

	ctx.SetStatusCode(http.StatusOK)
	ctx.SetContentType("application/json")
	ctx.SetBody(body)
}

func GetThreadDetails(ctx *fasthttp.RequestCtx) {
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

	body, err := json.Marshal(thread)
	if err != nil {
		log.Println(err)
		return
	}

	ctx.SetStatusCode(http.StatusOK)
	ctx.SetContentType("application/json")
	ctx.SetBody(body)
}

func EditThread(ctx *fasthttp.RequestCtx) {
	forumnameInterface := ctx.UserValue("threadnameOrID")
	var slug string
	switch forumnameInterface.(type) {
	case string:
		slug = forumnameInterface.(string)
	default:
		ctx.SetStatusCode(http.StatusBadRequest)
		return
	}

	var threadUpdate models.Thread
	err := json.NewDecoder(bytes.NewReader(ctx.Request.Body())).Decode(&threadUpdate)
	if err != nil {
		log.Println(err)
		return
	}

	slugID, err := strconv.Atoi(slug)
	switch err {
	case nil:
		threadUpdate.ID = slugID
	default:
		threadUpdate.Slug.String = slug
	}

	thread, err := UpdateThread(threadUpdate)
	if err != nil {
		ctx.SetStatusCode(http.StatusNotFound)
		ctx.SetContentType("application/json")
		ctx.SetBody(jsonToMessage("Can't find thread by id"))
		return
	}

	body, err := json.Marshal(thread)
	if err != nil {
		log.Println(err)
		return
	}

	ctx.SetStatusCode(http.StatusOK)
	ctx.SetContentType("application/json")
	ctx.SetBody(body)
}

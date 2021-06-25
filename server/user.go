package server

import (
	"bytes"
	"encoding/json"
	"forum_dbms/models"
	"github.com/jackc/pgx"
	"github.com/valyala/fasthttp"
	"log"
	"net/http"
	_ "strings"
)

func jsonToMessage(message string) []byte {
	jsonError, err := json.Marshal(models.Error{Message: message})
	if err != nil {
		return []byte("")
	}
	return jsonError
}

func CreateUser(ctx *fasthttp.RequestCtx) {
	usernameInterface := ctx.UserValue("username")
	var nickname string

	switch usernameInterface.(type) {
	case string:
		nickname = usernameInterface.(string)
	default:
		ctx.SetStatusCode(http.StatusBadRequest)
		return
	}

	var user models.User
	err := json.NewDecoder(bytes.NewReader(ctx.Request.Body())).Decode(&user)
	if err != nil {
		log.Println(err)
		return
	}
	user.Nickname = nickname

	err = InsertUser(user)
	if err != nil {
		users, err := SelectUsers(user.Email, user.Nickname)
		if err != nil {
			log.Println(err)
			return
		}

		body, err := json.Marshal(users)
		if err != nil {
			log.Println(err)
			return
		}

		ctx.SetStatusCode(http.StatusConflict)
		ctx.SetContentType("application/json")
		ctx.SetBody(body)
		return
	}

	body, err := json.Marshal(user)
	if err != nil {
		log.Println(err)
		return
	}

	ctx.SetStatusCode(http.StatusCreated)
	ctx.SetContentType("application/json")
	ctx.SetBody(body)
}

func GetUserProfile(ctx *fasthttp.RequestCtx) {
	usernameInterface := ctx.UserValue("username")
	var nickname string

	switch usernameInterface.(type) {
	case string:
		nickname = usernameInterface.(string)
	default:
		ctx.SetStatusCode(http.StatusBadRequest)
		return
	}


	user, err := SelectUserByNickname(nickname)
	if err != nil {
		ctx.SetStatusCode(http.StatusNotFound)
		ctx.SetContentType("application/json")
		ctx.SetBody(jsonToMessage("Can't find user"))
		return
	}

	body, err := json.Marshal(user)
	if err != nil {
		log.Println(err)
		return
	}

	ctx.SetStatusCode(http.StatusOK)
	ctx.SetContentType("application/json")
	ctx.SetBody(body)
}

func EditUser(ctx *fasthttp.RequestCtx) {
	usernameInterface := ctx.UserValue("username")
	var nickname string

	switch usernameInterface.(type) {
	case string:
		nickname = usernameInterface.(string)
	default:
		ctx.SetStatusCode(http.StatusBadRequest)
		return
	}


	var userUpdate models.User
	err := json.NewDecoder(bytes.NewReader(ctx.Request.Body())).Decode(&userUpdate)
	if err != nil {
		log.Println(err)
		return
	}

	userUpdate.Nickname = nickname
	user, err := UpdateUser(userUpdate)
	if err != nil {
		if pgErr, ok := err.(pgx.PgError); ok && pgErr.Code == "23505" {
			ctx.SetStatusCode(http.StatusConflict)
			ctx.SetContentType("application/json")
			ctx.SetBody(jsonToMessage("This email is already registered"))
			return
		}
		ctx.SetStatusCode(http.StatusNotFound)
		ctx.SetContentType("application/json")
		ctx.SetBody(jsonToMessage("Can't find user"))
		return
	}

	body, err := json.Marshal(user)
	if err != nil {
		log.Println(err)
		return
	}

	ctx.SetStatusCode(http.StatusOK)
	ctx.SetContentType("application/json")
	ctx.SetBody(body)
}

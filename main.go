package main

import (
	"fmt"
	"forum_dbms/models"
	"forum_dbms/server"
	"github.com/fasthttp/router"
	"github.com/jackc/pgx"
	"github.com/valyala/fasthttp"
	"log"
	"time"
)

func loggerMid(req fasthttp.RequestHandler) fasthttp.RequestHandler {
	return fasthttp.RequestHandler(func(ctx *fasthttp.RequestCtx) {
		begin := time.Now()
		req(ctx)
		end := time.Now()
		if end.Sub(begin) > 90*time.Millisecond {
			log.Printf("%s - %s",
				string(ctx.Request.URI().FullURI()),
				end.Sub(begin).String())
		}
	})
}

func runServer(addr string) {
	connString := "host=localhost user=docker password=docker dbname=forum_db sslmode=disable"
	pgxConn, err := pgx.ParseConnectionString(connString)
	if err != nil {
		return
	}

	pgxConn.PreferSimpleProtocol = true

	config := pgx.ConnPoolConfig{
		ConnConfig:     pgxConn,
		MaxConnections: 100,
		AfterConnect:   nil,
		AcquireTimeout: 0,
	}

	models.DB, err = pgx.NewConnPool(config)

	
	router := router.New()

	prefix := "/api"
	router.POST(prefix+"/user/{username}/create", server.CreateUser)
	router.GET(prefix+"/user/{username}/profile", server.GetUserProfile)
	router.POST(prefix+"/user/{username}/profile", server.EditUser)

	router.POST(prefix+"/forum/create", server.CreateForum)
	router.GET(prefix+"/forum/{forumname}/details", server.ForumDetails)
	router.GET(prefix+"/forum/{forumname}/users", server.ForumUsers)
	router.GET(prefix+"/forum/{forumname}/threads", server.ForumThreads)

	router.POST(prefix+"/forum/{forumname}/create", server.CreateThread)
	router.GET(prefix+"/thread/{threadnameOrID}/details", server.GetThreadDetails)
	router.POST(prefix+"/thread/{threadnameOrID}/details", server.EditThread)
	router.GET(prefix+"/thread/{threadnameOrID}/posts", server.ThreadPosts)
	router.POST(prefix+"/thread/{threadnameOrID}/vote", server.VoteThread)

	router.POST(prefix+"/thread/{threadnameOrID}/create", server.CreatePosts)
	router.GET(prefix+"/post/{postID}/details", server.GetPostDetails)
	router.POST(prefix+"/post/{postID}/details", server.EditPostDetails)

	router.GET(prefix+"/service/status", server.StatusHandler)
	router.POST(prefix+"/service/clear", server.ClearHandler)

	fmt.Printf("Starting server at localhost%s\n", addr)
	err = fasthttp.ListenAndServe(addr, loggerMid(router.Handler))
	if err != nil {
		return
	}
}

func main() {
	runServer(":5000")
}

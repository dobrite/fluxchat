package main

import (
	"bytes"
	"encoding/json"
	"github.com/codegangsta/martini-contrib/binding"
	"github.com/go-martini/martini"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Message struct {
	Text      string    `json:"text" binding:"required"`
	Nick      string    `json:"nick" binding:"required"`
	Timestamp time.Time `json:"timestamp"`
}

func escape(str string) string {
	esc := url.QueryEscape(str)
	esc = strings.Replace(esc, "+", " ", -1)
	return esc
}

func bytesToString(input []byte) string {
	buf := new(bytes.Buffer)
	buf.ReadFrom(bytes.NewReader(input))
	return buf.String()
}

func publish(message []byte) {
	str := bytesToString(message)
	esc := escape(str)
	// seems like this would block? goroutine?
	// TODO un-hardcode channel
	url := "http://localhost:9080/pub?id=example"
	resp, err := http.Post(url, "application/json", strings.NewReader(esc))
	if err != nil {
		log.Fatal(err)
	}
	defer resp.Body.Close()
	// do we want to return something here?
}

func main() {
	m := martini.Classic()
	m.Get("/", func(req *http.Request, res http.ResponseWriter) string {
		contents, err := ioutil.ReadFile("public/index.html")
		if err != nil {
			log.Fatal(err)
		}
		res.Write(contents)
		return ""
	})
	m.Post("/pub", binding.Bind(Message{}), func(args martini.Params, message Message) string {
		t := time.Now().UTC()
		log.Println(args["channel"])
		message.Timestamp = t
		m, err := json.Marshal(message)
		if err != nil {
			log.Fatal(err)
		}
		// auth type stuff goes here
		publish(m)
		return "" //actually return something
	})
	m.Run()
}

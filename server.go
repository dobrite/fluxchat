package main

import (
	"github.com/go-martini/martini"
	"io/ioutil"
	"log"
	"net/http"
)

func main() {
	m := martini.Classic()
	m.Get("/", func(res http.ResponseWriter, req *http.Request) string {
		contents, err := ioutil.ReadFile("public/index.html")
		if err != nil {
			log.Fatal(err)
		}
		res.Write(contents)
		return ""
	})
	m.Run()
}

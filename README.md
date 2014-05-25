fluxchat
========

```
$ npm install
$ gulp
```

This uses a martini app but right it's acting as a simple static server so you can just:

```
$ cd public
$ python -m SimpleHTTPServer 3000
```

otherwise use go

```
$ go run server.go
```

This also requires nginx with [nginx-push-stream-module](https://github.com/wandenberg/nginx-push-stream-module) compiled in.

```
$ sudo /usr/local/nginx/sbin/nginx -c <path-to>/nginx-push-stream-module/misc/nginx.conf
```

livereload is supported so download the chrome extension if you want.

gulpfile.js and tasks from the amazing [gulp-starter](https://github.com/greypants/gulp-starter).

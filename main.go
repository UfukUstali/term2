package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var icon []byte

func myFileHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		var err error
		app := req.Context().Value(AppKey).(*App)
		requestedFilename := strings.TrimPrefix(req.URL.Path, "/")

		if strings.HasPrefix(requestedFilename, "@term2") {
			requestedFilename = strings.TrimPrefix(requestedFilename, "@term2")
		} else {
			next.ServeHTTP(res, req)
			return
		}

		if strings.HasPrefix(requestedFilename, ".") {
			if app.dev {
				cwd, err := os.Getwd()
				if err != nil {
					runtime.MessageDialog(app.ctx, runtime.MessageDialogOptions{
						Type:    runtime.ErrorDialog,
						Title:   "Error",
						Message: "Couldn't find CWD",
					})
					runtime.Quit(app.ctx)
				}
				requestedFilename = filepath.Join(cwd, "assets", requestedFilename)
			} else {
				basePath, err := os.UserHomeDir()
				if err != nil {
					runtime.MessageDialog(app.ctx, runtime.MessageDialogOptions{
						Type:    runtime.ErrorDialog,
						Title:   "Error",
						Message: "Couldn't find HOMEDIR",
					})
					runtime.Quit(app.ctx)
				}
				requestedFilename = filepath.Join(basePath, "/.term2/assets", requestedFilename)
			}
		}
		logger.Printf("Requested file: %s\n", requestedFilename)

		if stats, err := os.Stat(requestedFilename); err != nil || stats.IsDir() {
			res.WriteHeader(http.StatusNotFound)
			res.Write([]byte(fmt.Sprintf("File %s not found", requestedFilename)))
			return
		}
		fileData, err := os.ReadFile(requestedFilename)
		if err != nil {
			res.WriteHeader(http.StatusBadRequest)
			res.Write([]byte(fmt.Sprintf("Could not load file %s", requestedFilename)))
		}

		res.Write(fileData)

		res.Header().Set("Content-Type", mime.TypeByExtension(filepath.Ext(requestedFilename)))
		res.Header().Set("Content-Length", fmt.Sprintf("%d", len(fileData)))
	})
}

type mainKey int

const (
	AppKey mainKey = iota
)

func main() {
	var err error
	tempDir := os.TempDir()
	logFile, err = os.OpenFile(filepath.Join(tempDir, "term2.txt"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		panic(err)
	}
	logger = log.New(logFile, "App ", log.Lshortfile|log.Lmsgprefix|log.Ltime)

	flag.Parse()
	dev := flag.Arg(0) == "dev"
	// Create an instance of the app structure
	app := NewApp(dev)

	appName := "term2"

	// Create application with options
	err = wails.Run(&options.App{
		Title:     appName,
		Width:     1024,
		Height:    768,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
			Middleware: assetserver.ChainMiddleware(func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), AppKey, app)))
				})
			}, myFileHandler),
		},
		Windows: &windows.Options{
			Theme: windows.Dark,
		},
		Linux: &linux.Options{
			Icon:        icon,
			ProgramName: appName,
		},
		Mac: &mac.Options{
			About: &mac.AboutInfo{
				Title: appName,
				Icon:  icon,
			},
		},
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: "fToKHxo3iuaCiSNhBB8EELCsvy03EvV5npJur7neMFc",
			OnSecondInstanceLaunch: func(secondInstanceData options.SecondInstanceData) {
				runtime.WindowUnminimise(app.ctx)
				runtime.Show(app.ctx)
			},
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	pty "github.com/UfukUstali/go-pty"
	ws "github.com/gorilla/websocket"
	"github.com/skratchdot/open-golang/open"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

var (
	logFile   *os.File
	logger    *log.Logger
	idCounter int = 0
)

var (
	causeProcessAwait    = errors.New("process await")
	causeFrontendClose   = errors.New("frontend close")
	causeClosingMultiple = errors.New("shutdown")
)

type Terminal struct {
	pty       pty.Pty
	process   pty.Child
	paused    bool
	connected bool
	cleanup   uint8
	toggle    chan struct{}
	read      chan []byte
	write     chan []byte
	ctx       context.Context
	cancel    context.CancelCauseFunc
	mutex     sync.Mutex
}

type Terminals struct {
	terminals map[int]*Terminal
	mutex     sync.Mutex
}

type key int

const (
	TerminalsKey key = iota
	FrontendAuthKey
	WebsocketPortKey
)

type TerminalConfig struct {
	Size    *PtySize `json:"size"`
	Command string   `json:"command"`
	Args    []string `json:"args"`
	Cwd     *string  `json:"cwd"`
}

type PtySize struct {
	Rows        uint16 `json:"rows"`
	Cols        uint16 `json:"cols"`
	PixelWidth  uint16 `json:"pixelWidth"`
	PixelHeight uint16 `json:"pixelHeight"`
}

type App struct {
	ctx context.Context
	dev bool
}

func NewApp(dev bool) *App {
	return &App{
		dev: dev,
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = context.WithValue(ctx, TerminalsKey, &Terminals{
		make(map[int]*Terminal),
		sync.Mutex{},
	})

	randBytes := make([]byte, 32)
	rand.Read(randBytes)
	a.ctx = context.WithValue(a.ctx, FrontendAuthKey, hex.EncodeToString(randBytes))

	var certFile string
	var keyFile string
	if a.dev {
		certFile = "./certs/localhost.pem"
		keyFile = "./certs/localhost-key.pem"
	} else {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
				Type:    runtime.ErrorDialog,
				Title:   "Error",
				Message: "Couldn't find HOMEDIR",
			})
			runtime.Quit(a.ctx)
		}
		certFile = homeDir + "/.term2/certs/localhost.pem"
		keyFile = homeDir + "/.term2/certs/localhost-key.pem"
	}

	if _, err := os.Stat(certFile); errors.Is(err, fs.ErrNotExist) {
		runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
			Type:    runtime.ErrorDialog,
			Title:   "Error",
			Message: "Certificate file not found under: " + certFile + ". Read the README",
		})
		runtime.Quit(a.ctx)
	}
	if _, err := os.Stat(keyFile); errors.Is(err, fs.ErrNotExist) {
		runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
			Type:    runtime.ErrorDialog,
			Title:   "Error",
			Message: "Key file not found under: " + keyFile + ". Read the README",
		})
		runtime.Quit(a.ctx)
	}

	cert, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
			Type:    runtime.ErrorDialog,
			Title:   "Error",
			Message: "Couldn't load certificate: " + err.Error(),
		})
		runtime.Quit(a.ctx)
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/health/{id}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		// Allow specific methods
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		// Allow specific headers
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		// Handle preflight (OPTIONS) requests
		if r.Method == "OPTIONS" {
			return
		}
		id, err := strconv.Atoi(r.PathValue("id"))
		if err != nil {
			logger.Println("No or bad id provided")
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		terminals := a.ctx.Value(TerminalsKey).(*Terminals)
		term, ok := terminals.terminals[id]
		if !ok {
			logger.Println("Terminal not found")
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if term.connected {
			logger.Println("Terminal already connected")
			w.WriteHeader(http.StatusConflict)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	mux.HandleFunc("/pty/ws/{id}", func(w http.ResponseWriter, r *http.Request) {
		// legend:
		// handle incoming messages:
		//   a: auth
		//   p: pause
		//   r: resume
		//   w: write
		//   s: size
		//   c: close
		// send outgoing messages:
		//   a: auth
		//   d: data
		//   e: exit
		//   k: keepalive
		id, err := strconv.Atoi(r.PathValue("id"))
		if err != nil {
			logger.Println("No or bad id provided")
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		terminals := a.ctx.Value(TerminalsKey).(*Terminals)
		term, ok := terminals.terminals[id]
		if !ok {
			logger.Println("Terminal not found")
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if term.connected {
			logger.Println("Terminal already connected")
			w.WriteHeader(http.StatusConflict)
			return
		}

		upgrader := ws.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			logger.Println(err)
			return
		}
		term.mutex.Lock()
		term.connected = true
		term.cleanup = 0
		term.mutex.Unlock()

		go func() {
			defer conn.Close()
			authed := false
			for {
				_, message, err := conn.ReadMessage()
				if err != nil {
					logger.Println(err)
					term.mutex.Lock()
					term.connected = false
					term.mutex.Unlock()
					return
				}
				select {
				case <-term.ctx.Done():
					return
				default:
					if (!authed) && message[0] != 'a' {
						logger.Println("Not authed")
						continue
					}
					switch message[0] {
					case 'a': // auth
						authToken := string(message[1:])
						if authed = authToken == a.ctx.Value(FrontendAuthKey); !authed {
							logger.Printf("Invalid auth %s\n", authToken)
							return
						}
						conn.WriteMessage(ws.TextMessage, []byte("a"))
					case 'p': // pause
						if !term.paused {
							term.toggle <- struct{}{}
							term.paused = true
						}
					case 'r': // resume
						if term.paused {
							term.toggle <- struct{}{}
							term.paused = false
						}
					case 'w': // write
						term.write <- message[1:]
					case 's': // size
						size := bytes.Split(message[1:], []byte{'x'})
						rows, _ := strconv.Atoi(string(size[0]))
						cols, _ := strconv.Atoi(string(size[1]))
						term.pty.Resize(pty.PtySize{
							Rows:        uint16(rows),
							Cols:        uint16(cols),
							PixelWidth:  0,
							PixelHeight: 0,
						})
					case 'c': // close
						term.cancel(causeFrontendClose)
						return
					default:
						logger.Printf("Unknown message %s\n", message)
					}
				}
			}
		}()

		go func() {
			defer conn.Close()
			ticker := time.NewTicker(10 * time.Second)
			var data []byte
			for {
				select {
				case <-term.ctx.Done():
					data = []byte("e") // exit
				case data, ok = <-term.read:
					if !ok {
						return
					}
					data = append([]byte("d"), data...) // data
				case <-ticker.C:
					data = []byte("k") // keepalive
				}

				if err := conn.WriteMessage(ws.TextMessage, data); err != nil {
					logger.Println(err)
					term.mutex.Lock()
					term.connected = false
					term.mutex.Unlock()
					return
				}
				if data[0] == 'e' {
					return
				}
			}
		}()
	})

	port := 34373
	for ; port < 65535; port++ {
		listener, err := net.Listen("tcp", fmt.Sprintf("localhost:%d", port))
		if err != nil {
			continue
		}
		listener.Close()
		break
	}
	if port == 65535 {
		runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
			Type:    runtime.ErrorDialog,
			Title:   "Error",
			Message: "Could not find a free port",
		})
		runtime.Quit(a.ctx)
	}
	a.ctx = context.WithValue(a.ctx, WebsocketPortKey, port)

	server := http.Server{
		Addr:      fmt.Sprintf("localhost:%d", port),
		TLSConfig: &tls.Config{Certificates: []tls.Certificate{cert}},
		Handler:   mux,
		BaseContext: func(listener net.Listener) context.Context {
			return a.ctx
		},
	}

	go func() {
		if err := server.ListenAndServeTLS("", ""); err != nil {
			logger.Println(err)
		}
	}()

	go func() {
		ticker := time.NewTicker(10 * time.Second)
		terminals := a.ctx.Value(TerminalsKey).(*Terminals)
		for {
			select {
			case <-a.ctx.Done():
				return
			case <-ticker.C:
				terminals.mutex.Lock()
				ids := make([]int, 0, len(terminals.terminals))
				for id, term := range terminals.terminals {
					term.mutex.Lock()
					if !term.connected {
						term.cleanup++
						if term.cleanup >= 2 {
							ids = append(ids, id)
						}
					}
					term.mutex.Unlock()
				}
				for _, id := range ids {
					terminals.terminals[id].cancel(causeClosingMultiple)
					delete(terminals.terminals, id)
				}
				terminals.mutex.Unlock()
			}
		}
	}()
}

func (a *App) shutdown(_ context.Context) {
	terminals := a.ctx.Value(TerminalsKey).(*Terminals)
	ids := make([]int, 0, len(terminals.terminals))

	terminals.mutex.Lock()
	for id := range terminals.terminals {
		ids = append(ids, id)
	}
	for _, id := range ids {
		terminals.terminals[id].cancel(causeClosingMultiple)
		delete(terminals.terminals, id)
	}
	terminals.mutex.Unlock()
}

func (a *App) GetDetails(lastId int) string {
	go func() {
		terminals := a.ctx.Value(TerminalsKey).(*Terminals)
		terminals.mutex.Lock()
		ids := make([]int, 0, len(terminals.terminals)-1)
		for id := range terminals.terminals {
			if id == lastId {
				continue
			}
			ids = append(ids, id)
		}
		for _, id := range ids {
			terminals.terminals[id].cancel(causeClosingMultiple)
			delete(terminals.terminals, id)
		}
		terminals.mutex.Unlock()
	}()
	return fmt.Sprintf("%v:%v", (a.ctx.Value(FrontendAuthKey)), (a.ctx.Value(WebsocketPortKey)))
}

func (a *App) CreateTerminal(config TerminalConfig) (int, error) {
	id := idCounter
	idCounter++

	var size pty.PtySize
	if config.Size != nil {
		size = pty.PtySize{
			Rows:        config.Size.Rows,
			Cols:        config.Size.Cols,
			PixelWidth:  config.Size.PixelWidth,
			PixelHeight: config.Size.PixelHeight,
		}
	} else {
		size = pty.DefaultPtySize()
	}
	pty, err := pty.NewPty(size)
	if err != nil {
		logger.Println(err)
		return -1, err
	}

	cmd := exec.Command(config.Command, config.Args...)
	if config.Cwd != nil {
		cmd.Dir = *config.Cwd
	} else if a.dev {
		dir, err := os.Getwd()
		if err != nil {
			logger.Println(err)
		} else {
			cmd.Dir = dir
		}
	} else {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			logger.Println(err)
		} else {
			cmd.Dir = homeDir
		}
	}
	cmd.Env = append(cmd.Environ(), "TERM_PROGRAM=term2", "TERM=xterm-256color")

	process, err := pty.SpawnCommand(cmd)
	if err != nil {
		logger.Println(err)
		return -1, err
	}

	reader, err := pty.TakeReader()
	if err != nil {
		logger.Println(err)
		return -1, err
	}

	writer, err := pty.TakeWriter()
	if err != nil {
		logger.Println(err)
		return -1, err
	}

	toggle := make(chan struct{})
	read := make(chan []byte)
	write := make(chan []byte)

	ctx, cancel := context.WithCancelCause(a.ctx)

	term := &Terminal{
		pty,
		process,
		true,
		false,
		0,
		toggle,
		read,
		write,
		ctx,
		cancel,
		sync.Mutex{},
	}

	go waitThread(ctx, id, term)

	go readThread(ctx, reader, read, toggle)

	go writeThread(ctx, writer, write)

	terminals := a.ctx.Value(TerminalsKey).(*Terminals)

	terminals.mutex.Lock()
	terminals.terminals[id] = term
	terminals.mutex.Unlock()

	return id, nil
}

func (a *App) ConsoleLog(message string) {
	logger.Println(message)
}

func (a *App) ReadConfigFile() string {
	var fileAddress string
	var err error
	if a.dev {
		fileAddress = "./config.json"
	} else {
		fileAddress, err = os.UserHomeDir()
		if err != nil {
			runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
				Type:    runtime.ErrorDialog,
				Title:   "Error",
				Message: "Couldn't find HOMEDIR",
			})
			runtime.Quit(a.ctx)
			return ""
		}
		fileAddress += "/.term2/config.json"
	}

	file, err := os.ReadFile(fileAddress)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			err = os.WriteFile(fileAddress, []byte(DefaultKeybinds), 0644)
			if err != nil {
				runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
					Type:    runtime.ErrorDialog,
					Title:   "Error",
					Message: "Couldn't create default config file",
				})
				runtime.Quit(a.ctx)
				return ""
			}
			return DefaultKeybinds
		}
		return ""
	}
	return string(file)
}

func (a *App) ExitWithErr(msg string) {
	runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:    runtime.ErrorDialog,
		Title:   "Error",
		Message: msg,
	})
	runtime.Quit(a.ctx)
}

func (a *App) OpenConfigFile() {
	var fileAddress string
	var err error
	if a.dev {
		cwd, err := os.Getwd()
		if err != nil {
			runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
				Type:    runtime.ErrorDialog,
				Title:   "Error",
				Message: "Couldn't find CWD",
			})
			runtime.Quit(a.ctx)
			return
		}
		fileAddress = filepath.Join(cwd, "./config.json")
	} else {
		fileAddress, err = os.UserHomeDir()
		if err != nil {
			runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
				Type:    runtime.ErrorDialog,
				Title:   "Error",
				Message: "Couldn't find HOMEDIR",
			})
			runtime.Quit(a.ctx)
			return
		}
		fileAddress += "/.term2/config.json"
	}
	open.Start(fileAddress)
}

func readThread(c context.Context, r io.Reader, channel chan<- []byte, toggle <-chan struct{}) {
	defer close(channel)
	<-toggle
	buf := make([]byte, 4096)
	for {
		select {
		case <-c.Done():
			return
		case <-toggle: // pause
			<-toggle // resume
		default:
			n, err := r.Read(buf)
			if err != nil {
				if err != io.EOF {
					logger.Println(err)
				}
				return
			}
			select {
			case channel <- buf[:n]:
				continue
			case <-c.Done():
				return
			}
		}
	}
}

func writeThread(c context.Context, w io.Writer, channel <-chan []byte) {
	for {
		select {
		case <-c.Done():
			return
		case input, ok := <-channel:
			if !ok {
				return
			}
			for len(input) > 0 {
				n, err := w.Write(input)
				if err != nil {
					logger.Println(err)
					return
				}
				input = input[n:]
			}
		}
	}
}

func waitThread(c context.Context, id int, term *Terminal) {
	go func() {
		term.process.Wait()
		term.cancel(causeProcessAwait)
	}()

	<-c.Done()

	cause := c.Err()

	if cause != causeClosingMultiple {
		terminals := c.Value(TerminalsKey).(*Terminals)
		terminals.mutex.Lock()
		delete(terminals.terminals, id)
		terminals.mutex.Unlock()
	}

	close(term.toggle)
	close(term.write)

	if cause != causeProcessAwait {
		term.process.Kill()
	}
	term.pty.Close()
}

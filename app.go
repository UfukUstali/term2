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
	"strconv"
	"sync"
	"time"

	pty "github.com/UfukUstali/go-pty"
	ws "github.com/gorilla/websocket"
)

var logger = log.New(os.Stdout, "App ", log.Lshortfile|log.Lmsgprefix)

type Terminal struct {
	pty     pty.Pty
	process pty.Child
	paused  bool
	toggle  chan struct{}
	read    chan []byte
	write   chan []byte
	exit    chan struct{}
	ctx     context.Context
	cancel  context.CancelCauseFunc
}

type Terminals struct {
	terminals map[int]*Terminal
	mutex     sync.Mutex
}

type key int

const (
	TerminalsKey     key = 0
	FrontendAuthKey  key = 1
	WebsocketPortKey key = 2
)

var idCounter int = 0

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
			panic(err)
		}
		certFile = homeDir + "/.term2/certs/localhost.pem"
		keyFile = homeDir + "/.term2/certs/localhost-key.pem"
	}

	if _, err := os.Stat(certFile); errors.Is(err, fs.ErrNotExist) {
		panic(fmt.Sprintf("Certificate file not found under: %s. Read the README", certFile))
	}
	if _, err := os.Stat(keyFile); errors.Is(err, fs.ErrNotExist) {
		panic(fmt.Sprintf("Key file not found under: %s. Read the README", keyFile))
	}

	cert, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		panic(err)
	}

	mux := http.NewServeMux()

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
			return
		}

		go func() {
			defer conn.Close()
			authed := false
			for {
				select {
				case <-term.ctx.Done():
					return
				default:
					_, message, err := conn.ReadMessage()
					if err != nil {
						if !errors.Is(err, net.ErrClosed) {
							logger.Println(err)
						}
						return
					}
					if !authed && message[0] != 'a' {
						logger.Printf("Auth required %s\n", message)
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
						term.exit <- struct{}{}
						return
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
				case data = <-term.read:
					data = append([]byte("d"), data...) // data
				case <-ticker.C:
					data = []byte("k") // keepalive
				}

				if err := conn.WriteMessage(ws.TextMessage, data); err != nil {
					if !errors.Is(err, net.ErrClosed) {
						logger.Println(err)
					}
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
		panic("Could not find a free port")
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
}

func (a *App) shutdown(c context.Context) {
	terminals := c.Value(TerminalsKey).(*Terminals)
	for _, term := range terminals.terminals {
		term.exit <- struct{}{}
	}
}

func (a *App) GetDetails(lastId int) string {
	defer func() {
		terminals := a.ctx.Value(TerminalsKey).(*Terminals)
		// close all terminals except the last one
		for id, term := range terminals.terminals {
			if id != lastId {
				term.exit <- struct{}{}
			}
		}
	}()
	details := fmt.Sprintf("%v:%v", (a.ctx.Value(FrontendAuthKey)), (a.ctx.Value(WebsocketPortKey)))
	return details
}

func (a *App) CreateTerminal(config TerminalConfig) (int, error) {
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
	exit := make(chan struct{})

	ctx, cancel := context.WithCancelCause(a.ctx)

	terminals := a.ctx.Value(TerminalsKey).(*Terminals)

	id := idCounter
	idCounter++

	terminals.mutex.Lock()
	terminals.terminals[id] = &Terminal{
		pty,
		process,
		true,
		toggle,
		read,
		write,
		exit,
		ctx,
		cancel,
	}
	terminals.mutex.Unlock()

	go readThread(ctx, reader, id)

	go writeThread(ctx, writer, id)

	go waitThread(ctx, id)

	return id, nil
}

func (a *App) ConsoleLog(message string) {
	logger.Println(message)
}

func (a *App) ReadConfigFile() string {
	var fileAddress string
	if a.dev {
		fileAddress = "./keybinds.json"
	} else {
		fileAddress, err := os.UserHomeDir()
		if err != nil {
			logger.Fatalln(err)
			return ""
		}
		fileAddress += "/.term2/keybinds.json"
	}

	file, err := os.ReadFile(fileAddress)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			err = os.WriteFile(fileAddress, []byte(DefaultKeybinds), 0644)
			if err != nil {
				logger.Fatalln(err)
				return ""
			}
			return DefaultKeybinds
		}
		return ""
	}
	return string(file)
}

func readThread(c context.Context, r io.Reader, id int) {
	terminals := c.Value(TerminalsKey).(*Terminals)
	term := terminals.terminals[id]

	buf := make([]byte, 4096)
	<-term.toggle
	for {
		select {
		case <-c.Done():
			return
		case <-term.toggle: // pause
			<-term.toggle // resume
		default:
			n, err := r.Read(buf)
			if err != nil {
				if err != io.EOF {
					logger.Println(err)
				}
				return
			}
			term.read <- buf[:n]
		}
	}
}

func writeThread(c context.Context, w io.Writer, id int) {
	terminals := c.Value(TerminalsKey).(*Terminals)
	term := terminals.terminals[id]

	for {
		select {
		case <-c.Done():
			return
		case input := <-term.write:
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

func waitThread(c context.Context, id int) {
	terminals := c.Value(TerminalsKey).(*Terminals)
	term := terminals.terminals[id]

	go func() {
		term.process.Wait()
		if c.Err() != nil {
			return
		}
		term.exit <- struct{}{}
	}()

	select {
	case <-c.Done():
		break
	case <-term.exit:
		break
	}
	if !(c.Err() == ErrCleanup) {
		cleanup(terminals, id)
	}
}

var ErrCleanup = errors.New("cleanup")

func cleanup(terminals *Terminals, id int) {
	term := terminals.terminals[id]
	term.cancel(ErrCleanup)
	close(term.toggle)
	close(term.write)
	close(term.read)
	close(term.exit)
	term.process.Kill()
	term.pty.Close()
	terminals.mutex.Lock()
	delete(terminals.terminals, id)
	terminals.mutex.Unlock()
}

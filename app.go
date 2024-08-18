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
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"time"

	pty "github.com/UfukUstali/go-pty"
	ws "github.com/gorilla/websocket"
)

var logger = log.New(os.Stdout, "App ", log.Lshortfile|log.Lmsgprefix)

type Terminal struct {
	pty     pty.Pty
	process pty.Child
	paused  bool
	toggle  chan byte
	read    chan []byte
	write   chan []byte
	exit    chan byte
	ctx     context.Context
	cancel  context.CancelCauseFunc
}

type key int

const (
	TerminalsKey     key = 0
	FrontendAuthKey  key = 1
	WebsocketPortKey key = 2
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
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = context.WithValue(ctx, TerminalsKey, make(map[int]*Terminal))

	randBytes := make([]byte, 32)
	rand.Read(randBytes)
	a.ctx = context.WithValue(a.ctx, FrontendAuthKey, hex.EncodeToString(randBytes))

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
		logger.Println("Could not find a free port")
	}
	a.ctx = context.WithValue(a.ctx, WebsocketPortKey, port)

	cert, err := tls.LoadX509KeyPair("./certs/localhost.pem", "./certs/localhost-key.pem")
	if err != nil {
		logger.Println(err)
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

		logger.Printf("New connection for terminal %d\n", id)
		terminals := a.ctx.Value(TerminalsKey).(map[int]*Terminal)
		term, ok := terminals[id]
		if !ok {
			logger.Println("Terminal not found")
			return
		}

		go func() {
			defer conn.Close()
			var authed bool = false
			for {
				select {
				case <-term.ctx.Done():
					return
				default:
					_, message, err := conn.ReadMessage()
					if err != nil {
						logger.Println(err)
						break
					}
					if !authed && message[0] != 'a' {
						logger.Println("Auth required")
						continue
					}
					switch message[0] {
					case 'a': // auth
						authToken := string(message[1:])
						if authed = authToken != a.ctx.Value(FrontendAuthKey); !authed {
							logger.Printf("Invalid auth %s\n", authToken)
							return
						}
						conn.WriteMessage(ws.TextMessage, []byte("a"))
					case 'p': // pause
						if !term.paused {
							term.toggle <- 0
							term.paused = true
						}
						logger.Println("Paused")
					case 'r': // resume
						if term.paused {
							term.toggle <- 0
							term.paused = false
						}
						logger.Println("Resumed")
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
						term.exit <- 0
					}
				}
			}
		}()

		go func() {
			defer conn.Close()
			ticker := time.NewTicker(10 * time.Second)
			for {
				select {
				case <-term.ctx.Done():
					conn.WriteMessage(ws.TextMessage, []byte("e")) // exit
					return
				case data := <-term.read:
					conn.WriteMessage(ws.TextMessage, append([]byte("d"), data...)) // data
				case <-ticker.C:
					conn.WriteMessage(ws.TextMessage, []byte("k")) // keepalive
				}
			}
		}()
	})

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
	terminals := c.Value(TerminalsKey).(map[int]*Terminal)
	for _, term := range terminals {
		term.exit <- 0
	}
}

func (a *App) GetDetails() string {
	details := fmt.Sprintf("%v:%v", (a.ctx.Value(FrontendAuthKey)), (a.ctx.Value(WebsocketPortKey)))
	logger.Println(details)
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

	toggle := make(chan byte)
	read := make(chan []byte)
	write := make(chan []byte)
	exit := make(chan byte)

	ctx, cancel := context.WithCancelCause(a.ctx)

	terminals := a.ctx.Value(TerminalsKey).(map[int]*Terminal)
	id := len(terminals)

	terminals[id] = &Terminal{
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

	fmt.Println("Terminal created with id:", id)

	go readThread(ctx, reader, id)

	go writeThread(ctx, writer, id)

	go waitThread(ctx, id)

	return id, nil
}

func (a *App) ConsoleLog(message string) {
	logger.Println(message)
}

func readThread(c context.Context, r io.Reader, id int) {
	terminals := c.Value(TerminalsKey).(map[int]*Terminal)
	term := terminals[id]

	buf := make([]byte, 4096)
	<-term.toggle
	for {
		select {
		case <-c.Done():
			return
		case <-term.toggle:
			logger.Println("Paused")
			<-term.toggle
			logger.Println("Resumed")
		default:
			n, err := r.Read(buf)
			if err != nil {
				logger.Println(err)
				term.exit <- 0
			}
			term.read <- buf[:n]
		}
	}
}

func writeThread(c context.Context, w io.Writer, id int) {
	terminals := c.Value(TerminalsKey).(map[int]*Terminal)
	term := terminals[id]

	for {
		select {
		case <-c.Done():
			return
		case input := <-term.write:
			for len(input) > 0 {
				n, err := w.Write(input)
				if err != nil {
					logger.Println(err)
					term.exit <- 0
				}
				input = input[n:]
			}
		}
	}
}

func waitThread(c context.Context, id int) {
	terminals := c.Value(TerminalsKey).(map[int]*Terminal)
	term := terminals[id]

	go func() {
		term.process.Wait()
		if c.Err() != nil {
			return
		}
		term.exit <- 0
	}()

	select {
	case <-term.exit:
		break
	case <-c.Done():
		break
	}
	if !(c.Err() == ErrCleanup) {
		cleanup(terminals, id)
	}
}

var ErrCleanup = errors.New("cleanup")

func cleanup(terminals map[int]*Terminal, id int) {
	term := terminals[id]
	term.cancel(ErrCleanup)
	close(term.toggle)
	close(term.write)
	close(term.read)
	close(term.exit)
	term.process.Kill()
	term.pty.Close()
	delete(terminals, id)
}

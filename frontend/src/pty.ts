import { GetDetails, ConsoleLog } from "@@/wailsjs/go/main/App";

let details: ((lastId: number) => Promise<string[]>) | string[] = async (
  lastId: number,
) => {
  const details = await GetDetails(lastId);
  return details.split(":");
};

class Pty {
  private ws: WebSocket;
  private buffer: string[] = [];
  private paused = true;
  private closed = false;
  public openPromise: Promise<void>;

  private constructor(id: number, port: number, authToken: string) {
    this.ws = new WebSocket(`wss://localhost:${port}/pty/ws/${id}`);

    let authPromiseResolve: (value: void) => void;
    this.openPromise = new Promise<void>((resolve) => {
      this.ws.onopen = async () => {
        this.ws.send(`a${authToken}`);
        await new Promise((r) => (authPromiseResolve = r)); // wait for auth response
        this.ws.send("r"); // resume
        resolve();
      };
    }).then(() => {
      this.paused = false;
    });

    this.ws.onmessage = (event) => {
      const prefix = (event.data as string)[0];
      const data = (event.data as string).substring(1);
      switch (prefix) {
        case "a": // auth
          authPromiseResolve();
        case "d": // data
          if (this.paused) {
            this.buffer.push(data);
          } else if (this.onData) {
            while (this.buffer.length > 0) {
              this.onData(this.buffer.pop()!);
            }
            this.onData(data);
          } else {
            this.buffer.push(data);
          }
          break;
        case "e": // exit
          if (this.onClose) {
            this.closed = true;
            this.onClose();
          }
          break;
        case "k": // keepalive
          break;
        default:
          console.error(`unexpected prefix: "${prefix}"\nwith data: ${data}`);
      }
    };
    this.ws.onclose = (event) => {
      if (!this.closed) {
        console.error("pty websocket closed unexpectedly", event.reason);
        ConsoleLog("pty websocket closed unexpectedly" + event.reason);
      }
    };
    this.ws.onerror = (_) => {
      console.error("pty websocket error");
      ConsoleLog("pty websocket error");
    };
  }

  static async create(id: number) {
    if (typeof details === "function") {
      details = await details(id);
    }
    if (details.length !== 2) {
      throw new Error("invalid details");
    }
    return new Pty(id, parseInt(details[1]), details[0]);
  }

  public onData: ((data: string) => void) | undefined;

  public onClose: (() => void) | undefined;

  public pause() {
    this.ws.send("p"); // pause
    this.paused = true;
  }

  public resume() {
    this.ws.send("r"); // resume
    this.paused = false;
  }

  public write(data: string) {
    const message = `w${data}`;
    this.ws.send(message); // write
  }

  public resize(rows: number, cols: number) {
    const message = `s${rows}x${cols}`;
    this.ws.send(message); // size
  }

  public destroy() {
    this.closed = true;
    this.ws.send("c"); // close
    this.ws.close();
  }
}

export default Pty;

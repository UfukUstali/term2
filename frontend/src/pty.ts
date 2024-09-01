import { GetDetails, ConsoleLog } from "@@/wailsjs/go/main/App";
import { destroyTerminal } from "@/store";

type ptyStatus = "connecting" | "connected" | "disconnected";

let details: ((lastId: number) => Promise<string[]>) | string[] = async (
  lastId: number,
) => {
  const details = await GetDetails(lastId);
  return details.split(":");
};

class Pty {
  private id: number;
  private ws: WebSocket;
  private receiveBuffer: string[] = [];
  private sendBuffer: string[] = [];
  private paused = true;
  private authPromiseResolve: ((_: void) => void) | undefined;
  private _status = ref<ptyStatus>("connecting");
  public status = computed(() => this._status.value);

  private static authToken: string;
  private static port: number;

  private constructor(id: number) {
    this.id = id;
    this.ws = new WebSocket(`wss://localhost:${Pty.port}/pty/ws/${this.id}`);

    this.ws.onopen = () => this.onopen();
    this.ws.onmessage = (event) => this.onmessage(event);
    this.ws.onclose = () => this.onclose();
    this.ws.onerror = () => this.onerror();
  }

  static async create(id: number) {
    if (typeof details === "function") {
      details = await details(id);
    }
    if (details.length !== 2) {
      throw new Error("invalid details");
    }
    Pty.port = parseInt(details[1]);
    Pty.authToken = details[0];
    return new Pty(id);
  }

  public onData: ((data: string) => void) | undefined;

  public onClose: (() => void) | undefined;

  public pause() {
    this.sendWithBuffer("p"); // pause
    this.paused = true;
  }

  public resume() {
    this.sendWithBuffer("r"); // resume
    this.paused = false;
    if (this.onData) {
      while (this.receiveBuffer.length > 0) {
        this.onData(this.receiveBuffer.pop()!);
      }
    }
  }

  public write(data: string) {
    const message = `w${data}`;
    this.sendWithBuffer(message); // write
  }

  public resize(rows: number, cols: number) {
    const message = `s${rows}x${cols}`;
    this.sendWithBuffer(message); // size
  }

  public destroy() {
    this._status.value = "disconnected";
    this.sendWithBuffer("c"); // close
    this.ws.close();
  }

  private async onopen() {
    this.ws.send(`a${Pty.authToken}`);
    await new Promise((r) => (this.authPromiseResolve = r)); // wait for auth response
    this.ws.send("r"); // resume
    this.paused = false;
    this.sendBuffered();
    this._status.value = "connected";
  }

  private onmessage(event: MessageEvent) {
    const prefix = (event.data as string)[0];
    const data = (event.data as string).substring(1);
    switch (prefix) {
      case "a": // auth
        this.authPromiseResolve && this.authPromiseResolve();
      case "d": // data
        if (this.paused || !this.onData) {
          this.receiveBuffer.unshift(data);
          return;
        }
        while (this.receiveBuffer.length > 0) {
          this.onData(this.receiveBuffer.pop()!);
        }
        this.onData(data);
        break;
      case "e": // exit
        this._status.value = "disconnected";
        if (this.onClose) {
          this.onClose();
        }
        break;
      case "k": // keepalive
        break;
      default:
        console.error(`unexpected prefix: "${prefix}"\nwith data: ${data}`);
    }
  }

  private async onclose() {
    if (this.status.value === "connected") {
      this._status.value = "connecting";
      let healthy = false;
      while (!healthy) {
        try {
          const res = await fetch(
            `https://localhost:${Pty.port}/health/${this.id}`,
          );
          switch (res.status) {
            case 200:
              healthy = true;
              break;
            case 400:
              ConsoleLog(`pty.ts/reconnect: 400; ${this.id}`);
              return;
            case 404:
              destroyTerminal(this.id);
              return;
            case 409:
              ConsoleLog("pty.ts/reconnect: 409");
            default:
              await new Promise((r) => setTimeout(r, 100));
          }
        } catch (e) {
          console.error(e);
        }
      }
      this.ws = new WebSocket(`wss://localhost:${Pty.port}/pty/ws/${this.id}`);
      this.ws.onopen = () => this.onopen();
      this.ws.onmessage = (event) => this.onmessage(event);
      this.ws.onclose = () => this.onclose();
      this.ws.onerror = () => this.onerror();
    }
  }

  private onerror() {
    this.onClose && this.onClose();
    ConsoleLog("pty websocket error");
  }

  private sendWithBuffer(data: string) {
    if (this.status.value === "connected") {
      if (this.sendBuffer.length > 0) {
        this.sendBuffered();
      }
      this.ws.send(data);
    } else {
      this.sendBuffer.unshift(data);
    }
  }

  private sendBuffered() {
    while (this.sendBuffer.length > 0) {
      this.ws.send(this.sendBuffer.pop()!);
    }
  }
}

export default Pty;

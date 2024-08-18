# TODO

- [ ] major refactors
  - [x] cleanup the backend logic
  - [ ] keyboard shortcuts
    - [ ] read shortcut bindings from a json file
    - [ ] split into 2 groups global or through xterm
  - [ ] tab switch logic
    - [ ] absolute positioning or overflow hide
- [ ] new features
  - [ ] settings tab with a visualized json file configurator
  - [ ] integration scripts
    - [ ] powershell
    - [ ] bash
    - [ ] zsh?

# For Usage or Development

- Check out [mkcert](https://github.com/FiloSottile/mkcert)
  - generate a key pair for `localhost` and put them in `./certs`
  - run the `-install` command
  - or use an existing already **trusted** TLS cert pair for `localhost`

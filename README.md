# TODO

- [x] major refactors
  - [x] cleanup the backend logic
  - [x] keyboard shortcuts
    - [x] rewrite the logic
    - [x] read shortcut bindings from a json file
  - [x] tab switch logic
    - [x] absolute positioning or overflow hide
- [ ] new features
  - [x] reset app on `vite:beforeUpdate` for `js` HMRs files
  - [ ] link addon
  - [ ] settings tab with a visualized json file configurator
  - [ ] integration scripts
    - [ ] powershell
    - [ ] bash
    - [ ] zsh?
- [ ] fixes
  - [ ] reconnect after hibernation
  - [ ] resource cleanup (after a panic)
  - [ ] logs disappearing

# For Usage or Development

- Check out [mkcert](https://github.com/FiloSottile/mkcert)
  - generate a key pair for `localhost` and put them in `./certs` (in dev) and `<HOMEDIR>/.term2/certs` (in prod)
  - run the `-install` command
  - or use an existing already **trusted** TLS cert pair for `localhost`

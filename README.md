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
  - [x] terminal profiles
  - [ ] ~~settings tab with a visualized json file configurator~~
  - [x] shortcut action to go to `config.json`
  - [ ] integration scripts
    - [ ] powershell
    - [ ] bash
    - [ ] zsh?
- [x] fixes
  - [x] reconnect after hibernation
  - [x] resource cleanup (after a panic)
  - [x] logs disappearing

# For Usage or Development

- Unix users

  - This app uses the [go-pty](https://github.com/UfukUstali/go-pty) library which still does not have a unix implementation, so if I were you, I would start there, either by **kindly** reminding the maintainer (if you could even call him that, since he didn't finish a single project to this date) that he should give up on windows already and move to a proper os, which would then force him to get around to the unix implementation **or** contributing yourself

- Check out [mkcert](https://github.com/FiloSottile/mkcert)
  - generate a key pair for `localhost` and put them in `./certs` (in dev) and `<HOMEDIR>/.term2/certs` (in prod)
  - run the `-install` command
  - or use an existing already **trusted** TLS cert pair for `localhost`
  - I don't even know whether using TLS for a local connection use/meaningful or not but YOLO
- Create your own config file `config.json`, you can base it on the `./config.example.json` file
  - in dev the one in the root of this repo
  - in production the one in `<HOMEDIR>/.term2/`
- Assets that you reference in the config file will be resolved against
  - in dev `./assets`
  - in production `<HOMEDIR>/.term2/assets`

package main

const (
	DefaultKeybinds string = `
{
  "fonts": [
    {
      "name": "CaskaydiaCove NF Mono Regular",
      "url": "./CaskaydiaCoveNerdFontMono-Regular.ttf"
    }
  ],
  "defaultProfile": "PowerShell",
  "profiles": [
    {
      "name": "create your own profile here",
    }
  ],
  "defaultScope": "default",
  "shortcuts": [
    {
      "shortcut": {
        "code": "Tab",
        "ctrlKey": true
      },
      "scopes": ["default", "tabSwitcher"],
      "action": "nextTab",
      "setScope": "tabSwitcher"
    },
    {
      "shortcut": {
        "code": "Tab",
        "ctrlKey": true,
        "shiftKey": true
      },
      "scopes": ["default", "tabSwitcher"],
      "action": "previousTab",
      "setScope": "tabSwitcher"
    },
    {
      "shortcut": { "code": "Control", "type": "keyup" },
      "scopes": ["tabSwitcher"],
      "action": "closeTabSwitcher",
      "setScope": "default"
    },
    {
      "shortcut": { "code": "KeyN", "ctrlKey": true },
      "scopes": ["default"],
      "action": "newTerminal"
    },
    {
      "shortcut": { "code": "KeyW", "ctrlKey": true },
      "scopes": ["default"],
      "action": "closeTerminal"
    },
    {
      "shortcut": { "code": "KeyC", "ctrlKey": true },
      "scopes": ["default"],
      "action": "copy"
    },
    {
      "shortcut": { "code": "KeyV", "ctrlKey": true },
      "scopes": ["default"],
      "action": "paste"
    },
    {
      "shortcut": { "code": "KeyF", "altKey": true },
      "scopes": ["default"],
      "action": "toggleTerminalMode"
    },
    {
      "shortcut": {
        "code": "Comma",
        "ctrlKey": true
      },
      "scopes": ["default"],
      "action": "openConfigFile"
    }
  ]
}
`
)

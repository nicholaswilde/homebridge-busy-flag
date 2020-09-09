# Presence switch connected to Microsoft Graph

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins) 
[![homebridge-presence-switch-msgraph](https://badgen.net/npm/v/homebridge-presence-switch-msgraph)](https://www.npmjs.com/package/homebridge-presence-switch-msgraph)

More information for now can be found here: [https://www.eliostruyf.com/diy-building-busy-light-show-microsoft-teams-presence/](https://www.eliostruyf.com/diy-building-busy-light-show-microsoft-teams-presence/).

## Local development

```bash
$ nvm use v12

% homebridge -D -I -U ~/nodejs/homebridge/homebridge-presence-switch-msgraph/debug -P ~/nodejs/homebridge/homebridge-presence-switch-msgraph
```

When writing your plugin, you'll want Homebridge to load it from your development directory instead of publishing it to npm each time. Run this command inside your plugin project folder so your global install of Homebridge can discover it:

```bash
$ sudo npm link
```

## Config

The `accessory` config could look like this:

```json
{
  "accessory": "presence-switch",
  "name": "Presence Indicator",
  "appId": "66204339-daf1-40fa-aa31-57342272edce",
  "upApi": "http://192.168.1.192:5000/api/up",
  "downApi": "http://192.168.1.192:5000/api/down",
  "interval": 1,
  "setColorApi": "http://192.168.1.192:5000/api/switch",
  "offApi": "http://192.168.1.192:5000/api/off",
  "onApi": "http://192.168.1.192:5000/api/on",
  "startTime": "8:30",
  "endTime": "18:00",
  "weekend": false,
  "statusColors": {
    "available": {
      "red": 0,
      "green": 144,
      "blue": 0
    },
    "away": {
      "red": 255,
      "green": 191,
      "blue": 0
    },
    "busy": {
      "red": 179,
      "green": 0,
      "blue": 0
    }
  },
  "lightType": "",
  "debug": true
}
```

## Useful links

- [https://github.com/oznu/homebridge-config-ui-x/wiki/Developers:-Plugin-Settings-GUI](https://github.com/oznu/homebridge-config-ui-x/wiki/Developers:-Plugin-Settings-GUI)
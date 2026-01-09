// homebridge-nb/lib/NbService.js
// Copyright © 2020-2026 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

import { ServiceDelegate } from 'homebridge-lib/ServiceDelegate'

class NbService extends ServiceDelegate {
  static dateToString (date) {
    if (date == null) {
      return String(new Date()).slice(0, 24)
    }
    return String(new Date(date)).slice(0, 24)
  }
}

export { NbService }

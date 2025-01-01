// homebridge-nb/lib/NbAccessory.js
// Copyright © 2020-2025 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

import { toHexString } from 'homebridge-lib'
import { AccessoryDelegate } from 'homebridge-lib/AccessoryDelegate'

class NbAccessory extends AccessoryDelegate {
  constructor (bridge, params) {
    super(bridge.platform, {
      id: params.id,
      name: params.name,
      category: params.category,
      manufacturer: 'Nuki',
      model: params.model,
      firmware: params.device.firmwareVersion
    })
    this.inheritLogLevel(bridge)
    this.bridge = bridge
    this.client = this.bridge.client
    this.context.bridgeId = this.bridge.id
    this.nukiId = toHexString(params.device.nukiId)
    this.deviceType = params.device.deviceType
    this.log('Nuki %s v%s %s', params.model, params.device.firmwareVersion, params.id)
    this.on('identify', this.identify)
    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
  }

  async lockAction (action) {
    return this.client.lockAction(this.nukiId, this.deviceType, action)
  }

  async refresh () {
    return this.client.lockState(this.nukiId, this.deviceType)
  }

  async identify () {
    try {
      const response = await this.refresh()
      this.update(response.body)
    } catch (error) { this.error(error) }
  }
}

export { NbAccessory }

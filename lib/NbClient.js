// homebridge-nb/lib/NbClient.js
// Copyright © 2020 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const crypto = require('crypto')
const dns = require('dns')
const events = require('events')
const homebridgeLib = require('homebridge-lib')

const ipRegExp = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/

// const modes = {
//   smartlock: {
//     2: 'door mode',
//     3: '-'
//   },
//   opener: {
//     2: 'door mode',
//     3: 'continuous mode'
//   }
// }
//
// const lockActions = {
//   smartlock: {
//     1: 'unlock',
//     2: 'lock',
//     3: 'unlatch',
//     4: 'lock ‘n’ go',
//     5: 'lock ‘n’ go with unlatch'
//   },
//   opener: {
//     1: 'activate rto',
//     2: 'deactivate rto',
//     3: 'electric strike actuation',
//     4: 'activate continuous mode',
//     5: 'deactivate continuous mode'
//   }
// }

class NbClient extends events.EventEmitter {
  static get DeviceTypes () {
    return { SMARTLOCK: 0, OPENER: 2 }
  }

  static get LockStates () {
    return {
      UNCALIBRATED: 0,
      LOCKED: 1,
      UNLOCKING: 2,
      UNLOCKED: 3,
      LOCKING: 4,
      UNLATCHED: 5,
      UNLOCKED_LOCK_N_GO: 6,
      UNLATCHING: 7,
      MOTOR_BLOCKED: 254,
      UNDEFINED: 255
    }
  }

  static get DoorSensorStates () {
    return {
      DEACTIVATED: 0,
      CLOSED: 2,
      OPEN: 3,
      UNKNOWN: 4,
      CALIBRATING: 5
    }
  }

  static get LockActions () {
    return {
      UNLOCK: 1,
      LOCK: 2,
      UNLATCH: 3,
      LOCK_N_GO: 4,
      LOCK_N_GO_WITH_UNLATCH: 5
    }
  }

  static get OpenerStates () {
    return {
      UNTRAINED: 0,
      OFFLINE: 1,
      RTO_ACTIVE: 3,
      OPEN: 5,
      OPENING: 7,
      BOOT_RUN: 253,
      UNDEFINED: 255
    }
  }

  static get OpenerActions () {
    return {
      ACTIVATE_RTO: 1,
      DEACTIVATE_RTO: 2,
      OPEN: 3,
      ACTIVATE_CM: 4,
      DEACTIVATE_CM: 5
    }
  }

  constructor (options = {}) {
    super()
    this._requestId = 0

    this._jsonFormatter = new homebridgeLib.JsonFormatter()
    // this._hash = crypto.createHash('sha256')

    this._config = {
      hashedToken: true,
      timeout: 5
    }
    const optionParser = new homebridgeLib.OptionParser(this._config)
    optionParser.hostKey('host')
    optionParser.intKey('timeout', 1, 60)
    optionParser.stringKey('token')
    optionParser.parse(options)
    this._config.timeout *= 1000 // seconds -> milliseconds
  }

  // Resolve hostname to normalised IPv4 address.
  async _resolve (hostname) {
    if (ipRegExp.test(hostname)) {
      // IPv4 address.
      return hostname
    }
    return new Promise((resolve, reject) => {
      dns.lookup(hostname, { family: 4 }, (error, address, family) => {
        if (error != null) {
          return reject(new Error(`${hostname}: cannot resolve hostname`))
        }
        return resolve(address)
      })
    })
  }

  get address () { return this._config.address }
  get host () { return this._config.hostname + ':' + this._config.port }
  get id () { return this._config.id }
  get name () { return 'Nuki_Bridge_' + this._config.id }
  get firmware () { return this._config.firmware }
  get token () { return this._config.token }

  async auth () {
    const response = await this._get('/auth')
    if (response.body.success) {
      this._config.token = response.body.token
      return response.body.token
    }
    throw new Error('Nuki bridge button not pressed')
  }

  async info () { return this._get('/info') }
  async log () { return this._get('/log') }
  async reboot () { return this._get('/reboot') }
  async list () { return this._get('/list') }

  async lockState (nukiId, deviceType) {
    return this._get('/lockState', { nukiId: nukiId, deviceType: deviceType })
  }

  async lock (nukiId, deviceType) {
    return this._get('/lock', { nukiId: nukiId, deviceType: deviceType })
  }

  async unlock (nukiId, deviceType) {
    return this._get('/unlock', { nukiId: nukiId, deviceType: deviceType })
  }

  async lockAction (nukiId, deviceType, action) {
    return this._get(
      '/lockAction', { nukiId: nukiId, deviceType: deviceType, action: action }
    )
  }

  async init () {
    if (this._config.address == null) {
      this._config.address = await this._resolve(this._config.hostname)
      const response = await this.info()
      this._config.id = response.body.ids.serverId.toString(16).toUpperCase()
      this._config.firmware = response.body.versions.firmwareVersion
    }
  }

  async callbackAdd (url) {
    return this._get('/callback/add', { url: encodeURIComponent(url) })
  }

  async callbackList () { return this._get('/callback/list') }
  async callbackRemove (id) { return this._get('/callback/remove', { id: id }) }

  async _get (resource, params = {}) {
    if (this._client == null) {
      const options = {
        host: this._config.hostname + ':' + this._config.port,
        json: true,
        keepAlive: false,
        maxSockets: 1,
        timeout: this._config.timeout
      }
      this._client = new homebridgeLib.HttpClient(options)
    }
    const requestId = ++this._requestId

    // Append parameters
    let separator = '?'
    for (const param in params) {
      resource += separator + param + '=' + params[param]
      separator = '&'
    }
    this.emit('request', requestId, 'GET', resource)
    if (resource !== '/auth') {
      if (this._config.hashedToken) {
        // Append hashed token
        const hash = crypto.createHash('sha256')
        const date = new Date().toISOString()
        const ts = date.slice(0, 19) + 'Z'
        const rnr = '1' + date.slice(20, 23)
        hash.update([ts, rnr, this._config.token].join(','))
        resource += separator + 'ts=' + ts + '&rnr=' + rnr +
          '&hash=' + hash.digest('hex')
      } else {
        resource += separator + 'token=' + this._config.token
      }
    }
    this.emit('vrequest', requestId, 'GET', resource)
    try {
      const response = await this._client.request('GET', resource)
      this.emit('vresponse', requestId, response)
      this.emit('response', requestId, response.statusCode, response.statusMessage)
      return response
    } catch (error) {
      this.emit(
        'response', requestId, homebridgeLib.CommandLineTool.formatError(error)
      )
      this.emit('error', error)
    }
  }
}

module.exports = NbClient

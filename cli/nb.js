#!/usr/bin/env node

// homebridge-nb/cli/nb.js
// Copyright © 2020-2021 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

// const fs = require('fs')
const NbClient = require('../lib/NbClient')
const NbDiscovery = require('../lib/NbDiscovery')
const NbListener = require('../lib/NbListener')
const homebridgeLib = require('homebridge-lib')
const packageJson = require('../package.json')

const { b, u } = homebridgeLib.CommandLineTool
const { UsageError } = homebridgeLib.CommandLineParser

const usage = {
  nb: `${b('nb')} [${b('-hVD')}] [${b('-H')} ${u('hostname')}[${b(':')}${u('port')}]] [${b('-T')} ${u('token')}] [${b('-t')} ${u('timeout')}] ${u('command')} [${u('argument')} ...]`,

  discover: `${b('discover')} [${b('-h')}] [${b('-t')} ${u('timeout')}]`,

  auth: `${b('auth')} [${b('-h')}]`,
  info: `${b('info')} [${b('-h')}]`,
  getlog: `${b('getlog')} [${b('-h')}]`,
  clearlog: `${b('clearlog')} [${b('-h')}]`,
  reboot: `${b('reboot')} [${b('-h')}]`,
  list: `${b('list')} [${b('-h')}]`,

  lockState: `${b('lockState')} [${b('-h')}] ${u('nukiId')} ${u('deviceType')}`,
  lock: `${b('lock')} [${b('-h')}] ${u('nukiId')} ${u('deviceType')}`,
  unlock: `${b('unlock')} [${b('-h')}] ${u('nukiId')} ${u('deviceType')}`,
  lockAction: `${b('lockAction')} [${b('-h')}] ${u('nukiId')} ${u('deviceType')} ${u('action')}`,

  eventlog: `${b('eventlog')} [${b('-hns')}]`,
  callbackList: `${b('callbackList')} [${b('-h')}]`,
  callbackRemove: `${b('callbackRemove')} [${b('-h')}] ${u('id')}`
}

const description = {
  nb: 'Command line interface to Nuki bridge HTTP API.',

  discover: 'Discover Nuki bridges.',

  auth: 'Obtain Nuki bridge token.',
  info: 'Get Nuki bridge info.',
  getlog: 'Get Nuki bridge log.',
  clearlog: 'Clear Nuki bridge log.',
  reboot: 'Reboot Nuki bridge.',
  list: 'Get list of paired Nuki devices.',

  lockState: 'Refresh state from paired Nuki device.',
  lock: 'Lock paired Nuki device.',
  unlock: 'Unlock paired Nuki device.',
  lockAction: 'Send action to paired Nuki device.',

  eventlog: 'Add Nuki bridge subscription and listen for events.',
  callbackList: 'List Nuki bridge subscriptions.',
  callbackRemove: 'Remove Nuki bridge subscription.'
}

const help = {
  nb: `${description.nb}

Usage: ${usage.nb}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-V')}, ${b('--version')}
  Print version and exit.

  ${b('-D')}, ${b('--debug')}
  Print debug messages for communication with Nuki bridge.

  ${b('-H')} ${u('hostname')}[${b(':')}${u('port')}], ${b('--host=')}${u('hostname')}[${b(':')}${u('port')}]
  Connect to ${u('hostname')}${b(':8080')} or ${u('hostname')}${b(':')}${u('port')}.

  ${b('-T')} ${u('token')}, ${b('--token=')}${u('token')}
  Use ${u('token')} instead of the token saved in ${b('~/.nb')}.

Commands:
  ${usage.discover}
  ${description.discover}

  ${usage.auth}
  ${description.auth}

  ${usage.info}
  ${description.info}

  ${usage.getlog}
  ${description.getlog}

  ${usage.clearlog}
  ${description.clearlog}

  ${usage.reboot}
  ${description.reboot}

  ${usage.list}
  ${description.list}

  ${usage.lockState}
  ${description.lockState}

  ${usage.lock}
  ${description.lock}

  ${usage.unlock}
  ${description.unlock}

  ${usage.lockAction}
  ${description.lockAction}

  ${usage.eventlog}
  ${description.eventlog}

  ${usage.callbackList}
  ${description.callbackList}

  ${usage.callbackRemove}
  ${description.callbackRemove}

For more help, issue: ${b('nb')} ${u('command')} ${b('-h')}`,
  discover: `${description.discover}

Usage: ${usage.discover}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.`,
  auth: `${description.auth}

Usage: ${usage.auth}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.`,
  info: `${description.info}

Usage: ${usage.info}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.`,
  getlog: `${description.getlog}

Usage: ${usage.getlog}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.`,
  clearlog: `${description.clearlog}

Usage: ${usage.clearlog}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.`,
  reboot: `${description.reboot}

Usage: ${usage.reboot}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.`,
  list: `${description.list}

Usage: ${usage.list}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.`,
  lockState: `${description.lockState}

Usage: ${usage.lockState}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${u('nukiId')}
  The ID of the Nuki device (from ${b('nb list')}).

  ${u('deviceType')}
  The type of the Nuki device (from ${b('nb list')}):
    0: smartlock
    2: opener`,
  lock: `${description.lock}

Usage: ${usage.lock}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${u('nukiId')}
  The ID of the Nuki device (from ${b('nb list')}).

  ${u('deviceType')}
  The type of the Nuki device (from ${b('nb list')}):
    0: smartlock
    2: opener`,
  unlock: `${description.unlock}

Usage: ${usage.unlock}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${u('nukiId')}
  The ID of the Nuki device (from ${b('nb list')}).

  ${u('deviceType')}
  The type of the Nuki device (from ${b('nb list')}):
    0: smartlock
    2: opener`,
  lockAction: `${description.lockAction}

Usage: ${usage.lockAction}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${u('nukiId')}
  The ID of the Nuki device (from ${b('nb list')}).

  ${u('deviceType')}
  The type of the Nuki device (from ${b('nb list')}):
    0: smartlock
    2: opener

  ${u('action')}
  The action to send to the Nuki device:
      smartlock                opener
    - ------------------------ -------------------------
    1 unlock                   activate rto
    2 lock                     deactivate rto
    3 unlatch                  electric strike actuation
    4 lock ‘n’ go              activate continuous mode
    5 lock ‘n’ go with unlatch deactivate continuous mode`,
  eventlog: `${description.eventlog}

Usage: ${usage.eventlog}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-n')}, ${b('--noWhiteSpace')}
  Do not include spaces nor newlines in JSON output.

  ${b('-s')}, ${b('--service')}
  Do not output timestamps (useful when running as service).`,
  callbackList: `${description.callbackList}

Usage: ${usage.callbackList}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.`,
  callbackRemove: `${description.callbackRemove}

Usage: ${usage.callbackRemove}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${u('id')}
  Remove callback with ID ${u('id')} (from ${b('nb callbackList')}).`
}

class Main extends homebridgeLib.CommandLineTool {
  constructor () {
    super({ mode: 'command', debug: false })
    this.usage = usage.ph
  }

  parseArguments () {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    const clargs = {
      options: {
        host: process.env.NB_HOST,
        token: process.env.NB_TOKEN
      }
    }
    parser
      .help('h', 'help', help.nb)
      .version('V', 'version')
      .flag('D', 'debug', () => {
        if (this.debugEnabled) {
          this.setOptions({ vdebug: true })
        } else {
          this.setOptions({ debug: true, chalk: true })
        }
      })
      .option('H', 'host', (value) => {
        homebridgeLib.OptionParser.toHost('host', value, false, true)
        clargs.options.host = value
      })
      .option('t', 'timeout', (value) => {
        clargs.options.timeout = homebridgeLib.OptionParser.toInt(
          'timeout', value, 1, 60, true
        )
      })
      .option('T', 'token', (value) => {
        clargs.options.token = homebridgeLib.OptionParser.toString(
          'token', value, true, true
        )
      })
      .parameter('command', (value) => {
        if (usage[value] == null || typeof this[value] !== 'function') {
          throw new UsageError(`${value}: unknown command`)
        }
        clargs.command = value
      })
      .remaining((list) => { clargs.args = list })
      .parse()
    return clargs
  }

  async main () {
    try {
      this.usage = usage.nb
      const clargs = this.parseArguments()
      this.jsonFormatter = new homebridgeLib.JsonFormatter({ sortKeys: true })
      if (clargs.command !== 'discover') {
        if (clargs.options.host == null) {
          await this.fatal(`Missing host.  Set ${b('NB_HOST')} or specify ${b('-H')}.`)
        }
        if (clargs.command === 'auth') {
          clargs.options.timeout = 30
        }
        const name = clargs.options.host
        this.client = new NbClient(clargs.options)
        this.client
          .on('error', (error) => {
            this.log(
              '%s: request %d: %s %s', name, error.request.id,
              error.request.method, error.request.resource
            )
            this.warn(
              '%s: request %d: error: %s', name, error.request.id, error
            )
          })
          .on('request', (request) => {
            this.debug(
              '%s: request %d: %s %s', name, request.id,
              request.method, request.resource
            )
            this.vdebug(
              '%s: request %d: %s %s', name, request.id,
              request.method, request.url
            )
          })
          .on('response', (response) => {
            this.vdebug(
              '%s: request %d: response: %j', name, response.request.id,
              response.body
            )
            this.debug(
              '%s: request %d: %d %s', name, response.request.id,
              response.statusCode, response.statusMessage
            )
          })
        if (clargs.options.token == null && clargs.command !== 'auth') {
          let args = ''
          if (clargs.options.host !== process.env.NB_HOST) {
            args += ' -H ' + clargs.options.host
          }
          await this.fatal(
            `Missing token.  Run ${b('nb' + args + ' auth')} and press bridge button.`
          )
        }
      }
      this.name = 'nb ' + clargs.command
      this.usage = `${b('nb')} ${usage[clargs.command]}`
      this.parser = new homebridgeLib.CommandLineParser(packageJson)
      this.parser.help('h', 'help', help[clargs.command])
      await this[clargs.command](clargs.args)
    } catch (error) {
      await this.fatal(error)
    }
  }

  async discover (...args) {
    const options = {}
    this.parser
      .option('t', 'timeout', (value, key) => {
        options.timeout = homebridgeLib.OptionParser.toInt(
          'timeout', value, 1, 60, true
        )
      })
      .parse(...args)
    const nbDiscovery = new NbDiscovery(options)
    nbDiscovery
      .on('error', (error) => {
        this.log(
          'nuki server: request %d: %s %s', error.request.id,
          error.request.method, error.request.resource
        )
        this.warn(
          'nuki server: request %d: error: %s', error.request.id, error
        )
      })
      .on('request', (request) => {
        this.debug(
          'nuki server: request %d: %s %s', request.id,
          request.method, request.resource
        )
        this.vdebug(
          'nuki server: request %d: %s %s', request.id,
          request.method, request.url
        )
      })
      .on('response', (response) => {
        this.vdebug(
          'nuki server: request %d: response: %j', response.request.id,
          response.body
        )
        this.debug(
          'nuki server: request %d: %d %s', response.request.id,
          response.statusCode, response.statusMessage
        )
      })
    const bridges = await nbDiscovery.discover()
    this.print(this.jsonFormatter.stringify(bridges))
  }

  async auth (...args) {
    this.parser.parse(...args)
    this.log('press button on Nuki bridge to obtain token')
    const token = await this.client.auth()
    this.print(token)
  }

  async info (...args) {
    this.parser.parse(...args)
    const response = await this.client.info()
    this.print(this.jsonFormatter.stringify(response.body))
  }

  async getlog (...args) {
    this.parser.parse(...args)
    const response = await this.client.log()
    this.print(this.jsonFormatter.stringify(response.body))
  }

  async clearlog (...args) {
    this.parser.parse(...args)
    const response = await this.client.clearlog()
    this.print(this.jsonFormatter.stringify(response.body))
  }

  async reboot (...args) {
    this.parser.parse(...args)
    const response = await this.client.reboot()
    this.print(this.jsonFormatter.stringify(response.body))
  }

  async list (...args) {
    this.parser.parse(...args)
    const response = await this.client.list()
    this.print(this.jsonFormatter.stringify(response.body))
  }

  async lockState (...args) {
    let nukiId
    let deviceType
    this.parser
      .parameter('nukiId', (value) => {
        nukiId = homebridgeLib.OptionParser.toInt(
          'nukiId', value, 0, Infinity, true
        )
      })
      .parameter('deviceType', (value) => {
        deviceType = homebridgeLib.OptionParser.toInt(
          'deviceType', value, 0, 2, true
        )
      })
      .parse(...args)
    const response = await this.client.lockState(nukiId, deviceType)
    this.print(this.jsonFormatter.stringify(response.body))
  }

  async lock (...args) {
    let nukiId
    let deviceType
    this.parser
      .parameter('nukiId', (value) => {
        nukiId = homebridgeLib.OptionParser.toInt(
          'nukiId', value, 0, Infinity, true
        )
      })
      .parameter('deviceType', (value) => {
        deviceType = homebridgeLib.OptionParser.toInt(
          'deviceType', value, 0, 2, true
        )
      })
      .parse(...args)
    const response = await this.client.lock(nukiId, deviceType)
    this.print(this.jsonFormatter.stringify(response.body))
  }

  async unlock (...args) {
    let nukiId
    let deviceType
    this.parser
      .parameter('nukiId', (value) => {
        nukiId = homebridgeLib.OptionParser.toInt(
          'nukiId', value, 0, Infinity, true
        )
      })
      .parameter('deviceType', (value) => {
        deviceType = homebridgeLib.OptionParser.toInt(
          'deviceType', value, 0, 2, true
        )
      })
      .parse(...args)
    const response = await this.client.unlock(nukiId, deviceType)
    this.print(this.jsonFormatter.stringify(response.body))
  }

  async lockAction (...args) {
    let nukiId
    let deviceType
    let action
    this.parser
      .parameter('nukiId', (value) => {
        nukiId = homebridgeLib.OptionParser.toInt(
          'nukiId', value, 0, Infinity, true
        )
      })
      .parameter('deviceType', (value) => {
        deviceType = homebridgeLib.OptionParser.toInt(
          'deviceType', value, 0, 2, true
        )
      })
      .parameter('action', (value) => {
        action = homebridgeLib.OptionParser.toInt('action', value, 1, 5, true)
      })
      .parse(...args)
    const response = await this.client.lockAction(nukiId, deviceType, action)
    this.print(this.jsonFormatter.stringify(response.body))
  }

  async destroy () {
    if (this.listener != null) {
      const response = await this.client.callbackList()
      for (const callback of response.body.callbacks) {
        if (callback.url === this._callbackUrl) {
          this.log(
            'Removing subscription %s for %s', callback.id, callback.url
          )
          try {
            await this.client.callbackRemove(callback.id)
          } catch (error) {
            this.error(error)
          }
        }
      }
      this.listener.removeClient(this.client)
    }
  }

  async eventlog (...args) {
    let noWhiteSpace = false
    let mode = 'daemon'
    this.parser
      .flag('n', 'noWhiteSpace', () => { noWhiteSpace = true })
      .flag('s', 'service', () => { mode = 'service' })
      .parse(...args)
    this.setOptions({ mode: mode })
    const jsonFormatter = new homebridgeLib.JsonFormatter({
      sortKeys: true,
      noWhiteSpace: noWhiteSpace
    })

    this.listener = new NbListener()
    this.listener
      .on('error', (error) => { this.error(error) })
      .on('listening', (url) => {
        this.log('listening on %s', url)
      })
      .on('close', (url) => {
        this.log('closed %s', url)
      })
    this.client.on('event', (event) => {
      this.log('%s', jsonFormatter.stringify(event))
    })

    await this.client.init()
    this._callbackUrl = await this.listener.addClient(this.client)
    const response = await this.client.callbackAdd(this._callbackUrl)
    if (!response.body.success) {
      this.listener.removeClient(this.client)
      this.error(response.body.message)
    }
  }

  async callbackList (...args) {
    this.parser.parse(...args)
    const response = await this.client.callbackList()
    this.print(this.jsonFormatter.stringify(response.body))
  }

  async callbackRemove (...args) {
    let id
    this.parser
      .parameter('id', (value) => {
        id = homebridgeLib.OptionParser.toInt('id', value, 0, Infinity, true)
      })
      .parse(...args)
    const response = await this.client.callbackRemove(id)
    this.print(this.jsonFormatter.stringify(response.body))
  }
}

new Main().main()

// homebridge-nb/lib/NbListener.js
// Copyright © 2020 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const debug = require('debug')
const events = require('events')
const http = require('http')
const os = require('os')

class NbListener extends events.EventEmitter {
  // Convert string with IP address to int.
  static _ipToInt (ip) {
    const a = ip.split('.')
    return a[0] << 24 | a[1] << 16 | a[2] << 8 | a[3]
  }

  // Check whether ip1 and ip2 are in the same network.
  static _inSameNetwork (ip1, ip2, netmask) {
    return (NbListener._ipToInt(ip1) & NbListener._ipToInt(netmask)) ===
           (NbListener._ipToInt(ip2) & NbListener._ipToInt(netmask))
  }

  // Find my address for network of ip.
  static _findMyIpFor (ip) {
    const myIps = []
    const interfaces = os.networkInterfaces()
    for (const id in interfaces) {
      for (const alias of interfaces[id]) {
        if (
          alias.family === 'IPv4' && alias.internal === false
        ) {
          myIps.push({ address: alias.address, netmask: alias.netmask })
        }
      }
    }
    if (myIps.length === 1 && ip == null) {
      return myIps[0].address
    }
    if (myIps.length > 0 && ip != null) {
      for (const { address, netmask } of myIps) {
        if (NbListener._inSameNetwork(ip, address, netmask)) {
          return address
        }
      }
    }
    return null
  }

  constructor (port = 0, address) {
    super()
    this._debug = debug('NbListener')
    this._myPort = port
    this._myIp = address
    this._clients = {}
    this._clientsByName = {}
    this._server = http.createServer((request, response) => {
      let buffer = ''
      request.on('data', (data) => {
        buffer += data
      })
      request.on('end', async () => {
        try {
          request.body = buffer
          this._debug('%s %s', request.method, request.url)
          if (request.method === 'GET' && request.url === '/notify') {
            // Provide an easy way to check that listener is reachable.
            response.writeHead(200, { 'Content-Type': 'text/html' })
            response.write('<table>')
            response.write(`<caption><h3>Listening to ${Object.keys(this._clients).length} clients</h3></caption>`)
            response.write('<tr><th scope="col">Nuki Bridge</th>')
            response.write('<th scope="col">IP Address</th>')
            for (const id of Object.keys(this._clients).sort()) {
              const client = this._clients[id]
              response.write(`<tr><td>${id}</td><td>${client.address}</td>`)
            }
            response.write('</table>')
          } else if (request.method === 'POST') {
            const array = request.url.split('/')
            const client = this._clients[array[2]]
            if (array[1] === 'notify' && client !== null) {
              const obj = JSON.parse(request.body)
              client.emit('event', obj)
            }
          }
          response.end()
        } catch (error) {
          this.emit('error', error)
        }
      })
    })
    this._server.on('error', (error) => { this.emit('error', error) })
    this._server.on('close', () => {
      this.emit('close', this._callbackUrl)
      delete this._callbackUrl
    })
  }

  async listen (ip) {
    if (this._callbackUrl != null) {
      return
    }
    return new Promise((resolve, reject) => {
      this._debug('_listen(%j)', ip)
      try {
        if (this._myIp == null) {
          this._myIp = NbListener._findMyIpFor(ip)
          if (this._myIp == null) {
            return reject(new Error('cannot determine my IPv4 address'))
          }
        }
        if (this._myPort == null) {
          this._myPort = 0
        }
        this._server.listen(this._myPort, this._myIp, () => {
          const address = this._server.address()
          this._myIp = address.address
          this._myPort = address.port
          this._callbackUrl =
            'http://' + this._myIp + ':' + this._myPort + '/notify'
          this.emit('listening', this._callbackUrl)
          this._debug('_listen(%j) => %j', ip, this._callbackUrl)
          return resolve()
        })
      } catch (error) {
        return reject(error)
      }
    })
  }

  async addClient (nbClient) {
    this._clients[nbClient.id] = nbClient
    await this.listen(nbClient.address)
    const callbackUrl = this._callbackUrl + '/' + nbClient.id
    return callbackUrl
  }

  async removeClient (nbClient) {
    delete this._clients[nbClient.id]
    if (Object.keys(this._clients).length === 0) {
      this._server.close()
    }
  }
}

module.exports = NbListener

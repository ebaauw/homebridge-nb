// homebridge-nb/lib/NbListener.js
// Copyright © 2020-2021 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const events = require('events')
const http = require('http')

class NbListener extends events.EventEmitter {
  constructor (port = 0) {
    super()
    this._myPort = port
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
          if (request.method === 'GET' && request.url === '/notify') {
            // Provide an easy way to check that listener is reachable.
            response.writeHead(200, { 'Content-Type': 'text/html' })
            response.write('<table>')
            response.write(`<caption><h3>Listening to ${Object.keys(this._clients).length} clients</h3></caption>`)
            response.write('<tr><th scope="col">Nuki Bridge</th>')
            response.write('<th scope="col">IP Address</th>')
            response.write('<th scope="col">Local IP Address</th>')
            for (const name of Object.keys(this._clientsByName).sort()) {
              const client = this._clientsByName[name]
              response.write(`<tr><td>${name}</td><td>${client.address}</td>`)
              response.write(`<td>${client.localAddress}</td></tr>`)
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
    this._server
      .on('error', (error) => { this.emit('error', error) })
      .on('close', () => {
        this.emit('close', this._callbackUrl)
        delete this._callbackUrl
      })
  }

  async _listen () {
    if (this._server.listening) {
      return
    }
    return new Promise((resolve, reject) => {
      try {
        this._server.listen(this._myPort, '0.0.0.0', () => {
          const address = this._server.address()
          this._myIp = address.address
          this._myPort = address.port
          this._callbackUrl =
            'http://' + this._myIp + ':' + this._myPort + '/notify'
          /** Emitted when the web server has started.
            * @event NbListener#listening
            * @param {string} url - The url the web server is listening on.
            */
          this.emit('listening', this._callbackUrl)
          return resolve()
        })
      } catch (error) {
        return reject(error)
      }
    })
  }

  async addClient (nbClient) {
    this._clients[nbClient.id] = nbClient
    this._clientsByName[nbClient.name] = nbClient
    await this._listen()
    const callbackUrl = 'http://' + nbClient.localAddress + ':' + this._myPort +
      '/notify/' + nbClient.id
    return callbackUrl
  }

  async removeClient (nbClient) {
    this.removeAllListeners(nbClient.id)
    delete this._clientsByName[nbClient.name]
    delete this._clients[nbClient.id]
    if (Object.keys(this._clients).length === 0) {
      await this._server.close()
    }
  }
}

module.exports = NbListener

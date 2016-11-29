'use strict';

const _ = require('lodash');
const Url = require('url');
const Rabbit = require('rabbit.js');
const comise = require('comise');
const Path = require('path');
const co = require('co');

const safeFs = require('../helpers/safe_fs');
const toss = require('../helpers/toss');
const checkpoint = require('../helpers/checkpoint');

const DEFAULT_CONFIG = require('./defaults.json');

const noopPromise = () => new Promise((resolve) => { resolve(); });

class RabbitService {
  //
  // Constructor
  //
  constructor (config) {
    this._stash = { fs: {}, reconnect: {} };
    this.resetReconnect();
    this.config = _.defaultsDeep(config || {}, DEFAULT_CONFIG);
    this.config.reconnect.handler = this.config.reconnect.handler || noopPromise;
    this.client = false;
    this.sockets = [];
    this.middleware = [];
    this.handlers = {
      reconnect: noopPromise,
      catch: (e) => new Promise((resolve) => {
        console.log(e.stack || e);
        resolve();
      }),
    };

    if (_.isString(this.config.controllers)) this.setControllerDir(config.controllers);
  }

  //
  // Catch
  //
  catch (handler) {
    checkpoint(_.isFunction(handler), 'catch handler must be a function');
    this.handlers.catch = handler;
  }

  //
  // Reconnect
  //
  reconnect (config) {
    checkpoint(_.isFunction(config) || _.isPlainObject(config), 'reconnect expects a configuration object, or a functions');
    this.resetReconnect();
    if (_.isFunction(config)) {
      this.config.reconnect.handler = config;
    } else {
      _.defaultsDeep(this.config.reconnect, DEFAULT_CONFIG.reconnect);
    }

    let self = this;
    this.handlers.reconnect = function *() {
      if (self._stash.reconnect.alive) return;

      // calculate delay
      if (!self._stash.reconnect.attempts) {
      } else if (self._stash.reconnect.delay) {
        self._stash.reconnect.delay = self._stash.reconnect.delay * self.config.reconnect.multiplier;
        if (self._stash.reconnect.delay > self.config.reconnect.max_delay) {
          self._stash.reconnect.delay = self.config.reconnect.max_delay;
        }
      } else {
        self._stash.reconnect.delay = self.config.reconnect.start_delay;
      }

      setTimeout(() => {
        co(function *() {
          // self.client.close();
          try {
            yield self.listen();
          } catch (e) {}
          yield self.config.reconnect.handler.call(self, self._stash.reconnect);
          self._stash.reconnect.attempts++;
        }).catch((e) => {
          co(function *() {
            yield self.handlers.catch(e);
          }).catch((err)=>console.log(err.stack || err));
        });
      }, self._stash.reconnect.delay);
    }
  }

  //
  // Reset Reconnect
  //
  resetReconnect () {
    this._stash.reconnect = {
      alive: false,
      attempts: 0,
      delay: 0
    };
  }

  //
  // Socket
  //
  register (configs) {
    checkpoint(configs, 'register expects either a single config or array of configs; found [' + configs + ']')
    if (!_.isArray(configs)) configs = [configs];
    _.each(configs, (config) => {
      let isHandlerDescriptor = _.isString(config.controller);
      checkpoint(config, 'a socket configuration is required')
        .and(config.controller, 'socket configuration must contain a controller')
        .and(!isHandlerDescriptor || (isHandlerDescriptor && this._stash.fs.controllerDir), 'if controller is a string, config.controllers must define a directory');

      if(isHandlerDescriptor) {
        let descriptor = config.controller.match(/(.+?)($|\.(.*))/) || [];
        let file = descriptor[1];
        let property = descriptor[2];
        let path = Path.join(this._stash.fs.controllerDir, file);
        let ctrl = safeFs.require(path);
        checkpoint(ctrl, 'could not read controller [' + path + ']');
        let handler;
        if (property) {
          handler = _.get(ctrl, property);
        } else {
          property = 'exported function';
          handler = ctrl;
        }
        checkpoint(handler, 'could not find property [' + property + '] for controller [' +  path + ']')
          .and(_.isFunction(handler), 'propterty [' + property + '] of controller [' +  path + '] is not a function');
        config._controller = handler;
      } else {
        config._controller = config.controller
      }

      this.sockets.push(config);
    });
  }

  //
  // Middleware
  //
  use (middleware) {
    checkpoint(_.isFunction(middleware), 'middleware must be a function');
    this.middleware.push(middleware);
  }

  //
  // Compile Middleware
  //
  wrapMiddleware (ctx, controller) {
    let self = this;
    // set bundle core to be the controller
    let bundle = () => {
      // wrap in comise for generator support
      return comise(function *() { 
        try {
          yield controller.call(ctx); 
        } catch (e) {
          yield self.handlers.catch(e);
        }
      });
    };
    // iteratively wrap the bundle
    for (let i = self.middleware.length-1; i >=0; i--) {
      let oldBundle = bundle;
      let newBundle = function () {
         // wrap in comise for generator support
        return comise(function *() { 
          try {
            yield self.middleware[i].call(ctx, oldBundle); 
          } catch (e) {
            yield self.handlers.catch(e);
          }
        });
      };
      bundle = newBundle;
    }
    return bundle;
  }

  //
  // Set Context
  //
  setContext (ctx) {
    ctx = ctx || {};

    // if ctx is a string, parse it as a url
    if (_.isString(ctx)) {
      let url = Url.parse(ctx);

      // parse auth
      if (_.isString(url.auth)) {
        let auth = url.auth.split(':');
        ctx.username = auth[0];
        ctx.password = auth[1];
        checkpoint(_.isString(ctx.username), 'failed to parse username from url [' + ctx + ']')
          .and(_.isString(ctx.password), 'failed to parse password from url [' + ctx + ']');
      }

      // rename to match internal data structure
      url.host = url.hostname;
      url.url = url.href;
    }

    this.config.context = _.defaultsDeep(_.pick(ctx, Object.keys(DEFAULT_CONFIG.context)), this.config.context);
    this.config.context.auth = this.config.context.user + ':' + this.config.context.pass || "";
    this.config.context.url = Url.format(this.config.context);
  }

  //
  // Set Controller Directory
  //
  setControllerDir (path) {
    let exists = safeFs.exists(path);
    checkpoint(exists, 'controller location [' + path + '] does not exist')
      .and(exists.isDirectory(), 'controller location [' + path + '] is not a directory');
    this._stash.fs.controllerDir = this.config.controllers = path;
  }

  //
  // Handle Socker Message
  //
  handleSocketMessage (sockConf) {
    let self = this;
    return (data) => {
      let socketReq = {
        context: self.client,
        channel: sockConf.channel,
        socket: sockConf,
        controller: self.config.controllers ? sockConf.controller : 'anonymous_controller',
        message: data
      };
      co(function *() {
        // middleware execution
        let bundle = self.wrapMiddleware(socketReq, sockConf._controller);
        yield bundle();
      }).catch((e) => {
        co(function *() {
          yield self.handlers.catch.call(socketReq, e);
        }).catch((err) => console.log(e.stack || e));
      });
    };
  }

  //
  // Listen
  //
  listen (ctx) {
    let self = this;
    return new Promise((resolve, reject) => {
      try {
        this.setContext(self);
        this.client = Rabbit.createContext(this.config.context.url);
        this.client.on('ready', () => {
          this.resetReconnect();
          this._stash.reconnect.alive = true;

          // bind sockets
          this.client._socket = [];
          _.each(this.sockets, (sockConf) => {
            sockConf = _.defaultsDeep(sockConf, this.config.socket);
            var socket = this.client.socket(sockConf.type, sockConf.options);
            socket.setEncoding(sockConf.encoding);

            this.client._socket.push(socket);

            if (sockConf.topic) {
              socket.connect(sockConf.channel, sockConf.topic);
            } else {
              socket.connect(sockConf.channel);
            }

            socket.on(sockConf.listen, this.handleSocketMessage(sockConf));
          });

          resolve(this);
        });

        this.client.on('close', (e) => {
          // self._stash.reconnect.alive = false;
          // co(function *() {
          //   yield self.handlers.reconnect();
          // }).catch((e) => {
          //   co(function *() {
          //     yield self.handlers.catch(e);
          //   }).catch((err)=>console.log(err.stack));
          // });
        });
        this.client.on('error', (e) => {
          co(function *() {
            if (~e.message.indexOf('ECONNREFUSED') || ~e.message.indexOf('Unexpected close')) {
              reject(e);
              self._stash.reconnect.alive = false;
              yield self.handlers.reconnect();
            } else {
              reject();
              yield self.handlers.catch(e);
            }
          }).catch((err)=>console.log(err.stack || err));
        });
      } catch (e) {
        reject(e);
      }
    });
  }
}

module.exports = RabbitService;
module.exports.defaults = DEFAULT_CONFIG;

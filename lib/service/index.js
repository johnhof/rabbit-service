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

class RabbitService {
  //
  // Constructor
  //
  constructor (config) {
    this._stash = { fs: {} };
    this.config = _.defaultsDeep(config || {}, DEFAULT_CONFIG);
    this.client = false;
    this.sockets = [];
    this.middleware = [];
    this.handlers = {
      catch: (e) => new Promise((resolve) => {
        console.log(e.stack || e);
        resolve();
      }),
      reconnect: () => new Promise((resolve) => { resolve(); }),
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
  // Socket
  //
  register (configs) {
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
        let handler = _.get(ctrl, property);
        checkpoint(handler, 'could not find property [' + property + '] for controller [' +  path + ']')
          .and(_.isFunction(handler), 'propterty [' + property + '] of controller [' +  path + '] iis not a function');
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
      return comise(function *() { yield controller.call(ctx); });
    };
    // iteratively wrap the bundle
    for (let i = self.middleware.length-1; i >=0; i--) {
      let oldBundle = bundle;
      let newBundle = function () {
         // wrap in comise for generator support
        return comise(function *() { yield self.middleware[i].call(ctx, oldBundle); });
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

  handleSocketMessage (sockConf) {
    let self = this;
    return (data) => {
      co(function *() {
        let socketReq = {
          context: self.client,
          channel: sockConf.channel,
          socket: sockConf,
          controller: self.config.controllers ? sockConf.controller : 'anonymous_controller',
          message: data
        };

        // middleware execution
        let bundle = self.wrapMiddleware(socketReq, sockConf._controller);
        yield bundle();
      }).catch((e) => {
        self.handlers.catch(e);
      });
    };
  }

  //
  // Listen
  //
  listen (ctx) {
    return new Promise((resolve, reject) => {
      try {
        this.setContext(ctx);
        this.client = Rabbit.createContext(this.config.url);
        this.client.on('ready', () => {
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
      } catch (e) {
        reject(e);
      }
    });
  }
}

module.exports = RabbitService;
module.exports.defaults = DEFAULT_CONFIG;

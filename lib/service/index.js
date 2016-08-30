'use strict';

const _ = require('lodash');
const Url = require('url');
const Rabbit = require('rabbit.js');

const DEFAULT_CONFIG = require('./defaults.json');

class RabbitService {
  constructor (config) {
    this.config = _.deepDefaults(config || {}, DEFAULT_CONFIG);
  }

  // accept object or string
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

    this.config.context = _.defaults(_.pick(ctx, Object.keys(DEFAULT_CONFIG.context)), this.config.context);
    this.config.context.url = Url.format(this.config.context);
  }

  listen (ctx) {
    this.setContext(ctx);
    Rabbit.createContext(this.context.url);
  }
}

module.exports = RabbitService;
module.exports.defaults = DEFAULT_CONFIG;

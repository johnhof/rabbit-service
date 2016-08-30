'use strict';

let RabbitService = require('./service');

module.exports = function (config) {
  return new RabbitService(config);
}

module.exports.DEFAULTS = RabbitService.DEFAULTS;

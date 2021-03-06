'use strict';

let RabbitService = require('./lib/service');

module.exports = function (config) {
  return new RabbitService(config);
}

module.exports.DEFAULTS = RabbitService.DEFAULTS;
module.exports.parsers = {
  json: require('./lib/parsers/json')
}

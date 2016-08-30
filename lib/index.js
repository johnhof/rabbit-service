'use strict';

let Service = require('./service');

module.exports = function (config) {
  return new Service(config);
}

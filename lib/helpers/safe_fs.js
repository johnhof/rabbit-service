'use strict';

const Path = require('path');
const fs = require('fs');
const _ = require('lodash')
const toss = require('./toss');

module.exports.exists = (path) => {
  path = Path.normalize(path || '');
  try {
    return fs.lstatSync(path);
  } catch (e) { return false; }
}

module.exports.require = function () {
  let args = _.map(arguments, (arg) => arg);
  let path = Path.join.apply(Path.join, args);
  let error = false;
  let result = false;
  try {
    result = require(path);
  } catch (e) {
    result = false;
    error = e;
  }

  if (error && !~error.message.indexOf('Cannot find module \'' + path + '\'')) toss(error);
  return result;
}

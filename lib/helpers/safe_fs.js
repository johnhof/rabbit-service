'use strict';

const Path = require('path');
const fs = require('fs');
const toss = require('./toss');

module.exports.exists = (path) => {
  path = Path.normalize(path || '');
  try {
    return fs.lstatSync(path);
  } catch (e) { return false; }
}

module.exports.require = () => {
  let path = Path.join.apply(arguments);
  let error = false;
  let result = false;
  try {
    result = require(path);
  } catch (e) {
    result = false;
    error = e;
  }

  if (error && !~e.message.indexOf('Cannot find module \'' + path + '\'')) toss(error);
  return result;
}

'use strict';

const toss = require('./toss');

let checkpoint = module.exports = (condition, message) => {
  if (!condition) toss(message);
  return { and: checkpoint };
};

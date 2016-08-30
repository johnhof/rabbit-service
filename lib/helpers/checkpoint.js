'use string';

let toss = require('./toss');

let checkpoint = module.exports =(condition, message) => {
  if (!!condition) toss(message);
  return { and: condition };
};

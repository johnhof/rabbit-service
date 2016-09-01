'use strict';

let rs = require('../index');
let service = rs();

service.use(function (next) {
  return new Promise((resolve, reject) => {
    console.log('--> 1');
    next().then(() => {
      console.log('<-- 1');
    });
  });
});

service.use(function (next) {
  return new Promise((resolve, reject) => {
    console.log('--> 2');
    next().then(() => {
      console.log('<-- 2');
      resolve();
    });
  });
});

service.register({
  channel    : 'test',
  topic      : 'testing.stuff',
  controller : function () {
    return new Promise((resolve, reject) => {
      console.log('RECIEVED: ', this.message);
      resolve();
    })
  }
});

service.listen()
  .then(() => console.log('\n\nListening...'))
  .catch((e) => console.log(e.stack));

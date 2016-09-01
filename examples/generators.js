'use strict';

let co = require('co');
let rs = require('../index');
let service = rs();

co(function *() {

  service.use(function *(next) {
    console.log('--> 1');
    yield next()
    console.log('<-- 1');
  });

  service.use(function *(next) {
    console.log('--> 2');
    yield next()
    console.log('<-- 2');
  });

  service.register({
    channel    : 'test',
    topic      : 'testing.stuff',
    controller : function *() {
      console.log('RECIEVED: ', this.message);
    }
  });

  yield service.listen();
  console.log('\n\nListening...');
}).catch((e) => console.log(e));

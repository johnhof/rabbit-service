'use strict';

let rabbit = require('rabbit.js');

const HOST = 'amqp://localhost';
const TYPE = 'PUB';
const CHANNEL = 'test';
const ROUTING = 'topic';
const ROUTE = 'testing.stuff';

let ctx = rabbit.createContext(HOST);
let pub = ctx.socket(TYPE, { routing: ROUTING });

pub.connect(CHANNEL, (error, other) => {
  console.log(error);
  console.log(other)
  let msg = JSON.stringify({ hello: 'world' });
  console.log('sending: ' + JSON.stringify({ hello: 'world' }));
  pub.publish(ROUTE, msg);

  process.exit();
});

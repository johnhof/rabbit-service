'use strict'

let rs = require('../../index');
let uuid = require('uuid');

const CONFIG = require('./config.json');

let service = rs({ controllers: __dirname + '/controllers' });

service.use(rs.parsers.json());

service.use(function *messageId (next) {
  this.id = uuid.v4();
  yield next();
});

service.use(function *logger (next) {
  let location = this.socket.channel;
  if (this.socket.topic) location += ':(' + this.socket.topic + ')';
  location += ' [' + this.id + ']'
  console.log(' => ' + location + ' = ' + this.message);
  yield next();
  console.log(' <= ' + location);
});

service.register(CONFIG.sockets);

service.catch(function *catch (e) {
  console.log('CAUGHT', e.stack);
});

service.reconnect(function *reconnect (data) {
  if (!data.attempts && !data.alive) console.log('Connection dropped');
  if (data.alive) {
    console.log('Connection recovered');
  } else if (data.attempts) {
    console.log('Reconnect attempt (' + data.attempts + ') failed after (' + data.delay + ')');
  }
});

service.listen()
  .then(() => console.log('\nListening to [' + service.config.context.url + ']...\n'))
  .catch((e) => console.log(e.stack));

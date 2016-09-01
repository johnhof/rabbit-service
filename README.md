# rabbit-service

This service leverages RabbitMQ and generators to create a simple, extensible service for messaging. Functionality is built on top of the [rabbit.js module](http://www.squaremobius.net/rabbit.js/).

- [Usage](#usage)
  - [Promises](#promises)
  - [Generators](#generators)
  - [Complex](https://github.com/johnhof/rabbit-service/tree/refactor/examples/complex)
- [Documentation](#documentation)
  - **TODO**
  - [`rs(config)`](#rsconfig)

# Usage

## Promises

**[Full Source](https://github.com/johnhof/rabbit-service/blob/refactor/examples/promises.js)**

```javascript
let rs = require('../index');
let service = rs();

service.use(function (next) {
  return new Promise((resolve, reject) => {
    console.log('--> 1');
    next().then(() => {
      console.log('<-- 1');
      resolve()
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
```

## Generators

**[Full Source](https://github.com/johnhof/rabbit-service/blob/refactor/examples/generators.js)**

```javascript
let co = require('co');
let rs = require('../index');
let service = rs();

co(function *() {

  service.use(function *(next) {
    console.log('--> 1');
    yield next()
    console.log('<-- 1');
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
```

# Documentation

## TODO

## `rs(config)`

### Example

```javascript
let rs = require('rabbit-service');
let service = rs('amqp://myhost.foo.com');
```

### Accepts

- Url string to be deconstructed into host connection parameters
- Configuration object to overwrite the following defaults

```json
{
  "controllers": null,
  "reconnect": {
    "start_delay": 1000,
    "max_delay": 60000,
    "multiplier": 2
  },
  "context": {
    "protocol": "amqp",
    "username": "guest",
    "password": "guest",
    "host": "127.0.0.1",
    "port": false,
  },
  "socket": {
    "listen": "data",
    "type": "SUB",
    "encoding": "utf8",
    "options": {
      "routing": "topic"
    }
  }
}˝
```

### Returns

- Instance of a service

# Authors

  - [John Hofrichter](https://github.com/johnhof)

# License

  MIT

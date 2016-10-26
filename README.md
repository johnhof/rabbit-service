# rabbit-service

This service leverages RabbitMQ and generators to create a simple, extensible service for messaging. Functionality is built on top of the [rabbit.js module](http://www.squaremobius.net/rabbit.js/).

- [Usage](#usage)
  - [Promises](#promises)
  - [Generators](#generators)
  - [Complex](https://github.com/johnhof/rabbit-service/tree/refactor/examples/complex)
- [Documentation](#documentation)
  - [`rs(config)`](#rsconfig)
  - [`this`](#this)
  - [`service.use(function)`](#serviceusefunction)
  - [`service.register(config)`](#serviceregisterconfig)
  - [`service.catch(function)`](#servicecatchfunction)
  - [`service.reconnect(function)`](#servicereconnectfunction)
  - [`service.listen(config)`](#servicelistenconfig)

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
      console.log('RECEIVED: ', this.message);
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
      console.log('RECEIVED: ', this.message);
    }
  });

  yield service.listen();
  console.log('\n\nListening...');

}).catch((e) => console.log(e));
```

# Documentation

## `rs(config)`

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
}
```

### Behavior

- Instance of a service

## `this`

In most cases, `this` will refer to the context of the request, and is shared across all functions called in the request

```javascript
{
  context: [Context], // rabbit.js client context
  channel: [String], // channel the message ws sent on
  socket: { // socket config after being processed
    channel: [String],
    topic: [String],
    controller: [Function], // controller defined by the user
    _controller: [Function], // controller post processed
    listen: [String],
    type: [String],
    encoding: [String],
    options: {} // options accepted by the rabbit.js socket connection
  },
  controller: [String],
  message: [String] // message sent to the socket
}
```

## `service.use(function)`

```javascript
let service = require('rabbit-service')();

// generator
service.use(function *(next) {
  yield next()
});

// promise
service.use(function (next) {
  return new Promise((resolve, reject) => {
    next().then(resolve);
  });
})
```

### Accepts

- Either
  - Generator function
  - Function which returns a promise

### Behavior

- Function parameter is added to the middleware chain
- Message event is processed in order that the middleware was added
- Function must call `next()` to progress to the next middleware function
- The context `this` refers to the message event and is shared through the middleware chain

## `service.register`

```javascript
let service = require('rabbit-service')();

service.register({
  channel: 'test',
  topic: 'testing.stuff',
  controller: function () {
    return new Promise((resolve, reject) => {
      console.log('RECEIVED: ', this.message);
      resolve();
    })
  }
});


service.register([{
  channel    : 'test',
  topic      : 'testing.stuff',
  controller : function () {
    return new Promise((resolve, reject) => {
      console.log('RECEIVED: ', this.message);
      resolve();
    })
  }
}, {
  channel: 'test',
  topic: 'testing.stuff',
  controller: 'test_controller.foo'
}]);
```

### Accepts

- Either
  - Socket config
  - Array of configs
- Configs will be defaulted against the [config default socket](#rsconfig)
- Configs must have a controller property that is either:
  - Generator function
  - Function returning a promise
  - String specifying a controller
    - **Requires:** Service config property `controller` to specify a path to a directory
    - If a property chain is used:
      - The leading word (`.` delimited) will be the controller
      - The remaining string is used to traverse subproperties of the controller module
      - Eg: `my_controller.foo[0]`
        - `my_controller` is the file in the controllers directory
        - The handler used will be the function found in the first element `[0]` of the `foo` property

### Behavior

- The config passed will be used to crete a socket via [rabbit.js](https://www.npmjs.com/package/rabbit.js)
- The `controller` property will be called after all middleware is called
- The context of `this` refers to the message event and is shared through the middleware chain

## `service.catch(function)`

```javascript
let service = require('rabbit-service')();

service.catch(function *(e) {
  console.log(e);
});

service.catch(function (e) {
  return new Promise((resolve, reject) => {
    console.log(e);
    resolve()
  });
});
```

### Accepts

- Either
  - Generator function
  - Function returning a promise
- Function should expect a parameter `error`
- **Note:** `this` is not guaranteed to be the context of a message event. Errors may occur outside the context of a message

### Behavior

- The callback is called **any** time an error is thrown from the rabbit client
- For middleware/controller only error handling, use:

```javascript
service.use(function *(next) {
  try {
    yield next()
  } catch (e) {
    /* Handle here */
  }
});

// OR

service.use(function (next) {
  return new Promise((resolve, reject) => {
    yield next().catch((e) => {
      /* Handle here */
    });
  });
});
```

## `service.reconnect(function)`

```javascript
let service = require('rabbit-service')();

service.use(function *() {
  if (!data.attempts && !data.alive) console.log('Connection dropped');
  if (data.alive) {
    console.log('Connection recovered');
  } else if (data.attempts) {
    console.log('Reconnect attempt (' + data.attempts + ') failed after (' + data.delay + ')');
  }
});

// OR

service.reconnect({
  start_delay: 5000,
  handler: function *() {
    if (!data.attempts && !data.alive) console.log('Connection dropped');
    if (data.alive) {
      console.log('Connection recovered');
    } else if (data.attempts) {
      console.log('Reconnect attempt (' + data.attempts + ') failed after (' + data.delay + ')');
    }
  }
})
```

### Accepts

- Either
  - Generator or funciton which returns a promise to be treated as the handler
  - Config to overwrite the default config, wich an optional `handler` function
  - Default:

```javascript
{
  start_delay: 1000, // start delay
  max_delay: 60000, // maximum delay
  multiplier: 2 // amount the delay is multiplied with each failure
}
```

### Behavior

- If the connection is dropped, a reconnection loop with exponential backoff begins
- the handler function is called after every drop, and reconnection


## `service.listen(config)`

```javascript
let service = require('rabbit-service')();

service.listen().then(() => console.log('listening'));
```

### Accepts

- Optional config for last minute overrides
- Config matches object passed to [`rs(config)`](#rsconfig)

### Behavior

- Compiles all functions and handlers into a finalized state
- Creates client context
- Connects all sockets
- registers all event listeners
- **NOTE:** This function is called on every reconnect attempt


# Authors

  - [John Hofrichter](https://github.com/johnhof)

# License

  MIT

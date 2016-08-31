# rabbit-service

This service leverages RabbitMQ and generators to create a simple, extensible service for messaging. Functionality is built on top of the [rabbit.js module](http://www.squaremobius.net/rabbit.js/).

- [Usage](#usage)
- [Defaults](#defaults)
- [Configuration](#configuration)
  - [config.context](#configcontext)
  - [config.json](#configjson)
  - [config.middleware](#configmiddleware)
  - [config.catch](#configcatch)
  - [config.sockets](#configsockets)
  - [config.controllers](#configcontrollers)
  - [config.onConnect](#configonconnect)
  - [config.reconnect](#configreconnect)
  - [config.reconnect.startDelay](#configreconnectstartdelay)
  - [config.reconnect.maxDelay](#configreconnectmaxdelay)
  - [config.reconnect.catch](#configreconnectcatch)

## Usage

```javascript
  let Service = require('rabbit-service');
  let service = Service({
    username: 'test',
    password: 'tester'
  });

  service.use(function *(next) {
    yield next;
  });

  service.use(function (next) {
    return new Promise((resolve, reject) => {
      next().then(resolve).catch(reject);
    });
  });

  service.socket({
    topic: 'test_topic_1',
    controller: function *() {
      console.log('received message on test_topic_1')
    }
  });
  service.socket({
    topic: 'test_topic_2',
    controller: function () {
      return new Promise((resolve, reject) => {
        console.log('received message on test_topic_1');
        resolve();
      })
    }
  });

  service.sockets([{
      topic: 'test_topic_3',
      controller: function *() {
        console.log('received message on test_topic_3')
      }
    }, {
      topic: 'test_topic_4',
      controller: function () {
        return new Promise((resolve, reject) => {
          console.log('received message on test_topic_4');
          resolve();
        })
      }
    }
  ]);

  service.catch(function (error) {
    return new Promise((resolve, reject) => {
      console.log(error);
      resolve();
    });
  });

  service.listen().then(() => {
    console.log('Listening...');
  });
```

## Defaults

The default config is as follows:
```javascript
```

## Configuration


### config.context

set the connection context. Defaults to `amqp://guest:guest@127.00.1`

```javascript
config.context = 'amqp://admin:1337HaXoR@127.00.1'
```

### config.json

if true, the message will be parsed into json before the controller is called. the json can be found in `this.json` with the original message remaining in `this.message`

```javascript
config.json = true
```

### config.middleware

middleware to wrap the controller

```javascript
config.middleware = function *(controller) {
  this.logJson = function (string) {
    console.log(JSON.stringify(string, null, '  '));
  }

  yield controller;

  console.log('done');
},
```

### config.catch

error handler function

```javascript
config.catch = function *(error) {
  console.log('ERROR!');
  console.log(error.stack);
}
```

### config.sockets

an array of socket configurations. Each socket requires a `channel`, and a `controller`. strings can be passed in to the `controller`, but a `controllers` directory must be passed in to the config. if strings are used, they must be `.` delimited where the first work is the file, and the remaining string denotes the controller property/handler chain (accepts nested objects). ([see complex example for more detail](https://github.com/johnhof/rabbit-service/tree/master/examples/complex)).


```javasscript
config.sockets = [{
  listen  : 'data',
  type    : 'SUB',
  channel : 'foo',
  topic   : 'bar.biz'
  options : {
    routing : 'topic'
  },
  controller : function *() {}
}]
```

for more detail on the option, look at the [rabbit.js documention](http://www.squaremobius.net/rabbit.js/)

### config.controllers

Path to controllers directory. If the socket controllers are identified by name (string), this directory is used to map the controller.


```javasscript
config.controllers = __dirname + 'controllers';
```

### config.onConnect

Generator function called when the rabbit context is established. Recalled is the connection is dropped and reconnected. can also be passed as the second parameter after the config object

```javascript
config.onConnect = function *(config) {
  // this = connection context object
  console.log('Listening');
}
```

### config.reconnect

Used if the service fails to connect to RabbitMQ, or the connection is dropped. Any truthy value will cause the service to automatically reconnect. By default, it will delay 1 second before attempting to reestablish a connection. each consecutive fail will double hte delay before the next attempt, up to a maximum delay (five minutes by default). initial and max delay can be configured, and a catch funtion can be injected to run every time the connection drops, or the reconnection fails.

```javascript
// start reconnect delay at 1 sec, doubling with each failure up to a max 5 minute delay
config.reconnect = true;

// start reconnect delay at 1 sec, doubling with each failure up to a max 5 minute delay. function is called on each failure
config.reconnect = function *(config, count, delay, err) {
  if (~err.stack.indexOf('Unexpected close')) {
    console.log('Connection dropped')
  } else {
    console.log('Failed to reconnect ' + count + ' times. Retrying after ' + (delay / 1000) + ' seconds...')
  }
}

// start reconnect delay at 2 sec, doubling with each failure up to a max 1 minute delay. function is called on each failure
config.reconnect = {
  startDelay : 2000, // 2 seconds
  maxDelay   : 60000, // one minute
  catch      : function *(config, count, delay, err) {
    if (~err.stack.indexOf('Unexpected close')) {
      console.log('Connection dropped')
    } else {
      console.log('Failed to reconnect ' + count + ' times. Retrying after ' + (delay / 1000) + ' seconds...')
    }
  }
};
```

### config.reconnect.startDelay

Initial delay before attempting to reconnect. Defaults to one second.

```javascript
config.reconnect.startDelay = 5000 // 5 seconds
```

### config.reconnect.maxDelay

Maximum delay allowed between each reconnection attempt. delay will double on each failure until this delay is reached.

```javascript
config.reconnect.maxDelay = 60000 // 1 minute
```

### config.reconnect.catch

```javascript
fconfit.reconnect.catch = function *(config, count, delay, err) {
  if (~err.stack.indexOf('Unexpected close')) {
    console.log('Connection dropped')
  } else {
    console.log('Failed to reconnect ' + count + ' times. Retrying after ' + (delay / 1000) + ' seconds...')
  }
}
```

## Authors

  - [John Hofrichter](https://github.com/johnhof)

## License

  MIT

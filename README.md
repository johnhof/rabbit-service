# rabbit-service

This service leverages RabbitMQ and generators to create a simple, extensible service for messaging. Functionality is built on top of the [rabbit.js module](http://www.squaremobius.net/rabbit.js/).

*NOTE*: the `--harmony` flag is required

- [Usage](#usage)
  - [Standalone](#standalone)
  - [Sub-service](#subservice)
- [Defaults](#defaults)
- [Configuration](#configuration)
  - [config.context](#configcontext)
  - [config.json](#configjson)
  - [config.middleware](#configmiddleware)
  - [config.error](#configerror)
  - [config.sockets](#configsockets)



## Usage

*Note*: The `app` object is passed in to each function. by default it contains the context result from the rabbit connect. other things can be attached to it, but remember that the context is shared between controller executions

### Standalone



```javascript
var service = require('rabbit-service');

service.config({
  context : 'amqp://guest:guest@127.00.1',
  json : true,
  sockets : {
    channel    : 'test',
    topic      : 'testing.stuff',
    controller : function *(json) {

    },
  }
});

service.launch();
```


### Sub-service


*main.js*
```javascript
var spawn    = require('child_process').spawn;

console.log('Starting koa...');
var koaProc = spawn('node', [ '--harmony','./koa_service.js']);
koaProc.stdout.pipe(process.stdout);
koaProc.stderr.pipe(process.stderr);

console.log('Starting rabbit...');
var rabbitProc = spawn('node', [ '--harmony','./rabbit_service.js']);
rabbitProc.stdout.pipe(process.stdout);
rabbitProc.stderr.pipe(process.stderr);
```

*koa_service.js*

```javascript
var koa = require('koa');
var app = koa();

app.use(function *() {
  this.body = 'Hello, World';
  console.log('Hello from koa!');
})
```

*rabbit_service.js*

```javascript
var service = require('rabbit-service');

service({
  sockets : [{
    channel    : 'test',
    topic      : 'testing.stuff',
    controller : function *(data) {
      console.log('Hello from rabbit!');
      console.log(data)
    }
  }]
});
```


## Defaults



The default config is as follows:
```javascript
context  : 'amqp://guest:guest@127.00.1',
defaults : {
  listen  : 'data',
  type    : 'SUB',
  options : {
    routing : 'topic'
  }
}
```


## Configuration


### config.context

set the connection context. Defaults to `amqp://guest:guest@127.00.1`

```javascript
config.context = 'amqp://admin:1337HaXoR@127.00.1'
```

### config.json

if true, the message will be parsed into json before the controller is called

```javascript
config.json = true
```

### config.middleware

middleware to wrap the controller

```javascript
config.middleware = function *(json, app, controller) {
  app.logJson = function (string) {
    console.log(JSON.stringify(string, null, '  '));
  }

  yield controller;

  console.log('done');
},
```

### config.error

error handler function

```javascript
config.error = function *(error, data, app) {
  console.log('ERROR!');
  console.log(error.stack);
}
```

### config.sockets

an array of socket configurations. Each socket requires a `channel`, and a `controller`. strings can be passed in to the `controller`, but a `controllers` directory must be passed in to the config. if strings are used, they must be `.` delimited where the first work is the file, and the remaining string denotes the controller property/handler. ([see complex example for more detail](https://github.com/johnhof/rabbit-service/tree/master/examples/complex)).


```javasscript
config.sockets = [{
  listen  : 'data',
  type    : 'SUB',
  channel : 'foo',
  topic   : 'bar.biz'
  options : {
    routing : 'topic'
  },
  controller : function *(data, app) {}
}]
```

for more detail on the option, look at the [rabbit.js documention](http://www.squaremobius.net/rabbit.js/)


## Authors

  - [John Hofrichter](https://github.com/johnhof)

## License

  MIT

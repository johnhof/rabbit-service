# rabbit-service

This service leverages RabbitMQ and generators to create a simple, extensible service for messaging. Functionality is built on top of the [rabbit.js module](http://www.squaremobius.net/rabbit.js/).

- [Usage](#usage)
  - [Promises](#promises)
  - [Generators](#generators)
  - [Complex](https://github.com/johnhof/rabbit-service/tree/refactor/examples/complex)
- [Documentation](#documentation)
  - **TODO**

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

# Authors

  - [John Hofrichter](https://github.com/johnhof)

# License

  MIT

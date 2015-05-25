var service = require('../../lib/service');

service({
  sockets : [{
    channel    : 'test',
    topic      : 'testing.stuff',
    controller : function *() {
      console.log('Hello from rabbit!');
      console.log(this.message)
    }
  }]
});

console.log('Rabbit listening...')

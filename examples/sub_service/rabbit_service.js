var service = require('../../lib/service');

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

console.log('Rabbit listening...')

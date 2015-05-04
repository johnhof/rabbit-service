var service = require('../lib/service');


service({
  sockets : [{
    channel    : 'test',
    topic      : 'testing.stuff',
    controller : function *(data) {
      console.log(data)
    }
  }]
})

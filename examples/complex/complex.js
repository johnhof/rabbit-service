var service = require('../../lib/service');

service({
  json        : true,
  controllers : __dirname + '/controllers',
  middleware  : function *(next) {
    this.log = function (string) {
      console.log(JSON.stringify(string, null, '  '));
    }

    yield next;

    console.log('done');
  },
  sockets    : [{
    channel    : 'test',
    topic      : 'testing.stuff',
    controller : 'test.stuff',
  },{
    channel    : 'test',
    topic      : 'testing.*',
    controller : 'another_test',
  }]
})

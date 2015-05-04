var service = require('../../lib/service');

service({
  json        : true,
  controllers : __dirname + '/controllers',
  before      : function *(json, app) {
    app.log = function (string) {
      console.log(JSON.stringify(string, null, '  '));
    }
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

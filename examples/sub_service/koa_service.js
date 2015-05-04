var koa = require('koa');
var app = koa();

app.use(function *() {
  this.body = 'Hello, World';
  console.log('Hello from koa!');
})

app.listen(3000);
console.log('Koa listening...')

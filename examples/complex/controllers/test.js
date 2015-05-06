exports.stuff = function *(json, app) {
  console.log('from test.stuff:')

  app.log(json);
}

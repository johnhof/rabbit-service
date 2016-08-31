'use strict';

module.exports = (msg) => {
  let error = new Error(msg);
  throw error
}

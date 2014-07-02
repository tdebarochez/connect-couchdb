var Couch = require('yacw');

var databases = ['connect-couch-underscoretest',
                 'connect-couch-throttle',
                 'connect-couch-reap',
                 'connect-couch-test',
                 'connect-couch-puttest'];
databases.forEach(function (database_name) {
  (new Couch({name: database_name})).dbDel();
});
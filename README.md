# Connect CouchDB

`connect-couchdb` is a middleware session store for the connect framework.

## Requirements

- request 1.9.x
- couchdb 1.0.x or higher
- expresso (only for tests)

## Installation

Via npm:

    $ npm install connect-couchdb

## Usage

    var connect = require('connect'),
        ConnectCouchDB = require('connect-couchdb')(connect);

    var store = new ConnectCouchDB({
      // Name of the database you would like to use for sessions.
      name: 'myapp-sessions',

      // Optional. How often expired sessions should be cleaned up.
      // Defaults to 600000 (10 minutes).
      reapInterval: 600000,

      // Optional. How often to run DB compaction against the session
      // database. Defaults to 600000 (10 minutes).
      compactInterval: 600000
    });
    var server = connect.createServer();
    server.use(connect.session({secret: 'YourSecretKey', store: store });

If the database specified doesn't already exist `connect-couch` will create it
and setup its primary design document. It is highly recommended that you use
a separate database for your sessions for performance of both the session
views and any other document views you may have.

See `example.js` file for an example connect server using `connect-couch`.

## Tests

    $ npm test

## Author

- Thomas Debarochez ([tdebarochez](https://github.com/tdebarochez))

## Contributors

- Ian Ward ([ianshward](https://github.com/ianshward))
- Ryan Kirkman ([ryankirkman](https://github.com/ryankirkman))
- Young Hahn ([yhahn](https://github.com/yhahn))
- Dan VerWeire ([wankdanker](https://github.com/wankdanker))
- Konstantin Käfer ([kkaefer](https://github.com/kkaefer))

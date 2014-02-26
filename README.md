# Connect CouchDB

`connect-couchdb` is a middleware session store for the connect framework.
[![Build Status](https://secure.travis-ci.org/tdebarochez/connect-couchdb.png)](http://travis-ci.org/tdebarochez/connect-couchdb)

## Requirements

- couchdb 1.2.x
- yacw 0.2.x : the couchdb wrapper. Should be easy to use another one.
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
      // database. Defaults to 300000 (5 minutes).
      // To disable compaction, set compactInterval to -1
      compactInterval: 300000,

      // Optional. How many time between two identical session store
      // Defaults to 60000 (1 minute)
      setThrottle: 60000
    });
    var server = connect.createServer();
    server.use(connect.session({secret: 'YourSecretKey', store: store });

If the database specified doesn't already exist you have to create it with
`tools/` files. Run following command to create database, populate with the
design document and setup the CouchDB database specific option `_revs_limit` :

    $ node tools/setup.js <database_name> <revs_limit> [username] [password]

For more informations about the `_revs_limit` option, read
[this](http://wiki.apache.org/couchdb/HTTP_database_API#Accessing_Database-specific_options).

It is highly recommended that you use a separate database for your
sessions for performance of both the session views and any other document
views you may have.

See `example.js` file for an example connect server using `connect-couch`.

## Updating

Please invoke the tool to create the design documents when updating to insure you are using the last version of the view.

    $ node tools/put_design_docs.js <database_name> [username] [password]

## Tests

    $ npm test

## Author

- Thomas Debarochez ([tdebarochez](https://github.com/tdebarochez))

## Contributors

    $ git shortlog -s -n

- Ian Ward ([ianshward](https://github.com/ianshward))
- Young Hahn ([yhahn](https://github.com/yhahn))
- Ryan Kirkman ([ryankirkman](https://github.com/ryankirkman))
- Andreas Lappe ([alappe](https://github.com/alappe))
- Cliffano Subagio ([cliffano](https://github.com/cliffano))
- Dan VerWeire ([wankdanker](https://github.com/wankdanker))
- Daniel Bell ([danbell](https://github.com/danbell))
- Konstantin Käfer ([kkaefer](https://github.com/kkaefer))
- Pau Ramon Revilla ([masylum](https://github.com/masylum))
- Quentin Raynaud ([even](https://github.com/even))
- Ivan Erceg ([ierceg](https://github.com/ierceg))

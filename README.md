# Connect CouchDB

connect-couchdb is a middleware session storage for connect framework

## Requirement

 - cradle (v 0.1.0)

## Installation

Via npm :

	  $ npm install connect-couchdb

If database doesn't exist, it will create it and setting views. If database
already exist you'll need to setup views by running :
`require('connect-couchdb').setup('yourdatabase').install()`

## Example

Take a look at `example.js` file to see an example of use.

## Options

 - `database`: database name
 - ... all every parameters are passed to cradle.Connection()
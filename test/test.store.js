var assert = require('assert')
  , connect = require('connect')
  , path = require('path')
  , ConnectCouchDB = require('../')(connect)
  , global_opts = {"name": 'connect-couchdb-' + +new Date};

if (path.existsSync('./test/credentials.js')) {
  var credentials = require('./credentials.js');
  global_opts.username = credentials.username;
  global_opts.password = credentials.password;
} 

module.exports = {
  // Test basic set/get/clear/length functionality.
  'basic': function () {
    var opts = global_opts;
    opts.name = 'connect-couch-test';
    opts.revs_limit = '2';
    var store = new ConnectCouchDB(opts);
    store.setup(opts, function (err, res) {
      assert.ok(!err);
      store.db.getOpt('_revs_limit', function (err, res) {
        assert.ok(!err);
        assert.equal(res, opts.revs_limit); 
        // #set()
        store.set('123', { cookie: { maxAge: 2000 }, name: 'tj' }, function(err, ok){
          assert.ok(!err, '#set() got an error');
          // #get()
          store.get('123', function(err, data){
            assert.ok(!err, '#get() got an error');
            assert.deepEqual({ cookie: { maxAge: 2000 }, name: 'tj' }, data);
            // #length()
            store.length(function(err, len){
              assert.ok(!err, '#length() got an error');
              assert.equal(1, len, '#length() with keys');
              // #clear()
              store.clear(function(err, ok){
                assert.ok(!err, '#clear()');
                // #length()
                store.length(function(err, len){
                  assert.ok(!err, '#length()');
                  assert.equal(0, len, '#length() without keys');
                  // #set null
                  store.set('123', { cookie: { maxAge: 2000 }, name: 'tj' }, function(){
                    store.destroy('123', function(){
                      store.length(function(err, len){
                        assert.equal(0, len, '#set() null');
                        store.db.dbDel();
                        store.clearInterval();
                      });
                    });
                  });
                });
              });
            });
          });
        });
      }); 
    });
  },
  // Test expired session reaping.
  'reap': function () {
    var opts = global_opts;
    opts.name = 'connect-couch-reap';
    opts.reapInterval = 500;
    var store = new ConnectCouchDB(opts);
    store.setupDatabase(function (err, res) {
      assert.ok(!err);
      store.setupDesignDocs(function (err, res) {
        assert.ok(!err);
        store.setupOptions(opts, function(err, res) {
          assert.ok(!err);
          store.set('1', { cookie: { maxAge: 250 } });
          store.set('2', { cookie: { maxAge: 250 } });
          store.set('3', { cookie: { maxAge: 5000 } });
          store.set('4', { cookie: { maxAge: 5000 } });
          setTimeout(function() {
            store.length(function(err, len) {
              assert.equal(2, len, '#length() after reap');
              store.db.dbDel();
              store.clearInterval();
            });
          }, 1000);
        });
      });
    });
  },
  // Test session put throttling
  'throttle': function () {
    var opts = global_opts;
    opts.name = 'connect-couch-throttle';
    opts.revs_limit = '4';
    var store = new ConnectCouchDB(opts);
    store.setup(opts, function (err, res) {
      assert.ok(!err);
        // First #set()
        store.set('123', { cookie: { maxAge: 20000 }, name: 'tj'
        //store.set('123', {
        //  cookie: {
        //    maxAge: 2000,
        //    _expires: 13253760002000,
        //    originalMaxAge: 2000 
        //  }, 
        //  name: 'foo',
        //  lastAccess: 13253760000000
        }, function(err, ok){
          var first = new Date().getTime();
          store.get('123', function(err, data){
            console.log(data);
            // Second #set()
        store.set('123', { cookie: { maxAge: 20000 }, name: 'tj'
            //store.set('123', {
            //  cookie: {
            //    maxAge: 2000,
            //    _expires: 13253760004000,
            //    originalMaxAge: 4000,
            //  },
            //  name: 'foo',
            //  lastAccess: 13253760000001
            }, function(err, ok){
              store.get('123', function(err, data){
                var second = new Date().getTime();
                // session data not changed. If two sets occurred < 1s, objects should be identical
                if (second - first < 1000) {
                  console.log('here');
                  console.log(data);
                } else {
                  console.log('there');
                  console.log(data);
                }
        store.set('123', { cookie: { maxAge: 20000 }, name: 'tj'}, function(err, ok) {
                store.db.dbDel();
                store.clearInterval();
              });
            });
          });
          });
        });
      }); 
  },
};

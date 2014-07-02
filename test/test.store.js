var assert = require('assert')
  , session = require('express-session')
  , path = require('path')
  , fs = require('fs')
  , ConnectCouchDB = require('../')(session)
  , global_opts = {"name": 'connect-couchdb-' + +new Date};

if (fs.existsSync('./test/credentials.json')) {
  var credentials = require('./credentials.json');
  global_opts.username = credentials.username;
  global_opts.password = credentials.password;
}

function reason (err) {
  return !err ? '' : err.reason;
}

describe('connect-session.json', function () {
  it('is a valid json', function(done) {
    assert.doesNotThrow(function() {
      fs.readFile('lib/connect-session.json', function(err, data) {
        assert.ok(!err, reason(err));
        JSON.parse(data.toString());
        done();
      });
    });
  });
});
describe('db', function () {
  it('put only if needed', function (done) {
    var opts = global_opts;
    opts.name = 'connect-couch-puttest';
    var store = new ConnectCouchDB(opts);
    var cookie = { cookie: { maxAge: 2000 }, name: 'nd' };
    store.setup(opts, function(err, res) {
      assert.ok(!err, reason(err));
      store.set('987', cookie, function(err, ok) {
        assert.ok(!err, reason(err));
        // Redefine store.db.put to assure that it's not executed any more:
        store.db._put = store.db.put;
        store.db.put = function(doc, fn) {
          throw new Error('This put is not needed!');
        };
        store.set('987', cookie, function(err, ok) {
          assert.ok(!err, reason(err));
          store.destroy('987', function() {
            store.length(function(err, len){
              assert.equal(0, len, '#set() null');
              store.clearInterval();
              done();
            });
          });
        });
      });
    });
  });
  // Test basic set/get/clear/length functionality.
  it('set/get/clear/length', function (done) {
    var opts = global_opts;
    var c = { cookie: { maxAge: 2000 }, name: 'tj' };
    opts.name = 'connect-couch-test';
    opts.revs_limit = '2';
    var store = new ConnectCouchDB(opts);
    store.setup(opts, function (err, res) {
      assert.ok(!err, reason(err));
      store.db.getOpt('_revs_limit', function (err, res) {
        assert.ok(!err, reason(err));
        assert.equal(res, opts.revs_limit);
        // #set()
        store.set('123', c, function(err, ok){
          assert.ok(!err, '#set() got an error');
          // #get()
          store.get('123', function(err, data){
            assert.ok(!err, '#get() got an error : ' + reason(err));
            assert.deepEqual(c, data);
            // #length()
            store.length(function(err, len){
              assert.ok(!err, '#length() got an error : ' + reason(err));
              assert.equal(1, len, '#length() with keys : ' + reason(err));
              // #clear()
              store.clear(function(err, ok){
                assert.ok(!err, '#clear() : ' + reason(err));
                // #length()
                store.length(function(err, len){
                  assert.ok(!err, reason(err));
                  assert.equal(0, len, '#length(' + len + ') without keys');
                  // #set null
                  store.set('123', c, function(){
                    store.destroy('123', function(){
                      store.length(function(err, len){
                        assert.ok(!err, reason(err));
                        assert.equal(0, len, '#set() null');
                        store.clearInterval();
                        done();
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
  });
  // Test expired session reaping.
  it('reaping', function (done) {
    var opts = global_opts;
    opts.name = 'connect-couch-reap';
    opts.reapInterval = 500;
    var store = new ConnectCouchDB(opts);
    store.setupDatabase(function (err, res) {
      assert.ok(!err, reason(err));
      store.setupDesignDocs(function (err, res) {
        assert.ok(!err, reason(err));
        store.setupOptions(opts, function(err, res) {
          assert.ok(!err, reason(err));
          var cb = function (i) {
            return function (err) {
              assert.ok(!err, 'error with #' + i + ' : ' + reason(err));
            };
          };
          store.set('1', { cookie: { maxAge:  250 } }, cb(1));
          store.set('2', { cookie: { maxAge:  250 } }, cb(2));
          store.set('3', { cookie: { maxAge: 5000 } }, cb(3));
          store.set('4', { cookie: { maxAge: 5000 } }, cb(4));
          setTimeout(function() {
            store.length(function(err, len) {
              assert.ok(!err, reason(err));
              assert.equal(2, len, '#length(' + len + ') after reap');
              store.clearInterval();
              done();
            });
          }, 1000);
        });
      });
    });
  });
  // Test session put throttling
  it('throttling', function (done) {
    var opts = global_opts;
    opts.name = 'connect-couch-throttle';
    opts.setThrottle = 1000;
    opts.revs_limit = '4';
    var store = new ConnectCouchDB(opts);
    store.setup(opts, function (err, res) {
      assert.ok(!err, reason(err));
      // Set new session
      store.set('123', { cookie: {
          maxAge: 20000, originalMaxAge: 20000 },
        name: 'foo',
        lastAccess: 13253760000000
      }, function(err, ok){
        assert.ok(!err, reason(err));
          // Set again, now added to locks object in connect-couchdb.js
          store.set('123', { cookie: {
              maxAge: 20000,  originalMaxAge: 19999 },
            name: 'foo',
            lastAccess: 13253760000001
          }, function(err, ok){
            assert.ok(!err, reason(err));
            var start = new Date().getTime();
            store.get('123', function(err, data){
              var orig = data;
              // If we set again now, and less than 1s passes, session should not change
              store.set('123', { cookie: {
                  maxAge: 20000, originalMaxAge: 19998 },
                name: 'foo',
                lastAccess: 13253760000002
              }, function(err, ok){
                assert.ok(!err, reason(err));
              store.get('123', function(err, data){
                var stop = new Date().getTime();
                if (stop - start < 1000) {
                  assert.equal(JSON.stringify(orig), JSON.stringify(data),
                    'Sub-microsecond session update without data change should be equal'
                  );
                } else {
                  assert.equal(false, JSON.stringify(orig) === JSON.stringify(data),
                    '> 1s session update without data change should not be equal'
                  );
                }
                // Now delay a second and the session time-related data should change
                var orig = data;
                var start = new Date().getTime();
                setTimeout(function() {
                  store.set('123', { cookie: {
                      maxAge: 20000, originalMaxAge: 19997 },
                    name: 'foo',
                    lastAccess: 13253760001003
                  }, function(err, ok){
                    assert.ok(!err, reason(err));
                    store.get('123', function(err, data){
                      var stop = new Date().getTime();
                      // session data not changed. If two sets occurred < 1s, objects should be identical
                      if (stop - start < 1000) {
                        assert.equal(JSON.stringify(orig), JSON.stringify(data),
                          'Sub-microsecond session update without data change should be equal'
                        );
                      } else {
                        assert.equal(false, JSON.stringify(orig) === JSON.stringify(data),
                          '> 1s session update without data change should not be equal'
                        );
                      }
                      // Now make change to data, session should change no matter what.
                      store.set('123', { cookie: {
                          maxAge: 20000, _expires: 13253760000003, originalMaxAge: 19997 },
                        name: 'bar',
                        lastAccess: 13253760001003
                      }, function(err, ok){
                        store.get('123', function(err, data){
                          assert.equal(false, JSON.stringify(orig) === JSON.stringify(data),
                            'Sub-microsecond session update without data change should be equal'
                          );
                          store.clearInterval();
                          done();
                        });
                      });
                    });
                  });
                }, opts.setThrottle + 100);
              });
            });
          });
        });
      });
    });
  });
  it("id leading with underscore", function (done) {
    var opts = global_opts;
    opts.name = 'connect-couch-underscoretest';
    var store = new ConnectCouchDB(opts);
    var cookie = { cookie: { maxAge: 2000 }, name: 'nd' };
    store.setup(opts, function(err, res) {
      assert.ok(!err, reason(err));
      store.set('_12345', cookie, function(err, ok) {
        assert.ok(!err, reason(err));
        store.get('_12345', function(err, ok) {
          assert.ok(!err, reason(err));
          store.clearInterval();
          done();
        });
      });
    });
  });
});

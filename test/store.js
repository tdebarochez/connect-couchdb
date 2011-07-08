var assert = require('assert'),
    connect = require('connect'),
    ConnectCouchDB = require('../')(connect);

module.exports = {
  // Test basic set/get/clear/length functionality.
  'basic': function () {
    var store = new ConnectCouchDB({ name: 'connect-couch-test' }, function() {
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
    var store = new ConnectCouchDB({
      name: 'connect-couch-reap',
      reapInterval: 500
    }, function() {
      store.set('1', { cookie: { maxAge: 250 } });
      store.set('2', { cookie: { maxAge: 250 } });
      store.set('3', { cookie: { maxAge: 5000 } });
      store.set('4', { cookie: { maxAge: 5000 } });
      setTimeout(function() {
        store.length(function(err, len) {
          assert.equal(2, len, '#length() after reap');
          store.db.dbDel();
        });
      }, 1000);
    });
  }
};

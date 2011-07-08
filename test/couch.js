var couch = require('../lib/couch')
  , assert = require('assert');

var db_name = 'connect-couchdb-' + +new Date;

module.exports = {
  'create & delete database': function () {
    var db = new couch({name: db_name + '1'});
    db.dbPut(function (err, res) {
      assert.strictEqual(err, null); 
      db.dbDel(function (err, res) {
        assert.strictEqual(err, null);
      });
    });
  },
  'db name': function () {
    assert.throws(function () {
      new couch(); 
    });   
  },
  'database _rev_limit option': function () {
    var db = new couch({name: db_name + '2'});
    db.dbPut(function (err, res) {    
      db.putOpt('_revs_limit', '1', function(err, res) {
        assert.strictEqual(err, null);
        db.dbDel();
      });
    }); 
  },
  'create & remove document': function () {
    var db = new couch({name: db_name + '3'});
    db.dbPut(function (err, res) {
      db.put({_id: "qsd", aze: 3}, function (err, res) {
        assert.strictEqual(err, null);
        assert.strictEqual(res.id, 'qsd');
        assert.strictEqual(res.ok, true);
        assert.notEqual(res._rev, undefined);
        db.del({_id: res.id, _rev: res._rev}, function (err, res) {
          assert.strictEqual(err, null);
          db.dbDel();
        });
      });
    }); 
  },
  'get & update document': function () {
    var db = new couch({name: db_name + '4'});
    db.dbPut(function (err, res) {
      db.put({_id: "wxc", aze: 4}, function (err, res) {
        db.get("wxc", function (err, res) {
          assert.strictEqual(err, null);
          assert.strictEqual(res._id, 'wxc');
          assert.strictEqual(res.aze, 4);
          assert.notEqual(res._rev, undefined);
          db.put({_id: "wxc", _rev: res._rev, aze: 5}, function (err, res) {
            assert.strictEqual(err, null);
            db.get("wxc", function (err, res) {
              assert.strictEqual(err, null);
              assert.strictEqual(res._id, 'wxc');
              assert.strictEqual(res.aze, 5);
              assert.notEqual(res._rev, undefined);
              db.head("wxc", function (err, res_head) {
                assert.strictEqual(err, null);
                assert.strictEqual(res._id, res_head._id);
                assert.strictEqual(res._rev, res_head._rev); 
                db.del({_id: res._id, _rev: res._rev}, function (err, res) {
                  assert.strictEqual(err, null);
                  db.dbDel();
                });
              });
            });
          });
        });
      });
    }); 
  },
  'create document with post & views': function () {
    var db = new couch({name: db_name + '5'});
    db.dbPut(function (err, res) { 
      db.putDesignDocs([__dirname + '/../lib/connect-session.json'], function (err) {
        assert.strictEqual(err, null);
        db.post({doc: {type: 'connect-session'}}, function (err, res) {
          assert.strictEqual(err, null);
          db.view('_design/connect-sessions/_view/expires', {}, function (err, docs) {
            assert.strictEqual(err, null);
            assert.strictEqual(docs.total_rows, 0);
            db.dbDel();
          });
        });
      });
    });
  }
};

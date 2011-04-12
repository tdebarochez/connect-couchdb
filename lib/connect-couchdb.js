var Store = require('connect').session.Store,
    cradle = require('cradle'),
    sys = require('sys');
    db = null;

var ConnectCouchDB = function (opts) {
  opts = opts || {};
  Store.call(this, opts);

  this.reapInterval = opts.reapInterval || 600000;
  if (this.reapInterval !== -1) {
    setInterval(function(self){
      self.reap(self.maxAge);
    }, this.reapInterval, this);
  }
};

function _check_error(err) {
  if (err != null) {
    console.log("connect-couchdb error:");
    console.log(err);
  }
};

ConnectCouchDB.setup = function (database, opts) {
  opts = opts || {};
  if (!database) {
    throw "You must define a database";
  }

  db = new(cradle.Connection)(opts).database(database);
  db.exists(function (err, exists) {
    _check_error(err);

    if (!exists) {
      db.create(function(err, res) {
        _check_error(err);
        _install();
      });
    }
  });
  return ConnectCouchDB;
};

_install = function () {
  var designDoc = {
    views: {
      all: {
        map: function (doc) {
          if (doc.type == 'connect-session') emit(null, doc);
        }
      },
      valid: {
        map: function (doc) {
          if (doc.type == 'connect-session' && doc.ttl < (+new Date - doc.ctime)) {
            emit(null, doc);
          }
        }
      }
    }
  };

  db.save('_design/connect-sessions', designDoc, function(err, doc) {
    _check_error(err);
  });
};

require('util').inherits(ConnectCouchDB, Store);

ConnectCouchDB.prototype.get = function(sid, fn){
  db.get(sid, function (err, doc) {
    if (err) return fn && fn(err);
    if (doc) {
      if (doc.ttl > (+new Date - doc.ctime)) {
        fn(null, doc.datas);
      }
      else {
        db.remove(sid);
        fn(null, null);
      }
    }
    else {
      fn(null, null);
    }
  });
};

ConnectCouchDB.prototype.set = function(sid, sess, fn) {
  fn = fn || function () {};
  var self = this;
  this.get(sid, function (err, doc) {
    if (!doc) {
      var newDoc = {ctime: +new Date,
             ttl: self.reapInterval,
             type: 'connect-session',
             datas: sess};
      db.save(sid, newDoc, fn);
    }
    else {
      db.merge(sid, {datas: sess}, fn);
    }
  });
};

ConnectCouchDB.prototype.destroy = function(sid, fn){
  db.get(sid, function(err, doc) {
    if (err) return fn(err, doc);

    db.remove(sid, doc._rev, fn);
  });
};

ConnectCouchDB.prototype.clear = function(fn){
  var self = this;
  db.view('sessions/all', function (err, docs) {
    if (err) return fn && fn(err);
    docs.forEach(function (doc) {
      self.remove(doc._id);
    });
    fn(null, null);
  });
};

ConnectCouchDB.prototype.reap = function(ms){
  var threshold = +new Date - ms;
  var self = this;
  db.view('sessions/all', function (err, docs) {
    if (err) return;
    docs.forEach(function (doc) {
      if (doc.ctime < threshold) {
        self.remove(doc._id);
      }
    });
  });
};

ConnectCouchDB.prototype.length = function(fn){
  db.view('sessions/valid', function (err, docs) {
    fn && fn(err, docs.length);
  });
};


module.exports = ConnectCouchDB;

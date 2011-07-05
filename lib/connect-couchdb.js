var _ = require('underscore'),
    sys = require('sys'),
    Couch = require('./couch');

module.exports = function(connect) {

    var Store = connect.session.Store;
    var db = null;

    function ConnectCouchDB(opts) {
        opts = opts || {};
        Store.call(this, opts);

        this.reapInterval = opts.reapInterval || 600000;
        if (this.reapInterval !== -1) {
            setInterval(function (self) {
                self.reap(self.maxAge);
            }, this.reapInterval, this);
        }
        // Even when _revs_limit is set to 1, old revisions take up space,
        // therefore, compact the database every once in awhile.
        this.compactInterval = opts.compactInterval || 300000;
        setInterval(function (self) {
            self.compact();
        }, this.compactInterval, this);

        ConnectCouchDB.setup.call(this, opts);
    };

    function _check_error(err) {
        if (err != null) {
            console.log("connect-couchdb error:");
            console.log(err);
            console.log(new Error().stack);
        }
    };

    function _uri_encode(id) {
        // We first decode it to escape any current URI encoding.
        return encodeURIComponent(decodeURIComponent(id));
    }

    ConnectCouchDB.setup = function(opts) {
        opts = opts || {};
        opts.revs_limit = opts.revs_limit || '1';
        if (!opts.name) {
            throw "You must define a database";
        }
        db = new Couch(opts);
        db.get('', function(err, doc) {
            if (err) {
                if (err.statusCode === 404) {
                    db.dbPut(function(err) {
                        db.putOpt('_revs_limit', opts.revs_limit, function(err, res) {
                            if (err) _check_error(err);
                        });
                        db.putDesignDocs([__dirname + '/connect-session.json']);
                    });
                }
            }
        });
        return ConnectCouchDB;
    };

    ConnectCouchDB.prototype.__proto__ = Store.prototype;

    ConnectCouchDB.prototype.get = function (sid, fn) {
        sid = _uri_encode(sid);
        var self = this;
        db.get(sid, function (err, doc) {
            if (err) {
                if (err.error == "not_found") {
                    err.code = "ENOENT";
                }

                return fn && fn(err);
            }
            if (doc) {
                if (doc.ttl > (+new Date - doc.ctime)) {
                    fn(null, doc.sess);
                } else {
                    self.destroy(sid);
                    fn(null, null);
                }
            } else {
                fn(null, null);
            }
        });
    };

    ConnectCouchDB.prototype.set = function (sid, sess, fn) {
        sid = _uri_encode(sid);
        fn = fn || function () {};
        var self = this;
        db.get(sid, function (err, doc) {
            if (err) {
                var newDoc = {};
                newDoc.doc = {
                    _id: sid,
                    ctime: +new Date,
                    ttl: self.reapInterval,
                    type: 'connect-session',
                    sess: sess
                };
                db.post(newDoc, function (err, res) {
                    fn(err, res);
                });
            } else {
                // Update the session object.  Throttle updating to
                // minimize 409 conflicts from overlapping set/get.
                // @TODO: assumes nothing meaningful is stored in
                // session data.
                if (sess.lastAccess - doc.sess.lastAccess > 5000) {
                    doc.sess = sess;
                    db.put(doc, function (err, res) {
                        fn(err, res);
                    });
                } else {
                    fn();
                }
            }
        });
    };

    ConnectCouchDB.prototype.destroy = function (sid, fn) {
        sid = _uri_encode(sid);
        db.get(sid, function (err, doc) {
            if (err) return fn && fn(err);
              db.del(doc, fn);
        });
    };

    ConnectCouchDB.prototype.clear = function (fn) {
        var self = this;
        db.view('sessions/all', function (err, docs) {
            if (err) return fn && fn(err);
            docs.forEach(function (doc) {
                self.destroy(doc._id);
            });
            fn();
        });
    };

    ConnectCouchDB.prototype.reap = function (ms) {
        var threshold = +new Date - ms;
        var self = this;

        db.view('connect-sessions/all', function (err, docs) {
            if (err) return fn && fn(err);
            docs.forEach(function (doc) {
                if (doc.ctime < threshold) {
                    self.destroy(doc._id);
                }
            });
        });
    };

    ConnectCouchDB.prototype.length = function (fn) {
        db.view('sessions/valid', function (err, docs) {
            fn && fn(err, docs.length);
        });
    };

    ConnectCouchDB.prototype.compact = function () {
        var obj = {endpoint: '_compact', doc: {}};
        db.post(obj, function(err, res) {});
    };

    return ConnectCouchDB;
}

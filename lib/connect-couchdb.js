var _ = require('underscore'),
    sys = require('sys'),
    Couch = require('./couch');

var env = process.env.NODE_ENV;

module.exports = function(connect) {

    var Store = connect.session.Store;
    var db = null;

    function ConnectCouchDB(opts) {
        opts = opts || {};
        Store.call(this, opts);

        this.reapInterval = opts.reapInterval || 600000;
        if (env !== 'test' && this.reapInterval !== -1) {
            this.reapIntervalID = setInterval(function () {
                this.reap(this.maxAge);
            }.bind(this), this.reapInterval);
        }
        // Even when _revs_limit is set to 1, old revisions take up space,
        // therefore, compact the database every once in awhile.
        this.compactInterval = opts.compactInterval || 300000;
        if (env !== 'test') {
            this.compactIntervalID = setInterval(function () {
                this.compact();
            }.bind(this), this.compactInterval);
        }

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
            if (err && err.statusCode === 404) {
                db.dbPut(function(err) {
                    _check_error(err);
                    db.putOpt('_revs_limit', opts.revs_limit, _check_error);
                    db.putDesignDocs([__dirname + '/connect-session.json']);
                });
            }
        });
        return ConnectCouchDB;
    };

    ConnectCouchDB.prototype.__proto__ = Store.prototype;

    ConnectCouchDB.prototype.get = function (sid, fn) {
        sid = _uri_encode(sid);
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
                    this.destroy(sid);
                    fn(null, null);
                }
            } else {
                fn(null, null);
            }
        }.bind(this));
    };

    ConnectCouchDB.prototype.set = function (sid, sess, fn) {
        sid = _uri_encode(sid);
        fn = fn || function () {};
        db.get(sid, function (err, doc) {
            if (err) {
                var newDoc = {};
                newDoc.doc = {
                    _id: sid,
                    ctime: +new Date,
                    ttl: this.reapInterval,
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
        }.bind(this));
    };

    ConnectCouchDB.prototype.destroy = function (sid, fn) {
        sid = _uri_encode(sid);
        db.get(sid, function (err, doc) {
            if (err) return fn && fn(err);
              db.del(doc, fn);
        });
    };

    ConnectCouchDB.prototype.clear = function (fn) {
        db.view('sessions/all', function (err, docs) {
            if (err) return fn && fn(err);
            docs.forEach(function (doc) {
                this.destroy(doc._id);
            });
            fn();
        }.bind(this));
    };

    ConnectCouchDB.prototype.reap = function (ms) {
        var threshold = +new Date - ms;
        db.view('connect-sessions/all', function (err, docs) {
            if (err) return fn && fn(err);
            docs.forEach(function (doc) {
                if (doc.ctime < threshold) {
                    this.destroy(doc._id);
                }
            });
        }.bind(this));
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

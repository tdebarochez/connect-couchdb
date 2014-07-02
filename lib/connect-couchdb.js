var Couch = require('yacw');

module.exports = function(session) {
    var Store = session.Store;

    function ConnectCouchDB(opts, fn)  {
        opts = opts || {};
        if (fn) {
            console.error('DEPRECATED usage of callback function in ConnectCouchDB\'s constructor');
        }

        Store.call(this, opts);

        this.db = null;
        this.reapInterval = opts.reapInterval || (10 * 60 * 1000);
        this.compactInterval = opts.compactInterval || (5 * 60 * 1000);
        this.setThrottle = opts.setThrottle || 60000;

        // Even when _revs_limit is set to 1, old revisions take up space,
        // therefore, compact the database every once in awhile.
        if (this.reapInterval > 0)
            this._reap = setInterval(this.reap.bind(this), this.reapInterval);
        if (this.compactInterval > 0)
            this._compact = setInterval(this.compact.bind(this), this.compactInterval);

        if (!opts.name && !opts.uri) {
            throw "You must define a database";
        }
        this.db = new Couch(opts);
    }

    function _check_error(err) {
        if (err !== null) {
            console.log("connect-couchdb error:");
            console.log(err);
            console.log(new Error().stack);
        }
    }

    function _uri_encode(id) {
        // starting storage key with undescore is reserved. See issue #24.
        var prefix = 'connect-session_';
        // We first decode it to escape any current URI encoding.
        return encodeURIComponent(decodeURIComponent(id.substr(0, prefix.length) === prefix ? '' : prefix) + id);
    }

    ConnectCouchDB.prototype.__proto__ = Store.prototype;

    ConnectCouchDB.prototype.setupOptions = function (opts, fn) {
        if ('revs_limit' in opts) {
            this.db.putOpt('_revs_limit', opts.revs_limit, function(err) {
                _check_error(err);
                fn && fn(err);
            });
        }
        else {
            fn && fn(null);
        }
    }

    ConnectCouchDB.prototype.setupDesignDocs = function (fn) {
        var self = this;

        function createDesignDocs() {
                // Create the design document
                self.db.putDesignDocs([__dirname + '/connect-session.json'], function(err) {
                        _check_error(err);
                        fn && fn(err);
                });
        }

        // Try to get the design doc if it exists
        this.db.get('_design/connect-sessions', function(err, doc) {
                // Delete the design docs if it exists & create the new one
                if (!err)
                        self.db.del(doc, createDesignDocs);
                else
                        createDesignDocs();
        });
    }

    ConnectCouchDB.prototype.setupDatabase = function (fn) {
        this.db.get('', function(err, doc) {
            if (err && err.statusCode === 404) {
                this.db.dbPut(function(err) {
                    _check_error(err);
                    fn && fn(err);
                }.bind(this));
            }
            else {
                _check_error(err);
                fn && fn(err);
            }
        }.bind(this));
    };

    ConnectCouchDB.prototype.setup = function (opts, fn) {
        this.setupDatabase(function (err) {
            if (err) return fn && fn(err);
            this.setupDesignDocs(function (err) {
                if (err) return fn && fn(err);
                this.setupOptions(opts, function (err) {
                    fn && fn(err);
                });
            }.bind(this));
        }.bind(this));
    };

    ConnectCouchDB.prototype.get = function (sid, fn) {
        sid = _uri_encode(sid);
        var now = +new Date;
        this.db.get(sid, function (err, doc) {
            if (err) {
                if (err.error == "not_found") err.code = "ENOENT";
                return fn && fn(err);
            } else if (doc.expires && now >= doc.expires) {
                return fn && fn(null, null);
            } else {
                return fn && fn(null, doc.sess);
            }
        }.bind(this));
    };

    ConnectCouchDB.prototype.set = function (sid, sess, fn) {
        sid = _uri_encode(sid);
        fn = fn || function () {};
        this.db.get(sid, function (err, doc) {
            var expires = typeof sess.cookie.maxAge === 'number'
                ? (+new Date()) + sess.cookie.maxAge
                : (+new Date()) + (24 * 60 * 60 * 1000);
            if (err) {
                doc = {
                    _id: sid,
                    expires: expires,
                    type: 'connect-session',
                    sess: sess
                };
                this.db.put(doc, fn);
            } else {
                var accessGap = sess.lastAccess - doc.sess.lastAccess;
                // Temporarily remove properties for session comparison
                var _lastAccess = sess.lastAccess;
                var _originalMaxAge = sess.cookie.originalMaxAge;
                if (sess.cookie._expires) {
                    var _expires = sess.cookie._expires;
                    sess.cookie._expires = null;
                }
                if (doc.sess.cookie.expires) {
                    doc.sess.cookie.expires = null;
                }
                sess.lastAccess = null;
                sess.cookie.originalMaxAge = null;
                doc.sess.lastAccess = null;
                doc.sess.cookie.originalMaxAge = null;
                // Compare new session to current session, save if different
                // or setThrottle elapses
                if (JSON.stringify(doc.sess) !== JSON.stringify(sess)
                    || accessGap > this.setThrottle) {
                    sess.lastAccess = _lastAccess;
                    if (_expires) sess.cookie._expires = _expires;
                    sess.cookie.originalMaxAge = _originalMaxAge;
                    doc.expires = expires;
                    doc.sess = sess;
                    this.db.put(doc, fn);
                } else {
                    return fn();
                }
            }
        }.bind(this));
    };

    ConnectCouchDB.prototype.destroy = function (sid, fn) {
        sid = _uri_encode(sid);
        this.db.get(sid, function (err, doc) {
            if (err) return fn && fn(err);
            this.db.del(doc, fn);
        }.bind(this));
    };

    function destroy(docs, fn) {
        var self = this;
        var deleted_docs = []
        docs.forEach(function(doc) {
            deleted_docs.push({_id: doc.doc._id, _rev: doc.doc._rev, _deleted: true});
        });
        this.db.bulk({docs: deleted_docs}, fn);
    }

    ConnectCouchDB.prototype.clear = function (fn) {
        var options = { reduce: false, include_docs: true };
        this.db.view('_design/connect-sessions/_view/expires', options, function (err, docs) {
            if (err) return fn && fn(err);
            destroy.call(this, docs.rows, fn);
        }.bind(this));
    };

    ConnectCouchDB.prototype.reap = function (fn) {
        var now = +new Date;
        var options = { endkey: now, reduce: false, include_docs: true };
        this.db.view('_design/connect-sessions/_view/expires', options, function (err, docs) {
            if (err) return fn && fn(err);
            destroy.call(this, docs.rows, fn);
        }.bind(this));
    };

    ConnectCouchDB.prototype.length = function (fn) {
        var now = +new Date;
        var options = { startkey: now, reduce: false, include_docs: true };
        this.db.view('_design/connect-sessions/_view/expires', options, function (err, docs) {
            if (err) {
                return fn && fn(err);
            } else {
                return fn && fn(err, docs.total_rows - docs.offset);
            }
        });
    };

    ConnectCouchDB.prototype.compact = function () {
        var obj = {endpoint: '_compact', doc: {}};
        this.db.post(obj, function(err, res) {});
    };

    ConnectCouchDB.prototype.clearInterval = function () {
        if (this._reap) clearInterval(this._reap);
        if (this._compact) clearInterval(this._compact);
    };

    return ConnectCouchDB;
}

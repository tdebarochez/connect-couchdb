var Couch = require('./couch');

var env = process.env.NODE_ENV;

module.exports = function(connect) {
    var Store = connect.session.Store;

    function ConnectCouchDB(opts, fn) {
        opts = opts || {};
        Store.call(this, opts);

        this.db = null;
        this.reapInterval = opts.reapInterval || (10 * 60 * 1000);
        this.compactInterval = opts.compactInterval || (5 * 60 * 1000);

        // Even when _revs_limit is set to 1, old revisions take up space,
        // therefore, compact the database every once in awhile.
        if (env !== 'test') {
            setInterval(this.reap.bind(this), this.reapInterval);
            setInterval(this.compact.bind(this), this.compactInterval);
        }
        this.setup(opts, fn);
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

    ConnectCouchDB.prototype.__proto__ = Store.prototype;

    ConnectCouchDB.prototype.setup = function(opts, fn) {
        opts = opts || {};
        opts.revs_limit = opts.revs_limit || '1';
        if (!opts.name) throw "You must define a database";

        this.db = new Couch(opts);
        this.db.get('', function(err, doc) {
            // Database already exists.
            if (!err) {
                fn && fn();
            // Database does not exist.
            } else if (err.statusCode === 404) {
                this.db.dbPut(function(err) {
                    _check_error(err);
                    this.db.putDesignDocs([__dirname + '/connect-session.json'], function(err) {
                        _check_error(err);
                        this.db.putOpt('_revs_limit', opts.revs_limit, function(err) {
                            _check_error(err);
                            fn && fn();
                        }.bind(this));
                    }.bind(this));
                }.bind(this));
            // Non-404 error occurred.
            } else {
                _check_error(err);
            }
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
                doc.expires = expires;
                doc.sess = sess;
                this.db.put(doc, fn);
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

    ConnectCouchDB.prototype.clear = function (fn) {
        this.db.view('_design/connect-sessions/_view/expires', {}, function (err, docs) {
            if (err) return fn && fn(err);
            var remaining = docs.rows.length;
            docs.rows.forEach(function (doc) {
                this.destroy(doc.value._id, function() {
                    remaining--;
                    if (!remaining) return fn && fn();
                });
            }.bind(this));
        }.bind(this));
    };

    ConnectCouchDB.prototype.reap = function (fn) {
        var now = +new Date;
        var options = { endkey: '[' + now + ',{}]' };
        this.db.view('_design/connect-sessions/_view/expires', options, function (err, docs) {
            if (err) return fn && fn(err);
            var remaining = docs.rows.length;
            docs.rows.forEach(function (doc) {
                this.destroy(doc.value._id, function() {
                    remaining--;
                    if (!remaining) return fn && fn();
                });
            }.bind(this));
        }.bind(this));
    };

    ConnectCouchDB.prototype.length = function (fn) {
        var now = +new Date;
        var options = { startkey: '[' + now + ',{}]' };
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

    return ConnectCouchDB;
}

var fs = require('fs'),
    request = require('request');

Couch = module.exports = function(config) {
    var host = config.host || '127.0.0.1';
    var port = config.port || '5984';
    var username = config.username || '';
    var password = config.password || '';
    var auth = username && password ? username + ':' + password + '@' : '';
    var ssl = config.ssl ? 's' : '';
    if (!config.name) throw 'Database name is required';
    this.uri = 'http' +
        ssl + '://' +
        auth +
        host + ':' +
        port + '/' +
        config.name;
    this.name = config.name;
};

// General response parser
// -----------------------
Couch.prototype.parse = function(callback) {
    var that = this;
    return function(err, res, body) {
        if (typeof body == "string") {
            body = JSON.parse(body);
        }
        else if (!body) {
            body = {}
        }
        if (!err) {
            if (body.error) {
                err = new Error(body.reason);
                err.error = body.error;
                err.reason = body.reason;
                err.statusCode = res.statusCode;
            } else if (res.headers['etag']) {
                body._rev = res.headers['etag'].slice(1, -1);
            }
        }
        callback && callback(err, body);
    }
};

// PUT a database option
// ---------------------
Couch.prototype.putOpt = function(id, data, callback) {
    request.put({
        uri: this.uri + '/' + encodeURIComponent(id),
        body: data
    }, this.parse(callback));
};

// GET a database option
// ---------------------
Couch.prototype.getOpt = function(id, callback) {
    request.get({
        uri: this.uri + '/' + encodeURIComponent(id),
    }, this.parse(callback));
};

// PUT a document to Couch
// -----------------------
Couch.prototype.put = function(doc, callback) {
    request.put({
        uri: this.uri + '/' + encodeURIComponent(doc._id),
        json: doc
    }, this.parse(callback));
};

// POST a document to Couch
// ------------------------
Couch.prototype.post = function(obj, callback) {
    var data = {};
    data.uri = obj.endpoint ? this.uri + '/' + obj.endpoint : this.uri;
    data.json = obj.doc || null;
    request.post(data, this.parse(callback));
};

// DELETE a document from Couch
// ----------------------------
Couch.prototype.del = function(doc, callback) {
    request.del({
        uri: this.uri + '/' + encodeURIComponent(doc._id) + '?rev=' + doc._rev
    }, this.parse(callback));
};

// GET a document from Couch
// -------------------------
Couch.prototype.get = function(id, callback) {
    request.get({
        uri: this.uri + '/' + encodeURIComponent(id)
    }, this.parse(callback));
};

// HEAD request to retrieve document _rev.
// ---------------------------------------
Couch.prototype.head = function(id, callback) {
    request.head({
        uri: this.uri + '/' + encodeURIComponent(id)
    }, this.parse(function(err, body) {
        body && !err && (body._id = id);
        callback(err, body);
    }));
};

// GET documents via view from Couch
// ---------------------------------
Couch.prototype.view = function(view, options, callback) {
    var opts = [];
    for (var k in options) {
        opts.push(encodeURIComponent(k) + '=' + encodeURIComponent(options[k]));
    }
    request.get({
        uri: this.uri + '/' + view + '/?' + opts.join('&')
    }, this.parse(callback));
};

// Create database
// ---------------
Couch.prototype.dbPut = function(callback) {
    request.put({
        uri: this.uri
    }, this.parse(callback));
};

// Delete database
// ---------------
Couch.prototype.dbDel = function(callback) {
    request.del({
        uri: this.uri
    }, this.parse(callback));
};

// PUT design docs from files or JSON objects
// ------------------------------------------
Couch.prototype.putDesignDocs = function(files, callback) {
    callback = callback || function() {};

    var remaining = files.length;
    var put = function(id, doc) {
        if (!id) return callback(new Error('Document _id required.'));
        doc = typeof doc === 'string' ? doc : JSON.stringify(doc);
        request.put({
            uri: this.uri + '/' + id,
            body: doc
        }, function(err, res) {
            remaining--;
            if (err) return callback(err);
            if (!remaining) return callback(err, res);
        });
    }.bind(this);

    files.forEach(function(file) {
        if (typeof file === 'string') {
            fs.readFile(file, 'utf8', function(err, data) {
                if (err) return callback(err);
                var id = data.match(/.*"_id".*?:.*?"(.*?)".*/)[1];
                put(id, data);
            });
        } else {
            put(file._id, file);
        }
    }.bind(this));
};

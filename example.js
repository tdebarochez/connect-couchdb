var connect = require('connect'),
    connectCouchDB = require('connect-couchdb');

function helloWorld(req, res) {
  if (!req.session.tick) {
    req.session.tick = 0;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  if (req.url == '/') {
    req.session.tick++;
    res.write('hello world : ' + req.session.tick);
  }
  res.end('');
}
var server = connect.createServer(connect.cookieDecoder(),
                                  connect.session({secret: 'your secret passphrase',
                                                   store: new connectCouchDB({database: "test"})}),
                                  helloWorld);

server.listen(3000);
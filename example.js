var connect = require('connect'),
    connectCouchDB = require('./lib/connect-couchdb')(connect);

function helloWorld(req, res, next) {
  if (req.url !== '/') return next();

  req.session.tick = req.session.tick || 0;
  req.session.tick++;
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('hello world : ' + req.session.tick);
  res.end('');
}

var server = connect.createServer(
  connect.cookieParser(),
  connect.session({
    secret: 'your secret passphrase',
    store: new connectCouchDB({name: "test"})
  }),
  helloWorld
);

server.listen(3000);

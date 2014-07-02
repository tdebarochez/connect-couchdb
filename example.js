var session = require('express-session'),
    express = require('express'),
    connectCouchDB = require('./lib/connect-couchdb')(session);

function helloWorld(req, res, next) {
  if (req.url !== '/') return next();

  req.session.tick = req.session.tick || 0;
  req.session.tick++;
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('hello world : ' + req.session.tick);
  res.end('');
}

var app = express();
app.use(session({
  secret: 'your secret passphrase',
  store: new connectCouchDB({name: "test"}),
  saveUninitialized:true,
  resave:false
}));
app.use(helloWorld);
app.listen(3000);

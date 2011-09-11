var connect = require('connect');

if (process.argv.length < 3) {
  console.error('Usage : $ node put_design_docs.js <database_name> [username] [password]');
  process.exit(1);
}

var opts = {"name": process.argv[2]};
if (process.argv.length >= 4) {
  opts.username = process.argv[3];
}
if (process.argv.length >= 5) {
  opts.password = process.argv[4];
}

var connect_couchdb = new (require(__dirname + '/../lib/connect-couchdb.js')(connect))(opts);

connect_couchdb.setupDesignDocs(function (err) {
  if (err) {
    return;
    process.exit(1);
  }
  console.log('ok !');
  process.exit(0);
});


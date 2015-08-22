var express = require('express')
  , cluster = require('express-cluster')
  , bodyParser = require('body-parser')
  , bearerToken = require('express-bearer-token')
  , _ = require('lodash')
  , port = process.env.POSTBIN_TOKEN_PORT || process.env.POSTBIN_PORT || 4000
  , spawnCount = process.env.POSTBIN_SPAWN_COUNT || 1;

cluster(function() {
  var app = express();

  app.use(bodyParser.json({limit: '50mb', strict:false}));
  app.use(bearerToken());

  app.all('/', function (req, res) {
    var delay = req.headers['x-delay'] || null;
    var statusCode = req.headers['x-status'] || 200;

    if (delay) {
      setTimeout(function () {
        res.status(statusCode).send({});
      }, delay);
    } else {
      res.status(statusCode).send({});
    }
  });

  app.all('/wildcard/:freq*', function (req, res) {
    var failed = (Math.random() * req.params.freq < 1);
    res.status(failed ? 500 : 200).send({});
  });

  app.all('/status/:statusCode*', authTimeout, function (req, res) {
    res.status(req.params.statusCode).send({});
  });

  app.all('/logged/:statusCode*', authTimeout, function (req, res) {
    var body = req.body;

    console.log('\n' + timestamp() + '\nLOGGED REQUEST: ' + req.url);

    if (Array.isArray(body)) {
      console.log("Body is an array of length", body.length);
    } else {
      console.log("Body is an object:\n" + JSON.stringify(body, null, 2));
    }
    console.log('Headers:\n' + JSON.stringify(req.headers, null, 2));

    if (req.token) {
      console.log('Bearer token:', req.token);
    }

    res.status(req.params.statusCode).send({});
  });

  app.all('/auth/:authCode*', function (req, res) {
    var authed = req.headers['x-messagesystems-webhook-token'] === req.params.authCode;
    if (!authed) {
      console.error('bad auth: ' + req.headers['x-messagesystems-webhook-token']);
    }
    res.status(authed ? 200 : 401).send({});
  });

  app.all('/slow/:averageTime*', function (req, res) {
    var time = Math.floor(Math.random() * req.params.averageTime * 2);
    var msg = 'Waited ' + time + 'ms';
    msg = { message: msg };

    setTimeout(function () {
      res.status(200).send(msg);
    }, time);
  });

  app.all('/delay/:delayTime*', function (req, res) {
    setTimeout(function () {
      res.status(200).send({});
    }, req.params.delayTime);
  });

  app.post('/token', function (req, res) {

    console.log('\n' + timestamp() + '\nTOKEN REQUEST: ' + req.url);
    console.log('Body:\n' + JSON.stringify(req.body, null, 2));
    
    switch (req.body.grant_type) {
      case 'client_credentials':
        var response = req.body;
        if (_.isUndefined(response.access_token)) {
          response.access_token = new Date().getTime().toString();
        }

        console.log('Valid token generated: ' + response.access_token);
        res.status(200).send(response);
        break;

      default:
        console.log('Invalid grant_type in token request body: ' + req.body.grant_type);
        res.status(400).send({
          error: 'invalid grant type'
        });
    }
  });

  app.listen(port, function () {
    console.log('Express server listening on port ' + port);
  });
}, { count: spawnCount });


/**
 * Middleware for checking timestamp token
 * against authTimeout ms value, and responding
 * with 401 if token is older than authTimeout ms ago
 */
function authTimeout(req, res, next) {
  var timeout = req.query.authTimeout
    , token = req.token;
  
  if (!timeout) {
    return next();
  }

  if(!token || new Date().getTime() - token > timeout) {
    res.status(401).send({
      error: 'invalid or expired token: ' + token
    });
    return;
  }
  
  next();
}


function timestamp() {
  var d = new Date();
  return d.toTimeString().split(' ').shift() + ' ' + d.toDateString();
}

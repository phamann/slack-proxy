var http = require('https');
var querystring = require('querystring');
var express = require('express');
var logfmt = require('logfmt');
var Q = require('q');
var app = express();

app.use(logfmt.requestLogger());
app.use(express.bodyParser());

function addDataToken(data) {
    data.token = 'Lfsrcf0g6QNTM3gzhtzz4qdK';
    return data;
}

function parseMessage(msg) {
    console.log('Body: ');
    console.log(msg);
    return JSON.parse(msg);
}

function sendMsgToSlack(msg) {
    var deferred = Q.defer();

    var post_data = querystring.stringify(addDataToken(parseMessage(msg)));

    var post_options = {
        host: 'guardian-frontend.slack.com',
        port: '80',
        path: '/services/hooks/incoming-webhook',
        method: 'POST'
    };

    var post_req = http.request(post_options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (msg) {
            deferred.resolve(msg);
        });
    });

    post_req.on('error', function(e) {
        deferred.reject(e);
    });

    post_req.write(post_data);
    post_req.end();

    return deferred.promise;
}

app.post('/send', function(req, res) {
    console.log(req);
    sendMsgToSlack(req.body).then(function(msg){
        res.status(200);
        res.set({'Content-Type': 'text/plain'});
        res.end('SUCCESS: ' + msg);
    }).fail(function(msg) {
        res.status(500);
        res.set({'Content-Type': 'text/plain'});
        res.end('ERROR: ' + msg);
    });
});

var port = Number(process.env.PORT || 5000);
app.listen(port, function() {
    console.log("Listening on " + port);
});
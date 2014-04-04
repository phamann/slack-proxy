var http = require('https');
var url = require('url');
var querystring = require('querystring');
var express = require('express');
var logfmt = require('logfmt');
var Q = require('q');
var app = express();

app.use(logfmt.requestLogger());
app.use(express.methodOverride());

app.use(function parsePlainTextBody(req, res, next) {
    if (!req.is('text/plain')) {
        return next();
    }
    req.body = '';
    req.on('data', function(data) {
        return req.body += data;
    });
    req.on('end', function(){
        req.body = JSON.parse(req.body);
        next();
    });
});

function isSubscriptionConfirmation(msg) {
    return msg.Type === "SubscriptionConfirmation";
}

function sendConfirmation(msg) {
    var deferred = Q.defer();
    var confirmUrl = url.parse(msg.SubscribeURL, true);

    console.log(msg.SubscribeURL);

    var get_options = {
        host: confirmUrl.host,
        port: '443',
        path: confirmUrl.pathname + confirmUrl.search,
        method: 'GET'
    };

    var get_req = http.request(get_options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (msg) {
            deferred.resolve(msg);
        });
    });

    get_req.on('error', function(e) {
        deferred.reject(e);
    });

    get_req.write('ok');
    get_req.end();

    return deferred.promise;
}

function parseMessage(msg) {
    var text = 'Deploy of {PROJECT} by {USER} has just {ACTION}. <{URL} |View here>';
    text = text.replace('{PROJECT}', msg.project);
    text = text.replace('{USER}', msg.deployer);
    text = text.replace('{ACTION}', msg.adjective);
    text = text.replace('{URL}', msg.href);
    return text;
}

function isValidMessageType(body) {
    if("Message" in body &&  body.type === "Notification") {
        var message = JSON.parse(body.Message);
        var teamName = process.env.TEAM_NAME;
        var teamNameRegExp = new RegExp('^' + teamName + '::', 'g');
        return teamNameRegExp.test(message.project) &&
            (message.event === "DeployCompleted" ||  message.event === "DeployStarted");
    }
    return false;
}

function sendMsgToSlack(msg) {
    var deferred = Q.defer();
    var post_data = {
        username: 'Riff-raff',
        text: parseMessage(msg)
    };

    var post_options = {
        host: process.env.SLACK_URL,
        port: '443',
        path: '/services/hooks/incoming-webhook?token=' + process.env.SLACK_TOKEN,
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

    post_req.write(JSON.stringify(post_data));
    post_req.end();

    return deferred.promise;
}

app.post('/send', function(req, res) {
    res.set({'Content-Type': 'text/plain'});
    if(isValidMessageType(req.body)) {
        sendMsgToSlack(JSON.parse(req.body.Message)).then(function(msg){
            res.status(200);
            res.end(msg);
        }).fail(function(err) {
            res.status(500);
            res.end(err);
        });
    } else if(isSubscriptionConfirmation(req.body)) {
        sendConfirmation(req.body).then(function(msg){
            res.status(200);
            res.end(msg);
        }).fail(function(err) {
            res.status(500);
            res.end(err);
        });
    } else {
        res.status(404);
        res.end();
    }
});

var port = Number(process.env.PORT || 5000);
app.listen(port, function() {
    console.log("Listening on " + port);
});

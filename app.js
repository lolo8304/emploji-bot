var restify = require('restify');
var builder = require('botbuilder');
var fs = require('fs');
require('dotenv').config();

var database = require('./modules/db.js')();
var qnaMaker = require('./modules/qna-maker.js')();

var db = database.db;

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

var bot = new builder.UniversalBot(connector, {
    localizerSettings: {
        defaultLocale: "de"
    }
});

//=========================================================
// App helper methods
//=========================================================

function RestApiError(code, message) {
    this.name = "RestApiError";
    this.message = "[" + code + "] " + (message || "");
}
RestApiError.prototype = Error.prototype;

function getHttpErrorCode(e) {
    var hasError = /^\[.*\].*$/.test(e.message);
    if (hasError) {
        var myRegexp = /^\[(.*)\].*$/;
        var match = myRegexp.exec(e.message);
        return match[1];
    } else {
        return "500";
    }
}

function handleError(res, e, docs, defaultString) {
    if (e && e.name == "RestApiError") {
        console.log("handle error: e=" + e + ", docs=" + docs + ", str=" + defaultString);
        res.status(getHttpErrorCode(e)).send(e.message);
        res.end();
        //res.render('500', {error: err, stack: err.stack});
        return true;
    } else if (e) {
        console.log("handle error: e=" + e + ", docs=" + docs + ", str=" + defaultString);
        res.status(500).send(e.message);
        res.end();
        return true;
    } else if (!docs && defaultString != undefined) {
        console.log("handle error: e=" + e + ", docs=" + docs + ", str=" + defaultString);
        res.status(404).send(defaultString);
        res.end();
        return true;
    }
    return false;
}

function isEmpty(obj) {
    return obj == undefined || obj.length == 0;
}

server.get('/images/:name', function (req, res, next) {
    var imageName = req.params.name;
    if (isEmpty(imageName)) {
        return handleError(res,
            new RestApiError("400", 'image name must be specified'));
    }
    if (imageName.indexOf("..") >= 0 || imageName.indexOf("/") >= 0) {
        return handleError(res,
            new RestApiError("400", 'invalid image name - only "name.ext" allowed'));
    }
    var ext = imageName.split(".");
    if (ext.length == 0) {
        return handleError(res,
            new RestApiError("400", 'image has not extension'));
    }
    var contents = fs.readFileSync('./images/' + imageName, '');
    res.setHeader('Content-Type', 'image/' + ext[ext.length - 1]);
    res.end(contents);
});

server.get('/', function (req, res, next) {
    var contents = fs.readFileSync('./index.html', 'utf8');
    res.setHeader('content-type', 'text/html');
    res.end(new Buffer(contents));
});


//=========================================================
// LUIS initialization
//=========================================================


// Add global LUIS recognizer to bot
var model = process.env.MICROSOFT_LUIS_MODEL;
var recognizer = new builder.LuisRecognizer(model);
/*var intents = new builder.IntentDialog({ recognizers: [recognizer] });
bot.dialog('/', 
  intents
    .matches('Help', '/Help')
    .matches('Testen', '/Testen')
    .matches('Intro', '/Intro')
);


// Entity Constants
const ENTITIES = {
  TEST: 'TestEntity'
};*/


//=========================================================
// BOT handler
//=========================================================

bot_helper = require("./modules/bot-helper.js")(bot, builder, recognizer);

//=========================================================
// default handler
//=========================================================

var introRecognizer = new builder.RegExpRecognizer("Intro", {
    en_us: /^(intro|start)/i,
    de: /^(intro|start)/i
});
var faqRecognizer = new builder.RegExpRecognizer("FAQ", {
    en_us: /^(faq|help)/i,
    de: /^(faq|hilfe)/i
});
var abschlussRecognizer = new builder.RegExpRecognizer("Monatsabschluss", {
    en_us: /^(closing|month)/i,
    de: /^(abschluss|monat)/i
});
var spesenRecognizer = new builder.RegExpRecognizer("Spesen", {
    en_us: /^(exp)/i,
    de: /^(spesen)/i
});
var absenzenRecognizer = new builder.RegExpRecognizer("Absenzen", {
    en_us: /^(absence)/i,
    de: /^(absenz|krank|ferien)/i
});
var intents = new builder.IntentDialog({
    recognizers: [introRecognizer, faqRecognizer, abschlussRecognizer, spesenRecognizer, absenzenRecognizer]
});

bot.dialog('/',
    intents
        .matches('Intro', '/Intro')
        .matches('FAQ', '/FAQ')
        .matches('Monatsabschluss', '/Monatsabschluss')
        .matches('Spesen', '/Spesen')
        .matches('Absenzen', '/Absenzen'), [
        function (session, args, next) {
            console.log("in /");
        }
    ]);


bot.on('conversationUpdate', (message) => {
    if (message.membersAdded) {
        if (!(message.membersAdded[0].name === 'Bot')) {
            bot.beginDialog(message.address, '*:/Intro');
        }
    }
});


intents.onDefault(
    builder.DialogAction.send("$.Intro.Error")
);

abschlussDialog = require('./modules/abschluss-dialog.js')(bot, builder, recognizer);
absenzenDialog = require('./modules/absenz-dialog.js')(bot, builder, recognizer);
spesenDialog = require('./modules/spesen-dialog.js')(bot, builder, recognizer);

//=========================================================
// dialog handler
//=========================================================

bot.dialog('/Intro', [
    function (session, args, next) {
        if (session.message.type === "message" 
        && (!session.message.text.match(/(start|stop|bye|goodbye|abbruch|tschüss)/i)) 
        && session.message.text ) {
            session.send(session.message.text);
        } else {
            session.preferredLocale("de");
            var buttons = [];
            buttons[0] = builder.CardAction.imBack(session, "Monatsabschluss", "Monatsabschluss");
            buttons[1] = builder.CardAction.imBack(session, "Absenzen", "Absenzen");
            buttons[2] = builder.CardAction.imBack(session, "Spesen", "Spesen");
            var card = new builder.HeroCard(session)
                .title("Emploji")
                .text("$.Intro.Welcome")
                .images([
                    builder.CardImage.create(session, process.env.BOT_DOMAIN_URL + "/images/emploji.png")
                ]).buttons(buttons);

            var msg = new builder.Message(session).addAttachment(card);
            session.send(msg);
            session.sendBatch();
        }
    }
])
    .cancelAction('/Intro', "OK abgebrochen - tippe mit 'start' wenn Du was von mir willst", { matches: /(stop|bye|goodbye|abbruch|tschüss)/i });


bot.dialog('/Testen', [
    function (session, args, next) {
        session.preferredLocale("de");
        builder.Prompts.text(session, "Teste einen Intent. Satz bitte?");
        session.sendBatch();
    },
    function (session, results) {
        recognizer.recognize({ message: { text: results.response }, locale: session.defaultLocale }, (err, args) => {
            if (!err) {
                // how to find specific entity
                // const entity = (builder.EntityRecognizer.findEntity(args.entities || [], ENTITIES.TEST) || {});
                var text = "Best intent: " + args.intent + " / " + Math.floor(args.score * 100) + "%";
                if (args.intents.length > 1) {
                    text += "\n\nOther intents: ";
                    for (var i = 1; i < args.intents.length; i++) {
                        var otherIntent = args.intents[i];
                        text += "\n\n - " + otherIntent.intent + " / " + Math.floor(otherIntent.score * 100) + "%";
                    }
                }
                session.send(text);
                var metadata = "no entities";
                if (args.entities.length > 0) {
                    metadata = "Entities:";
                    for (var i = 0; i < args.entities.length; i++) {
                        var entity = args.entities[i];
                        metadata += "\n\n - " + entity.type + " = " + (entity.resolution ? entity.resolution.values[0] : entity.entity);
                    }
                }
                session.send(metadata);
                session.sendBatch();
                session.replaceDialog("/Testen");
            } else {
                session.endDialog("Es ist ein Fehler aufgetreten. " + err);
            }
        });
    }
])
    .triggerAction({ matches: /(Testen=.*|testen)/i })
    .cancelAction('/Intro', "OK abgebrochen - tippe mit 'start' wenn Du was von mir willst", { matches: /(start|stop|bye|goodbye|abbruch|tschüss)/i });
;


bot.dialog('/Hilfe', [
    function (session, args, next) {
        session.preferredLocale("de");
        builder.Prompts.text(session, "Frage?");
    },
    function (session, results) {
        qnaMaker.getQnAResponse(results.response, function (Q, A) {
            var realAnswers = [];
            if (A.answers) {
                for (var i = 0; i < A.answers.length; i++) {
                    var answer = A.answers[i];
                    if (answer.score > 0) {
                        realAnswers.push(answer);
                    }
                }
            }
            if (realAnswers.length > 0) {
                var text = "Unsere Antworten:";
                for (var i = 0; i < realAnswers.length; i++) {
                    var answer = realAnswers[i];
                    text = text + "\n\n - " + answer.answer + " (" + answer.score + "%)";
                }
                session.send(text);
                bot_helper.choices(session, "$.Hilfe.Feedback.Title", "$.Hilfe.Feedback.Choices");
                session.sendBatch();
            } else {
                session.endDialog("$.Hilfe.KeineAntwort");
            }
        })
    },
    function (session, results) {
        if (results.response.entity === bot_helper.locale(session, "$.Nein")) {
            session.replaceDialog("/Help");
        }
        if (results.response.entity === bot_helper.locale(session, "$.Ja")) {
            session.endDialog();
        }
    }
])
    .triggerAction({ matches: /(help|hilfe|fragen|Hilfe=.*)/i })
    .cancelAction('/Intro', "OK abgebrochen - tippe mit 'start' wenn Du was von mir willst", { matches: /(start|stop|bye|goodbye|abbruch|tschüss)/i });
;

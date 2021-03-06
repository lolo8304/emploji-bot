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
    //appId: process.env.MICROSOFT_APP_ID,
    //appPassword: process.env.MICROSOFT_APP_PASSWORD
    appId: null,
    appPassword: null
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());


var bot = new builder.UniversalBot(connector, {
    localizerSettings: {
        defaultLocale: "de"
    }
});
bot.set('localizerSettings', {
    defaultLocale: "de" 
});

bot.datastore = {
    users: require('./import/datastore/users.json'),
    absences: require('./import/datastore/absences.json'),
    spesenzettel: require('./import/datastore/spesenzettel.json'),
    holiday: require('./import/datastore/holiday.json'),
    holidayMap: {},
    holidayNamedMap: {},
    getUserId: function (session) {
        var id = session.message.address.user.name;
        for (var i in this.users) {
            if (this.users[i].user === id) return id;
        }
        return "lorenz-haenggi";
    },
    getUser: function (session) {
        var id = this.getUserId(session);
        for (var i in this.users) {
            if (this.users[i].user === id) return this.users[i];
        }
        return undefined;
    },
    getUserSlackIdByName: function (userName) {
        for (var i in this.users) {
            if (this.users[i].user === userName) return this.users[i].slack_id;
        }
        return undefined;
    },
    getManagerSlackIdByName: function (userName) {
        for (var i in this.users) {
            if (this.users[i].user === userName) {
                var manager = this.this.users[i].manager;
                if (manager) {
                    return this.getUserSlackIdByName(manager);
                } else {
                    return undefined;
                }
            }
        }
        return undefined;
    },
    getUserManager: function (session) {
        return this.getUser(session).manager;
    },

    getAbsences: function (session) {
        var id = this.getUserId(session);
        var result = [];
        for (var i in this.absences) {
            if (this.absences[i].user === id) result.push(this.absences[i]);
        }
        return result;
    },
    buildHolidayMap: function() {
        for (var i in this.holiday) {
           var holidayDay = this.holiday[i];
           if (holidayDay.public) {
               this.holidayMap[holidayDay.date] = holidayDay;
           }
        }
        return this.holidayMap;
    },
    isPublicHolidayCH(dateYYYMMDD) {
        var day = this.holidayMap[dateYYYMMDD];
        return day ? day.public : false;
    },
    buildHolidayNamedMap() {
        for (var i in this.holiday) {
            var holidayDay = this.holiday[i];

            var key = holidayDay.name.toLowerCase();
            this.holidayNamedMap[key] = this.holidayNamedMap[key] || [];
            this.holidayNamedMap[key].push(holidayDay);
            if (holidayDay.alias) {
                for (var t in holidayDay.alias) {
                    var key = holidayDay.alias[t].toLowerCase();
                    this.holidayNamedMap[key] = this.holidayNamedMap[key] || [];
                    this.holidayNamedMap[key].push(holidayDay);
                }
            }
        }
        return this.holidayNamedMap;
    },
    getHolidayDate(name, YYYY) {
        var entries = this.holidayNamedMap[name.toLowerCase()];
        var day = undefined;
        if (entries) {
            for (var i in entries) {
                var entry = entries[i];
                if (entry.date.indexOf(YYYY) != -1) {
                    return entry.date;
                }
            }
        }
        return day;
    }
};
bot.datastore.buildHolidayMap();
bot.datastore.buildHolidayNamedMap();

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

//parse http params
var querystring = require('querystring');
var url = require('url');

server.use(function (req, res, next) {
    req.queryJson = querystring.parse(url.parse(req.url).query);
    req.param = function (name) {
        var p = this.params[name];
        if (p) {
            return p
        }
        return this.queryJson[name];
    };
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
});

//notifiy all users
server.get('/notifyallusers', function (req, response, next) {
    response.setHeader('content-type', 'text/html');

    var message = req.param("message") || "undefined message";

    response.write('<html>');
    response.write('<body>');
    response.write('<h1>User Notification</h1>');
    response.write('notification: </br>');
    response.write(message);
    response.write('</br>');
    response.write('<ul>');
    var users = bot.datastore.users;
    for (var i in users) {
        if (users[i].user) {
            notifier.notifyUserWithId(users[i].slack_id, message);
            response.write('<li>' + users[i].user + '</li>');
        }
    }
    response.write('</ul>')
    response.write('</body>');
    response.write('</html>');
    response.end();
});


//=========================================================
// LUIS initialization
//=========================================================


// Add global LUIS recognizer to bot
var model = process.env.MICROSOFT_LUIS_MODEL;
var recognizer = new builder.LuisRecognizer(model);

//=========================================================
// default handler
//=========================================================

var introRecognizer = new builder.RegExpRecognizer("Intro", {
    "en_us": /^(intro|start)/i,
    "en-US": /^(intro|start)/i,
    "en": /^(intro|start)/i,
    "en-GB": /^(intro|start)/i,
    "de": /^(intro|start)/i
});

var intents = new builder.IntentDialog({
    recognizers: [introRecognizer]
});

bot.dialog('/',
    intents
        .matches('Intro', '/Intro'), [
        function (session, args, next) {
            console.log("in /");
        }
    ]);

//zeige das Menu (intro) wenn der User neu dazu kommt, das erst mal...
bot.on('conversationUpdate', (message) => {
    if (message.membersAdded) {
        if (!(message.membersAdded[0].name === 'Bot')) {
            bot.beginDialog(message.address, '*:/Intro');
        }
    }
});

//und wenn wir nicht weiterkommen wird ein Fehler angezeigt
intents.onDefault(
    builder.DialogAction.send("$.Intro.Error")
);

//=========================================================
// BOT und Dialog Handlers
//=========================================================

bot_helper = require("./modules/bot-helper.js")(bot, builder, recognizer);

abschlussDialog = require('./modules/abschluss-dialog.js')(bot, builder, recognizer);
absenzenDialog = require('./modules/absenz-dialog.js')(bot, builder, recognizer);
spesenDialog = require('./modules/spesen-dialog.js')(bot, builder, recognizer);
notifier = require('./modules/notification.js')(bot, builder, recognizer);
bot.notifier = notifier;

//=========================================================
// Intro dialog handler
//=========================================================

bot.dialog('/Intro', [
    function (session, args, next) {
        session.preferredLocale("de");
        if (session.message && (session.message.type === "message")
            && session.message.text
            && (!session.message.text.match(/(start|stop|bye|goodbye|abbruch|tschüss)/i))
        ) {

            //handle standard UseCases
            if (session.message.text.startsWith("action?Spesen")) {
                session.beginDialog("Spesen");
            } else if (session.message.text.startsWith("action?Absenzen")) {
                session.beginDialog("Absenzen");
            } else if (session.message.text.startsWith("action?Monats")) {
                session.beginDialog("Monatsabschluss");
            } else if (session.message.text.startsWith("action?Notifier")) {
                session.beginDialog("Notifier");
                //notifier.notifyUserWithName(session, "lorenz-haenggi", "hallo David Notification");
            }
            else {
                //starte die Universalweiche: 1. LUIS, 2. QNA, 3. sorry...
                handleTextMessage(session.message.text, session);
            }
        } else {
            if (session.message && (session.message.type === "message")
                && session.message.text
                && (session.message.text.match(/(stop|bye|goodbye|abbruch|tschüss)/i))) {
                showShortMenu(session);
            } else {
                showMenu(session);
            }
        }
    },
    function (session, args, next) {
        session.replaceDialog("/Intro");
    }
])
    .cancelAction('/Intro', "OK abgebrochen - tippe mit 'start' wenn Du was von mir willst",
    {
        matches: /(stop|bye|goodbye|abbruch|tschüss)/i,
        onSelectAction: (session, args) => {
            session.endDialog();
            session.beginDialog("/Intro");
        }
    });

//Menu HeroCard mit den Buttons zum Start der Haupt UseCases
function showMenu(session) {
    session.preferredLocale("de");
    var welcomeText = session.localizer.gettext(session.preferredLocale(), "$.Intro.Hi") +
        session.localizer.gettext(session.preferredLocale(), "$.Intro.Welcome");
    var buttons = [];
    buttons[0] = builder.CardAction.dialogAction(session, "Monatsabschluss", "Monatsabschluss", "Monatsabschluss");
    buttons[1] = builder.CardAction.dialogAction(session, "Absenzen", "Absenzen", "Absenzen");
    buttons[2] = builder.CardAction.dialogAction(session, "Spesen", "Spesen", "Spesen");

    //notification testing
    //buttons[3] = builder.CardAction.dialogAction(session, "Notifier", "Notifier", "Notifier");
    var card = new builder.HeroCard(session)
        .title("")
        .text(welcomeText)
        .images([
            builder.CardImage.create(session, process.env.BOT_DOMAIN_URL + "/images/emoji_nolego.png")
        ]).buttons(buttons);

    var msg = new builder.Message(session).addAttachment(card);
    session.send(msg);
    session.sendBatch();
}

function showShortMenu(session) {
    session.preferredLocale("de");
    var buttons = [];
    buttons[0] = builder.CardAction.dialogAction(session, "Monatsabschluss", "Monatsabschluss", "Monatsabschluss");
    buttons[1] = builder.CardAction.dialogAction(session, "Absenzen", "Absenzen", "Absenzen");
    buttons[2] = builder.CardAction.dialogAction(session, "Spesen", "Spesen", "Spesen");

    //notification testing
    // buttons[3] = builder.CardAction.dialogAction(session, "Notifier", "Notifier", "Notifier");
    var card = new builder.HeroCard(session).buttons(buttons);

    var msg = new builder.Message(session).addAttachment(card);
    session.send(msg);
    session.sendBatch();
}

//=========================================================
// Universalweiche 
//   1. Zeige QnA mit hohem Treffer
//   2. Check Luis, wenn Intent gefunden > Schwellwert --> Starte passenden Dialog, Stop
//   3. Wenn nicht Luis, dann zeige noch die QNA zwischen high and low level mark
//   4. wenn keine Treffer --> verstehe nicht Antwort 
//=========================================================

function handleTextMessage(message, session) {
    if (session.message.text === "hallo" || session.message.text === "Hallo") {
        var arr = [];
        for (var i in bot.datastore.users) {
            arr.push(" - " + bot.datastore.users[i].firstname);
            if (Math.random() > 0.5) arr = arr.reverse(); // etwa sumsortieren gefällig?
        }
        session.message.text = "bye2";
        session.endDialog("Ein Hallo zurück von\n\n" + arr.join("\n\n"));
    } else {
        handleTextMessagePhase1(message, session);
    }
}

//Phase 1: Retrieve QNA Answers, zeige hohe Treffer
function handleTextMessagePhase1(message, session) {
    qnaMaker.getQnAResponse(message, function (Q, A) {
        var topAnswers = [];
        var alternativeAnswers = [];
        if (A.answers) {
            for (var i = 0; i < A.answers.length; i++) {
                var answer = A.answers[i];
                console.log("QnA score: " + answer.score);
                var thresholdLow = Number.parseFloat(process.env.INTENT_SCORE_QnA_LOW_THRESHOLD || "35.0");
                var thresholdHigh = Number.parseFloat(process.env.INTENT_SCORE_QnA_HIGH_THRESHOLD || "75.0");
                console.log("QnA thresholds: low=" + thresholdLow + ", high="+thresholdHigh);

                if (answer.score >= thresholdHigh) {
                    console.log("QnA high answer");
                    topAnswers.push(answer);
                } else if (answer.score >= thresholdLow) {
                    console.log("QnA alternative answer");
                    alternativeAnswers.push(answer);
                }
            }
        }
        if (topAnswers.length > 0) {
            sendQnAAnswers(topAnswers, session);
        }

        //starte Phase 2 -> LUIS, gebe top und alternative answers mit
        handleTextMessagePhase2(message, topAnswers, alternativeAnswers, session);
    })
}

function isValidIntent(intent, score, threshold) {
    if (intent == "Help") { return false; }
    if (intent == "None") { return false; }
    if (intent == "Intro" && score < 0.8) { return false; }
    return (score >= threshold);
}

//Phase 2: check LUIS for matching intents
function handleTextMessagePhase2(message, topAnswers, altAnswers, session) {
    builder.LuisRecognizer.recognize(message, model, function (err, intents, entities) {
        if (intents.length > 0) {
            console.log("message: " + message);
            console.log('Luis Score: ' + intents[0].score + " for " + intents[0].intent);
            var threshold = Number.parseFloat(process.env.INTENT_SCORE_LUIS_THRESHOLD || "0.51");
            if (isValidIntent(intents[0].intent, intents[0].score, threshold)) {
                handleTextMessagePhase3Tip(message, topAnswers, altAnswers, session);
                beginDialogOnLuisIntent(intents[0], entities, session);
                return;
            }
        }
        //Starte Phasen 3/4
        handleTextMessagePhase3(message, topAnswers, altAnswers, session);
    });
}

//Handle LUIS Intent - Starte die passenden Dialoge
function beginDialogOnLuisIntent(intent, entities, session) {
    console.log("Switch to Dialog based on luis intent " + intent.intent);
    if (intent.intent.startsWith("Absenzen")) {
        //hier müssen wir noch die Daten übergeben
        session.beginDialog("Absenzen", { "intent": intent, "entities": entities });
    } else if (intent.intent.startsWith("Spesen")) {
        //hier müssen wir noch die Daten übergeben
        session.beginDialog("Spesen", { "intent": intent, "entities": entities });
    } if (intent.intent.startsWith("Monatsabschluss")) {
        //hier müssen wir noch die Daten übergeben
        session.beginDialog("Monatsabschluss", { "intent": intent, "entities": entities });
    } else {
        console.log("no dialog found for intend " + intent.intent);
    }
}

//Phasen 3/4 - zeige alternative Answers als Zusatztip
function handleTextMessagePhase3Tip(message, topAnswers, altAnswers, session) {
    if (altAnswers.length > 0) {
        sendQnAAnswers(altAnswers, session, "Mein Gratistip");
    }
}


//Phasen 3/4 - zeige alternative Answers oder wenn keine vorhanden, habe nicht verstanden
function handleTextMessagePhase3(message, topAnswers, altAnswers, session) {
    if (altAnswers.length > 0) {
        sendQnAAnswers(altAnswers, session);
    } else {
        if (topAnswers.length === 0) {
            if (session.message.text.startsWith("action?")) {
                //war eine action, mache nichts!
            } else {
                //zeige nicht verstanden nur, wenn keine topAnswer gezeigt wird
                session.send("$.Intro.NichtVerstanden", session.message.text);
                session.message.text = "bye"; //trick den menu dialog wiederanzuzeigen
                session.replaceDialog("/Intro");
            }
        }
    }
}


//=========================================================
// Testen dialog handler
//=========================================================
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

//=========================================================
// Hilfe dialog handler
//=========================================================
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
                sendQnAAnswers(realAnswers, session);
                session.sendBatch();
                session.endDialog();
            } else {
                session.endDialog("$.Hilfe.KeineAntwort");
            }
        })
    }
])
    .triggerAction({ matches: /(help|hilfe|fragen|Hilfe|faq=.*)/i })
    .cancelAction('/Intro', "OK abgebrochen - tippe mit 'start' wenn Du was von mir willst", { matches: /(start|stop|bye|goodbye|abbruch|tschüss)/i });
;

const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();

//hilfsfunktion
function sendQnAAnswers(answers, session, titel) {
    var finalText = "";
    if (titel) {
        finalText = titel+": ";
    }
    for (var i = 0; i < answers.length; i++) {
        var answer = answers[i];
        text = answer.answer; //+ " (" + answer.score + "%)";
        if (i > 0) {
            finalText += "\n\n";
        }
        finalText += text;
    }
    finalText = entities.decode(finalText);
    session.send(finalText);
}

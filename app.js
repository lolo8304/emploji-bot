var restify = require('restify');
var builder = require('botbuilder');
var sprintf = require('sprintf-js');
var fs = require('fs');
require('dotenv').config();

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
    this.message = "["+code+"] "+(message || "");
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
        console.log("handle error: e="+e+", docs="+docs+", str="+defaultString);
        res.status(getHttpErrorCode(e)).send(e.message);
        res.end();
        //res.render('500', {error: err, stack: err.stack});
        return true;
    } else if (e) {
        console.log("handle error: e="+e+", docs="+docs+", str="+defaultString);
        res.status(500).send(e.message);
        res.end();
        return true;
    } else if (!docs && defaultString != undefined) {
        console.log("handle error: e="+e+", docs="+docs+", str="+defaultString);
        res.status(404).send(defaultString);
        res.end();
        return true;
    }
    return false;
}

function isEmpty(obj) {
    return obj == undefined || obj.length == 0;
}

server.get('/images/:name', function(req, res, next) {
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
    var contents = fs.readFileSync('./images/'+imageName, '');
    res.setHeader('Content-Type', 'image/'+ext[ext.length-1]);
    res.end(contents);
});

server.get('/', function (req, res, next) {
  var contents = fs.readFileSync('./index.html', 'utf8');
  res.setHeader('content-type', 'text/html');
  res.end(new Buffer(contents));
});


var rp = require("request-promise");

//http://localhost:3978/model/skis/set/kind/blau
function getQnAResponsePromise(question) {
    var options = {
        method: 'POST',
        uri: process.env.MICROSOFT_QNA_MAKER_URL,
        headers: {
            'Ocp-Apim-Subscription-Key': process.env.MICROSOFT_QNA_MAKER_KEY,
            'Content-Type': 'application/json'
        },
        body: {
            question: question
        },
        json: true // Automatically stringifies the body to JSON 
    };
    return rp(options);
}

function getQnAResponse(question, cb) {
    getQnAResponsePromise(question).then(value => {
        cb(question, value);
    });
};



//=========================================================
// LUIS initialization
//=========================================================


// Add global LUIS recognizer to bot
var model = process.env.MICROSOFT_LUIS_MODEL;
var recognizer = new builder.LuisRecognizer(model);
var intents = new builder.IntentDialog({ recognizers: [recognizer] });
bot.dialog('/', 
  intents
    .matches('Help', '/Help')
    .matches('Intro', '/Intro')
);

// Entity Constants
const ENTITIES = {
  TEST: 'TestEntity'
};


//=========================================================
// BOT handler
//=========================================================

function replRegExp(session, text) {
    var reg=/(\$\.[a-zA-Z\.]+)/ig;
    var variableReplacementArray = text.match(reg);
    if (variableReplacementArray) {
        for (var i=0; i < variableReplacementArray.length;i++) {
            var fromVar = variableReplacementArray[i];
            var toText = session.localizer.gettext(session.preferredLocale(), fromVar);
            text = text.replace(fromVar, toText);
        }
    }
    return text;
}

// pass a text in locale file and will be replaced according to the language
function choices(session, text, choices, ...args) {
    var intro = sprintf.sprintf(session.localizer.gettext(session.preferredLocale(), text), args);
    intro = replRegExp(session, intro);
    var options = session.localizer.gettext(session.preferredLocale(), choices);
    options = replRegExp(session, options);
    //builder.Prompts.choice(session, intro, options, {listStyle: builder.ListStyle["inline"]});
    builder.Prompts.choice(session, intro, options, {listStyle: builder.ListStyle["button"]});
    //builder.Prompts.choice(session, intro, options);
}


//=========================================================
// default handler
//=========================================================

intents.onDefault(
 builder.DialogAction.send("$.Intro.Error")
);

bot.dialog('/Intro', [
  function (session, args, next) {
        session.preferredLocale("de");
        var card = new builder.HeroCard(session)
            .title("Emploji")
            .text("$.Intro.Welcome")
            .images([
                 builder.CardImage.create(session, process.env.BOT_DOMAIN_URL+"/images/emploji.png")
            ])
            .buttons([
                // session, Action, Data-pushed, Title
                builder.CardAction.dialogAction(session, "Absenzen", "meine Absenzen", "Absenzen"),
                builder.CardAction.dialogAction(session, "Hilfe", "hilfe", "Hilfe"),
                builder.CardAction.dialogAction(session, "Testen", "test", "Testen")
            ]);
        var msg = new builder.Message(session).addAttachment(card);
        session.send(msg);
        session.sendBatch(); 
  }
])
.cancelAction('/', "OK abgebrochen - tippe mit 'start' wenn Du was von mir willst", { matches: /(stop|bye|goodbye|abbruch|tschüss)/i })
.beginDialogAction('Absenzen', '/Absenzen', { matches: /Absenzen=meine.*/i })
.beginDialogAction('Testen', '/Testen', { matches: /Testen=.*/i })
.beginDialogAction('Help', '/Help', { matches: /hilfe.*/i });


bot.dialog('/Absenzen', [
  function (session, args, next) {
        session.preferredLocale("de");
        choices(session, "$.Absenzen.Auswahl", "$.Absenzen.Auswahl.Choices");
        session.sendBatch(); 
  },
  function (session, results, next) {
      session.send(results.response.entity + " gedrückt");
  }
])


bot.dialog('/Help', [
  function (session, args, next) {
        session.preferredLocale("de");
        builder.Prompts.text(session, "Was willst Du wissen?");
        session.sendBatch(); 
  },
  function (session, results) {
    recognizer.recognize({ message: { text: results.response }, locale: session.defaultLocale }, (err, args) => {
      if (!err) {
        const entity = (builder.EntityRecognizer.findEntity(args.entities || [], ENTITIES.TEST) || {});
        session.send("intent and entities found");
        session.replaceDialog('/Help/Test')
      }
    });
  }
])


bot.dialog('/Help/Test', [
  function (session, args, next) {
        session.preferredLocale("de");
        builder.Prompts.text(session, "Frage?");
  },
  function (session, results) {
    getQnAResponse(results.response, function(Q,A) {
        var realAnswers = [];
        if (A.answers) {
            for (var i=0; i < A.answers.length;i++) {
                var answer = A.answers[i];
                if (answer.score > 0) {
                    realAnswers.push(answer);
                }
            }
        }
        if (realAnswers.length > 0) {
            var text = "Unsere Antworten:";
            for (var i=0; i < realAnswers.length;i++) {
                var answer = realAnswers[i];
                text = text + "\n\n - "+answer.answer+" ("+answer.score+"%)";
            }
            session.send(text);
            choices(session, "$.Hilfe.Feedback.Title", "$.Hilfe.Feedback.Choices");
            session.sendBatch();
        } else {
            session.endDialog("$.Hilfe.KeineAntwort");
        }
    })
  },
  function (session, results) {
  }
])

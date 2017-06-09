module.exports = AbsenzenDialogHelper;

function AbsenzenDialogHelper(bot, builder, luisRecognizer) {
    return new AbsenzenDialog(bot, builder, luisRecognizer);
};

function addAbsence(bot, session, category, text, fromDate, toDate, days) {
    var user = bot.datastore.getUser(session);
    var newAbsence = {
        user: user,
        typ: category,
        text: text,
        fromDate: fromDate,
        toDate: toDate,
        days: 3,
        commit: false
    }
    bot.datastore.absences.push(newAbsence);
    return newAbsence;
}


function getAbsenzTyp(builder, entities) {
  const entity = (builder.EntityRecognizer.findEntity(entities || [], "AbsenzTyp") || {});
  if (entity) {
      return entity.resolution.values[0];
  }
  return "";
}
function getAbsenzDateFrom(builder, entities) {
  const entity = (builder.EntityRecognizer.findEntity(entities || [], "builtin.datetime") || {});
  if (entity) {
      return entity.entity;
  }
  return "";
}
function getAbsenzDauer(builder, entities) {
  const entity = (builder.EntityRecognizer.findEntity(entities || [], "AbsenzDauer") || {});
  if (entity) {
      return entity.resolution.values[0];
  }
  return "";
}

function getAbsenceAttributes(builder, entities) {
    return {
        typ: getAbsenzTyp(builder, entities),
        fromDate: getAbsenzDateFrom(builder, entities),
        days: getAbsenzDauer(builder, entities)
    };
}

function addAbsenceFromEntities(bot, session, entities) {
    return addAbsence(bot, session, "Ferien", "endlich mal Ferien", "2017-04-01", "2017-04-15", 3);
}

function AbsenzenDialog(bot, builder, recognizer) {
    this.bot = bot;
    this.builder = builder;
    this.recognizer = recognizer;
    this.getDayDifference = function getDayDifference(fromDate, toDate) {
        return 3;
    };


    this.bot.dialog('Absenzen_Erstellen', [
        function (session, args, next) {
            if (args && args.intent) {
                var absenceAttributes = getAbsenceAttributes(builder, args.entities);
                var newAbsence = addAbsenceFromEntities(bot, session, args.entities);
                if (newAbsence) {
                    var user = bot.datastore.getUser(session);
                    bot.notifier.notifyUserWithName(bot.datastore.getUserManager(session), "Bitte Absenz von "+user.firstname+" "+user.name+" bestätigen.");
                    session.send("Vielen Dank. Ich habe folgende Absenz erfasst: %s vom %s - %s (%s Tag)", newAbsence.typ, newAbsence.fromDate, newAbsence.toDate, newAbsence.days);
                    session.send("Dein Manager wurde zur Bestätigung aufgefordert");
                } else {
                    session.send("Es ist ein Fehler aufgetreten bei der Erstellung Deiner Absenz. Bitte melde Dich bei meine Administration.")
                }
            }
            session.message.text = "bye"; //trick den menu dialog wiederanzuzeigen
            session.replaceDialog("/Intro");
        }
    ])
        .cancelAction('/Intro', "OK Absenzerfassung abgebrochen",
        {
            matches: /(start|stop|bye|goodbye|abbruch|tschüss)/i,
            onSelectAction: (session, args) => {
                session.endDialog();
            }
        });

    this.bot.dialog('Absenzen', [
        function (session, args, next) {
            if (args && args.intent) {
                session.replaceDialog("Absenzen_Erstellen", args);
            } else if (args && args.errorText) {                
                builder.Prompts.text(session, args.errorText);
            } else {
                builder.Prompts.text(session, "Nenne mir den Abwesenheitsgrund und Datum von bis, dann erfasse ich die Absenz.");
            }
        },
        function (session, result, next) {
            var message = result.response;
            builder.LuisRecognizer.recognize(message, process.env.MICROSOFT_LUIS_MODEL, function (err, intents, entities) {
                if (err || (intents[0] && intents[0].intent === "None")) {
                    session.replaceDialog("Absenzen", { errorText: "Ich habe nicht alles verstanden. Bitte wiederholen" });
                } else if (intents[0]) {
                    session.replaceDialog(intents[0].intent, {intent: intents[0].intent, entities: entities});
                }
            });
        }
    ])
        .cancelAction('/Intro', "OK Absenzerfassung abgebrochen",
        {
            matches: /(start|stop|bye|goodbye|abbruch|tschüss)/i,
            onSelectAction: (session, args) => {
                session.endDialog();
            }
        });
}
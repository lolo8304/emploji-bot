var sprintf = require('sprintf-js');
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
        days: days,
        commit: false
    }
    bot.datastore.absences.push(newAbsence);
    return newAbsence;
}


function getAbsenzTyp(builder, entities) {
  const entity = (builder.EntityRecognizer.findEntity(entities || [], "AbsenzTyp") || undefined);
  if (entity) {
      return entity.resolution.values[0];
  }
  return "";
}
function getAbsenzDateFrom(builder, entities) {
  const entity = (builder.EntityRecognizer.findEntity(entities || [], "builtin.datetime") || undefined);
  if (entity) {
      return entity.entity.replace(" ","");
  }
  return "";
}
function getAbsenzDauer(builder, entities) {
  const entity = (builder.EntityRecognizer.findEntity(entities || [], "builtin.number") || undefined);
  if (entity) {
      return Number.parseInt(entity.entity);
  }
  return "";
}
function getAbsenzDauerMultiplier(builder, entities) {
  const entity = (builder.EntityRecognizer.findEntity(entities || [], "AbsenzDauer") || undefined);
  if (entity) {
      var dauer = entity.resolution.values[0];
      if (dauer === "Woche") {
        return 5;
      } else {
          return 1;
      }
  }
  return 1;
}

function getAbsenceAttributes(builder, entities) {
    var multiplyer = getAbsenzDauerMultiplier(builder, entities);

    var absence = {
        typ: getAbsenzTyp(builder, entities),
        fromDate: getAbsenzDateFrom(builder, entities),
        toDate: "",
        days: multiplyer * getAbsenzDauer(builder, entities)
    };
    if (absence.typ === "Wohnungswechsel") {
        absence.responseToUserText = sprintf.sprintf(
            "Ich habe deine Absenz vom %s für deinen %s registriert",
        absence.fromDate, absence.typ);
    } else {
        absence.responseToUserText = sprintf.sprintf(
            "Vielen Dank. Ich habe folgende Absenz erfasst: %s vom %s - %s (%s Tag)", 
            absence.typ, absence.fromDate, absence.toDate, absence.days);
    }
    return absence;
}

function addAbsenceFromAttributes(bot, session, attributes) {
    return addAbsence(bot, session, attributes.typ, "", attributes.fromDate, "", attributes.days);
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
                var newAbsence = addAbsenceFromAttributes(bot, session, absenceAttributes);
                if (newAbsence) {
                    var user = bot.datastore.getUser(session);
                    bot.notifier.notifyUserWithName(bot.datastore.getUserManager(session), "Bitte Absenz von "+user.firstname+" "+user.name+" bestätigen.");
                    session.send(absenceAttributes.responseToUserText);
                    session.send("Dein Manager wurde zur Bestätigung aufgefordert");
                    session.sendBatch();
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
                builder.Prompts.text(session, "Nenne mir den Abwesenheitsgrund (krank, Ferien, Umzug, ...), Datum und Anzahl Tage - dann erfasse ich die Absenz.");
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
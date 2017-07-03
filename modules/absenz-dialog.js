var sprintf = require('sprintf-js');
var moment = require('moment');

module.exports = AbsenzenDialogHelper;

function AbsenzenDialogHelper(bot, builder, luisRecognizer) {
    return new AbsenzenDialog(bot, builder, luisRecognizer);
};

function addAbsence(bot, session, category, text, fromDate, toDate, days) {
    var user = bot.datastore.getUser(session);
    var newAbsence = {
        user: user.user,
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
  var entity = (builder.EntityRecognizer.findEntity(entities || [], "builtin.datetime") || undefined);
  if (entity && entity.score >= 0.8) {
    var absenzDate =  entity.entity.replace(/\s/g,"");
    var absenzDateMoment = moment(absenzDate, "DD.MM.YYYY");
    var YYYYMMDD = absenzDateMoment.format("YYYY-MM-DD");
    return YYYYMMDD;
  }
  entity = (builder.EntityRecognizer.findEntity(entities || [], "Zeitpunkt") || undefined);
  var today = moment();
  if (entity) {
    var resolution = entity.resolution.values[0];
    if (resolution === "heute") {
    } else if (resolution === "morgen") {
        today.add(1, "days");
    } else if (resolution === "übermorgen") {
        today.add(2, "days");
    } else if (resolution === "gestern") {
        today.subtract(1, "days");
    } else if (resolution === "vorgestern") {
        today.subtract(2, "days");
    }
  }
  return today.format("YYYY-MM-DD");
}
function getAbsenzDauer(builder, entities) {
  const entity = (builder.EntityRecognizer.findEntity(entities || [], "builtin.number") || undefined);
  if (entity) {
      return Number.parseInt(entity.entity);
  }
  return 1;
}
function getAbsenzDauerMultiplier(builder, entities) {
  const foundEntities = (builder.EntityRecognizer.findAllEntities(entities || [], "AbsenzDauer") || undefined);
  if (foundEntities) {
    for (var i = 0; i < foundEntities.length; i++) {
        var entity = foundEntities[i];
        var dauer = entity.resolution.values[0];
        if (dauer === "Woche") {
            return 5;
        } else if (dauer === "Tag") {
            return 1;
        }
    }
  }
  return 1;
}

function getToDateMoment(fromDate, days) {
    var fromD = moment(fromDate, "YYYY-MM-DD");
    while (days > 0) {
        // isoWeekday = day of week . Monday = 1, Sunday = 7
        fromD.add(1, "days");
        if (fromD.isoWeekday() < 6) {
            days--;
        }
    }
    return fromD;
}
function calculateDates(absence) {
    // fromDate in form YYYY-MM-DD
    // days as integer
    var fromD = moment(absence.fromDate, "YYYY-MM-DD");
    var toD = getToDateMoment(absence.fromDate, absence.days);
    absence.toDate = toD.format("YYYY-MM-DD");

    absence.fromDateDDMMYYYY=fromD.format("DD.MM.YYYY");
    absence.fromDateDDMM=fromD.format("DD.MM.");
    absence.year = fromD.year;
    absence.toDateDDMMYYYY=toD.format("DD.MM.YYYY");
    absence.toDateDDMM=toD.format("DD.MM.");
    return absence;
}
function isAbsenceThisYear(absence) {
    return absence.year == moment().year;
}
function removeUnneededEntities(builder, entities) {
  const entityDateTime = (builder.EntityRecognizer.findEntity(entities || [], "builtin.datetime") || undefined);
  if (entityDateTime) {
    var entitiesCopy = [].concat(entities);
    var posToDelete = 0;
    for (var i = 0; i < entitiesCopy.length; i++) {
        var e = entitiesCopy[i];
        if (entityDateTime.score < 0.6) {
            if (e == entityDateTime) {
                e.type = e.type + "-removed";
                entities.splice(posToDelete, 1);
            } else {
                posToDelete += 1;
            }
        } else {
            if (e != entityDateTime && e.startIndex >= entityDateTime.startIndex && e.endIndex <= entityDateTime.endIndex) {
                e.type = e.type + "-removed";
                entities.splice(posToDelete, 1);
            } else {
                posToDelete += 1;
            }
        }
    }
  }
  return entities;
}
function getAbsenceAttributes(builder, entities) {
    entities = removeUnneededEntities(builder, entities);
    var multiplyer = getAbsenzDauerMultiplier(builder, entities);

    var absence = {
        typ: getAbsenzTyp(builder, entities),
        fromDate: getAbsenzDateFrom(builder, entities),
        days: multiplyer * getAbsenzDauer(builder, entities)
    };
    absence = calculateDates(absence);

    if (absence.typ === "Wohnungswechsel") {
        absence.responseToUserText = sprintf.sprintf(
            "Ich habe Deine Absenz vom %s für den %s registriert",
        absence.fromDateDDMMYYYY, absence.typ);
    } else {
        var dayText = "1 Arbeitstag";
        var dateText = isAbsenceThisYear(absence) ? absence.fromDateDDMM : absence.fromDateDDMMYYYY;
        if (absence.days != 1) {
            dayText = sprintf.sprintf("%s Arbeitstage", absence.days);
            if (isAbsenceThisYear(absence)) {
                dateText = sprintf.sprintf("%s - %s", absence.fromDateDDMM, absence.toDateDDMM);
            } else {
                dateText = sprintf.sprintf("%s - %s", absence.fromDateDDMMYYYY, absence.toDateDDMMYYYY);
            }
        }
        absence.responseToUserText = sprintf.sprintf(
            "Vielen Dank. Ich habe folgende Absenz erfasst: '%s' vom %s (%s)", 
            absence.typ, dateText, dayText);
    }
    return absence;
}

function addAbsenceFromAttributes(bot, session, attributes) {
    return addAbsence(bot, session, attributes.typ, "", attributes.fromDate, attributes.toDate, attributes.days);
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
                    bot.notifier.notifyUserWithName(session, bot.datastore.getUserManager(session), "Bitte Absenz von "+user.firstname+" "+user.name+" bestätigen.");
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

    this.bot.dialog('Absenzen_SaldoJahr', [
        function (session, args, next) {
            if (args && args.intent) {
                var absenceAttributes = getAbsenceAttributes(builder, args.entities);
                var newAbsence = addAbsenceFromAttributes(bot, session, absenceAttributes);
                if (newAbsence) {
                    var user = bot.datastore.getUser(session);
                    bot.notifier.notifyUserWithName(session, bot.datastore.getUserManager(session), "Bitte Absenz von "+user.firstname+" "+user.name+" bestätigen.");
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



}
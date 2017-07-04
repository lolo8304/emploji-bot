var sprintf = require('sprintf-js');
var moment = require('moment');

module.exports = AbsenzenDialogHelper;

function AbsenzenDialogHelper(bot, builder, luisRecognizer) {
    return new AbsenzenDialog(bot, builder, luisRecognizer);
};

function addAbsence(bot, session, category, text, fromDate, toDate, days) {
    if (days > 0 && category && category.length > 0) {
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
    } else {
        return undefined;
    }
}


function getAbsenzTyp(builder, entities) {
  const entity = (builder.EntityRecognizer.findEntity(entities || [], "AbsenzTyp") || undefined);
  if (entity) {
      return entity.resolution.values[0];
  }
  return "";
}
function getAbsenzDateFromTo(builder, entities) {
  var dateEntities = (builder.EntityRecognizer.findAllEntities(entities || [], "builtin.datetime") || undefined);
  var foundDates = [];
  for (var i = 0; i < dateEntities.length; i++) {
    var entity = dateEntities[i];
    if (entity && entity.score >= 0.6) {
        var absenzDate =  entity.entity.replace(/\s/g,"");
        var absenzDateMoment = moment(absenzDate, "DD.MM.YYYY");
        var YYYYMMDD = absenzDateMoment.format("YYYY-MM-DD");
        foundDates.push(YYYYMMDD);
    }
  }
  if (foundDates.length > 0) {
    foundDates.sort();
    return {
        from: foundDates[0],
        to: foundDates[1]
    }
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
  return { from: today.format("YYYY-MM-DD"), to: undefined };
}

function getAbsenzDauer(builder, entities) {
  const numberEntity = (builder.EntityRecognizer.findEntity(entities || [], "builtin.number") || undefined);
  if (entity) {
      return Number.parseInt(numberEntity.entity);
  }
  const foundEntities = (builder.EntityRecognizer.findAllEntities(entities || [], "AbsenzDauer") || undefined);
  if (foundEntities) {
    for (var i = 0; i < foundEntities.length; i++) {
        var entity = foundEntities[i];
        var dauer = entity.resolution.values[0];
        var dauerNumber = Number.parseInt(dauer);
        if (!isNaN(dauerNumber)) {
            return dauerNumber;
        }
    }
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
            return 7;
        } else if (dauer === "Tag") {
            return 1;
        }
    }
  }
  return 1;
}

function dateIsWeekDay(bot, dateMoment) {
    return (dateMoment.isoWeekday() < 6 && 
        !bot.datastore.isPublicHolidayCH(dateMoment.format("YYYY-MM-DD")));  
}
function getDatesAndWorkingDaysBetweenMoments(bot, fromDateMoment, toDateMoment) {
    var fromD = moment(fromDateMoment);
    var workingDays = 0;
    var validFirstDate = false;
    var validFromDate = moment(fromDateMoment);
    var lastValidToDate = moment(fromDateMoment);
    while (fromD.isSameOrBefore(toDateMoment)) {
        if (dateIsWeekDay(bot, fromD)) {
            if (!validFirstDate) {
                validFirstDate = true;
            }
            lastValidToDate = moment(fromD);
            workingDays += 1;
        } else {
            if (!validFirstDate) {
                validFromDate.add(1, "days");
            }
        }
        fromD.add(1, "days");
    }
    fromD.subtract(1, "days");
    return { from: validFromDate, to: lastValidToDate, workingDays: workingDays};
}

function calculateDates(bot, absence) {
    // fromDate in form YYYY-MM-DD
    // days as integer
    var fromD = moment(absence.fromDate, "YYYY-MM-DD");

    var toD = undefined;
    var workingDays = 0;
    if (absence.toDate) {
        toD = moment(absence.toDate, "YYYY-MM-DD");
    } else {
        toD = moment(absence.fromDate, "YYYY-MM-DD");
        toD.add(absence.days > 0 ? absence.days - 1 : 0, "days");
    }
    datesAndWorkingDays = getDatesAndWorkingDaysBetweenMoments(bot, fromD, toD);
    fromD = datesAndWorkingDays.from;
    toD = datesAndWorkingDays.to;
    workingDays = datesAndWorkingDays.workingDays;

    absence.days = workingDays;
    absence.fromDate = fromD.format("YYYY-MM-DD");
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
  const entityDateTimes = (builder.EntityRecognizer.findAllEntities(entities || [], "builtin.datetime") || undefined); 
  for (var t = 0; t < entityDateTimes.length; t++) {
    var entityDateTime = entityDateTimes[t];
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
  }
  return entities;
}
function getAbsenceAttributes(bot, builder, entities) {
    entities = removeUnneededEntities(builder, entities);
    var multiplyer = getAbsenzDauerMultiplier(builder, entities);
    var fromToDate = getAbsenzDateFromTo(builder, entities);

    var absence = {
        typ: getAbsenzTyp(builder, entities),
        fromDate: fromToDate.from,
        toDate: fromToDate.to,
        days: multiplyer * getAbsenzDauer(builder, entities)
    };
    absence = calculateDates(bot, absence);

    if (absence.days > 0) {
        if (absence.typ === "Wohnungswechsel") {
            absence.responseToUserText = sprintf.sprintf(
                "Ich habe Deine Absenz vom %s für den %s registriert",
            absence.fromDateDDMMYYYY, absence.typ);
        } else if (absence.typ && absence.typ.length > 0){
            var dayText = "1 Arbeitstag";
            var dateText = isAbsenceThisYear(absence) ? absence.fromDateDDMM : absence.fromDateDDMMYYYY;
            if (absence.days != 1 || absence.fromDateDDMMYYYY != absence.toDateDDMMYYYY) {
                dayText = sprintf.sprintf("%s Arbeitstage", absence.days);
                if (isAbsenceThisYear(absence)) {
                    dateText = sprintf.sprintf("%s - %s", absence.fromDateDDMM, absence.toDateDDMM);
                } else {
                    dateText = sprintf.sprintf("%s - %s", absence.fromDateDDMMYYYY, absence.toDateDDMMYYYY);
                }
            }
            absence.responseToUserText = sprintf.sprintf(
                "Vielen Dank. Ich habe folgende Absenz erfasst:\n\n**'%s'** vom %s (%s)", 
                absence.typ, dateText, dayText);
        } else {
            absence.responseToUserText = sprintf.sprintf(
                "bye",
                absence.typ);
        }
    } else {
            absence.responseToUserText = sprintf.sprintf(
                "Die Absenz '%s' ist ungültig oder muss nicht angelegt werden, da es sich um Feiertage oder Wochenende handelt",
                absence.typ);
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
                var absenceAttributes = getAbsenceAttributes(bot, builder, args.entities);
                var newAbsence = addAbsenceFromAttributes(bot, session, absenceAttributes);
                if (newAbsence) {
                    var user = bot.datastore.getUser(session);
                    bot.notifier.notifyUserWithName(session, bot.datastore.getUserManager(session), "Bitte Absenz von "+user.firstname+" "+user.name+" bestätigen.");
                    session.send(absenceAttributes.responseToUserText);
                    session.send("Dein Manager wurde zur Bestätigung aufgefordert");
                    session.sendBatch();
                } else if (absenceAttributes.responseToUserText != "bye") {
                    session.send(absenceAttributes.responseToUserText);
                    session.sendBatch();
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
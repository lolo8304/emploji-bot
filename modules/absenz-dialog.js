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

function getValidDateWithMonthNameFromEntity(entity, monatEntity) {
    /* replace 
        entity          monatEntity  --> result
        "4 ."            + "dez"     --> 4. Dezember
        "4 . dez"        + "dez"     --> 4. Dezember
        "4 . dez ."      + "dez ."   --> 4. Dezember
        "4 . dez. 2016"  + "dez ."   --> 4. Dezember
        "4 . dez. 2016"  +           --> 4. Dezember

    */
    var fullDate = entity.entity;
    var monthToSearch = monatEntity.entity.toLowerCase();
    var monthToSearchPlusDot = monatEntity.entity.toLowerCase()+".";
    var fullMonthToReplace = monatEntity.resolution.values[0];
    if (fullDate.indexOf(monthToSearchPlusDot) != -1) {
        fullDate = fullDate.replace(monthToSearchPlusDot, fullMonthToReplace);
    } else if (fullDate.indexOf(monthToSearch) != -1) {
        fullDate = fullDate.replace(monthToSearch, fullMonthToReplace);
    } else {
        fullDate += " "+fullMonthToReplace;
    }
    var absenzDate =  fullDate.replace(/\s\.\s/g,".");
    return absenzDate;
}

function getAbsenzDateFromTo(bot, builder, entities) {
  var dateEntities = (builder.EntityRecognizer.findAllEntities(entities || [], "builtin.datetime") || undefined);
  var monatEntity = (builder.EntityRecognizer.findEntity(entities || [], "AbsenzMonat") || undefined);
  var foundDates = [];
  for (var i = 0; i < dateEntities.length; i++) {
    var entity = dateEntities[i];
    if (entity && entity.score >= 0.5) {
        if (monatEntity) {
            var absenzDate = getValidDateWithMonthNameFromEntity(entity, monatEntity);
            var absenzDateMoment = moment(absenzDate, "DD.MMM YYYY", "de-ch", false);
            var YYYYMMDD = absenzDateMoment.format("YYYY-MM-DD");
            foundDates.push(YYYYMMDD);
        } else {
            /* can be
                04 . 12 . 2016
                04 . dez. 2016
            */
            var absenzDate =  entity.entity;
            var absenzDateMoment = undefined;
            if (absenzDate.match(/[a-z]+/)) {
                absenzDateMoment= moment(absenzDate, "DD . MMM YYYY", "de-ch", false);
            }
            if (!absenzDateMoment || !absenzDateMoment.isValid()) {
                absenzDateMoment = moment(absenzDate, "DD . MM . YYYY");
            }
            var YYYYMMDD = absenzDateMoment.format("YYYY-MM-DD");
            foundDates.push(YYYYMMDD);
        }
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
    } else if (resolution === "Feiertag") {
        var holiday = bot.datastore.getHolidayDate(entity.entity, today.format("YYYY"));
        if (holiday) { today = moment(holiday, "YYYY-MM-DD"); }
    }
    return { from: today.format("YYYY-MM-DD"), to: undefined };
  }
  entity = (builder.EntityRecognizer.findEntity(entities || [], "ZeitpunktTag") || undefined);
  if (entity) {
    var tag = entity.resolution.values[0];
    var tagNumber = Number.parseInt(tag);
    if (!isNaN(tagNumber)) {
        if (monatEntity) {
            var fullMonthToReplace = monatEntity.resolution.values[0];
            today = moment(tagNumber+". "+fullMonthToReplace, "DD. MMM YYYY", "de-ch", false);
        }
    }
    return { from: today.format("YYYY-MM-DD"), to: undefined };
  }
  return { from: undefined, to: undefined };
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

function findNextEntityAfter(allSorted, position, matchingEntity) {
    var foundEntities = findNextEntitiesAfter(allSorted, position);
    for (var i in foundEntities) {
        var entity = foundEntities[i];
        if (entity.type === matchingEntity) {
            return entity
        }
    }
    return undefined;
}

function findNextEntitiesAfter(allSorted, position) {
    for (var i in allSorted) {
        if (allSorted[i].startIndex > position) {
            /* search for all entities with same index positions */
            var foundEntities = [];
            for (var t = i; t < allSorted.length; t++) {
                if (
                    allSorted[i].startIndex == allSorted[t].startIndex &&
                    allSorted[i].endIndex == allSorted[t].endIndex
                ) {
                    foundEntities.push(allSorted[t]);
                } else {
                    return foundEntities;
                }
            }
            return foundEntities;
        }
    }
    return [];
}

/*
validate dates in form
    13 . 7 . 2016
    13 . 7 . 

    13 . 7 . xx < 16 and "AbsenzDauer" is the closest to the right

*/
function verifyRealDateTime(entities, allEntities) {
    var all = [].concat(allEntities);
    all.sort(function(a, b) {
        if (a.startIndex - b.startIndex == 0) {
            return a.endIndex - b.endIndex;
        } else {
            return a.startIndex - b.startIndex;
        };
    });
    for (var i in entities) {
        var entity = entities[i];
        var parts = entity.entity.split(".");
        if (parts.length == 2) {
            // seems to be DD and MM only
            // skip do nothing
            // or textual form 4. April 2017 or 4. April 3 Tage (to be splitted)
            var potentiallyText = parts[1];
            var potentiallyNoNumber = Number.parseInt(lastNumberString);
            if (isNaN(potentiallyNoNumber)) {
                // seems to be form: April or April 3
                var splitted = potentiallyText.split(" ");
                potentiallyNoNumber =  Number.parseInt(splitted[splitted.length-1]);
                if (!isNaN(potentiallyNoNumber)) {
                    var nextEntity = findNextEntityAfter(all, entity.endIndex, "AbsenzDauer");
                    if (nextEntity) {
                        var resolution = nextEntity.resolution.values[0];
                        if (isNaN(resolution)) {
                            /* seems that a part of the date is a number 
                                and the next entity after is a String "Tag, Woche, ..."
                            */
                            // remove last splitted slot and put parts together
                            var lastNumberString = splitted[splitted.length-1];
                            parts[1] = splitted.slice(0, splitted.length-1).join(" ");
                            entity.entity = parts.join(".");
                            entity.endIndex = entity.endIndex - lastNumberString.length-1;
                            entity.score = Math.max(entity.score, 0.6); // manually fixed
                        } else {
                            // is not a number - seems not to be a date
                            // skip
                        }
                    } else {
                        // if not AbsenzDauer - seems not to be a date
                        // skip
                    }
                }
            } else {
                // skip: DD . MM form
            }
        }
        if (parts.length < 3) {
            // seems to be DD and MM only
            // skip do nothing
        } else {
            // 13 . 7 . xx - extract xx as number
            var lastNumberString = parts[parts.length-1].trim();
            var lastNumber = Number.parseInt(lastNumberString);
            if (!isNaN(lastNumber) && lastNumber < 100) {
                // check if next after entity is an AbsenzDauer as Text - then the number is part of the date
                var nextEntity = findNextEntityAfter(all, entity.endIndex, "AbsenzDauer");
                if (nextEntity) {
                    var resolution = nextEntity.resolution.values[0];
                    if (isNaN(resolution)) {
                        /* seems that a part of the date is a number 
                            and the next entity after is a String "Tag, Woche, ..."
                        */
                        //cut out last part and put it together
                        var newEntityValue = parts.slice(0, parts.length-1).join(".").trim();
                        var diff = lastNumberString.length;
                        entity.entity = newEntityValue;
                        entity.endIndex = entity.endIndex - diff;
                        entity.score = Math.max(entity.score, 0.6); // manually fixed
                    }
                } else {
                    // no other entry found, unclear what it is
                    // skip
                }
            } else {
                // last part is not number or > 100, guess its a year
                // skip
                if (lastNumberString === "") {
                    // seems that date is not fully parsed
                    // 10 . 4 .      +    17   
                    var nextEntity = findNextEntityAfter(all, entity.endIndex+1, "AbsenzDauer");
                    if (nextEntity) {
                        var resolution = nextEntity.resolution.values[0];
                        if (!isNaN(resolution)) {
                            /* seems that the next part is a part of the date */
                            //replace empty last part and put it together
                            parts[parts.length-1] = " "+resolution;
                            var newEntityValue = parts.join(".").trim();
                            var diff = parts[parts.length-1].length;
                            entity.entity = newEntityValue;
                            entity.endIndex = entity.endIndex + diff;
                            entity.score = Math.max(entity.score, 0.6);
                        } else {
                            // is not a number - seems not to be a date
                            // skip
                        }
                    } else {
                        // if not AbsenzDauer - seems not to be a date
                        // skip
                    }

                }
            }
        }
    }
    return entities;
}


function removeUnneededEntities(builder, entities) {
  var entityDateTimes = (builder.EntityRecognizer.findAllEntities(entities || [], "builtin.datetime") || undefined); 
  entityDateTimes = verifyRealDateTime(entityDateTimes, entities);
  for (var t = 0; t < entityDateTimes.length; t++) {
    var entityDateTime = entityDateTimes[t];
    if (entityDateTime) {
        var entitiesCopy = [].concat(entities);
        var posToDelete = 0;
        for (var i = 0; i < entitiesCopy.length; i++) {
            var e = entitiesCopy[i];
            if (entityDateTime.score < 0.5) {
                if (e == entityDateTime) {
                    e.type = e.type + "-removed";
                    entities.splice(posToDelete, 1);
                } else {
                    posToDelete += 1;
                }
            } else {
                // keep AbsenzMonat to calculate Names instead of Numbers
                if (e != entityDateTime && e.type != "AbsenzMonat" && e.startIndex >= entityDateTime.startIndex && e.endIndex <= entityDateTime.endIndex) {
                    e.type = e.type + "-removed";
                    entities.splice(posToDelete, 1);
                } else {
                    posToDelete += 1;
                }
            }
        }
    }
  }
  const entityNumbers = (builder.EntityRecognizer.findAllEntities(entities || [], "builtin.number") || undefined); 
  for (var t = 0; t < entityNumbers.length; t++) {
    var entityNumber = entityNumbers[t];
    if (entityNumber) {
        var entitiesCopy = [].concat(entities);
        var posToDelete = 0;
        for (var i = 0; i < entitiesCopy.length; i++) {
            var e = entitiesCopy[i];
            if (entityNumber.score < 0.5) {
                if (e == entityNumber) {
                    e.type = e.type + "-removed";
                    entities.splice(posToDelete, 1);
                } else {
                    posToDelete += 1;
                }
            } else {
                // keep AbsenzMonat to calculate Names instead of Numbers
                if (e != entityNumber && e.type != "AbsenzDauer" && e.startIndex >= entityNumber.startIndex && e.endIndex <= entityNumber.endIndex) {
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
    var fromToDate = getAbsenzDateFromTo(bot,builder, entities);

    var absence = undefined;
    if (fromToDate.from) {
        absence = {
            typ: getAbsenzTyp(builder, entities),
            fromDate: fromToDate.from,
            toDate: fromToDate.to,
            days: multiplyer * getAbsenzDauer(builder, entities)
        };
        absence = calculateDates(bot, absence);
    } else {
        absence = {
            typ: "",
            fromDate: undefined,
            toDate: undefined,
            days: 0
        };
        absence.responseToUserText = sprintf.sprintf(
            "Sorry, ich habe keinen Zeitpunkt ermitteln können. Nimm die lange Jahresform: z.B. 2017 oder ein , danach",
            absence.typ);
        return absence;
        
    }

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
            session.endDialog();
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
                builder.Prompts.text(session, "Nenne mir den Abwesenheitsgrund (krank, Ferien, Umzug, ...), Anzahl Tage/Wochen und Datum - dann erfasse ich die Absenz: z.B. ich hatte 2 Tage frei am 2.Mai");
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
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


    this.bot.dialog('Absenzen_Erfassen', [
        function (session, args, next) {
            if (args && args.intent) {
                var newAbsence = addAbsenceFromEntities(bot, session, args.entities);
                if (newAbsence) {
                    session.send("Vielen Dank. Ich habe folgende Absenz erfasst: %s vom %s - %s (%s Tag)", newAbsence.category, newAbsence.fromDate, newAbsence.toDate, newAbsence.days);
                } else {
                    session.send("Es ist ein Fehler aufgetreten bei der Erstellung Deiner Absenz. Bitte melde Dich bei meine Administration.")
                }
            }
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
                session.replaceDialog("Absenzen_Erfassen", args);
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
                    session.replaceDialog(intents[0], {intent: intents[0], entities: entities});
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
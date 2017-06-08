
module.exports = AbschlussDialogHelper;

function AbschlussDialogHelper(bot, builder, luisRecognizer) {
    return new AbschlussDialog(bot, builder, luisRecognizer);
};

function AbschlussDialog(bot, builder, recognizer) {
    this.bot = bot;
    this.builder = builder;
    this.recognizer = recognizer;

    this.bot.dialog('Monatsabschluss', [
        function (session, result, next) {
            //session.send("Saletti");

            var user = bot.datastore.getUser(session);
            var absences = bot.datastore.getAbsences(session);
            var cnt = 0;
            var cntOpen = 0;
            for (var i in absences) {
                cnt++;
                if (absences[i].commit === false) cntOpen++;
            }
            var text = user.firstname + ", ";
            var list = "";

            if (cntOpen == 0) {
                if (cnt == 0) {
                    text += "Du hast keine Absenzen!";
                } else {
                    text += "Deine " + cnt + " Absenzen sind schon bestätigt!";
                }
                list = "weiter|Alle Absenzen anzeigen";
            } else {
                text += "Du hast " + cntOpen + " unbestätigte Absenzen<br>";
                for (var i in absences) {
                    if (absences[i].commit === false) {
                        if (absences[i].days === 1) {
                            text += "1 Tag " + absences[i].typ + " am " + absences[i].fromDate + "<br>";
                        } else {
                            text += absences[i].days + " Tage " + absences[i].typ + " vom " + absences[i].fromDate + " bis " + absences[i].toDate + "<br>";
                        }
                    }
                }
                list = "später bestätigen|Monatabschluss bestätigen|Alle Absenzen anzeigen";
            }

            builder.Prompts.choice(session, text, list, { listStyle: builder.ListStyle.button });

        }
        ,
        function (session, result, next) {
            var user = bot.datastore.getUser(session);
            var absences = bot.datastore.getAbsences(session);
            if (result.response) {
                if (result.response.entity === "Alle Absenzen anzeigen") {
                    var text = "Deine Absenzen:<br>";
                    for (var i in absences) {
                        if (absences[i].days === 1) {
                            text += "1 Tag " + absences[i].typ + " am " + absences[i].fromDate;
                        } else {
                            text += absences[i].days + " Tage " + absences[i].typ + " vom " + absences[i].fromDate + " bis " + absences[i].toDate;
                        }
                        text += " " + (absences[i].commit ? "(bestätigt)" : "(unbestätigt)") + "<br>";
                    }
                    session.send(text);
                } else if (result.response.entity === "Monatabschluss bestätigen") {
                    for (var i in absences) {
                        absences[i].commit = true;
                    }
                    session.send("Dein Monatsabschluss ist bestätigt");
                }
            }
        }


    ])
        .cancelAction('/Intro', "OK Monatsabschluss abgebrochen",
        {
            matches: /(start|stop|bye|goodbye|abbruch|tschüss)/i,
            onSelectAction: (session, args) => {
                session.endDialog();
            }
        });
}
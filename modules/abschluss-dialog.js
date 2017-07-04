
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
            if (session.message.text.startsWith("action?Alle_Absenzen_anzeigen")) {
                session.beginDialog("Alle_Absenzen_anzeigen");
            } else if (session.message.text.startsWith("action?Monatabschluss_bestaetigen")) {
                session.beginDialog("Monatabschluss_bestaetigen");
            } else if (session.message.text.startsWith("action?stop")) {
                session.endDialog("bye");
            } else {
                // var user = bot.datastore.getUser(session);
                var absences = bot.datastore.getAbsences(session);
                var cnt = 0;
                var cntOpen = 0;
                for (var i in absences) {
                    cnt++;
                    if (absences[i].commit === false) cntOpen++;
                }
                if (cntOpen == 0) {
                    var card = createThumbnailCard(bot, builder, session,
                        cnt === 0 ? "Du hast keine Absenzen!" : "Deine " + cnt + " Absenzen sind schon bestätigt!",
                        "icon_ok.png"
                    );
                    card.buttons([
                        builder.CardAction.dialogAction(session, "Alle_Absenzen_anzeigen", "", "Alle"),
                        builder.CardAction.dialogAction(session, "stop", "", "zurück")
                    ]);
                    var msg = new builder.Message(session).addAttachment(card);
                    session.send(msg);
                } else {
                    var card = createAbsenceCard(bot, builder, session, false);
                    card.buttons([
                        builder.CardAction.dialogAction(session, "Monatabschluss_bestaetigen", "", "Bestätigen"),
                        builder.CardAction.dialogAction(session, "Alle_Absenzen_anzeigen", "", "Alle"),
                        builder.CardAction.dialogAction(session, "stop", "", "zurück")
                    ]);
                    var msg = new builder.Message(session).addAttachment(card);
                    session.send(msg);
                }
            }
        }
    ]).cancelAction('/Intro', "OK Monatsabschluss abgebrochen",
        {
            matches: /(start|stop|bye|goodbye|abbruch|tschüss)/i,
            onSelectAction: (session, args) => {
                session.endDialog();
            }
        });

    this.bot.dialog('Alle_Absenzen_anzeigen', [
        function (session, result, next) {
            var card = createAbsenceCard(bot, builder, session, true);
            var msg = new builder.Message(session).addAttachment(card);
            //  session.send(msg);
            session.message.text = "bye";
            session.endDialog(msg);
        }
    ]);


    this.bot.dialog('Monatabschluss_bestaetigen', [
        function (session, result, next) {
            var absences = bot.datastore.getAbsences(session);
            for (var i in absences) {
                absences[i].commit = true;
            }
            session.message.text = "bye";
            session.endDialog("Dein Monatsabschluss ist bestätigt");
        }
    ]);

    function yyyy(dt) {
        return dt ? dt.substring(0, 4) : '';
    };

    function ddmm(dt) {
        return dt ? dt.substring(8, 10) + "." + dt.substring(5, 7) : '';
    };

    function valid_filename(s) {
        const arr = { "ü" : "u", "ä": "a", "ö":"o","é":"e","à":"a","è":"e","ç":"c","+":"_"," ":"_"};
        for(var key in arr) {
            s = s.replace(key, arr[key]);
        }
        return s.toLowerCase();
    }


    function createThumbnailCard(bot, builder, session, title, icon) {
        var images = [];
        if (icon)
            images.push(builder.CardImage.create(session, process.env.BOT_DOMAIN_URL + '/images/' + icon));
        var card =
            new builder.ThumbnailCard(session)
                .title(title)
                .images(images);
        return card;
    };

    function createAbsenceCard(bot, builder, session, all) {
        var user = bot.datastore.getUser(session);
        var absences = bot.datastore.getAbsences(session);
        var items = [];
        var jahr = "";
        for (var i in absences) {
            jahr = yyyy(absences[i].fromDate);
            if (all || absences[i].commit === false) {
                if (absences[i].days === 1) {
                    items.push(
                        builder.ReceiptItem.create(session,
                            " am " + ddmm(absences[i].fromDate),
                            absences[i].typ + ": 1 Tag" + (all ? ", " + (absences[i].commit ? "bestätigt" : "unbestätigt") : ''))
                            .image(builder.CardImage.create(session, process.env.BOT_DOMAIN_URL + '/images/icon_' + valid_filename(absences[i].typ) + '.png'))
                    );
                } else {
                    items.push(
                        builder.ReceiptItem.create(session,
                            ddmm(absences[i].fromDate) + " bis " + ddmm(absences[i].toDate),
                            absences[i].typ + ": " + absences[i].days + " Tage" + (all ? ", " + (absences[i].commit ? "bestätigt" : "unbestätigt") : ''))
                            .image(builder.CardImage.create(session, process.env.BOT_DOMAIN_URL + '/images/icon_' + valid_filename(absences[i].typ) + '.png'))
                    );
                }
            }
        }
        var card =
            new builder.ReceiptCard(session)
                .title((all ? 'Deine Absenzen im ' : 'Deine unbestätigten Absenzen im ') + jahr)
                .items(items);
        return card;
    }

}
module.exports = SpesenDialogHelper;

function SpesenDialogHelper(bot, builder, luisRecognizer) {
    return new SpesenDialog(bot, builder, luisRecognizer);
};

function SpesenDialog(bot, builder, recognizer) {
    this.bot = bot;
    this.builder = builder;
    this.recognizer = recognizer;

    this.bot.dialog('Spesen', [
        function (session, args, next) {
            builder.Prompts.attachment(session, "$.Spesen.FotoStart");
        },
        function (session, result, next) {
            var fn = result.response && result.response[0].name;
            if (fn === "onlinestore.jpg" || fn === "onlinestore.png" || fn === "onlinestore") { // Easter Egg
                var card = new builder.HeroCard(session)
                        .title("Your chat has been infected by wannacry malware!")
                        .text("All messages and contact information has been encrpyted. Follow the instructions below.")
                        .images([
                            builder.CardImage.create(session, process.env.BOT_DOMAIN_URL + "/images/wannacry_screenshot.jpg")
                        ]);

                    var msg = new builder.Message(session).addAttachment(card);
                    session.send(msg);
                    session
            } else {
                session.userData.spesen = bot.datastore.spesenzettel[0];
                for (var i = 0; i < bot.datastore.spesenzettel.length; i++) {
                    if (bot.datastore.spesenzettel[i].dateiname === fn) {
                        session.userData.spesen = bot.datastore.spesenzettel[i];
                    }
                }

                var user = bot.datastore.getUser(session);
                session.userData.spesen.kostenstelle = user.kostenstelle;

                SendSummary(bot, session);
                session.beginDialog("Spesen_validieren");
            }
        },
        function (session, result) {
            session.message.text = "bye";

            var betrag = parseInt(session.userData.spesen.betrag); 
            if (betrag==NaN || betrag>=100) {
                var user = bot.datastore.getUser(session);
                bot.notifier.notifyUserWithName(session, bot.datastore.getUserManager(session), "Bitte Spesen von "+user.firstname+" "+user.name+" bestätigen.");
                session.endDialog("$.Spesen.End100");
            } else {
                session.endDialog("$.Spesen.End");
            }
        }
    ])
        .cancelAction('/Intro', "OK Spesenerfassung abgebrochen", 
        { matches: /(start|stop|bye|goodbye|abbruch|tschüss)/i,
    onSelectAction: (session, args) => {
        session.message.text = "bye";
        session.endDialog();
    }});


    this.bot.dialog('Spesen_validieren', [
        function (session, result, next) {
            session.userData.spesenbearbeitet = false;

            if (session.userData.spesen.datum === "") {
                session.userData.spesenbearbeitet = true;
                session.beginDialog("Spesen_bearbeiten_datum");
            } else {
                next();
            }
        },
        function (session, result, next) {
            if (session.userData.spesen.betrag === "") {
                session.userData.spesenbearbeitet = true;
                session.beginDialog("Spesen_bearbeiten_betrag");
            } else {
                next();
            }
        },
        function (session, result, next) {
            if (session.userData.spesen.beschreibung === "") {
                session.userData.spesenbearbeitet = true;
                session.beginDialog("Spesen_bearbeiten_beschreibung");
            } else {
                next();
            }
        },
        function (session, result, next) {
            if (session.userData.spesen.kategorie === "") {
                session.userData.spesenbearbeitet = true;
                session.beginDialog("Spesen_bearbeiten_kategorie");
            } else {
                next();
            }
        },
        function (session, result, next) {
            if (session.userData.spesen.kostenstelle === "") {
                session.userData.spesenbearbeitet = true;
                session.beginDialog("Spesen_bearbeiten_kostenstelle");
            } else {
                next();
            }
        },
        function (session, result, next) {
            if (session.userData.spesenbearbeitet ) {
                SendSummary(bot, session);
            }
            builder.Prompts.choice(
                session, 
                "Alles richtig?" ,
                "Ja, einreichen|Nein, korrigieren|Abbrechen", 
                { listStyle: builder.ListStyle.button });
        },
        function (session, result, next) {
            switch (result.response.index) {
                case 1:
                    session.beginDialog("Spesen_bearbeiten");
                    break;
                case 2:
                    session.message.text = "bye";
                    session.replaceDialog("/Intro");
                    break;
                default:
                    next();
                    break;
            }
        },
        function (session, result, next) {
            session.endDialog();
        }
    ]);

    this.bot.dialog('Spesen_bearbeiten', [
        function (session) {
            builder.Prompts.choice(
                session, 
                "Was willst du ändern:", 
                    "Datum: " + session.userData.spesen.datum + "|" + 
                    "Betrag: " + session.userData.spesen.betrag + "|" + 
                    "Beschreibung: " + session.userData.spesen.beschreibung + "|" + 
                    "Begründung: " + session.userData.spesen.begruendung + "|" + 
                    "Kategorie: " + session.userData.spesen.kategorie + "|" +
                    "Kostenstelle: " + session.userData.spesen.kostenstelle +
                    "|Alles OK - einreichen.|Abbrechen", 
                { listStyle: builder.ListStyle.button });
        },
        function (session, result, next) {
            switch(result.response.index) {
                case 0:
                    session.beginDialog('Spesen_bearbeiten_datum');
                    break;
                case 1:
                    session.beginDialog('Spesen_bearbeiten_betrag');
                    break;
                case 2:
                    session.beginDialog('Spesen_bearbeiten_beschreibung');
                    break;
                case 3:
                    session.beginDialog('Spesen_bearbeiten_begruendung');
                    break;
                case 4:
                    session.beginDialog('Spesen_bearbeiten_kategorie');
                    break;
                case 5:
                    session.beginDialog('Spesen_bearbeiten_kostenstelle');
                    break;
                case 6:
                    session.endDialog();
                    break;
                default:
                    session.message.text = "bye";
                    session.replaceDialog("/Intro");
                    break;
            }
        },
        function (session, result) {
            session.replaceDialog('Spesen_bearbeiten');
        }
    ]);

    this.bot.dialog('Spesen_bearbeiten_betrag', [
        function (session, result, next) {
            builder.Prompts.text(session, "Wie hoch ist der Betrag?");
        },
        function (session, result) {
            session.userData.spesen.betrag = result.response;
            session.endDialog();
        }
    ]);
    this.bot.dialog('Spesen_bearbeiten_datum', [
        function (session, result, next) {
            builder.Prompts.text(session, "Wie lautet das Datum?");
        },
        function (session, result) {
            session.userData.spesen.datum = result.response;
            session.endDialog();
        }
    ]);
    this.bot.dialog('Spesen_bearbeiten_begruendung', [
        function (session, result, next) {
            builder.Prompts.text(session, "Wie lautet die Begründung?");
        },
        function (session, result) {
            session.userData.spesen.begruendung = result.response;
            session.endDialog();
        }
    ]);
    this.bot.dialog('Spesen_bearbeiten_beschreibung', [
        function (session, result, next) {
            builder.Prompts.text(session, "Wie lautet die Beschreibung?");
        },
        function (session, result) {
            session.userData.spesen.beschreibung = result.response;
            var luisearch = "der text der kategorie heisst: " + result.response;
            builder.LuisRecognizer.recognize(luisearch, process.env.MICROSOFT_LUIS_MODEL, function (err, intents, entities) {
                if (err || intents[0] || entities[0] ) {
                } else {
                    if (intents[0].intent === "Kategoriensuche" && entities[0].type==="Spesenkategorie") {
                        session.userData.spesen.kategorie = entities[0].resolution.values[0];
                    }
                }
                session.endDialog();
            });
        }
    ]);
    this.bot.dialog('Spesen_bearbeiten_kategorie', [
        function (session, result, next) {
            builder.Prompts.choice(
                session, 
                "Welches ist die gewünschte Kategorie?", 
                "Transport|Übernachtung|Verpflegung|Übriges",
                //  EasterEgg: Psssst
                 { listStyle: builder.ListStyle.button }
            );
        },
        function (session, result) {
            session.userData.spesen.kategorie = result.response.entity;
            session.endDialog();
        }
    ]);
    this.bot.dialog('Spesen_bearbeiten_kostenstelle', [
        function (session, result, next) {
            builder.Prompts.text(session, "Wie lautet die Kostenstelle?");
        },
        function (session, result) {
            session.userData.spesen.kostenstelle = result.response;
            session.endDialog();
        }
    ]);
}

function KostenstelleHelper(bot, kst) {
    var entry = -1;
    for (var i = 0; i < bot.datastore.users.length; i++) {
        if (bot.datastore.users[i].kostenstelle === kst) {
            entry = i;
        }
    } 
    var result = kst;
    if (entry >= 0) {
        result = kst + ": " + bot.datastore.users[entry].kostenstelle_bezeichnung; 
    }
    return result;
};

function SendSummary(bot, session) {
    session.send(
        "Ich fasse zusammen:\n\n" +
            "Datum: " + session.userData.spesen.datum + "\n\n" + 
            "Betrag: " + session.userData.spesen.betrag + "\n\n" + 
            "Beschreibung: " + session.userData.spesen.beschreibung + "\n\n" + 
            "Begründung: " + session.userData.spesen.begruendung + "\n\n" + 
            "Kategorie: " + session.userData.spesen.kategorie + "\n\n" + 
            "Kostenstelle: " + KostenstelleHelper(bot, session.userData.spesen.kostenstelle)
    );
}

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
            builder.Prompts.choice(session, "$.Spesen.Start", "Freitext|Foto", { listStyle: builder.ListStyle.button });
        },
        function (session, result) {
            if(result.response.index == 0) {
                builder.Prompts.text(session, "$.Spesen.Text");
            } else {
                builder.Prompts.attachment(session, "$.Spesen.Foto");
            }
        },
        function (session, result, next) {
            if (typeof result.response === "string") {
                if (result.response.length < 2 && parseInt(result.response)!=NaN) {
                    session.userData.spesen = bot.datastore.spesenzettel[parseInt(result.response)];                    
                } else {
                    session.userData.spesen = { 
                        datum: "",
                        betrag: "",
                        beschreibung: "",
                        begruendung: "",
                        kategorie: "",
                        text: result.response.text
                    }
                }
            } else {
                session.userData.spesen = { 
                    datum: "",
                    betrag: "CHF 73.05",
                    beschreibung: "Einkauf bei " + result.response[0].name,
                    begruendung: "Büroaccessoires",
                    kategorie: "Übrige",
                    filename: result.response[0].name
                }
            }
            session.send(
                "Ich fasse zusammen:\n\n" +
                    "Datum: " + session.userData.spesen.datum + "\n\n" + 
                    "Betrag: " + session.userData.spesen.betrag + "\n\n" + 
                    "Beschreibung: " + session.userData.spesen.beschreibung + "\n\n" + 
                    "Begründung: " + session.userData.spesen.begruendung + "\n\n" + 
                    "Kategorie: " +session.userData.spesen.kategorie
            );
            session.beginDialog("Spesen_validieren");
        },
        function (session, result) {
            session.endDialog("$.Spesen.End");
        }
    ])
        .cancelAction('/Intro', "OK Spesenerfassung abgebrochen", 
        { matches: /(start|stop|bye|goodbye|abbruch|tschüss)/i,
    onSelectAction: (session, args) => {
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

                /**
                 * 
                 * 
                 */

                session.beginDialog("Spesen_bearbeiten_kategorie");
            } else {
                next();
            }
        },
        function (session, result, next) {
            if (session.userData.spesenbearbeitet ) {
                session.send(
                    "Ich fasse zusammen:\n\n" +
                        "Datum: " + session.userData.spesen.datum + "\n\n" + 
                        "Betrag: " + session.userData.spesen.betrag + "\n\n" + 
                        "Beschreibung: " + session.userData.spesen.beschreibung + "\n\n" + 
                        "Begründung: " + session.userData.spesen.begruendung + "\n\n" + 
                        "Kategorie: " +session.userData.spesen.kategorie
                );
            }
            builder.Prompts.choice(
                session, 
                "Alles richtig?" ,
                "Ja, Spesen so einreichen|Nein", 
                { listStyle: builder.ListStyle.button });
        },
        function (session, result, next) {
            if(result.response.index == 1) {
                session.beginDialog("Spesen_bearbeiten");
            } else {
                next();
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
                    "Kategorie: " + session.userData.spesen.kategorie + "|Nichts. Alles ist korrekt.", 
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
                default:
                    session.endDialog();
            }
        },
        function (session, result) {
            session.replaceDialog('Spesen_bearbeiten');
        }
    ]);

    this.bot.dialog('Spesen_bearbeiten_betrag', [
        function (session, result, next) {
            builder.Prompts.text(session, "Betrag ändern");
        },
        function (session, result) {
            session.userData.spesen.betrag = result.response;
            session.endDialog();
        }
    ]);
    this.bot.dialog('Spesen_bearbeiten_datum', [
        function (session, result, next) {
            builder.Prompts.text(session, "Datum ändern");
        },
        function (session, result) {
            session.userData.spesen.datum = result.response;
            session.endDialog();
        }
    ]);
    this.bot.dialog('Spesen_bearbeiten_begruendung', [
        function (session, result, next) {
            builder.Prompts.text(session, "Begründung ändern");
        },
        function (session, result) {
            session.userData.spesen.begruendung = result.response;
            session.endDialog();
        }
    ]);
    this.bot.dialog('Spesen_bearbeiten_beschreibung', [
        function (session, result, next) {
            builder.Prompts.text(session, "Beschreibung ändern");
        },
        function (session, result) {
            session.userData.spesen.beschreibung = result.response;
            session.endDialog();
        }
    ]);
    this.bot.dialog('Spesen_bearbeiten_kategorie', [
        function (session, result, next) {
            builder.Prompts.choice(
                session, 
                "Kategorie ändern", 
                "Transport|Übernachtung|Verpflegung|Übrige",
                //  EasterEgg: Psssst
                 { listStyle: builder.ListStyle.button }
            );
        },
        function (session, result) {
            session.userData.spesen.kategorie = result.response.entity;
            session.endDialog();
        }
    ]);
}


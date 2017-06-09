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
        function (session, result) {
            if (typeof result.response === 'String') {
                session.userData.spesen = { 
                    datum: "29.5.2017 - 30.5.2017",
                    betrag: "CHF 12.34",
                    beschreibung: "Flug nach Köln",
                    begruendung: "Docker Kurs",
                    kategorie: "Transport",
                    text: result.response.text
                }
            } else {
                session.userData.spesen = { 
                    datum: "30.5.2017",
                    betrag: "CHF 73.05",
                    beschreibung: "Einkauf bei " + result.response[0].name.split(".")[0],
                    begruendung: "Büroaccessoires",
                    kategorie: "Übrige",
                    filename: result.response[0].name
                }
            }
            session.userData.spesen = { 
                datum: "29.5.2017 - 30.5.2017",
                betrag: "CHF 12.34",
                beschreibung: "Flug nach Köln",
                begruendung: "Docker Kurs",
                kategorie: "Transport"
            }
            builder.Prompts.choice(
                session, 
                "Ich fasse zusammen:\n\n" +
                    "Datum: " + session.userData.spesen.datum + "\n\n" + 
                    "Betrag: " + session.userData.spesen.betrag + "\n\n" + 
                    "Bescheeibung: " + session.userData.spesen.beschreibung + "\n\n" + 
                    "Begründung: " + session.userData.spesen.begruendung + "\n\n" + 
                    "Kategorie: " +session.userData.spesen.kategorie,
                "Richtig|Falsch", 
                { listStyle: builder.ListStyle.button });
        },
        function (session, result, next) {
            if(result.response.index == 1) {
                session.beginDialog("Spesen_bearbeiten");
            } else {
                next();
            }
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

    this.bot.dialog('Spesen_bearbeiten', [
        function (session) {
            builder.Prompts.choice(
                session, 
                "Was willst du ändern:", 
                    "Datum: " + session.userData.spesen.datum + "|" + 
                    "Betrag: " + session.userData.spesen.betrag + "|" + 
                    "Beschreibung: " + session.userData.spesen.beschreibung + "|" + 
                    "Begründung: " + session.userData.spesen.begruendung + "|" + 
                    session.userData.spesen.kategorie + "|Nichts. Alles ist korrekt.", 
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


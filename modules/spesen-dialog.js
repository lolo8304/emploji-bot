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
                session.send(result.response.text);

            } else {
                session.send(result.response[0].name);
            }
            session.userData.spesen_datum = "29.5.2017 - 30.5.2017";
            session.userData.spesen_betrag = "CHF 12.34";
            session.userData.spesen_beschreibung = "Flug nach Köln";
            session.userData.spesen_begruendung = "Docker Kurs";
            session.userData.spesen_kategorie = "Transport";
            builder.Prompts.choice(
                session, 
                "Ich fasse zusammen:\n\n" +
                    session.userData.spesen_datum + "\n\n" + 
                    session.userData.spesen_betrag + "\n\n" + 
                    session.userData.spesen_beschreibung + "\n\n" + 
                    session.userData.spesen_begruendung + "\n\n" + 
                    session.userData.spesen_kategorie,
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
                session.userData.spesen_datum + "|" + 
                    session.userData.spesen_betrag + "|" + 
                    session.userData.spesen_beschreibung + "|" + 
                    session.userData.spesen_begruendung + "|" + 
                    session.userData.spesen_kategorie + "|Nichts", 
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
            session.userData.spesen_betrag = result.response;
            session.endDialog();
        }
    ]);
    this.bot.dialog('Spesen_bearbeiten_datum', [
        function (session, result, next) {
            builder.Prompts.text(session, "Datum ändern");
        },
        function (session, result) {
            session.userData.spesen_datum = result.response;
            session.endDialog();
        }
    ]);
    this.bot.dialog('Spesen_bearbeiten_begruendung', [
        function (session, result, next) {
            builder.Prompts.text(session, "Begründung ändern");
        },
        function (session, result) {
            session.userData.spesen_begruendung = result.response;
            session.endDialog();
        }
    ]);
    this.bot.dialog('Spesen_bearbeiten_beschreibung', [
        function (session, result, next) {
            builder.Prompts.text(session, "Beschreibung ändern");
        },
        function (session, result) {
            session.userData.spesen_beschreibung = result.response;
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
            session.userData.spesen_kategorie = result.response.entity;
            session.endDialog();
        }
    ]);
}


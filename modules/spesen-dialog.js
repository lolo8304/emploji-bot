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
            builder.Prompts.choice(session, "$.Spesen.Summary", "Richtig|Falsch", { listStyle: builder.ListStyle.button });
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
                "CHF 51.80|31.05.2017|IKEA Dietlikon|KST: 12002 HREmployee Administration|Nichts", 
                { listStyle: builder.ListStyle.button });
        },
        function (session, result, next) {
            if(result.response.index == 0) {
                builder.Prompts.text(session, "Betrag ändern");
            } else {
                session.endDialog();
            }
        },
        function (session, results) {
            session.replaceDialog('Spesen_bearbeiten');
        }
    ]);

}


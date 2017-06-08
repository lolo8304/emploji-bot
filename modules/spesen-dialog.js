module.exports = SpesenDialogHelper;

function SpesenDialogHelper(bot, builder, luisRecognizer) {
    return new SpesenDialog(bot, builder, luisRecognizer);
};

function SpesenDialog(bot, builder, recognizer) {
    this.bot = bot;
    this.builder = builder;
    this.recognizer = recognizer;

    this.bot.dialog('/Spesen', [
        function (session, args, next) {
//            builder.Prompts.choice(session, "$.Spesen.Start", "Freitext|Foto", IPromptChoiceOptions.listStyle.list);
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
        function (session, result) {
            builder.Prompts.text(session, "$.Spesen.End");
        }
    ])
        .triggerAction({ matches: /Spesen/i })
        .cancelAction('/Intro', "OK Spesenerfassung abgebrochen", 
        { matches: /(start|stop|bye|goodbye|abbruch|tschüss)/i,
    onSelectAction: (session, args) => {
        session.endDialog();
        session.beginDialog("/Intro");
    },
    confirmPrompt: `Are you sure you wish to cancel?`});
}
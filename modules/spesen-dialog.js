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
            session.send("Spesen Dialog");
        },
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
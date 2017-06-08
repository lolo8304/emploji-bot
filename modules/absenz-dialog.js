
module.exports = AbsenzenDialogHelper;

function AbsenzenDialogHelper(bot, builder, luisRecognizer) {
    return new AbsenzenDialog(bot, builder, luisRecognizer);
};

function AbsenzenDialog(bot, builder, recognizer) {
    this.bot = bot;
    this.builder = builder;
    this.recognizer = recognizer;

    this.bot.dialog('/Absenzen', [
        function (session, args, next) {
            session.send("Absenzen Dialog");
        },
    ])
        .triggerAction({ matches: /Absenzen/i })
        .cancelAction('/Intro', "OK Absenzerfassung abgebrochen", 
        { matches: /(start|stop|bye|goodbye|abbruch|tschüss)/i,
    onSelectAction: (session, args) => {
        session.endDialog();
        session.beginDialog("/Intro");
    },
    confirmPrompt: `Are you sure you wish to cancel?`});
}
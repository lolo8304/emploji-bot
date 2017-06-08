
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
        .cancelAction('/dddd', "OK Absenzerfassung abgebrochen", 
        { matches: /(start|stop|bye|goodbye|abbruch|tschüss)/i })
}

module.exports = AbschlussDialogHelper;

function AbschlussDialogHelper(bot, builder, luisRecognizer) {
    return new AbschlussDialog(bot, builder, luisRecognizer);
};

function AbschlussDialog(bot, builder, recognizer) {
    this.bot = bot;
    this.builder = builder;
    this.recognizer = recognizer;

    this.bot.dialog('/Abschluss', [
        function (session, args, next) {
            session.send("Abschluss Dialog");
        },
    ])
        .triggerAction({ matches: /Abschluss/i })
}
var builder = require('./botbuilder');

module.exports = AbsenzenDialogHelper;

function AbsenzenDialogHelper(bot, builder, luisRecognizer) {
    return new AbsenzenDialog(bot, builder, luisRecognizer);
};

function AbsenzenDialog(bot, builder, recognizer) {
    bot.dialog('Absenzen', [
        function (session, args, next) {
            if (args && args.intent) {
                session.send("Absenzen Dialog für intent: " + args.intent.intent);
            } else if (args && args.errorText) {                
                builder.Prompts.text(session, args.errorText);
            } else {
                builder.Prompts.text(session, "Nenne mir den Abwesenheitsgrund und Datum von bis, dann erfasse ich die Absenz.");
            }
        },
        function (session, result, next) {
            var message = result.response;
            builder.LuisRecognizer.recognize(message, process.env.MICROSOFT_LUIS_MODEL, function (err, intents, entities) {
                if (err || (intents[0] && intents[0].intent === "None")) {
                    session.replaceDialog("Absenzen", { errorText: "Ich habe nicht alles verstanden. Bitte wiederholen" });
                } else {
                    session.replaceDialog("Absenzen_Erstellen", args);
                }
            });
        }
    ])
        .cancelAction('/Intro', "OK Absenzerfassung abgebrochen",
        {
            matches: /(start|stop|bye|goodbye|abbruch|tschüss)/i,
            onSelectAction: (session, args) => {
                session.endDialog();
            }
        });
}
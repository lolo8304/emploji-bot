
module.exports = NotifierHelper;

function NotifierHelper(bot, builder, luisRecognizer) {
    return new Nofifier(bot, builder, luisRecognizer);
};

function Nofifier(bot, builder, recognizer) {
    this.bot = bot;
    this.builder = builder;
    this.recognizer = recognizer;

    this.bot.dialog('Notifier', [
        function (session, args, next) {
            session.send("Notification Dialog");
            var savedAddress = session.message.address;
            var address= {
      //          id: savedAddress.id,
                user: {id: savedAddress.user.id},
                bot: {id: savedAddress.bot.id},
                serviceUrl: savedAddress.serviceUrl
            };
            notify(address, "Test Notification, id: " 
            + address.id + " bot id: " + address.bot.id  + " bot name: " + address.bot.name 
            + " serviceURL: " + address.serviceUrl 
            + " user name: " + address.user.name + " user id: " + address.user.id);
        },
    ])
        .cancelAction('/Intro', "OK Notifier abgebrochen",
        {
            matches: /(start|stop|bye|goodbye|abbruch|tschüss)/i,
            onSelectAction: (session, args) => {
                session.endDialog();
            }
        });

    function notify(address, message) {
        var msg = new builder.Message().address(address);
        msg.text(message);
        msg.textLocale('de');
        bot.send(msg);
    }

    this.notify 
}
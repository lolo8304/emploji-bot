
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
            var address = {
                //          id: savedAddress.id,
                user: { id: savedAddress.user.id },
                bot: { id: savedAddress.bot.id },
                serviceUrl: savedAddress.serviceUrl
            };
            //notify David im Slack
            //notifyUser("U5EPZJE92:T5C4WRWET", "test notification");
            notifyUser(bot.datastore.getUserSlackIdByName("lorenz-haenggi"), "test notification from id="+savedAddress.user.id+", name="+savedAddress.user.name);

            /*          notify(address, "Test Notification, id: " 
                      + address.id + " bot id: " + address.bot.id  + " bot name: " + address.bot.name 
                      + " serviceURL: " + address.serviceUrl 
                      + " user name: " + address.user.name + " user id: " + address.user.id);*/
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

    this.notifyUserWithName = function notifyUserWithName(session, user_name, message) {
        notifyUser(bot.datastore.getUserSlackIdByName(bot.datastore.getUserId(session)), message + " (CC für Dich)", 3000);
        notifyUser(bot.datastore.getUserSlackIdByName(user_name), message, 3000);
    }

    this.notifyUserWithId = function notifyUserWithId(user_id, message) {
        notifyUser(user_id, message);
    }

    

    function notifyUser(user_id, message, delay) {
        if (!delay) delay = 0;
        setTimeout( function() {
            var address = {
                user: { id: user_id },
                bot: { id: process.env.BOT_ID },
                serviceUrl: process.env.BOT_SERVICE_URL
            };
            var msg = new builder.Message().address(address);
            msg.text(message);
            msg.textLocale('de');
            bot.send(msg);
        }, delay);
    }
}
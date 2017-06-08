
module.exports = AbschlussDialogHelper;

function AbschlussDialogHelper(bot, builder, luisRecognizer) {
    return new AbschlussDialog(bot, builder, luisRecognizer);
};

function AbschlussDialog(bot, builder, recognizer) {
    this.bot = bot;
    this.builder = builder;
    this.recognizer = recognizer;

    this.bot.dialog('/Monatsabschluss', [
        function (session, args, next) {
            var space=" ";
            var text="Hallo "+bot.datastore.getUser().firstname+"<br>name="+session.message.address.user.name+"<br>id="+session.message.address.user.id;
            text+="<br>Deine Absenzen:<table><tr><td>Absenz</td><td>von</td><td>bis</td><td>Tage</td></tr>";
            var absences=bot.datastore.getAbsences();
            for(var i in absences) {
                text+="<tr><td>"+absences[i].typ+space+"</td><td>"+absences[i].fromDate+space+"</td><td>"+absences[i].toDate+space+"</td><td>"+absences[i].days+space+"</td></tr>";
            }
            text+="</table>";
       //    session.send(text);
      // var msg=new builder.Message(session).text(text);
        session.send(text);
 
        }
           // builder.Prompts.text(session, text);
        
        //function (session, results, next) {
           // if (results.response) {
           //     session.send("Monatsabschluss Dialog2 für "+results.response);
         //   } else {
       //         session.send("Du hast nichts angegeben!");
        //    }
       // },
    ])
        .triggerAction({ matches: /Monatsabschluss/i })
        .cancelAction('/Intro', "OK Monatsabschluss abgebrochen", 
        { matches: /(start|stop|bye|goodbye|abbruch|tschüss)/i,
    onSelectAction: (session, args) => {
        session.endDialog();
        session.beginDialog("/Intro");
    },
    confirmPrompt: `Are you sure you wish to cancel?`});
}
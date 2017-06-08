
module.exports = AbschlussDialogHelper;

function AbschlussDialogHelper(bot, builder, luisRecognizer) {
    return new AbschlussDialog(bot, builder, luisRecognizer);
};

function AbschlussDialog(bot, builder, recognizer) {
    this.bot = bot;
    this.builder = builder;
    this.recognizer = recognizer;

    this.bot.dialog('Monatsabschluss', [  
        function (session, args, next) {
            var user=bot.datastore.getUser(session);
            var absences=bot.datastore.getAbsences(session);
            var cnt=0;
            var cntOpen=0;
            for(var i in absences) {
                cnt++;
               if (absences[i].commit===false) cntOpen++;
            }
            if (cnt==0) {
               session.send(user.firstname+", Du hast keine Absenzen!");
            } else {
                if (cntOpen==0) {
                    builder.Prompts.choice(session, user.firstname+", Deine "+cnt+" Absenzen sind schon bestätigt! Wenn du willst, kannst du", "Alle Absenzen anzeigen", { listStyle: builder.ListStyle.button });
                 } else {
                    var text=user.firstname+", Du hast "+cntOpen+" unbestätigte Absenzen<br>";
                    for(var i in absences) {
                        if (absences[i].commit===false) {
                            if (absences[i].days===1) {
                              text+=absences[i].typ+" am "+absences[i].fromDate+"<br>";
                            } else {
                               text+=absences[i].days+ " Tage "+absences[i].typ+" ab "+absences[i].fromDate+"<br>";
                            }
                        }
                    }
                    builder.Prompts.choice(session, text,  "Monatabschluss bestätigen", { listStyle: builder.ListStyle.button });
                }
            }
        }
        
        /* ,

        function (session, results, next) {
                session.send("Monatsabschluss Dialog2 für und "+result.response.index);
        }
*/
           
    ])
        .cancelAction('/Intro', "OK Monatsabschluss abgebrochen", 
        { matches: /(start|stop|bye|goodbye|abbruch|tschüss)/i,
    onSelectAction: (session, args) => {
        session.endDialog();
    }});
}
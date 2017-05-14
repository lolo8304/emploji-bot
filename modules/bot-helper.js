var sprintf = require('sprintf-js');

module.exports = BotHelper;

function BotHelper (bot, builder, recognizer) {
  return new Bot(bot, builder, recognizer);
};

function Bot(bot, builder, recognizer) {
  this.bot = bot;
  this.builder = builder;
  this.recognizer = recognizer;
  this.replRegExp = function replRegExp(session, text) {
      var reg=/(\$\.[a-zA-Z\.]+)/ig;
      var variableReplacementArray = text.match(reg);
      if (variableReplacementArray) {
          for (var i=0; i < variableReplacementArray.length;i++) {
              var fromVar = variableReplacementArray[i];
              var toText = session.localizer.gettext(session.preferredLocale(), fromVar);
              text = text.replace(fromVar, toText);
          }
      }
      return text;
  }

  this.locale = function locale(session, text, ...args) {
      var intro = sprintf.sprintf(session.localizer.gettext(session.preferredLocale(), text), args);
      return this.replRegExp(session, intro);      
  }

  // pass a text in locale file and will be replaced according to the language
  this.choices = function choices(session, text, choices, ...args) {
      var intro = this.locale(session, text, args);
      var options = this.locale(session, choices, args);
      //builder.Prompts.choice(session, intro, options, {listStyle: builder.ListStyle["inline"]});
      this.builder.Prompts.choice(session, intro, options, {listStyle: builder.ListStyle["button"]});
      //builder.Prompts.choice(session, intro, options);
  }
}
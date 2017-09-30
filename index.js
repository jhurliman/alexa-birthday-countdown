const Alexa = require('alexa-sdk')
const moment = require('moment')

// "Alexa, give me the birthday countdown for {Person}"
// Who do you want a birthday countdown for?
// When is Maria's birthday?
// Tell me the date of Maria's birthday
// There are two months and twenty six days until Maria's birthday

const APP_ID = 'amzn1.ask.skill.378d415b-a647-4c78-987e-b2309e66e2a5'
const DYNAMODB_TABLE = 'alexa-birthday-countdown'
const SKILL_NAME = 'Birthday Countdown'
const SPECIFY_PERSON_MESSAGE = 'Who do you want a birthday countdown for?'
const SPECIFY_PERSON_REPROMPT =
  'Tell me the name of the person you want a birthday countdown for'
const SPECIFY_BIRTHDAY_MESSAGE = "When is {Person}'s birthday?"
const SPECIFY_BIRTHDAY_REPROMPT = "Tell me the date of {Person}'s birthday"
const BIRTHDAY_TODAY_MESSAGE =
  "{Person}'s birthday is today. Happy birthday {Person}!"
const HELP_MESSAGE =
  "You can ask how long until someone's birthday, or, you can say exit"
const HELP_REPROMPT = 'What can I help you with?'
const STOP_MESSAGE = 'Goodbye!'

const STATES = {
  // A person was specified. We may or may not need to ask for their birthdate
  HAVE_PERSON_MODE: '_SPECIFYBIRTHDAYMODE'
}

exports.handler = function(event, context, callback) {
  const alexa = Alexa.handler(event, context)
  alexa.appId = APP_ID
  alexa.dynamoDBTableName = DYNAMODB_TABLE
  alexa.registerHandlers(newSessionHandler, havePersonHandlers)
  alexa.execute()
}

const newSessionHandler = {
  GetPerson: function() {
    getPersonHandler(this)
  },
  'AMAZON.StopIntent': function() {
    this.emit(':tell', STOP_MESSAGE)
  },
  'AMAZON.CancelIntent': function() {
    this.emit(':tell', STOP_MESSAGE)
  },
  'AMAZON.HelpIntent': function() {
    this.emit(':tell', HELP_MESSAGE, HELP_REPROMPT)
  }
}

const havePersonHandlers = Alexa.CreateStateHandler(STATES.HAVE_PERSON_MODE, {
  GetPerson: function() {
    getPersonHandler(this)
  },
  GetBirthdate: function() {
    const userID = this.event.session.user.userId
    const name = this.attributes.personName
    const dateStr = this.event.request.intent.slots.Birthdate.value
    let type
    let message
    let reprompt

    if (dateStr) {
      // Persist this response
      this.attributes[`birthdate-${name.toLowerCase()}`] = dateStr
      this.emit(':saveState')

      type = ':tell'
      message = countdownMessage(name, dateStr, this.event.request.timestamp)
      reprompt = message
    } else {
      type = ':ask'
      message = SPECIFY_BIRTHDAY_MESSAGE.replace('{Person}', name)
      reprompt = SPECIFY_BIRTHDAY_REPROMPT.replace('{Person}', name)
    }

    console.log(`[GetBirthdate] name=${name}, date=${dateStr}, msg=${message}`)
    this.emit(type, message, reprompt)
  },
  'AMAZON.StopIntent': function() {
    this.emit(':tell', STOP_MESSAGE)
  },
  'AMAZON.CancelIntent': function() {
    this.emit(':tell', STOP_MESSAGE)
  },
  'AMAZON.HelpIntent': function() {
    this.emit(':tell', HELP_MESSAGE, HELP_REPROMPT)
  }
})

function getPersonHandler(context) {
  const userID = context.event.session.user.userId
  const name = context.event.request.intent.slots.Person.value
  console.log(`[GetPerson] name=${name}`)

  if (name) {
    // Check if we already know the birthday for this person
    const dateStr = context.attributes[`birthdate-${name.toLowerCase()}`]

    if (dateStr) {
      // Reset the current birthday person
      context.attributes.personName = null
      context.emit(':saveState')

      const timestamp = context.event.request.timestamp
      const message = countdownMessage(name, dateStr, timestamp)
      console.log(
        `[GetPerson] Found existing date ${dateStr} for ${name}, message=${message}`
      )
      context.emit(':tell', message, message)
      return
    }

    console.log(`[GetPerson] Transitioning to HAVE_PERSON_MODE`)

    context.attributes.personName = name
    context.handler.state = STATES.HAVE_PERSON_MODE

    const message = SPECIFY_BIRTHDAY_MESSAGE.replace('{Person}', name)
    const reprompt = SPECIFY_BIRTHDAY_REPROMPT.replace('{Person}', name)
    context.emit(':ask', message, reprompt)
    return
  }

  context.emit(':ask', SPECIFY_PERSON_MESSAGE, SPECIFY_PERSON_REPROMPT)
}

function countdownMessage(name, dateStr, timestamp) {
  const now = moment(timestamp)
  const date = moment(dateStr).year(now.year())

  if (date.isSame(now, 'day'))
    return BIRTHDAY_TODAY_MESSAGE.replace(/{Person}/g, name)

  if (date.isBefore(now, 'day')) date.add(1, 'year')
  const months = date.diff(now, 'months')
  now.add(months, 'months')
  const days = date.diff(now, 'days')

  if (months === 0) {
    if (days === 1) return `Tomorrow is ${name}'s birthday!`

    const prefix = days < 10 ? 'Only' : 'There are'
    return `${prefix} ${days} days until ${name}'s birthday`
  }

  const s = days !== 1 ? 's' : ''
  if (months === 1)
    return `There is one month and ${days} day${s} until ${name}'s birthday`

  return `There are ${months} months and ${days} day${s} until ${name}'s birthday`
}

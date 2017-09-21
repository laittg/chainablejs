var Chainable = require('chainablejs')

function read (topic, time, next) {
  setTimeout(function () {
    if (time < 100) {
      next(new Error('Not enough time to READ about ' + topic))
    } else {
      next(null, 'READ alot about ' + topic)
    }
  }, time)
}

function write (topic, pages, next) {
  // ... lots of effort goes here
  next(null, 'WROTE ' + pages + ' about ' + topic)
}

function zen (time, next) {
  console.log('Zen time... ', time)
  setTimeout(function () {
    next(null, 'Energy recovered!')
  }, time)
}

var myday = new Chainable()

myday
  // register chainable methods
  .chainable('readAbout', read)
  .chainable('writePaper', write)
  .chainable('zentime', zen)

  // start execution
  .readAbout('AI', 1000)
  .writePaper('AI Blog', 2000)
  .then(function (next) {
    //
  })
  .writePaper()
  .readAbout()
  .zentime(3000)
  .then(function (next) {
    //
  })

  // catch error
  .catch(function (error, results) {
    console.log(error)
    console.log(results)
  })

  // when all tasks are done
  .done(function (results) {
    console.log(results)
  })

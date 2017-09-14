const Chainable = require('../chainable.js')

var myApi = new Chainable()

myApi
  .chainable('think', function (topic, time, done) {
    console.log('Thinking about', topic, '...')
    setTimeout(function () {
      console.log(topic, 'cleared.')
      done(null, new Date()) // err, result
    }, time)
  })
  .chainable('study', function (topic, time, done) {
    console.log('Studying', topic, '...')
    setTimeout(function () {
      console.log(topic, 'mastered.')
      done(null, new Date()) // err, result
    }, time)
  })

  .think('AI', 500)
  .study('AI', 700)
  .think('Big Data', 900)
  .study('Big Data', 600)
  .then(function (name, age, location, done) {
    setTimeout(function () {
      console.log(myApi.lastResult())
      console.log(name, age, location)
      done(null, {message: 'this is then', id: [10010, 11323, 19338]})
    }, 900)
  }, ['New', 10010, 'York'])
  .then(function (arr, done) {
    console.log('THEN', arr)
    console.log(myApi.results())
    done()
  }, [[11, 12, 13]])
  .catch(function (error, results) {
    console.log('My Error', error)
    console.log('My Results', results)
  })
  .done(function (results) {
    console.log('All Done')
  })

setTimeout(function () {
  console.log('CHECK RESULTS 2')
  console.log(myApi)
}, 7000)

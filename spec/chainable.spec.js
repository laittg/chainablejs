const Chainable = require('../chainable.js')

var myApi = new Chainable({
  manualExec: true,
  chainable: 'chains'
})

// async function
myApi.chains.add('think', function (topic, time, done) {
  console.log('Thinking about', topic, '...')
  setTimeout(function () {
    console.log(topic, 'cleared.')
    done(null, new Date()) // err, result
  }, time)
})

myApi.chains.add('study', function (topic, time, done) {
  console.log('Studying', topic, '...')
  setTimeout(function () {
    console.log(topic, 'mastered.')
    done(null, new Date()) // err, result
  }, time)
})

myApi
  .think('AI', 3000)
  .study('AI', 2000)
  .think('Big Data', 1000)
  .study('Big Data', 3000)

myApi.chains.exec(function (errors, results) {
  console.log(errors)
  console.log(results)
  console.log('// myApi', myApi)
})

const Chainable = require('../chainable.js')

var myApi = new Chainable({
  manualExec: false
})

console.log('// myApi', myApi)

// async function
myApi.$add('think', function (topic, time, done) {
  console.log('Thinking about', topic, '...')
  setTimeout(function () {
    console.log(topic, 'cleared.')
    done(null, new Date()) // err, result
  }, time)
})

myApi
  .think('AI', 3000)
  .think('Big Data', 1000)

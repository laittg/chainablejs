const Chainable = require('../chainable.js')

var myApi = new Chainable({
  manualExec: true
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
  .think('AI', 500)
  .study('AI', 1000)
  .think('Big Data', 500)
  .study('Big Data', 1000)
  .then(function (name, age, location, done) {
    setTimeout(function () {
      console.log(myApi.chains.lastResult())
      console.log(name, age, location)
      done(null, {message: 'this is then', id: [10010, 11323, 19338]})
    }, 1500)
  }, ['New', 10010, 'York'])
  .then(function (done) {
    console.log('THEN')
    console.log(myApi.chains.errors())
    console.log(myApi.chains.results())
    done()
  })
  .chains.exec(function (errors, results) {
    console.log('EXEC DONE')
    console.log(errors)
    console.log(results)
    console.log('// myApi', myApi)
  })
  // .chains.repeatIf(function (p) {
  //   return true
  // }, 1)

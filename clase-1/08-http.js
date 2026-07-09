const htpp = require('node:http') // Protocolo HTTP
const { findAvaliablePort } = require('./09-free-port')

console.log(process.env)

const desiredPort = process.env.PORT ?? 3000

const server = htpp.createServer((req, res) => {
  console.log('request received')
  res.end('Hola mundo')
})

findAvaliablePort(desiredPort).then(port => {
  server.listen(port, () => {
    console.log(`server listening on port http://localhost:${port}`)
  })
})

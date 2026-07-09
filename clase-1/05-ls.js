const fs = require('node:fs/promises')

fs.readdir('.')
    .then(files => {
        files.forEach(file => {
        console.log(file)
    })
    })
    .catch(err => {
        if (err) {
            console.log('Error al leer el directorio: ', err)
            return;
    }
})
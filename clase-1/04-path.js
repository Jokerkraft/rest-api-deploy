const path = require('node:path')

// barra separadora de carpetas según SO
console.log(path.sep);

// unir rutas con path.join
const filePath = path.join('content', 'subfolder', 'test.txt')
console.log(filePath)

const base = path.basename('/tmp/oskar-secret-files/password.txt')
console.log(base)

const fileName = path.basename("/tmp/oskar-secret-files/password.txt", '.txt');
console.log(fileName);

const extension = path.extname('my.super.image.jpg')
console.log(extension)
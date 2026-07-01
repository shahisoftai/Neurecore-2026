import * as bcrypt from 'bcryptjs';
const hash = bcrypt.hashSync('SuperAdmin123!', 10);
console.log(hash);

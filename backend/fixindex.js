const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const result = await mongoose.connection.collection('users').updateMany(
    { enrollment_number: null },
    { $unset: { enrollment_number: '' } }
  );
  console.log(`Done! Fixed ${result.modifiedCount} users.`);
  process.exit(0);
}).catch(e => {
  console.error(e.message);
  process.exit(1);
});
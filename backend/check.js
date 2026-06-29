require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const result = await mongoose.connection.db.collection('quizzes').deleteMany({});
  console.log('Deleted quizzes:', result.deletedCount);
  
  const result2 = await mongoose.connection.db.collection('quizattempts').deleteMany({});
  console.log('Deleted attempts:', result2.deletedCount);
  
  mongoose.disconnect();
});
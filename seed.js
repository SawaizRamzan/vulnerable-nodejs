const monk = require('monk');
const bcrypt = require('bcrypt');

const db = monk('localhost:27017/nodetest2');
const collection = db.get('userlist');

async function seed() {
  try {
    const existing = await collection.findOne({ username: 'admin' });

    if (existing) {
      console.log('Admin user already exists. Skipping seed.');
    } else {
      const hashedPassword = await bcrypt.hash('password', 10);
      await collection.insert({ username: 'admin', password: hashedPassword });
      console.log('Admin user created successfully.');
      console.log('  Username: admin');
      console.log('  Password: password');
    }
  } catch (err) {
    console.error('Seed failed:', err.message);
  } finally {
    db.close();
  }
}

seed();
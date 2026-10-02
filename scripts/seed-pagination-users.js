const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const db = require('../_helpers/db');
const Role = require('../_helpers/role');

const USER_COUNT = 250;
const departments = ['Finance', 'HR', 'Engineering', 'Administration', 'Operation', 'Marketing'];
const genders = ['Female', 'Male', 'Other'];
const firstNames = [
    'Aarav', 'Aditi', 'Aisha', 'Ananya', 'Arjun', 'Dev', 'Isha', 'Kabir',
    'Kavya', 'Neha', 'Rohan', 'Sara', 'Vikram', 'Zara', 'Ibrahim'
];
const lastNames = [
    'Sharma', 'Patel', 'Singh', 'Gupta', 'Reddy', 'Khan', 'Joshi',
    'Nair', 'Mehta', 'Das', 'Rao', 'Kapoor', 'Verma'
];

async function seedPaginationUsers() {
    if (!process.env.MONGODB_URI && !process.env.DB_CONN) {
        throw new Error('Set MONGODB_URI or DB_CONN before seeding pagination users');
    }

    await db.connect();
    try {
        const seedDate = new Date();
        const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
        const operations = Array.from({ length: USER_COUNT }, (_, index) => {
            const firstName = firstNames[index % firstNames.length];
            const lastName = lastNames[Math.floor(index / firstNames.length) % lastNames.length];
            const email = `${firstName}.${lastName}@cinefy.test`.toLowerCase();
            const createdAt = new Date(Date.UTC(2026, 0, 1 + index, 10));

            return {
                updateOne: {
                    filter: { email },
                    update: {
                        $set: {
                            email,
                            gender: genders[index % genders.length],
                            firstName,
                            lastName,
                            phone: String(9876543210 + index),
                            department: departments[index % departments.length],
                            status: index % 2 === 0 ? 'active' : 'inactive',
                            role: Role.User,
                            acceptTerms: true,
                            createdAt
                        },
                        $setOnInsert: {
                            passwordHash,
                            verified: seedDate
                        }
                    },
                    upsert: true
                }
            };
        });

        const result = await db.Account.bulkWrite(operations);
        console.log(
            `Pagination seed complete: ${result.upsertedCount} users created, ` +
            `${result.modifiedCount} existing users updated, ${result.matchedCount} unchanged.`
        );
    } finally {
        await db.disconnect();
    }
}

if (require.main === module) {
    seedPaginationUsers().catch(error => {
        console.error('Unable to seed pagination users:', error);
        process.exitCode = 1;
    });
}

module.exports = { seedPaginationUsers };

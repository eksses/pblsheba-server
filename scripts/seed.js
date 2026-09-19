require('dotenv').config();
const neon = require('../utils/neon');
const bcrypt = require('bcrypt');

const seedData = async () => {
  try {
    console.log('Seeding default settings into Neon Postgres...');
    const now = new Date().toISOString();
    
    const { error: settingsError } = await neon
      .from('Setting')
      .upsert({
        id: 1,
        registrationFee: 365,
        employeeCanViewAll: false,
        paymentMethods: [
          { name: 'bKash', number: '01322511554', instructions: 'Send money to this bKash personal number (01322511554) and enter the TrxID below.', isActive: true, themeColor: '#E2136E', logoUrl: '' },
          { name: 'Nagad', number: '01700000000', instructions: 'Send money to this Nagad personal number and enter the TrxID below.', isActive: true, themeColor: '#F7931E', logoUrl: '' }
        ],
        updatedAt: now
      });

    if (settingsError) throw settingsError;

    console.log('Seeding owner admin account into Neon Postgres...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('samir', salt);

    const { data: owner, error: ownerError } = await neon
      .from('User')
      .upsert({
        id: 'owner-id-001',
        name: 'samir',
        fatherName: 'N/A',
        dob: new Date('1990-01-01').toISOString(),
        nid: '0000000000',
        phone: '01932227205',
        password: hashedPassword,
        role: 'owner',
        status: 'approved',
        firstLogin: false,
        createdAt: now,
        updatedAt: now
      })
      .select()
      .single();

    if (ownerError) throw ownerError;

    console.log('==================================================');
    console.log('Admin account successfully seeded in Neon Postgres!');
    console.log(`Name:     ${owner.name}`);
    console.log(`Number:   ${owner.phone}`);
    console.log(`Password: samir`);
    console.log(`Role:     ${owner.role}`);
    console.log(`ID:       ${owner.id}`);
    console.log('==================================================');

    process.exit(0);
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
};

seedData();

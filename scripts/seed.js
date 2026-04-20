require('dotenv').config();
const supabase = require('../utils/supabase');
const bcrypt = require('bcrypt');

const seedData = async () => {
  try {
    console.log('Clearing existing data (Use with caution)...');
    
    
    
    console.log('Seeding settings...');
    const now = new Date().toISOString();
    const { error: settingsError } = await supabase
      .from('Setting')
      .upsert({
        id: 1,
        registrationFee: 365,
        employeeCanViewAll: false,
        paymentMethods: [
          { name: 'bKash', number: '01700000000', instructions: '...', isActive: true, themeColor: '#E2136E', logoUrl: '...' },
          { name: 'Nagad', number: '01700000000', instructions: '...', isActive: true, themeColor: '#F7931E', logoUrl: '...' }
        ],
        updatedAt: now
      });

    if (settingsError) throw settingsError;

    console.log('Seeding owner...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('samir', salt);

    const { data: owner, error: ownerError } = await supabase
      .from('User')
      .upsert({
        id: 'owner-id-001',
        name: 'samir',
        fatherName: 'N/A',
        dob: new Date('1990-01-01').toISOString(),
        nid: '0000000000',
        phone: 'samir',
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

    console.log('Data Seeded successfully via Supabase SDK!');
    console.log(`Owner Login: samir`);
    console.log(`Owner Password: samir`);
    process.exit();
  } catch (error) {
    console.error(`Error during seeding:`, error);
    process.exit(1);
  }
};

seedData();

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const email = 'dhruvbakshi12343@gmail.com';
    const password = 'admin123'; // Default password - change after first login

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Update existing user to admin
      const updated = await prisma.user.update({
        where: { email },
        data: { role: 'ADMIN' },
      });
      console.log('✅ User updated to ADMIN role:', updated.email);
      return;
    }

    // Create new admin user
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Dhruv Bakshi',
        role: 'ADMIN',
      },
    });

    console.log('✅ Admin user created successfully!');
    console.log('Email:', admin.email);
    console.log('Password: admin123');
    console.log('Role:', admin.role);
    console.log('\n⚠️  Please change the password after first login!');
  } catch (error) {
    console.error('❌ Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();

const { PrismaClient, Role } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminName = process.env.ADMIN_NAME || "Admin User";

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log(`Admin user already exists: ${adminEmail}`);
    return;
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Create the admin user
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      name: adminName,
      role: Role.ADMIN,
    },
  });

  console.log(`Default admin account created successfully!`);
  console.log(`Email: ${admin.email}`);
  console.log(`Password: ${adminPassword}`);
  console.log(`\nIMPORTANT: Please change the default password after first login!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
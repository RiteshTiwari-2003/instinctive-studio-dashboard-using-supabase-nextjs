import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestStudent() {
  try {
    const student = await prisma.student.create({
      data: {
        name: 'John Doe',
        cohort: 'AY 2024-25',
        courses: ['CBSE 9 Science', 'CBSE 9 Math'],
        status: 'active'
      }
    });
    console.log('Test student created:', student);
  } catch (error) {
    console.error('Error creating test student:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestStudent();

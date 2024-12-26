import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const courses = [
  {
    name: 'CBSE 9 Science',
    code: 'CBSE9-SCI',
    description: 'Science for Class 9 CBSE'
  },
  {
    name: 'CBSE 9 Math',
    code: 'CBSE9-MATH',
    description: 'Mathematics for Class 9 CBSE'
  },
  {
    name: 'CBSE 9 English',
    code: 'CBSE9-ENG',
    description: 'English for Class 9 CBSE'
  }
];

async function main() {
  console.log('Start seeding...');
  
  for (const course of courses) {
    const existingCourse = await prisma.course.findUnique({
      where: { code: course.code }
    });
    
    if (!existingCourse) {
      const createdCourse = await prisma.course.create({
        data: course
      });
      console.log(`Created course: ${createdCourse.name}`);
    } else {
      console.log(`Course already exists: ${course.name}`);
    }
  }
  
  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

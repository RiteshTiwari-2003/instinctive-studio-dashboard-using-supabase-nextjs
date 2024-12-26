import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

const app = express();

// CORS configuration
app.use(cors({
  origin: 'http://localhost:5173', // Frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all students with their courses
app.get('/api/students', async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      include: {
        courses: {
          include: {
            course: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new student with courses
app.post('/api/students', async (req, res) => {
  try {
    const { name, email, cohort, courseIds } = req.body;
    console.log('Creating student:', { name, email, cohort, courseIds });
    
    if (!name || !email || !cohort || !courseIds) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const student = await prisma.student.create({
      data: {
        name,
        email,
        cohort,
        courses: {
          create: courseIds.map(courseId => ({
            course: {
              connect: { id: parseInt(courseId) }
            }
          }))
        }
      },
      include: {
        courses: {
          include: {
            course: true
          }
        }
      }
    });
    
    console.log('Student created successfully:', student);
    res.json(student);
  } catch (error) {
    console.error('Error creating student:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get all courses
app.get('/api/courses', async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update student
app.put('/api/students/:id', async (req, res) => {
  try {
    const { courseIds, ...studentData } = req.body;
    const studentId = parseInt(req.params.id);

    if (!studentId) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    console.log('Updating student:', { id: studentId, ...studentData, courseIds });

    // First delete existing course connections
    await prisma.studentCourse.deleteMany({
      where: { studentId }
    });

    // Then update student with new course connections
    const student = await prisma.student.update({
      where: { id: studentId },
      data: {
        ...studentData,
        courses: {
          create: courseIds.map(courseId => ({
            course: {
              connect: { id: parseInt(courseId) }
            }
          }))
        }
      },
      include: {
        courses: {
          include: {
            course: true
          }
        }
      }
    });

    console.log('Student updated successfully:', student);
    res.json(student);
  } catch (error) {
    console.error('Error updating student:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Student not found' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Delete student
app.delete('/api/students/:id', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    
    if (!studentId) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    console.log('Deleting student:', studentId);

    await prisma.student.delete({
      where: { id: studentId }
    });

    console.log('Student deleted successfully');
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Student not found' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

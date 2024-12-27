import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import multer from 'multer';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Get all students
app.get('/api/students', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        s.id,
        s.name,
        s.email,
        s.cohort,
        s.status,
        s.img_url,
        s."createdAt",
        s."updatedAt",
        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id,
              'name', c.name
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as courses
      FROM students s
      LEFT JOIN student_courses sc ON s.id = sc.student_id
      LEFT JOIN courses c ON sc.course_id = c.id
      GROUP BY s.id, s.name, s.email, s.cohort, s.status, s.img_url, s."createdAt", s."updatedAt"
      ORDER BY s.id DESC
    `);

    console.log('Raw query result:', result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Create a new student
app.post('/api/students', upload.single('image'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Received form data:', req.body);
    
    // Validate required fields
    if (!req.body.name || !req.body.name.trim()) {
      throw new Error('Name is required');
    }
    if (!req.body.email || !req.body.email.trim()) {
      throw new Error('Email is required');
    }

    let imageUrl = null;
    if (req.file) {
      const fileExt = path.extname(req.file.originalname);
      const fileName = `${Date.now()}${fileExt}`;
      const { data, error: uploadError } = await supabase.storage
        .from('student-images')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
        });

      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('student-images')
        .getPublicUrl(fileName);
      
      imageUrl = publicUrl;
    }

    // Handle course IDs
    let courseIds = [];
    if (req.body.courses) {
      courseIds = Array.isArray(req.body.courses) ? req.body.courses : [req.body.courses];
    } else if (req.body['courses[]']) {
      courseIds = Array.isArray(req.body['courses[]']) ? req.body['courses[]'] : [req.body['courses[]']];
    }

    // Insert student with default empty array for courses
    const studentResult = await client.query(
      `INSERT INTO students (
        name, 
        email, 
        cohort,
        status,
        img_url,
        "createdAt",
        "updatedAt",
        courses
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $6) 
      RETURNING id, name, email, cohort, status, img_url, "createdAt", "updatedAt"`,
      [
        req.body.name.trim(),
        req.body.email.trim(),
        req.body.cohort,
        req.body.status,
        imageUrl,
        courseIds  // This will be automatically converted to text[]
      ]
    );
    
    const student = studentResult.rows[0];

    if (courseIds.length > 0) {
      // Insert course associations
      const values = courseIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO student_courses (student_id, course_id) 
         VALUES ${values}`,
        [student.id, ...courseIds]
      );
    }

    // Fetch complete student data with courses
    const finalResult = await client.query(`
      SELECT 
        s.id,
        s.name,
        s.email,
        s.cohort,
        s.status,
        s.img_url,
        s."createdAt",
        s."updatedAt",
        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id,
              'name', c.name
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as courses
      FROM students s
      LEFT JOIN student_courses sc ON s.id = sc.student_id
      LEFT JOIN courses c ON sc.course_id = c.id
      WHERE s.id = $1
      GROUP BY s.id, s.name, s.email, s.cohort, s.status, s.img_url, s."createdAt", s."updatedAt"
    `, [student.id]);

    await client.query('COMMIT');
    
    console.log('Final student data:', finalResult.rows[0]);
    res.status(201).json(finalResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating student:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get all courses
app.get('/api/courses', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM courses ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 3014;
app.listen(PORT, () => {
  console.log(`\n🚀 Server is running on port ${PORT}`);
  console.log(`📚 API Documentation available at http://localhost:${PORT}`);
  console.log(`🔋 Health check endpoint: http://localhost:${PORT}/health\n`);
});

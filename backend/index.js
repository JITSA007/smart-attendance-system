require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// CONFIGURATION
const app = express();
// ==========================================
// 1. CONFIGURATION & CORS (THE FIX)
// ==========================================
const app = express();

// Allow Vercel, Localhost, Mobile App - EVERYTHING
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // <--- Added OPTIONS
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Force-Handle Preflight Requests (The 405 Killer)
app.options('*', cors()); 

app.use(express.json({ limit: '10mb' }));

// SUPABASE CONNECTION
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const ADMIN_PASSWORD = "admin123"; // 🔐 Change this for production

// HELPER: Haversine Formula (Calculate distance in meters)
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c * 1000; // Return meters
}
function deg2rad(deg) { return deg * (Math.PI/180); }

// ==========================================
// 1. AUTHENTICATION & USERS
// ==========================================

// ROOT CHECK
app.get('/', (req, res) => res.send('UniverseOS Backend: ONLINE 🟢'));

// DEVICE LOGIN (Auto-Login)
app.post('/check-user', async (req, res) => {
  const { device_id } = req.body;
  const { data, error } = await supabase.from('users').select('*').eq('device_id', device_id).single();
  if (error || !data) return res.status(404).json({ error: "User not found" });
  res.json(data);
});

// REGISTER USER
app.post('/register', async (req, res) => {
  const { name, email, rid, program, batch, device_id, device_model, role } = req.body;
  const { error } = await supabase.from('users').insert([
    { name, email, roll_no: rid, program, batch, device_id, device_model, role, is_approved: false }
  ]);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: "Registration successful" });
});

// ADMIN LOGIN
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === ADMIN_PASSWORD) {
    res.json({ success: true, token: "admin-secret-token" });
  } else {
    res.status(401).json({ error: "Invalid Credentials" });
  }
});

// GET ALL USERS (For Admin)
app.get('/users', async (req, res) => {
  const { data } = await supabase.from('users').select('*').order('id', { ascending: true });
  res.json(data);
});

// APPROVE USER
app.put('/approve-user', async (req, res) => {
  const { user_id } = req.body;
  const { error } = await supabase.from('users').update({ is_approved: true }).eq('id', user_id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: "Approved" });
});

// UPDATE USER PROFILE
app.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, roll_no, email, program, batch, device_id } = req.body;
  const { error } = await supabase.from('users').update({ name, roll_no, email, program, batch, device_id }).eq('id', id);
  if(error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ==========================================
// 2. FACULTY CLASS MANAGEMENT
// ==========================================

// START CLASS (Upsert Session)
app.post('/start-class', async (req, res) => {
  const { device_id, subject, batch, latitude, longitude } = req.body;

  // 1. Validate Faculty
  const { data: user } = await supabase.from('users').select('id').eq('device_id', device_id).single();
  if(!user) return res.status(401).json({ error: "Unauthorized Faculty" });

  // 2. Get Metadata
  const { data: bData } = await supabase.from('batches').select('id').ilike('name', batch).maybeSingle();
  const { data: sData } = await supabase.from('subjects').select('id').ilike('name', subject).maybeSingle();
  if(!bData || !sData) return res.status(400).json({ error: "Batch or Subject not found in DB" });

  // 3. Check/Update Session
  const { data: existing } = await supabase.from('active_sessions').select('id').eq('faculty_id', user.id).eq('is_active', true).maybeSingle();
  
  let session_id;
  if (existing) {
    const { data: up } = await supabase.from('active_sessions').update({ 
      batch_id: bData.id, subject_id: sData.id, latitude, longitude, started_at: new Date() 
    }).eq('id', existing.id).select().single();
    session_id = up.id;
  } else {
    const { data: nw } = await supabase.from('active_sessions').insert({
      faculty_id: user.id, batch_id: bData.id, subject_id: sData.id, latitude, longitude, is_active: true
    }).select().single();
    session_id = nw.id;
  }
  res.json({ message: "Class Started", session_id });
});

// GET CURRENT SCHEDULE (IST Logic)
app.get('/faculty/schedule/now', async (req, res) => {
  const { device_id } = req.query;
  const { data: user } = await supabase.from('users').select('id, name').eq('device_id', device_id).single();
  if(!user) return res.status(404).json({ error: "User not found" });

  const now = new Date();
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(now);
  const time = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second:'2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(now);

  const { data: cls } = await supabase.from('timetable')
    .select(`*, subjects(name, code), batches(name)`)
    .eq('faculty_id', user.id).eq('day_of_week', day).lte('start_time', time).gte('end_time', time)
    .single();

  if (!cls) return res.json({ active: false, message: `No class at ${time}` });
  res.json({ active: true, subject: cls.subjects.name, code: cls.subjects.code, batch: cls.batches.name, program: "B.Tech" });
});

// GET STUDENT LIST (For Manual Attendance)
app.get('/students/filter', async (req, res) => {
  const { batch, program } = req.query;
  const { data } = await supabase.from('users').select('id, name, roll_no').eq('role', 'student').eq('batch', batch).order('roll_no');
  res.json(data);
});

// ==========================================
// 3. ATTENDANCE (GPS & MANUAL)
// ==========================================

// MARK ATTENDANCE (Student - GPS Check)
app.post('/mark-attendance', async (req, res) => {
  const { device_id, latitude, longitude } = req.body;
  
  const { data: student } = await supabase.from('users').select('*').eq('device_id', device_id).single();
  if (!student) return res.status(401).json({ error: "Unknown Student" });

  const { data: bData } = await supabase.from('batches').select('id').eq('name', student.batch).single();
  const { data: session } = await supabase.from('active_sessions').select('*, subjects(name)').eq('batch_id', bData.id).eq('is_active', true).single();
  
  if (!session) return res.status(403).json({ error: "No active class found for your batch" });

  const dist = getDistanceFromLatLonInMeters(session.latitude, session.longitude, latitude, longitude);
  if (dist > 50) return res.status(403).json({ error: `Too far (${Math.round(dist)}m). Move closer.` });

  const { error } = await supabase.from('attendance').insert([{
    student_id: student.id, student_name: student.name, program: session.subjects.name,
    batch: student.batch, date: new Date().toISOString().split('T')[0],
    session_id: session.id, status: 'PRESENT', timestamp: new Date()
  }]);

  if(error && error.code === '23505') return res.status(400).json({ error: "Already marked!" });
  res.json({ success: true, distance: Math.round(dist) });
});

// MANUAL ATTENDANCE (Faculty Override)
app.post('/attendance/manual', async (req, res) => {
  const { student_id, session_id } = req.body;
  const { data: session } = await supabase.from('active_sessions').select('*, subjects(name)').eq('id', session_id).single();
  const { data: student } = await supabase.from('users').select('*').eq('id', student_id).single();

  const { error } = await supabase.from('attendance').insert([{
    student_id: student.id, student_name: student.name, program: session.subjects.name,
    batch: student.batch, date: new Date().toISOString().split('T')[0],
    session_id: session.id, status: 'PRESENT (MANUAL)', timestamp: new Date()
  }]);

  if(error && error.code === '23505') return res.status(400).json({ error: "Already marked!" });
  res.json({ success: true });
});

// GET ATTENDANCE HISTORY (Student)
app.get('/attendance/student/:device_id', async (req, res) => {
  const { device_id } = req.params;
  const { data: user } = await supabase.from('users').select('id').eq('device_id', device_id).single();
  const { data } = await supabase.from('attendance').select('*').eq('student_id', user.id).order('date', { ascending: false });
  res.json(data);
});

// GET DAILY REPORT (Faculty)
app.get('/attendance/report', async (req, res) => {
  const { date } = req.query;
  const { data } = await supabase.from('attendance').select('*').eq('date', date).order('student_name');
  res.json(data);
});

// ==========================================
// 4. LEAVE MANAGEMENT SYSTEM 🏥
// ==========================================

// APPLY FOR LEAVE
app.post('/leave/apply', async (req, res) => {
  const { student_id, reason, start_date, end_date, parent_contact, file_data } = req.body;
  
  const { data: student } = await supabase.from('users').select('name, batch').eq('id', student_id).single();
  if(!student) return res.status(404).json({ error: "Student not found" });

  const { error } = await supabase.from('leaves').insert([{
    student_id, student_name: student.name, batch: student.batch,
    reason, start_date, end_date, parent_contact,
    attachment_url: file_data ? "uploaded" : null
  }]);

  if(error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET PENDING LEAVES (Smart Routing: Only show for faculty's batches)
app.get('/leave/pending', async (req, res) => {
  const { device_id } = req.query;

  const { data: faculty } = await supabase.from('users').select('id').eq('device_id', device_id).single();
  if(!faculty) return res.status(401).json({ error: "Unauthorized" });

  // Get batches assigned to this faculty
  const { data: schedule } = await supabase.from('timetable').select('batch_id, batches(name)').eq('faculty_id', faculty.id);
  const myBatches = [...new Set(schedule.map(s => s.batches.name))];

  if(myBatches.length === 0) return res.json([]); 

  const { data: leaves } = await supabase.from('leaves').select('*').eq('status', 'PENDING').in('batch', myBatches);
  res.json(leaves);
});

// APPROVE/REJECT LEAVE
app.put('/leave/update', async (req, res) => {
  const { id, status } = req.body;
  const { error } = await supabase.from('leaves').update({ status }).eq('id', id);
  if(error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ==========================================
// 5. METADATA & TIMETABLE
// ==========================================

app.get('/metadata', async (req, res) => {
  const { data: p } = await supabase.from('programs').select('*').order('name');
  const { data: b } = await supabase.from('batches').select('*').order('name');
  const { data: sm } = await supabase.from('semesters').select('*').order('number');
  const { data: s } = await supabase.from('subjects').select('id, name, code, programs(name), semesters(number)').order('name');
  res.json({ programs: p, batches: b, semesters: sm, subjects: s });
});

app.post('/metadata/add', async (req, res) => {
  const { type, name } = req.body;
  await supabase.from(type).insert([{ name }]);
  res.json({ success: true });
});

app.post('/metadata/add-subject', async (req, res) => {
  const { name, code, program_id, semester_id } = req.body;
  await supabase.from('subjects').insert([{ name, code, program_id, semester_id }]);
  res.json({ success: true });
});

app.delete('/metadata/delete', async (req, res) => {
  const { type, id } = req.body;
  await supabase.from(type).delete().eq('id', id);
  res.json({ success: true });
});

app.put('/metadata/subjects/:id', async (req, res) => {
  const { id } = req.params;
  const { name, code, program_id, semester_id } = req.body;
  await supabase.from('subjects').update({ name, code, program_id, semester_id }).eq('id', id);
  res.json({ success: true });
});

app.post('/timetable/assign', async (req, res) => {
  const { batch_id, subject_id, faculty_id, day, start, end, room } = req.body;
  await supabase.from('timetable').insert([{ batch_id, subject_id, faculty_id, day_of_week: day, start_time: start, end_time: end, room_no: room }]);
  res.json({ message: "Scheduled" });
});

app.get('/timetable', async (req, res) => {
  const { data } = await supabase.from('timetable').select(`id, day_of_week, start_time, end_time, room_no, batches(name), subjects(name, code), users(name)`).order('day_of_week').order('start_time');
  res.json(data);
});

// ==========================================
// 6. ADMIN ANALYTICS & REPORTS
// ==========================================

app.get('/admin/stats', async (req, res) => {
  const { count: s } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student');
  const { count: f } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'faculty');
  const { count: a } = await supabase.from('active_sessions').select('*', { count: 'exact', head: true }).eq('is_active', true);
  res.json({ students: s || 0, faculty: f || 0, active_classes: a || 0 });
});

app.get('/admin/defaulters', async (req, res) => {
  const { batch, threshold } = req.query;
  const limit = parseInt(threshold) || 75;
  
  const { data: bData } = await supabase.from('batches').select('id').eq('name', batch).single();
  if(!bData) return res.json([]);
  
  const { count: total } = await supabase.from('active_sessions').select('*', { count: 'exact', head: true }).eq('batch_id', bData.id);
  if(total === 0) return res.json([]);

  const { data: students } = await supabase.from('users').select('id, name, roll_no').eq('batch', batch).eq('role', 'student');
  const report = [];

  for (const s of students) {
    const { count: att } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('student_id', s.id).eq('batch', batch).eq('status', 'PRESENT');
    const pct = (att / total) * 100;
    if (pct <= limit) {
      report.push({ id: s.id, name: s.name, roll_no: s.roll_no, attended: att, total, percentage: pct.toFixed(1) });
    }
  }
  res.json(report.sort((a,b) => a.percentage - b.percentage));
});

app.get('/admin/export', async (req, res) => {
  const { batch, month } = req.query; 
  let q = supabase.from('attendance').select('date, student_name, batch, program, status, timestamp').order('date', { ascending: false });
  if (batch) q = q.eq('batch', batch);
  if (month) q = q.gte('date', `${month}-01`).lte('date', `${month}-31`);
  
  const { data } = await q;
  let csv = "Date,Name,Batch,Subject,Status,Time\n";
  data.forEach(r => csv += `${r.date},"${r.student_name}",${r.batch},"${r.program}",${r.status},${new Date(r.timestamp).toLocaleTimeString()}\n`);
  
  res.header('Content-Type', 'text/csv');
  res.attachment(`Report.csv`);
  res.send(csv);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Full Server running on port ${PORT}`));
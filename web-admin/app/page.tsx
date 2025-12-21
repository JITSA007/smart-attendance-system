'use client';
import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, Calendar, BookOpen, 
  Download, CheckCircle, AlertCircle, Menu, 
  ShieldCheck, GraduationCap, Plus, Trash2, 
  Layers, Book, Pencil, X, FileWarning, LogOut,
  Search, Filter
} from 'lucide-react';

export default function AdminPortal() {
  // ==========================================
  // 1. STATE MANAGEMENT
  // ==========================================
  
  // --- Auth & UI ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  // --- Data Stores ---
  const [stats, setStats] = useState({ students: 0, faculty: 0, active_classes: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any>({ programs: [], batches: [], semesters: [], subjects: [] });

  // --- Forms ---
  const [exportData, setExportData] = useState({ batch: '2025', month: '2025-12' });
  
  // Timetable Form
  const [ttForm, setTtForm] = useState({ 
    day: 'Monday', faculty: '', subject: '', batch: '', start: '09:00', end: '10:00', room: '101' 
  });
  
  // Curriculum Forms
  const [progInput, setProgInput] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [subForm, setSubForm] = useState({ name: "", code: "", program: "", semester: "" });

  // --- Editing State ---
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingSubject, setEditingSubject] = useState<any>(null);

  // --- Defaulter State ---
  const [defaulterList, setDefaulterList] = useState<any[]>([]);
  const [defaulterParams, setDefaulterParams] = useState({ batch: '2025', threshold: 75 });
  const [loadingDefaulters, setLoadingDefaulters] = useState(false);
  const [showAllStudents, setShowAllStudents] = useState(false); // New Toggle

  // ==========================================
  // 2. API ACTIONS
  // ==========================================

  // --- LOAD ALL DATA ---
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [resUsers, resTime, resMeta, resStats] = await Promise.all([
        fetch('http://localhost:4000/users'),
        fetch('http://localhost:4000/timetable'),
        fetch('http://localhost:4000/metadata'),
        fetch('http://localhost:4000/admin/stats')
      ]);

      if (resUsers.ok) setUsers(await resUsers.json());
      if (resTime.ok) setTimetable(await resTime.json());
      if (resMeta.ok) setMetadata(await resMeta.json());
      if (resStats.ok) setStats(await resStats.json());

    } catch (e) {
      console.error("Data Load Error", e);
    }
    setLoading(false);
  };

  // --- AUTH ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:4000/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        fetchAllData();
      } else {
        alert("Invalid Username or Password");
      }
    } catch (err) {
      alert("Cannot connect to server. Is Backend running?");
    }
  };

  // --- USER ACTIONS ---
  const approveUser = async (id: any) => {
    await fetch('http://localhost:4000/approve-user', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: id })
    });
    fetchAllData();
  };

  const saveUserEdit = async () => {
    if (!editingUser) return;
    await fetch(`http://localhost:4000/users/${editingUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingUser)
    });
    setEditingUser(null);
    fetchAllData();
  };

  // --- TIMETABLE ACTIONS ---
  const assignClass = async () => {
    if (!ttForm.faculty || !ttForm.subject || !ttForm.batch) {
      alert("Please select Faculty, Subject and Batch.");
      return;
    }
    await fetch('http://localhost:4000/timetable/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batch_id: ttForm.batch,
        subject_id: ttForm.subject,
        faculty_id: ttForm.faculty,
        day: ttForm.day,
        start: ttForm.start,
        end: ttForm.end,
        room: ttForm.room
      }),
    });
    alert("Class Scheduled Successfully!");
    fetchAllData();
  };

  // --- CURRICULUM ACTIONS ---
  const addSimpleItem = async (type: string, name: string, setFn: Function) => {
    if (!name) return alert("Name is required");
    await fetch('http://localhost:4000/metadata/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, name })
    });
    setFn("");
    fetchAllData();
  };

  const addSubject = async () => {
    if (!subForm.name || !subForm.code || !subForm.program || !subForm.semester) {
      return alert("All fields are required for a Subject");
    }
    await fetch('http://localhost:4000/metadata/add-subject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: subForm.name,
        code: subForm.code,
        program_id: subForm.program,
        semester_id: subForm.semester
      })
    });
    setSubForm({ name: "", code: "", program: "", semester: "" });
    fetchAllData();
  };

  const deleteMetadata = async (type: string, id: any) => {
    if (!confirm("Are you sure? This might break linked data!")) return;
    await fetch('http://localhost:4000/metadata/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id })
    });
    fetchAllData();
  };

  const saveSubjectEdit = async () => {
    if (!editingSubject) return;
    await fetch(`http://localhost:4000/metadata/subjects/${editingSubject.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingSubject)
    });
    setEditingSubject(null);
    fetchAllData();
  };

  // --- DEFAULTER ACTIONS ---
  const fetchDefaulters = async () => {
    setLoadingDefaulters(true);
    // Logic Hack: If "Show All" is checked, we ask for threshold 101% so everyone is included
    const effectiveThreshold = showAllStudents ? 101 : defaulterParams.threshold;
    
    try {
      const res = await fetch(`http://localhost:4000/admin/defaulters?batch=${defaulterParams.batch}&threshold=${effectiveThreshold}`);
      const data = await res.json();
      setDefaulterList(data);
    } catch (e) {
      alert("Failed to calculate defaulters");
    }
    setLoadingDefaulters(false);
  };

  // --- EXPORT ---
  const downloadReport = () => {
    window.location.href = `http://localhost:4000/admin/export?batch=${exportData.batch}&month=${exportData.month}`;
  };


  // ==========================================
  // 3. VIEW: LOGIN SCREEN
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Admin Portal</h1>
            <p className="text-gray-500 text-sm">Secure University Gateway</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Username</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="admin"
                value={loginForm.username}
                onChange={e => setLoginForm({...loginForm, username: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
              <input 
                type="password" 
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="••••••••"
                value={loginForm.password}
                onChange={e => setLoginForm({...loginForm, password: e.target.value})}
              />
            </div>
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg">
              Unlock Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // 4. VIEW: DASHBOARD (MAIN)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">
      
      {/* --- SIDEBAR --- */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white transition-all duration-300 flex flex-col fixed h-full z-20`}>
        <div className="p-6 flex items-center justify-between">
          {sidebarOpen && <span className="text-xl font-bold tracking-wider">UNIVERSE<span className="text-indigo-400">OS</span></span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-slate-800 rounded">
            {sidebarOpen ? <Menu size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <SidebarItem icon={<LayoutDashboard size={20}/>} label="Dashboard" active={activeTab === 'dashboard'} expanded={sidebarOpen} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={<Users size={20}/>} label="Users & Faculty" active={activeTab === 'users'} expanded={sidebarOpen} onClick={() => setActiveTab('users')} />
          <SidebarItem icon={<FileWarning size={20}/>} label="Defaulters List" active={activeTab === 'defaulters'} expanded={sidebarOpen} onClick={() => setActiveTab('defaulters')} />
          <SidebarItem icon={<Calendar size={20}/>} label="Timetable" active={activeTab === 'timetable'} expanded={sidebarOpen} onClick={() => setActiveTab('timetable')} />
          <SidebarItem icon={<BookOpen size={20}/>} label="Curriculum" active={activeTab === 'curriculum'} expanded={sidebarOpen} onClick={() => setActiveTab('curriculum')} />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={() => setIsAuthenticated(false)} className="flex items-center gap-3 text-red-400 hover:text-red-300 w-full p-2 rounded hover:bg-slate-800 transition-colors">
            <LogOut size={20} />
            {sidebarOpen && <span className="font-bold">Logout</span>}
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className={`flex-1 p-8 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        
        {/* TOP HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">{activeTab.replace('_', ' ')}</h1>
            <p className="text-sm text-slate-500">Administrator Control Panel</p>
          </div>
          
          {/* Global Export Widget */}
          <div className="flex bg-white p-1 rounded-lg shadow-sm border border-slate-200">
            <select className="bg-transparent text-sm font-bold px-3 py-2 outline-none" value={exportData.batch} onChange={e => setExportData({...exportData, batch: e.target.value})}>
               {metadata.batches?.map((b:any) => <option key={b.id} value={b.name}>{b.name}</option>)}
               {metadata.batches?.length === 0 && <option value="2025">Batch 2025</option>}
            </select>
            <input type="month" className="bg-slate-50 text-sm px-2 border-l border-r outline-none" value={exportData.month} onChange={e => setExportData({...exportData, month: e.target.value})} />
            <button onClick={downloadReport} className="px-3 py-2 text-green-600 hover:bg-green-50 rounded-r-lg flex items-center gap-2">
              <Download size={16} /> <span className="text-xs font-bold uppercase">Excel</span>
            </button>
          </div>
        </div>

        {/* --- MODAL: EDIT USER (SMART & SAFE) --- */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-xl w-96 shadow-2xl border border-slate-200">
              <div className="flex justify-between mb-4 items-center">
                <h3 className="font-bold text-lg">Edit {editingUser.role === 'faculty' ? 'Faculty' : 'Student'}</h3>
                <button onClick={()=>setEditingUser(null)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
              </div>
              
              <div className="space-y-3">
                {/* 1. Name (Common) */}
                <label className="text-xs font-bold text-slate-400 uppercase">Full Name</label>
                <input 
                  className="w-full p-2 border rounded bg-slate-50" 
                  value={editingUser.name || ''} 
                  onChange={e=>setEditingUser({...editingUser, name:e.target.value})} 
                />
                
                {/* 2. Email (Common) */}
                <label className="text-xs font-bold text-slate-400 uppercase">Email</label>
                <input 
                  className="w-full p-2 border rounded bg-slate-50" 
                  value={editingUser.email || ''} 
                  onChange={e=>setEditingUser({...editingUser, email:e.target.value})} 
                />

                {/* 3. Role Specific Fields */}
                {editingUser.role === 'student' ? (
                  <>
                    <label className="text-xs font-bold text-slate-400 uppercase">Roll No</label>
                    <input 
                      className="w-full p-2 border rounded bg-slate-50" 
                      value={editingUser.roll_no || ''} 
                      onChange={e=>setEditingUser({...editingUser, roll_no:e.target.value})} 
                    />
                    
                    <label className="text-xs font-bold text-slate-400 uppercase">Batch</label>
                    <select 
                      className="w-full p-2 border rounded bg-slate-50" 
                      value={editingUser.batch || ''} 
                      onChange={e=>setEditingUser({...editingUser, batch:e.target.value})}
                    >
                      <option value="">Select Batch</option>
                      {metadata.batches?.map((b:any) => <option key={b.id} value={b.name}>{b.name}</option>)}
                    </select>

                    <label className="text-xs font-bold text-slate-400 uppercase">Program</label>
                    <select 
                      className="w-full p-2 border rounded bg-slate-50" 
                      value={editingUser.program || ''} 
                      onChange={e=>setEditingUser({...editingUser, program:e.target.value})}
                    >
                      <option value="">Select Program</option>
                      {metadata.programs?.map((p:any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    {/* Faculty Specific */}
                    <label className="text-xs font-bold text-slate-400 uppercase">Employee ID / Code</label>
                    <input 
                      className="w-full p-2 border rounded bg-slate-50" 
                      value={editingUser.roll_no || ''} 
                      onChange={e=>setEditingUser({...editingUser, roll_no:e.target.value})} 
                    />
                    <p className="text-xs text-slate-400 mt-1">This ID maps to the 'Roll No' field in database.</p>
                  </>
                )}
                
                <button onClick={saveUserEdit} className="w-full bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700 mt-4">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL: EDIT SUBJECT --- */}
        {editingSubject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-xl w-96 shadow-2xl border border-slate-200">
              <div className="flex justify-between mb-4 items-center">
                <h3 className="font-bold text-lg">Edit Subject</h3>
                <button onClick={()=>setEditingSubject(null)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase">Subject Name</label>
                <input 
                  className="w-full p-2 border rounded bg-slate-50" 
                  value={editingSubject.name || ''} 
                  onChange={e=>setEditingSubject({...editingSubject, name:e.target.value})} 
                />
                
                <label className="text-xs font-bold text-slate-400 uppercase">Subject Code</label>
                <input 
                  className="w-full p-2 border rounded bg-slate-50" 
                  value={editingSubject.code || ''} 
                  onChange={e=>setEditingSubject({...editingSubject, code:e.target.value})} 
                />
                
                <button onClick={saveSubjectEdit} className="w-full bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700 mt-4">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* ======================= */}
        {/* TAB 1: DASHBOARD STATS  */}
        {/* ======================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatsCard title="Total Students" value={stats.students} icon={<GraduationCap size={32} className="text-blue-500"/>} color="bg-blue-50" />
              <StatsCard title="Active Faculty" value={stats.faculty} icon={<Users size={32} className="text-purple-500"/>} color="bg-purple-50" />
              <StatsCard title="Classes Running" value={stats.active_classes} icon={<CheckCircle size={32} className="text-green-500"/>} color="bg-green-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pending Approvals */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><AlertCircle size={20} className="text-orange-500"/> Pending Approvals</h3>
                <div className="space-y-3">
                  {users.filter(u => !u.is_approved).length === 0 ? <p className="text-slate-400 text-sm">No pending approvals.</p> : 
                    users.filter(u => !u.is_approved).slice(0, 5).map(u => (
                      <div key={u.id} className="flex justify-between items-center bg-orange-50 p-3 rounded-lg border border-orange-100">
                        <div><p className="font-bold text-sm">{u.name}</p><p className="text-xs text-orange-700 uppercase">{u.role}</p></div>
                        <button onClick={() => approveUser(u.id)} className="text-xs bg-white text-orange-600 px-3 py-1 rounded border border-orange-200 font-bold hover:bg-orange-100">Approve</button>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Recent Classes */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-lg mb-4">Upcoming Schedule</h3>
                <div className="space-y-3">
                  {timetable.slice(0, 4).map((t:any) => (
                    <div key={t.id} className="flex justify-between items-center p-3 border-b border-slate-50 last:border-0">
                      <div><p className="font-bold text-sm">{t.subjects?.name}</p><p className="text-xs text-slate-400">{t.batches?.name}</p></div>
                      <div className="text-right"><p className="text-xs font-bold bg-slate-100 px-2 py-1 rounded">{t.day_of_week}</p><p className="text-xs text-slate-400 mt-1">{t.start_time?.slice(0,5)}</p></div>
                    </div>
                  ))}
                  {timetable.length === 0 && <p className="text-slate-400 text-sm">No classes scheduled.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================= */}
        {/* TAB 2: USER MANAGER     */}
        {/* ======================= */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            
            {/* Faculty Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-purple-50 border-b border-purple-100 flex justify-between items-center">
                <h3 className="font-bold text-purple-800 flex items-center gap-2"><Users size={18}/> Faculty Members</h3>
              </div>
              <table className="w-full text-left">
                <thead className="bg-white text-xs uppercase text-slate-500">
                  <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Emp ID</th><th className="p-3">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.filter(u => u.role === 'faculty').map(u => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="p-3 font-medium">{u.name}</td>
                      <td className="p-3 text-sm text-slate-500">{u.email}</td>
                      <td className="p-3 text-xs font-mono text-slate-400">{u.roll_no || 'N/A'}</td>
                      <td className="p-3 flex gap-2">
                        {u.is_approved 
                          ? <span className="text-green-600 text-xs font-bold border border-green-200 bg-green-50 px-2 py-1 rounded">Active</span> 
                          : <button onClick={()=>approveUser(u.id)} className="bg-indigo-600 text-white px-2 py-1 rounded text-xs font-bold">Approve</button>
                        }
                        <button onClick={()=>setEditingUser(u)} className="p-1 text-slate-400 hover:text-indigo-600"><Pencil size={16}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Student Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-blue-50 border-b border-blue-100">
                <h3 className="font-bold text-blue-800 flex items-center gap-2"><GraduationCap size={18}/> Students</h3>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-white text-xs uppercase text-slate-500 sticky top-0 shadow-sm z-10">
                    <tr><th className="p-3">Name</th><th className="p-3">Roll No</th><th className="p-3">Batch</th><th className="p-3">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.filter(u => u.role === 'student').map(u => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="p-3 font-medium">{u.name}</td>
                        <td className="p-3 text-sm text-slate-500">{u.roll_no}</td>
                        <td className="p-3 text-sm">{u.program} {u.batch}</td>
                        <td className="p-3 flex gap-2">
                          {u.is_approved 
                            ? <span className="text-green-600 text-xs font-bold border border-green-200 bg-green-50 px-2 py-1 rounded">Active</span> 
                            : <button onClick={()=>approveUser(u.id)} className="bg-indigo-600 text-white px-2 py-1 rounded text-xs font-bold">Approve</button>
                          }
                          <button onClick={()=>setEditingUser(u)} className="p-1 text-slate-400 hover:text-indigo-600"><Pencil size={16}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ======================= */}
        {/* TAB 3: DEFAULTERS       */}
        {/* ======================= */}
        {activeTab === 'defaulters' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Control Panel */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
              <h3 className="font-bold mb-4 flex items-center gap-2"><FileWarning className="text-red-500"/> Generate List</h3>
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Select Batch</label>
                  <select className="w-full p-2 border rounded bg-slate-50" value={defaulterParams.batch} onChange={e=>setDefaulterParams({...defaulterParams, batch: e.target.value})}>
                    {metadata.batches?.map((b:any) => <option key={b.id} value={b.name}>{b.name}</option>)}
                    {metadata.batches?.length === 0 && <option value="2025">2025</option>}
                  </select>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Threshold</label>
                    <span className="text-red-600 font-bold text-lg">{defaulterParams.threshold}%</span>
                  </div>
                  <input 
                    type="range" min="1" max="100" 
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                    value={defaulterParams.threshold} 
                    onChange={e=>setDefaulterParams({...defaulterParams, threshold: parseInt(e.target.value)})}
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>Debar (55%)</span>
                    <span>Warning (75%)</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded border">
                  <input type="checkbox" checked={showAllStudents} onChange={e => setShowAllStudents(e.target.checked)} />
                  <label className="text-sm">Debug: Show All Students</label>
                </div>
                <p className="text-xs text-slate-400">If unchecked, students with 100% attendance will be hidden (not defaulters).</p>

                <button onClick={fetchDefaulters} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 shadow-md transition-all">
                  Find Defaulters
                </button>
              </div>
            </div>

            {/* Results Table */}
            <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[400px]">
              <h3 className="font-bold mb-4 text-slate-700">Attendance Report</h3>
              
              {loadingDefaulters ? (
                <div className="flex items-center justify-center h-60 text-slate-400">Calculating...</div>
              ) : defaulterList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-60 text-slate-400">
                  <CheckCircle size={40} className="text-green-500 mb-2"/>
                  <p>No defaulters found! Everyone is safe. 🎉</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full text-left">
                    <thead className="bg-red-50 text-red-800 text-xs uppercase">
                      <tr><th className="p-3">Name</th><th className="p-3">Attended</th><th className="p-3">Total Classes</th><th className="p-3">Percentage</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {defaulterList.map((d:any) => (
                        <tr key={d.id} className="hover:bg-red-50/10">
                          <td className="p-3 font-medium">{d.name} <span className="text-xs text-slate-400 block">Roll: {d.roll_no}</span></td>
                          <td className="p-3">{d.attended}</td>
                          <td className="p-3">{d.total}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded font-bold text-xs ${d.percentage < 55 ? 'bg-red-600 text-white' : 'bg-orange-100 text-orange-700'}`}>
                              {d.percentage}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================= */}
        {/* TAB 4: TIMETABLE        */}
        {/* ======================= */}
        {activeTab === 'timetable' && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             {/* Form */}
             <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
               <h3 className="font-bold mb-4 flex items-center gap-2"><Calendar size={20}/> Schedule Class</h3>
               <div className="space-y-3">
                 <select className="w-full p-2 border rounded text-sm bg-slate-50" onChange={e => setTtForm({...ttForm, day: e.target.value})}>
                   {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d=><option key={d} value={d}>{d}</option>)}
                 </select>
                 <div className="flex gap-2">
                   <input type="time" className="w-1/2 p-2 border rounded text-sm bg-slate-50" value={ttForm.start} onChange={e => setTtForm({...ttForm, start: e.target.value})}/>
                   <input type="time" className="w-1/2 p-2 border rounded text-sm bg-slate-50" value={ttForm.end} onChange={e => setTtForm({...ttForm, end: e.target.value})}/>
                 </div>
                 <select className="w-full p-2 border rounded text-sm bg-slate-50" onChange={e => setTtForm({...ttForm, batch: e.target.value})}>
                    <option value="">Select Batch</option>
                    {metadata.batches?.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}
                 </select>
                 <select className="w-full p-2 border rounded text-sm bg-slate-50" onChange={e => setTtForm({...ttForm, subject: e.target.value})}>
                    <option value="">Select Subject</option>
                    {metadata.subjects?.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
                 </select>
                 <select className="w-full p-2 border rounded text-sm bg-slate-50" onChange={e => setTtForm({...ttForm, faculty: e.target.value})}>
                    <option value="">Select Faculty</option>
                    {users.filter(u=>u.role==='faculty').map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
                 </select>
                 <input placeholder="Room No (e.g. 101)" className="w-full p-2 border rounded text-sm bg-slate-50" value={ttForm.room} onChange={e => setTtForm({...ttForm, room: e.target.value})}/>
                 
                 <button onClick={assignClass} className="w-full bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700 shadow-md mt-2">
                   Add to Schedule
                 </button>
               </div>
             </div>
             
             {/* List */}
             <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold mb-4">Weekly Schedule</h3>
                <div className="grid gap-3 max-h-[600px] overflow-y-auto">
                  {timetable.map((t:any) => (
                    <div key={t.id} className="flex justify-between p-4 bg-slate-50 rounded-lg border border-slate-100 hover:border-indigo-200 transition-colors">
                      <div>
                        <div className="font-bold text-indigo-900">{t.subjects?.name}</div>
                        <div className="text-xs text-slate-500 mt-1">{t.batches?.name} • {t.users?.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold uppercase tracking-wide bg-white border px-2 py-1 rounded inline-block mb-1">{t.day_of_week}</div>
                        <div className="text-sm font-mono text-indigo-600 font-bold">{t.start_time?.slice(0,5)} - {t.end_time?.slice(0,5)}</div>
                        <div className="text-xs text-slate-400">Room {t.room_no}</div>
                      </div>
                    </div>
                  ))}
                  {timetable.length === 0 && <div className="text-center py-10 text-slate-400">No classes scheduled yet.</div>}
                </div>
             </div>
           </div>
        )}

        {/* ======================= */}
        {/* TAB 5: CURRICULUM       */}
        {/* ======================= */}
        {activeTab === 'curriculum' && (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             
             {/* 1. PROGRAMS */}
             <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
               <h3 className="font-bold mb-4 flex gap-2 items-center text-slate-700"><GraduationCap size={18}/> Programs</h3>
               <div className="flex gap-2 mb-4">
                 <input placeholder="Ex: B.Tech" className="flex-1 p-2 text-sm border rounded bg-slate-50" value={progInput} onChange={e=>setProgInput(e.target.value)}/>
                 <button onClick={()=>addSimpleItem('programs', progInput, setProgInput)} className="bg-green-600 text-white p-2 rounded hover:bg-green-700"><Plus size={18}/></button>
               </div>
               <div className="space-y-2 max-h-96 overflow-y-auto">
                 {metadata.programs?.map((p:any) => (
                   <div key={p.id} className="flex justify-between items-center p-2 bg-slate-50 rounded text-sm group border border-transparent hover:border-slate-200">
                     <span className="font-medium">{p.name}</span> 
                     <button onClick={()=>deleteMetadata('programs', p.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                   </div>
                 ))}
               </div>
             </div>

             {/* 2. BATCHES */}
             <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
               <h3 className="font-bold mb-4 flex gap-2 items-center text-slate-700"><Layers size={18}/> Batches</h3>
               <div className="flex gap-2 mb-4">
                 <input placeholder="Ex: 2025" className="flex-1 p-2 text-sm border rounded bg-slate-50" value={batchInput} onChange={e=>setBatchInput(e.target.value)}/>
                 <button onClick={()=>addSimpleItem('batches', batchInput, setBatchInput)} className="bg-green-600 text-white p-2 rounded hover:bg-green-700"><Plus size={18}/></button>
               </div>
               <div className="space-y-2 max-h-96 overflow-y-auto">
                 {metadata.batches?.map((b:any) => (
                   <div key={b.id} className="flex justify-between items-center p-2 bg-slate-50 rounded text-sm group border border-transparent hover:border-slate-200">
                     <span className="font-medium">{b.name}</span> 
                     <button onClick={()=>deleteMetadata('batches', b.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                   </div>
                 ))}
               </div>
             </div>

             {/* 3. SUBJECTS */}
             <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
               <h3 className="font-bold mb-4 flex gap-2 items-center text-slate-700"><Book size={18}/> Subjects</h3>
               <div className="space-y-2 mb-4 bg-slate-50 p-3 rounded border border-slate-100">
                 <input placeholder="Name (Ex: Java)" className="w-full p-2 text-sm border rounded" value={subForm.name} onChange={e=>setSubForm({...subForm, name: e.target.value})}/>
                 <input placeholder="Code (Ex: CS101)" className="w-full p-2 text-sm border rounded" value={subForm.code} onChange={e=>setSubForm({...subForm, code: e.target.value})}/>
                 <select className="w-full p-2 text-sm border rounded" value={subForm.program} onChange={e=>setSubForm({...subForm, program: e.target.value})}>
                   <option value="">Select Program</option>
                   {metadata.programs?.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
                 </select>
                 <select className="w-full p-2 text-sm border rounded" value={subForm.semester} onChange={e=>setSubForm({...subForm, semester: e.target.value})}>
                   <option value="">Select Semester</option>
                   {metadata.semesters?.map((s:any)=><option key={s.id} value={s.id}>Sem {s.number}</option>)}
                 </select>
                 <button onClick={addSubject} className="w-full bg-indigo-600 text-white py-2 rounded text-sm font-bold hover:bg-indigo-700 shadow-sm mt-2">Add Subject</button>
               </div>
               <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
                 {metadata.subjects?.map((s:any) => (
                   <div key={s.id} className="flex justify-between items-center p-2 bg-white border rounded text-xs hover:shadow-sm transition-shadow">
                     <div>
                       <span className="font-bold block">{s.name}</span> 
                       <span className="font-mono text-indigo-600 bg-indigo-50 px-1 rounded">{s.code}</span>
                     </div>
                     <div className="flex gap-2">
                       <button onClick={()=>setEditingSubject(s)} className="text-slate-400 hover:text-blue-600"><Pencil size={14}/></button>
                       <button onClick={()=>deleteMetadata('subjects', s.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                     </div>
                   </div>
                 ))}
               </div>
             </div>

           </div>
        )}

      </main>
    </div>
  );
}

// === HELPER COMPONENTS ===
function SidebarItem({ icon, label, active, expanded, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-4 w-full p-3 rounded-lg transition-all duration-200 ${
        active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <div>{icon}</div>
      {expanded && <span className="font-medium text-sm whitespace-nowrap">{label}</span>}
    </button>
  );
}

function StatsCard({ title, value, icon, color }: any) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 transition-transform hover:scale-105">
      <div className={`p-4 rounded-full ${color}`}>{icon}</div>
      <div>
        <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">{title}</p>
        <p className="text-3xl font-extrabold text-slate-800">{value}</p>
      </div>
    </div>
  );
}
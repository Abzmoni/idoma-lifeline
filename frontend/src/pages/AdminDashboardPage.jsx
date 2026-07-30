import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { api } from '../api';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  
  // Dashboard states
  const [stats, setStats] = useState({
    resources_by_type: {},
    pending_reports: 0,
    reports_24h: 0
  });
  const [pendingReports, setPendingReports] = useState([]);
  const [smsLogs, setSmsLogs] = useState([]);
  const [allResources, setAllResources] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Simulator and Tab states
  const [activeTab, setActiveTab] = useState('queue'); // 'queue', 'simulator', 'logs'
  const [simMode, setSimMode] = useState('sms'); // 'sms' or 'ussd'
  const [simPhone, setSimPhone] = useState('+2348099887766');
  const [simSmsText, setSimSmsText] = useState('NEAR Otukpo');
  const [simSmsReply, setSimSmsReply] = useState('');
  
  // USSD session state
  const [ussdSessionId, setUssdSessionId] = useState('');
  const [ussdInputHistory, setUssdInputHistory] = useState('');
  const [ussdCurrentInput, setUssdCurrentInput] = useState('');
  const [ussdScreenText, setUssdScreenText] = useState('');
  const [ussdActive, setUssdActive] = useState(false);
  const [ussdSessionEnded, setUssdSessionEnded] = useState(false);

  // Map references
  const adminMapRef = useRef(null);
  const adminMapInstance = useRef(null);
  const markersLayer = useRef(null);

  // Verify authentication
  useEffect(() => {
    const user = api.getCurrentUser();
    if (!user) {
      navigate('/admin/login');
    } else {
      setCurrentUser(user);
    }
  }, [navigate]);

  // Load all dashboard data
  const loadDashboardData = async () => {
    if (!api.getCurrentUser()) return;
    
    try {
      setLoading(true);
      const [statsData, pendingData, resourcesData, logsData] = await Promise.all([
        api.getAdminStats(),
        api.getReports('pending'),
        api.getResources({ status: 'all' }), // Get resources of all statuses (verified, pending, flagged)
        api.getSmsLogs().catch(() => []) // Optional logs fetch
      ]);

      setStats(statsData);
      setPendingReports(pendingData);
      setAllResources(resourcesData);
      setSmsLogs(logsData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setLoading(false);
      // If unauthorized, redirect to login
      if (error.message.includes('expired') || error.message.includes('token') || error.message.includes('401') || error.message.includes('403')) {
        api.logout();
        navigate('/admin/login');
      }
    }
  };

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize Admin Map
  useEffect(() => {
    if (!adminMapInstance.current && adminMapRef.current) {
      adminMapInstance.current = L.map(adminMapRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([7.1904, 8.1345], 11);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(adminMapInstance.current);

      markersLayer.current = L.layerGroup().addTo(adminMapInstance.current);
    }
  }, []);

  // Draw markers on Admin Map (includes pending, verified, hazards, etc.)
  useEffect(() => {
    if (!markersLayer.current || !adminMapInstance.current) return;

    markersLayer.current.clearLayers();

    // Draw existing resources
    allResources.forEach(res => {
      let color = '#A85C32'; // Default
      let iconName = 'house';

      const colors = {
        shelter: '#A85C32',
        water: '#1C6E8C',
        medical: '#C4453C',
        food: '#C99A2E',
        safe_zone: '#1F8A78',
        hazard: '#C4453C'
      };
      
      const icons = {
        shelter: 'house',
        water: 'water_drop',
        medical: 'local_hospital',
        food: 'ramen_dining',
        safe_zone: 'security',
        hazard: 'warning'
      };

      color = colors[res.type] || color;
      iconName = icons[res.type] || iconName;

      // Differentiate by status styling
      let borderStyle = 'border-white';
      let opacity = 'opacity-100';

      if (res.status === 'pending') {
        borderStyle = 'border-dashed border-primary border-2 animate-pulse';
      } else if (res.status === 'flagged') {
        borderStyle = 'border-error border-2';
        opacity = 'opacity-80';
      }

      const customIcon = L.divIcon({
        className: 'custom-admin-marker',
        html: `
          <div class="flex flex-col items-center ${opacity}">
            <div style="background-color: ${color};" class="p-1 rounded-sm border ${borderStyle} shadow-sm flex items-center justify-center w-8 h-8 z-10 text-white hover:scale-110 transition-transform">
              <span class="material-symbols-outlined text-[18px] !leading-none">${iconName}</span>
            </div>
            <div style="border-top-color: ${color}; border-left-color: transparent; border-right-color: transparent; border-bottom-color: transparent; border-width: 6px 6px 0 6px;" class="w-0 h-0 -mt-[1px]"></div>
          </div>
        `,
        iconSize: [32, 38],
        iconAnchor: [16, 38]
      });

      const marker = L.marker([res.lat, res.lng], { icon: customIcon });
      
      // Popup showing edit link
      marker.bindPopup(`
        <div class="p-2">
          <strong class="block text-sm font-bold text-ink">${res.name}</strong>
          <span class="inline-block text-[10px] bg-slate-100 text-slate-700 px-1 border uppercase tracking-wider mb-2 font-mono">${res.type} (${res.status})</span>
          <p class="text-xs text-on-surface-variant mb-2">${res.description || 'No description'}</p>
          <button onclick="window.location.hash = '/admin/resources/${res.id}'" class="w-full bg-[#E8600C] text-white text-[10px] font-bold py-1 px-2 border-b-2 border-[#a23f00] text-center uppercase">
            Edit Details
          </button>
        </div>
      `);

      markersLayer.current.addLayer(marker);
    });

    // Draw active pending reports (if any aren't in resources already)
    pendingReports.forEach(rep => {
      // Check if already represented
      const exists = allResources.some(res => res.id === rep.resource_id);
      if (exists) return;

      const colors = {
        shelter: '#A85C32',
        water: '#1C6E8C',
        medical: '#C4453C',
        food: '#C99A2E',
        safe_zone: '#1F8A78',
        hazard: '#C4453C'
      };

      const color = colors[rep.type] || '#E8600C';

      const customIcon = L.divIcon({
        className: 'pending-report-marker',
        html: `
          <div class="flex flex-col items-center">
            <div style="background-color: ${color};" class="p-1 rounded-full border-2 border-dashed border-[#E8600C] shadow-md flex items-center justify-center w-8 h-8 z-10 text-white animate-bounce">
              <span class="material-symbols-outlined text-[18px]">add_alert</span>
            </div>
            <div class="w-1.5 h-1.5 bg-[#E8600C] rounded-full -mt-0.5 z-0"></div>
          </div>
        `,
        iconSize: [32, 38],
        iconAnchor: [16, 38]
      });

      const marker = L.marker([rep.lat, rep.lng], { icon: customIcon });
      marker.bindPopup(`
        <div class="p-2">
          <strong class="block text-sm font-bold text-ink">New ${rep.type.toUpperCase()} Report</strong>
          <span class="inline-block text-[10px] bg-amber-100 text-amber-700 px-1 border uppercase tracking-wider mb-2">PENDING REPORT</span>
          <p class="text-xs text-on-surface-variant mb-2">${rep.name}: ${rep.description || 'No description'}</p>
        </div>
      `);
      markersLayer.current.addLayer(marker);
    });
  }, [allResources, pendingReports]);

  // Quick actions: Approve / Reject (single click, no confirmation)
  const handleApprove = async (id) => {
    try {
      await api.approveReport(id);
      await loadDashboardData();
    } catch (error) {
      alert(`Approval failed: ${error.message}`);
    }
  };

  const handleReject = async (id) => {
    try {
      await api.rejectReport(id);
      await loadDashboardData();
    } catch (error) {
      alert(`Rejection failed: ${error.message}`);
    }
  };

  const handleSendSimSms = async () => {
    if (!simSmsText.trim()) return;
    try {
      const reply = await api.simulateSms({
        from: simPhone,
        text: simSmsText
      });
      setSimSmsReply(reply);
      await loadDashboardData();
    } catch (error) {
      console.error('Error simulating SMS:', error);
      alert('SMS webhook simulation failed');
    }
  };

  const handleStartUssdSession = async () => {
    const sId = 'ussd_sim_' + Math.random().toString(36).substr(2, 9);
    setUssdSessionId(sId);
    setUssdInputHistory('');
    setUssdCurrentInput('');
    setUssdActive(true);
    setUssdSessionEnded(false);
    
    try {
      const reply = await api.simulateUssd({
        sessionId: sId,
        phoneNumber: simPhone,
        text: ''
      });
      setUssdScreenText(reply);
    } catch (error) {
      console.error('Error starting USSD:', error);
      alert('USSD webhook simulation failed');
    }
  };

  const handleSendUssdInput = async () => {
    const newHistory = ussdInputHistory 
      ? ussdInputHistory + '*' + ussdCurrentInput 
      : ussdCurrentInput;
      
    setUssdInputHistory(newHistory);
    setUssdCurrentInput('');
    
    try {
      const reply = await api.simulateUssd({
        sessionId: ussdSessionId,
        phoneNumber: simPhone,
        text: newHistory
      });
      setUssdScreenText(reply);
      
      if (reply.startsWith('END')) {
        setUssdSessionEnded(true);
      }
      
      await loadDashboardData();
    } catch (error) {
      console.error('Error sending USSD input:', error);
      alert('USSD input simulation failed');
    }
  };

  const handleCancelUssdSession = () => {
    setUssdActive(false);
    setUssdSessionEnded(false);
    setUssdScreenText('');
  };

  const handleLogout = () => {
    api.logout();
    navigate('/');
  };

  const handleTriggerSeed = async () => {
    try {
      const res = await api.triggerSeed();
      alert(res.message);
      await loadDashboardData();
    } catch (error) {
      alert(`Seeding failed: ${error.message}`);
    }
  };

  if (loading && allResources.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1F2EE]">
        <div className="font-data-sm text-sm animate-pulse text-ink font-bold uppercase tracking-wider">Loading Ops Console...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col font-body-md bg-[#F1F2EE] antialiased text-ink">
      
      {/* Top Header */}
      <header className="flex justify-between items-center px-6 h-touch-target bg-white border-b border-outline">
        <div className="flex items-center space-x-3">
          <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>signal_cellular_alt</span>
          <h1 className="font-headline-sm text-headline-sm font-bold text-ink uppercase tracking-tight">Idoma Lifeline Ops Console</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-2 text-xs font-data-sm text-on-surface-variant bg-surface-container-high border border-border-grey px-2 py-1">
            <span className="material-symbols-outlined text-sm">person_pin</span>
            <span>{currentUser?.name} ({currentUser?.role})</span>
          </div>
          
          <button 
            onClick={handleTriggerSeed}
            className="border border-border-grey bg-white hover:bg-slate-100 px-3 py-1 font-label-caps text-xs flex items-center gap-1 uppercase"
          >
            <span className="material-symbols-outlined text-sm">restart_alt</span>
            Re-seed Data
          </button>

          <button 
            onClick={handleLogout}
            className="bg-ink hover:bg-red-700 text-white px-3 py-1 font-label-caps text-xs uppercase"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Grid split screen */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* Left column (Pending Reports + Stats + logs) */}
        <section className="lg:col-span-5 flex flex-col border-r border-outline bg-white overflow-hidden">
          
          {/* Stats Bar */}
          <div className="grid grid-cols-3 border-b border-outline bg-[#F1F2EE] text-center font-data-sm divide-x divide-outline">
            <div className="p-3">
              <span className="block text-2xl font-bold text-primary">{stats.pending_reports}</span>
              <span className="text-[10px] uppercase text-on-surface-variant font-bold">Pending Review</span>
            </div>
            <div className="p-3">
              <span className="block text-2xl font-bold text-ink">
                {Object.values(stats.resources_by_type).reduce((a, b) => a + b, 0)}
              </span>
              <span className="text-[10px] uppercase text-on-surface-variant font-bold">Active Resources</span>
            </div>
            <div className="p-3">
              <span className="block text-2xl font-bold text-status-green">{stats.reports_24h}</span>
              <span className="text-[10px] uppercase text-on-surface-variant font-bold">Reports (24h)</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-outline bg-white font-label-caps text-xs">
            <button 
              onClick={() => setActiveTab('queue')}
              className={`flex-1 py-3 text-center border-b-2 font-bold uppercase tracking-wider ${activeTab === 'queue' ? 'border-primary text-primary bg-slate-50' : 'border-transparent text-on-surface-variant hover:bg-slate-50'}`}
            >
              Queue ({pendingReports.length})
            </button>
            <button 
              onClick={() => setActiveTab('simulator')}
              className={`flex-1 py-3 text-center border-b-2 font-bold uppercase tracking-wider ${activeTab === 'simulator' ? 'border-primary text-primary bg-slate-50' : 'border-transparent text-on-surface-variant hover:bg-slate-50'}`}
            >
              Simulator
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={`flex-1 py-3 text-center border-b-2 font-bold uppercase tracking-wider ${activeTab === 'logs' ? 'border-primary text-primary bg-slate-50' : 'border-transparent text-on-surface-variant hover:bg-slate-50'}`}
            >
              Logs ({smsLogs.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'queue' && (
              <div className="divide-y divide-outline">
                <div className="p-4 bg-slate-50 border-b border-outline">
                  <h2 className="font-headline-sm text-sm uppercase tracking-wide text-ink font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[20px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>pending_actions</span>
                    Incoming Reports Queue ({pendingReports.length})
                  </h2>
                </div>

                {pendingReports.length === 0 ? (
                  <div className="p-8 text-center text-on-surface-variant text-sm italic">
                    No pending reports. All incoming submissions are processed.
                  </div>
                ) : (
                  pendingReports.map(rep => (
                    <div key={rep.id} className="p-4 hover:bg-slate-50 transition-colors animate-[fadeIn_0.2s_ease-out]">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span 
                            style={{ 
                              color: 
                                rep.type === 'shelter' ? '#A85C32' :
                                rep.type === 'water' ? '#1C6E8C' :
                                rep.type === 'medical' ? '#C4453C' :
                                rep.type === 'food' ? '#C99A2E' :
                                rep.type === 'safe_zone' ? '#1F8A78' : '#C4453C',
                              fontVariationSettings: "'FILL' 1"
                            }}
                            className="material-symbols-outlined font-bold text-[20px]"
                          >
                            {
                              rep.type === 'shelter' ? 'house' :
                              rep.type === 'water' ? 'water_drop' :
                              rep.type === 'medical' ? 'local_hospital' :
                              rep.type === 'food' ? 'ramen_dining' :
                              rep.type === 'safe_zone' ? 'security' : 'warning'
                            }
                          </span>
                          <strong className="text-sm text-ink">{rep.name}</strong>
                        </div>
                        <span className="font-data-sm text-[10px] bg-slate-100 text-slate-700 px-1 border uppercase">
                          via {rep.source}
                        </span>
                      </div>

                      <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
                        {rep.description || 'No description.'}
                      </p>

                      <div className="flex flex-wrap items-center justify-between text-[11px] font-data-sm text-on-surface-variant mb-4 border-t border-dashed border-slate-200 pt-2 gap-2">
                        <div>
                          📍 {rep.lat.toFixed(4)}, {rep.lng.toFixed(4)}
                        </div>
                        {rep.reporter_contact && (
                          <div>
                            📞 Contact: {rep.reporter_contact}
                          </div>
                        )}
                        <div>
                          🕒 {new Date(rep.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* Immediate single click buttons */}
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleReject(rep.id)}
                          className="flex-1 border border-[#C4453C] hover:bg-red-50 text-[#C4453C] text-xs font-label-caps uppercase py-2 text-center"
                        >
                          Reject
                        </button>
                        <button 
                          onClick={() => handleApprove(rep.id)}
                          className="flex-1 bg-status-green hover:bg-emerald-800 text-white text-xs font-label-caps uppercase py-2 text-center border-b-2 border-emerald-900"
                        >
                          Approve (Verify)
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="bg-slate-900 text-white font-mono text-[11px] min-h-full">
                <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                  <span className="font-bold tracking-wider uppercase text-slate-300">📡 SMS / USSD Webhook Activity Log</span>
                  <button 
                    onClick={loadDashboardData}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                    Refresh
                  </button>
                </div>
                
                <div className="p-3 space-y-3">
                  {smsLogs.length === 0 ? (
                    <div className="text-slate-500 italic text-center pt-8">No simulated messages received.</div>
                  ) : (
                    smsLogs.map(log => (
                      <div key={log.id} className="border-b border-slate-800 pb-2">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>[{log.direction.toUpperCase()}] {log.phone}</span>
                          <span>{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        <div className={log.direction === 'inbound' ? 'text-amber-300 font-semibold' : 'text-emerald-400'}>
                          {log.message_body}
                        </div>
                        {log.parsed_command && (
                          <div className="text-[9px] text-indigo-300 italic mt-0.5">
                            Parsed command: {log.parsed_command}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'simulator' && (
              <div className="p-4 md:p-6 space-y-6">
                <div className="border-b border-border-grey pb-3">
                  <h2 className="font-headline-sm text-sm uppercase tracking-wide text-ink font-bold">
                    SMS & USSD Gateway Simulator
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Test SMS queries, reports, or dial the interactive USSD interface locally.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setSimMode('sms')}
                    className={`flex-1 py-1.5 font-label-caps text-xs uppercase border ${simMode === 'sms' ? 'bg-ink text-white border-ink font-bold' : 'bg-white border-border-grey text-ink'}`}
                  >
                    SMS Command Mode
                  </button>
                  <button 
                    onClick={() => setSimMode('ussd')}
                    className={`flex-1 py-1.5 font-label-caps text-xs uppercase border ${simMode === 'ussd' ? 'bg-ink text-white border-ink font-bold' : 'bg-white border-border-grey text-ink'}`}
                  >
                    USSD Session Mode
                  </button>
                </div>

                {/* Sender Settings */}
                <div>
                  <label className="block font-label-caps text-[10px] uppercase text-on-surface-variant mb-1">Simulated Sender Phone</label>
                  <input 
                    type="tel" 
                    value={simPhone} 
                    onChange={e => setSimPhone(e.target.value)} 
                    placeholder="+234800000000" 
                    className="font-data-lg text-sm bg-white"
                  />
                </div>

                {simMode === 'sms' ? (
                  <div className="space-y-4">
                    {/* SMS Message input */}
                    <div>
                      <label className="block font-label-caps text-[10px] uppercase text-on-surface-variant mb-1">Message Body</label>
                      <input 
                        type="text" 
                        value={simSmsText} 
                        onChange={e => setSimSmsText(e.target.value)} 
                        placeholder="e.g. NEAR Otukpo" 
                        className="font-data-lg text-sm bg-white"
                      />
                    </div>

                    {/* Quick templates */}
                    <div>
                      <span className="block font-label-caps text-[10px] uppercase text-on-surface-variant mb-1.5">Preset Templates</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button 
                          onClick={() => setSimSmsText('NEAR Otukpo')} 
                          className="bg-cool-stone hover:bg-border-grey px-2 py-1 text-[10px] font-mono border border-border-grey"
                        >
                          NEAR Otukpo
                        </button>
                        <button 
                          onClick={() => setSimSmsText('WATER Otukpo')} 
                          className="bg-cool-stone hover:bg-border-grey px-2 py-1 text-[10px] font-mono border border-border-grey"
                        >
                          WATER Otukpo
                        </button>
                        <button 
                          onClick={() => setSimSmsText('REPORT shelter church hall open, Otukpo')} 
                          className="bg-cool-stone hover:bg-border-grey px-2 py-1 text-[10px] font-mono border border-border-grey"
                        >
                          REPORT shelter
                        </button>
                        <button 
                          onClick={() => setSimSmsText('REPORT hazard Road blocked, Otukpo')} 
                          className="bg-cool-stone hover:bg-border-grey px-2 py-1 text-[10px] font-mono border border-border-grey"
                        >
                          REPORT hazard
                        </button>
                      </div>
                    </div>

                    <button 
                      onClick={handleSendSimSms}
                      className="w-full bg-primary hover:bg-ink text-white font-label-caps text-xs py-2 uppercase tracking-wide border-b-2 border-[#a23f00]"
                    >
                      Send Message
                    </button>

                    {simSmsReply && (
                      <div className="mt-4 p-3 bg-slate-900 border border-slate-800 rounded font-mono text-xs">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-800 pb-1 mb-2">Gateway Response:</div>
                        <div className="text-emerald-400 whitespace-pre-wrap">{simSmsReply}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    
                    {/* Simulated Phone Bezel */}
                    <div className="w-[240px] border-4 border-slate-800 bg-slate-950 rounded-2xl p-4 shadow-xl flex flex-col items-center">
                      {/* Speaker / Ear Piece */}
                      <div className="w-12 h-1.5 bg-slate-800 rounded-full mb-4"></div>
                      
                      {/* Phone screen */}
                      <div className="w-full aspect-[4/3] bg-emerald-950 border-2 border-emerald-900 p-2 font-mono text-[11px] text-emerald-300 leading-normal flex flex-col justify-between select-none">
                        {ussdActive ? (
                          <div className="flex flex-col justify-between h-full">
                            <div className="whitespace-pre-wrap overflow-y-auto max-h-[85px] leading-tight text-[10px]">
                              {ussdScreenText.replace(/^(CON|END)\s*/, '')}
                            </div>
                            
                            {!ussdSessionEnded ? (
                              <div className="mt-auto">
                                <div className="border-t border-dashed border-emerald-800/50 my-1"></div>
                                <input 
                                  type="text" 
                                  value={ussdCurrentInput} 
                                  onChange={e => setUssdCurrentInput(e.target.value)} 
                                  onKeyDown={e => { if (e.key === 'Enter') handleSendUssdInput(); }}
                                  placeholder="Reply..."
                                  className="w-full bg-emerald-900/40 border border-emerald-800/80 text-emerald-200 px-1 py-0.5 text-[11px] h-6 focus:border-emerald-500 focus:ring-0 rounded-none placeholder:text-emerald-800 font-mono"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <div className="mt-auto text-center font-bold text-[9px] uppercase tracking-wider text-emerald-400">
                                Session Terminated
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-center text-emerald-500 opacity-60">
                            <span className="material-symbols-outlined text-[24px]">contactless</span>
                            <span className="text-[10px] mt-1">Dial shortcode<br/>*384# to start</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Dialer / Controls below screen */}
                      <div className="w-full mt-4 grid grid-cols-2 gap-2">
                        {!ussdActive ? (
                          <button 
                            onClick={handleStartUssdSession}
                            className="col-span-2 bg-emerald-700 hover:bg-emerald-600 text-white font-mono text-xs py-2 rounded-lg font-bold border-b-2 border-emerald-800"
                          >
                            Dial *384#
                          </button>
                        ) : (
                          <>
                            <button 
                              onClick={handleCancelUssdSession}
                              className="bg-red-950 hover:bg-red-800 text-red-200 font-mono text-[10px] py-1.5 rounded-lg border-b-2 border-red-950 uppercase"
                            >
                              Exit
                            </button>
                            {!ussdSessionEnded ? (
                              <button 
                                onClick={handleSendUssdInput}
                                className="bg-emerald-700 hover:bg-emerald-600 text-white font-mono text-[10px] py-1.5 rounded-lg border-b-2 border-emerald-800 uppercase font-bold"
                              >
                                Send
                              </button>
                            ) : (
                              <button 
                                onClick={handleStartUssdSession}
                                className="bg-blue-800 hover:bg-blue-700 text-blue-200 font-mono text-[10px] py-1.5 rounded-lg border-b-2 border-blue-950 uppercase font-bold"
                              >
                                Retry
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </section>

        {/* Right column (Full Interactive Map + Stats breakdown) */}
        <section className="lg:col-span-7 flex flex-col bg-[#e5e5dc] relative overflow-hidden h-[400px] lg:h-full">
          
          {/* Admin map */}
          <div ref={adminMapRef} className="flex-1 w-full h-full z-0 bg-[#e5e5dc]"></div>
          
          {/* Legend panel overlay */}
          <div className="absolute top-4 right-4 z-40 bg-white/95 backdrop-blur-sm border border-border-grey p-3 shadow-md w-[200px] font-data-sm text-[11px]">
            <strong className="block text-xs font-bold uppercase tracking-wider mb-2">Map Legend</strong>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-shelter-brown border border-white"></div>
                <span>🏡 Shelter</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-water-blue border border-white"></div>
                <span>💧 Water Point</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-medical-red border border-white"></div>
                <span>🏥 Medical Station</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-food-gold border border-white"></div>
                <span>🍲 Food Distribution</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-safe-green border border-white"></div>
                <span>🛡️ Safe Zone</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#C4453C] border-2 border-red-800 animate-pulse"></div>
                <span>⚠️ Hazard Zone</span>
              </div>
              <div className="border-t border-slate-200 my-2 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-dashed border-primary bg-slate-300 animate-pulse"></div>
                  <span>⚡ Pending Submissions</span>
                </div>
              </div>
            </div>
          </div>
          
        </section>

      </div>

    </div>
  );
}

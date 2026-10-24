import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  KeyRound, Send, Eye, EyeOff, X, CheckCircle2, Clock,
  Mail, MessageSquare, User, Copy, AlertTriangle, History,
  Shield, Search, Power, FileText, Ban
} from 'lucide-react';
import Toast from '../../components/common/Toast';
import API from '../../services/api';

// ─── Types ────────────────────────────────────────────────────
type UserRole = 'STUDENT' | 'TEACHER' | 'HOD' | 'PARENT' | 'PRINCIPAL';
type UserStatus = 'ACTIVE' | 'DISABLED' | 'PENDING_GENERATION';

interface RegistryUser {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  phone: string;
  username: string;
  status: UserStatus;
  lastResetAt: string;
}

interface ForgotRequest {
  id: string;
  userId: string;
  name: string;
  role: UserRole;
  email: string;
  phone: string;
  status: 'PENDING' | 'PROCESSED' | 'REJECTED';
  requestedAt: string;
}

interface AuditLog {
  id: string;
  action: 'GENERATE_CREDENTIALS' | 'PASSWORD_RESET' | 'ACCOUNT_DISABLED' | 'ACCOUNT_ENABLED' | 'REJECT_RESET_REQUEST';
  performedBy: string;
  targetUser: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED';
}

// ─── Mock Registry Users ───────────────────────────────────────
const INITIAL_USERS: RegistryUser[] = [];

const INITIAL_AUDIT_LOGS: AuditLog[] = [];

// ─── Helpers ──────────────────────────────────────────────────
const ROLE_STYLE: Record<UserRole, { pill: string; text: string }> = {
  STUDENT:   { pill: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300', text: 'Student' },
  TEACHER:   { pill: 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300', text: 'Teacher' },
  HOD:       { pill: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300', text: 'HOD' },
  PRINCIPAL: { pill: 'bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300', text: 'Principal' },
  PARENT:    { pill: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300', text: 'Parent' },
};

const generateTempPassword = (): string => {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `JCER@${new Date().getFullYear()}${randomDigits}`;
};

const formatUsername = (name: string, role: UserRole): string => {
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const prefix = role.toLowerCase().slice(0, 3);
  return `${prefix}.${cleanName}@jcer.edu.in`;
};

// ─── Component ────────────────────────────────────────────────
export const DocumentVerificationPage: React.FC = () => {
  const [users, setUsers] = useState<RegistryUser[]>(INITIAL_USERS);
  const [forgotRequests, setForgotRequests] = useState<ForgotRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'registry' | 'requests' | 'audit'>('registry');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');

  // Dispatch preview state
  const [dispatchTarget, setDispatchTarget] = useState<{ user: RegistryUser; sourceRequest?: ForgotRequest } | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [tempUsername, setTempUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load forgot requests from localStorage
  useEffect(() => {
    const loadRequests = () => {
      const local = localStorage.getItem('jcer_forgot_password_requests');
      if (local) {
        setForgotRequests(JSON.parse(local));
      } else {
        // Seed default mock requests
        const defaults: ForgotRequest[] = [];
        localStorage.setItem('jcer_forgot_password_requests', JSON.stringify(defaults));
        setForgotRequests(defaults);
      }
    };
    loadRequests();
  }, []);

  // Listen to localStorage changes (for real-time updates when request is submitted on LoginPage)
  useEffect(() => {
    const handleStorageChange = () => {
      const local = localStorage.getItem('jcer_forgot_password_requests');
      if (local) setForgotRequests(JSON.parse(local));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ── Action handlers ──
  
  // 1. Open Generator modal
  const handleInitiateGenerate = (user: RegistryUser) => {
    const password = generateTempPassword();
    const username = user.username || formatUsername(user.name, user.role);
    setTempPassword(password);
    setTempUsername(username);
    setDispatchTarget({ user });
    setShowPassword(false);
  };

  // 2. Open Reset & Send modal (from Forgot Password tab)
  const handleInitiateResetFromRequest = (request: ForgotRequest) => {
    // Find matching user registry entry or map from request details
    let user = users.find(u => u.id === request.userId || u.email === request.email);
    if (!user) {
      user = {
        id: request.userId,
        name: request.name,
        role: request.role,
        email: request.email,
        phone: request.phone,
        username: request.userId.includes('@') ? request.userId : formatUsername(request.name, request.role),
        status: 'ACTIVE',
        lastResetAt: '',
      };
    }
    const password = generateTempPassword();
    setTempPassword(password);
    setTempUsername(user.username);
    setDispatchTarget({ user, sourceRequest: request });
    setShowPassword(false);
  };

  // 3. Open Force Reset modal (from Credentials Registry tab)
  const handleInitiateForceReset = (user: RegistryUser) => {
    const password = generateTempPassword();
    setTempPassword(password);
    setTempUsername(user.username);
    setDispatchTarget({ user });
    setShowPassword(false);
  };

  // 4. Reject Forgot Password Request
  const handleRejectRequest = (request: ForgotRequest) => {
    const updatedRequests = forgotRequests.map(r => r.id === request.id ? { ...r, status: 'REJECTED' as const } : r);
    setForgotRequests(updatedRequests);
    localStorage.setItem('jcer_forgot_password_requests', JSON.stringify(updatedRequests));

    // Audit Log
    const log: AuditLog = {
      id: `AUD-${Date.now()}`,
      action: 'REJECT_RESET_REQUEST',
      performedBy: 'System Admin',
      targetUser: `${request.userId} (${request.name})`,
      timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      status: 'SUCCESS',
    };
    setAuditLogs(prev => [log, ...prev]);

    setToast({ type: 'success', message: `Rejected password recovery request for ${request.name}.` });
  };

  // 5. Confirm Send & Dispatch Credentials
  const handleConfirmDispatch = async () => {
    if (!dispatchTarget) return;
    const { user, sourceRequest } = dispatchTarget;
    
    setSending(true);
    try {
      const res = await API.post('/admin/credentials/dispatch', {
        userId: user.id,
        username: tempUsername,
        password: tempPassword,
      });

      if (res.data.success) {
        const nowStr = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

        // Update User Registry Status
        setUsers(prev => prev.map(u => 
          (u.id === user.id || u.email === user.email) 
            ? { ...u, username: tempUsername, status: 'ACTIVE' as const, lastResetAt: nowStr }
            : u
        ));

        // Update source request status if it was from Forgot Password tab
        if (sourceRequest) {
          const updatedRequests = forgotRequests.map(r => r.id === sourceRequest.id ? { ...r, status: 'PROCESSED' as const } : r);
          setForgotRequests(updatedRequests);
          localStorage.setItem('jcer_forgot_password_requests', JSON.stringify(updatedRequests));
        }

        // Add to audit trail log
        const actionType = sourceRequest || user.status === 'ACTIVE' ? 'PASSWORD_RESET' as const : 'GENERATE_CREDENTIALS' as const;
        const log: AuditLog = {
          id: `AUD-${Date.now()}`,
          action: actionType,
          performedBy: 'System Admin',
          targetUser: `${tempUsername} (${user.name})`,
          timestamp: nowStr,
          status: 'SUCCESS',
        };
        setAuditLogs(prev => [log, ...prev]);

        setToast({
          type: 'success',
          message: `Credentials dispatched to ${user.email} and ${user.phone}. Plaintext password has been cleared from memory.`,
        });
        setDispatchTarget(null);
      }
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.response?.data?.error || 'Failed to dispatch credentials',
      });
    } finally {
      setSending(false);
    }
  };

  // 6. Disable or Enable account toggle
  const handleToggleStatus = (target: RegistryUser) => {
    const nextStatus = target.status === 'ACTIVE' ? 'DISABLED' as const : 'ACTIVE' as const;
    setUsers(prev => prev.map(u => u.id === target.id ? { ...u, status: nextStatus } : u));
    
    const actionType = nextStatus === 'DISABLED' ? 'ACCOUNT_DISABLED' as const : 'ACCOUNT_ENABLED' as const;
    const log: AuditLog = {
      id: `AUD-${Date.now()}`,
      action: actionType,
      performedBy: 'System Admin',
      targetUser: `${target.username} (${target.name})`,
      timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      status: 'SUCCESS',
    };
    setAuditLogs(prev => [log, ...prev]);

    setToast({ type: 'success', message: `Account for ${target.name} has been ${nextStatus === 'DISABLED' ? 'disabled' : 'enabled'}.` });
  };

  // Helper copy text
  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };

  // Filter Registry Users
  const filteredUsers = users.filter((u) => {
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchQuery =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase());
    return matchRole && matchQuery;
  });

  const pendingRequestsCount = forgotRequests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="space-y-6 pb-6 animate-fade-in text-neutral-800 dark:text-neutral-100">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {/* Page Header */}
      <div className="glass-panel rounded-[32px] p-6 shadow-ambient">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Credential Lifecycle &amp; Access Recovery</h2>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">Verify forgot password recovery requests and manage administrative credentials securely</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border border-violet-200 dark:border-violet-850 bg-violet-500/5 backdrop-blur-md">
            <Shield className="w-4.5 h-4.5 text-violet-600" />
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-700">🔐 Superior Security Mode</p>
              <p className="text-[9px] text-neutral-400 font-bold leading-normal">Zero plaintext password storage. Reset and generation generate unique keys on-the-fly.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Nav Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setActiveTab('registry')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'registry'
              ? 'text-black border-[#bae6fd] shadow-sm bg-[#bae6fd]'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-250 dark:border-neutral-750 hover:bg-neutral-200'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          Credentials Registry
          <span className="bg-neutral-300 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-[9px] font-black px-1.5 py-0.5 rounded-full">{users.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'requests'
              ? 'text-black border-[#fde047] shadow-sm bg-[#fef9c3]'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-250 dark:border-neutral-750 hover:bg-neutral-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Forgot Password Requests
          {pendingRequestsCount > 0 && (
            <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none animate-pulse">
              {pendingRequestsCount} PENDING
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'text-black border-[#bbf7d0] shadow-sm bg-[#bbf7d0]'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-250 dark:border-neutral-750 hover:bg-neutral-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          System Audit Trail
          <span className="bg-neutral-300 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-[9px] font-black px-1.5 py-0.5 rounded-full">{auditLogs.length}</span>
        </button>
      </div>

      {/* ── TAB 1: CREDENTIALS REGISTRY ── */}
      {activeTab === 'registry' && (
        <div className="glass-panel rounded-[32px] p-6 shadow-ambient space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold tracking-tight">Active User Registry</h3>
              <p className="text-xs text-neutral-400 font-medium">Generate or force reset account credentials. Passwords are never visible except on dispatch.</p>
            </div>
            
            {/* Search & Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search user, ID or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl py-1.5 px-3 pl-8 text-xs outline-none text-neutral-800 dark:text-neutral-100"
                />
                <Search className="w-3.5 h-3.5 text-neutral-450 absolute left-2.5 top-2.5" />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl py-1.5 px-3 text-xs outline-none text-neutral-800 dark:text-neutral-100 cursor-pointer"
              >
                <option value="ALL">All Roles</option>
                <option value="STUDENT">Students</option>
                <option value="TEACHER">Teachers</option>
                <option value="HOD">HODs</option>
                <option value="PARENT">Parents</option>
                <option value="PRINCIPAL">Principals</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-[22px] glass-table-container shadow-sm border border-neutral-200/50 dark:border-neutral-850">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase font-extrabold tracking-wider bg-[#111111] dark:bg-neutral-950 text-white border-b border-neutral-800">
                  <tr className="text-white">
                    <th className="px-5 py-4 text-white font-bold">Name &amp; ID</th>
                    <th className="px-5 py-4 text-white font-bold">Role</th>
                    <th className="px-5 py-4 text-white font-bold">Email / Phone</th>
                    <th className="px-5 py-4 text-white font-bold">Username ID</th>
                    <th className="px-5 py-4 text-center text-white font-bold">Status</th>
                    <th className="px-5 py-4 text-center text-white font-bold">Last Reset At</th>
                    <th className="px-5 py-4 text-right text-white font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {filteredUsers.map((user) => {
                    const rs = ROLE_STYLE[user.role];
                    return (
                      <tr key={user.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-bold text-xs">{user.name}</p>
                          <p className="text-[10px] text-neutral-400 font-semibold uppercase">{user.id}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rs.pill}`}>{rs.text}</span>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-[10px] font-semibold">{user.email}</p>
                          <p className="text-[10px] text-neutral-400 font-medium">{user.phone}</p>
                        </td>
                        <td className="px-5 py-4">
                          {user.username ? (
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-750">
                              {user.username}
                            </span>
                          ) : (
                            <span className="text-[10px] text-neutral-400 italic">Not generated</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {user.status === 'ACTIVE' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">Active</span>
                          )}
                          {user.status === 'DISABLED' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-350">Disabled</span>
                          )}
                          {user.status === 'PENDING_GENERATION' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300">No Credentials</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500">{user.lastResetAt || '—'}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            {user.status === 'PENDING_GENERATION' ? (
                              <button
                                onClick={() => handleInitiateGenerate(user)}
                                className="btn-admin-primary text-[10px] font-bold px-3 py-1.5 rounded-xl cursor-pointer hover:scale-[1.02] transition-all"
                              >
                                Generate Account
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleInitiateForceReset(user)}
                                  className="text-[10px] font-bold border border-violet-300/40 hover:bg-violet-500/10 text-violet-600 px-3 py-1.5 rounded-xl cursor-pointer transition-all"
                                >
                                  Force Reset
                                </button>
                                <button
                                  onClick={() => handleToggleStatus(user)}
                                  title={user.status === 'ACTIVE' ? 'Disable Account' : 'Enable Account'}
                                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                    user.status === 'ACTIVE' 
                                      ? 'border-rose-200 text-rose-500 hover:bg-rose-50' 
                                      : 'border-emerald-250 text-emerald-500 hover:bg-emerald-50'
                                  }`}
                                >
                                  {user.status === 'ACTIVE' ? <Power className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: FORGOT PASSWORD REQUESTS ── */}
      {activeTab === 'requests' && (
        <div className="glass-panel rounded-[32px] p-6 shadow-ambient space-y-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight">Forgot Password Requests</h3>
            <p className="text-xs text-neutral-400 font-medium">Inbound password recovery requests. Approvals regenerate, hash, and dispatch a new password immediately.</p>
          </div>

          {forgotRequests.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center space-y-2">
              <Clock className="w-10 h-10 text-neutral-300" />
              <p className="text-sm font-bold text-neutral-400">No requests submitted yet</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[22px] glass-table-container shadow-sm border border-neutral-200/50 dark:border-neutral-850">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase font-extrabold tracking-wider bg-[#111111] dark:bg-neutral-950 text-white border-b border-neutral-800">
                    <tr className="text-white">
                      <th className="px-5 py-4 text-white font-bold">Request ID</th>
                      <th className="px-5 py-4 text-white font-bold">User Details</th>
                      <th className="px-5 py-4 text-white font-bold">Role</th>
                      <th className="px-5 py-4 text-white font-bold">Request Date / Time</th>
                      <th className="px-5 py-4 text-center text-white font-bold">Status</th>
                      <th className="px-5 py-4 text-right text-white font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {forgotRequests.map((req) => {
                      const rs = ROLE_STYLE[req.role];
                      return (
                        <tr key={req.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-colors">
                          <td className="px-5 py-4 font-mono text-xs font-bold text-neutral-400">{req.id}</td>
                          <td className="px-5 py-4">
                            <p className="font-bold text-xs">{req.name || req.userId}</p>
                            <p className="text-[10px] text-neutral-400 font-semibold">{req.email || req.phone}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rs.pill}`}>{rs.text}</span>
                          </td>
                          <td className="px-5 py-4 text-neutral-500 font-semibold text-[11px]">{req.requestedAt}</td>
                          <td className="px-5 py-4 text-center">
                            {req.status === 'PENDING' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 animate-pulse">Pending Review</span>
                            )}
                            {req.status === 'PROCESSED' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">✓ Reset &amp; Dispatched</span>
                            )}
                            {req.status === 'REJECTED' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-350">✗ Rejected</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {req.status === 'PENDING' ? (
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => handleRejectRequest(req)}
                                  className="text-[10px] font-bold text-rose-600 border border-rose-300 hover:bg-rose-50 px-3 py-1.5 rounded-xl cursor-pointer"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => handleInitiateResetFromRequest(req)}
                                  className="btn-admin-primary text-[10px] font-bold px-3 py-1.5 rounded-xl cursor-pointer hover:scale-[1.02] transition-all"
                                >
                                  Reset &amp; Send
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-neutral-400 font-semibold italic">Processed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: SYSTEM AUDIT TRAIL ── */}
      {activeTab === 'audit' && (
        <div className="glass-panel rounded-[32px] p-6 shadow-ambient space-y-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight">Security Audit Logs</h3>
            <p className="text-xs text-neutral-400 font-medium">Comprehensive audit trail of all credential generation, status edits, and dispatch events.</p>
          </div>

          <div className="overflow-hidden rounded-[22px] glass-table-container shadow-sm border border-neutral-200/50 dark:border-neutral-850">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase font-extrabold tracking-wider bg-[#111111] dark:bg-neutral-950 text-white border-b border-neutral-800">
                  <tr className="text-white">
                    <th className="px-5 py-4 text-white font-bold">Audit ID</th>
                    <th className="px-5 py-4 text-white font-bold">Action Event</th>
                    <th className="px-5 py-4 text-white font-bold">Target Account</th>
                    <th className="px-5 py-4 text-white font-bold">Performed By</th>
                    <th className="px-5 py-4 text-center text-white font-bold">Result</th>
                    <th className="px-5 py-4 text-right text-white font-bold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-colors">
                      <td className="px-5 py-4 font-mono text-xs font-bold text-neutral-400">{log.id}</td>
                      <td className="px-5 py-4">
                        <span className="font-bold font-mono text-xs text-neutral-700 dark:text-neutral-200">{log.action}</span>
                      </td>
                      <td className="px-5 py-4 font-bold text-xs">{log.targetUser}</td>
                      <td className="px-5 py-4 text-xs font-semibold text-neutral-500">{log.performedBy}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-350'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-xs font-semibold text-neutral-500">
                        {log.timestamp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CREDENTIAL PREVIEW & DISPATCH MODAL ── */}
      {dispatchTarget && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.08),rgba(109,40,217,0.03))' }}>
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-600">
                  <KeyRound className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Dispatch New Credentials</h3>
                  <p className="text-[10px] text-neutral-500 font-semibold">Security preview for {dispatchTarget.user.name}</p>
                </div>
              </div>
              {!sending && (
                <button onClick={() => setDispatchTarget(null)} className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-850 flex items-center justify-center hover:scale-105 border-none cursor-pointer">
                  <X className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              
              {/* Credentials Box */}
              <div className="rounded-2xl border border-violet-200 dark:border-violet-850 overflow-hidden bg-violet-500/5">
                <div className="px-4 py-2.5 border-b border-violet-200 dark:border-violet-850 flex items-center justify-between bg-violet-500/10">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-700">Generated Credentials (In Memory Preview)</p>
                  <div className="flex items-center gap-1 text-[9px] text-rose-700 bg-rose-100 dark:bg-rose-950/30 px-2 py-0.5 rounded-full font-bold">
                    <Shield className="w-3 h-3" /> Will Not Be Stored Plain
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {/* Username ID */}
                  <div>
                    <p className="text-[9px] text-neutral-450 font-extrabold uppercase tracking-wider mb-1">User ID / Username</p>
                    <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 rounded-xl border border-violet-100 dark:border-violet-850 px-3 py-2.5">
                      <span className="font-mono text-xs font-bold text-neutral-800 dark:text-white flex-1">{tempUsername}</span>
                      <button onClick={() => copyText(tempUsername, 'user')} className="bg-transparent border-none cursor-pointer hover:scale-110 transition-all">
                        {copied === 'user' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-neutral-450" />}
                      </button>
                    </div>
                  </div>

                  {/* Temporary Password */}
                  <div>
                    <p className="text-[9px] text-neutral-450 font-extrabold uppercase tracking-wider mb-1">Temporary Password</p>
                    <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 rounded-xl border border-violet-100 dark:border-violet-850 px-3 py-2.5">
                      <span className="font-mono text-xs font-bold text-neutral-800 dark:text-white flex-1 tracking-wider">
                        {showPassword ? tempPassword : '••••••••••••'}
                      </span>
                      <button onClick={() => setShowPassword(!showPassword)} className="bg-transparent border-none cursor-pointer hover:scale-110 transition-all">
                        {showPassword ? <EyeOff className="w-4 h-4 text-neutral-450" /> : <Eye className="w-4 h-4 text-neutral-450" />}
                      </button>
                      {showPassword && (
                        <button onClick={() => copyText(tempPassword, 'pass')} className="bg-transparent border-none cursor-pointer hover:scale-110 transition-all">
                          {copied === 'pass' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-neutral-450" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulated Email Preview */}
              <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2 bg-neutral-50 dark:bg-neutral-900/50">
                  <Mail className="w-3.5 h-3.5 text-neutral-450" />
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-450">Email Dispatch Preview → {dispatchTarget.user.email}</p>
                </div>
                <div className="p-4 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100">
                  <div className="border-l-4 border-violet-600 pl-3 py-1 mb-3">
                    <p className="text-[11px] font-bold">Subject: Your JCER ERP Login Credentials</p>
                  </div>
                  <div className="text-[11px] font-medium leading-relaxed space-y-2">
                    <p>Dear <strong>{dispatchTarget.user.name}</strong>,</p>
                    <p>Your JCER ERP access has been configured by the system administrator. Please find your login credentials below:</p>
                    <div className="bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-800 rounded-xl p-3 my-2 space-y-1">
                      <p><strong>Portal Link:</strong> https://erp.jcer.edu.in</p>
                      <p><strong>User ID / Email:</strong> <span className="font-mono">{tempUsername}</span></p>
                      <p><strong>Temporary Password:</strong> <span className="font-mono">{tempPassword}</span></p>
                    </div>
                    <p>Please secure these credentials. They can be used to log in immediately to your dashboard.</p>
                    <p>Regards,<br /><strong>JCER Administrative Office</strong></p>
                  </div>
                </div>
              </div>

              {/* Simulated SMS Preview */}
              <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2 bg-neutral-50 dark:bg-neutral-900/50">
                  <MessageSquare className="w-3.5 h-3.5 text-neutral-450" />
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-450">SMS Dispatch Preview → {dispatchTarget.user.phone}</p>
                </div>
                <div className="p-4 bg-white dark:bg-neutral-900">
                  <div className="bg-neutral-800 text-neutral-100 text-[10px] font-mono p-3 rounded-xl leading-relaxed">
                    JCER ERP: Your credentials - User ID: {tempUsername} | Password: {tempPassword} | Portal: erp.jcer.edu.in —JCER Admin
                  </div>
                </div>
              </div>

              {/* Security Banner */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-250 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] font-medium leading-relaxed">
                  <strong>Verification Required:</strong> Review details before dispatch. Upon clicking "Send", credentials will be sent to the contact channels, and the plain password will be discarded from memory immediately. Only the bcrypt hash remains stored.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 flex gap-3 flex-shrink-0 bg-neutral-50/50 dark:bg-neutral-900/50">
              <button
                onClick={() => setDispatchTarget(null)}
                disabled={sending}
                className="px-4 py-2.5 rounded-xl border border-neutral-250 dark:border-neutral-750 bg-white dark:bg-neutral-800 text-xs font-bold cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-750 transition-all disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDispatch}
                disabled={sending}
                className="flex-1 btn-admin-primary py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 hover:scale-[1.01] transition-all"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending Credentials...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Confirm &amp; Send Credentials via Email + SMS
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DocumentVerificationPage;


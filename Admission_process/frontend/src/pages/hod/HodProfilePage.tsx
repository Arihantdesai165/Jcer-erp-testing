import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { updateUser } from '../../store/authSlice';
import { toast } from 'react-toastify';
import API from '../../services/api';
import { ProfileAvatar } from '../../components/common/ProfileAvatar';
import {
  User,
  Lock,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Key,
  Clock,
  Camera,
  Loader2,
  Shield,
  Phone,
  Mail,
  UserCheck,
} from 'lucide-react';
import hodService from '../../services/hod.service';

export const HodProfilePage: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  const [profileData, setProfileData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Avatar Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Profile Form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB.');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setUploadingImage(true);
    try {
      const res = await API.post('/auth/profile-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success && res.data?.data?.profileImage) {
        const newUrl = res.data.data.profileImage;
        dispatch(updateUser({ profileImage: newUrl }));
        toast.success('🎉 Profile picture updated successfully!');
        fetchProfile();
      } else {
        toast.error('Failed to upload profile picture.');
      }
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      toast.error(err.response?.data?.error || 'Failed to upload profile picture.');
    } finally {
      setUploadingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await hodService.getProfile();
      setProfileData(data);
      if (data?.profile) {
        setFirstName(data.profile.firstName || (data.profile.name || '').split(' ')[0] || '');
        setLastName(data.profile.lastName || (data.profile.name || '').split(' ').slice(1).join(' ') || '');
        setPhone(data.profile.phone || '');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      // Fallback to auth user state
      if (user) {
        setFirstName(user.firstName || '');
        setLastName(user.lastName || '');
        setPhone((user as any).phone || '');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      await hodService.updateProfile({ firstName, lastName, phone });
      setProfileMsg('Profile information updated successfully.');
      dispatch(updateUser({ firstName, lastName, name: `${firstName} ${lastName}`.trim() }));
      toast.success('Profile details saved successfully.');
      fetchProfile();
    } catch (err: any) {
      const errText = err?.response?.data?.error || 'Failed to update profile.';
      setProfileMsg(errText);
      toast.error(errText);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New password and confirmation password do not match.' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }

    setSavingPassword(true);
    try {
      await hodService.updatePassword({ currentPassword, newPassword });
      setPasswordMsg({ type: 'success', text: 'Password changed successfully.' });
      toast.success('Security password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const errText = err?.response?.data?.error || 'Failed to update password. Please check your current password.';
      setPasswordMsg({
        type: 'error',
        text: errText,
      });
      toast.error(errText);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-xs">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              My Profile
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Manage your personal credentials, contact details, profile photograph, and security authentication password.
            </p>
          </div>
        </div>
      </div>

      {/* ── Assigned Department Scope (Locked Context Card) ────────────────────── */}
      <div className="glass-card rounded-3xl p-6 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>Assigned Department Scope</span>
          </h2>
          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-indigo-600 text-white shadow-xs">
            <Lock className="w-3 h-3" /> PERMANENTLY LOCKED
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 font-medium block">Department Name:</span>
              <strong className="text-slate-900 dark:text-white text-sm">
                {profileData?.department?.name || user?.department?.name || 'Head of Department'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">Department Code:</span>
              <strong className="text-slate-900 dark:text-white font-mono text-sm">
                {profileData?.department?.code || user?.department?.code || 'AS'}
              </strong>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
            Note: HOD accounts are strictly scoped to their appointed department. To transfer departments or change institution codes, contact the Dean Academics or Super Admin.
          </p>
        </div>
      </div>

      {/* ── Two Column Forms: Personal Profile & Change Password ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Personal Profile Details Form */}
        <form onSubmit={handleUpdateProfile} className="glass-card rounded-3xl p-6 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <span>Personal Profile</span>
          </h3>

          {/* Profile Photo Upload */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/60 text-center gap-3">
            <div className="relative group">
              <ProfileAvatar
                imageUrl={profileData?.profile?.profileImage || user?.profileImage}
                name={`${firstName} ${lastName}`.trim() || user?.name || 'HOD'}
                size="2xl"
                className="w-24 h-24 rounded-2xl border-2 border-white dark:border-slate-700 shadow-md object-cover"
              />
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={uploadingImage}
                title="Change Profile Photo"
                className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-800 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {uploadingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={uploadingImage}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline cursor-pointer inline-flex items-center gap-1.5"
              >
                {uploadingImage ? 'Uploading...' : 'Change Photo'}
              </button>
              <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, or WEBP (max 5MB)</p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/jpeg,image/png,image/webp,image/jpg"
              className="hidden"
            />
          </div>

          {profileMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>{profileMsg}</span>
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">First Name</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Email (Read Only)</label>
              <input
                type="email"
                disabled
                value={profileData?.profile?.email || user?.email || ''}
                className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border text-slate-500 font-mono cursor-not-allowed"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 XXXXX XXXXX"
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {savingProfile ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </form>

        {/* Change Password Form */}
        <form onSubmit={handleUpdatePassword} className="glass-card rounded-3xl p-6 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-600" />
            <span>Change Security Password</span>
          </h3>

          {passwordMsg && (
            <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              passwordMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
            }`}>
              {passwordMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{passwordMsg.text}</span>
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">New Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingPassword}
            className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {savingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* ── Recent HOD Activity Audit Logs ───────────────────────────────────── */}
      <div className="glass-card rounded-3xl p-6 border border-white/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80 space-y-3">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          <span>Recent Administrative Activity Log</span>
        </h3>

        {profileData?.auditLogs && profileData.auditLogs.length > 0 ? (
          <div className="space-y-2">
            {profileData.auditLogs.map((log: any) => (
              <div key={log.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{log.action}</p>
                  <p className="text-[10px] text-slate-400">IP: {log.ipAddress || '127.0.0.1'}</p>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No recent activity recorded.</p>
        )}
      </div>
    </div>
  );
};

export default HodProfilePage;

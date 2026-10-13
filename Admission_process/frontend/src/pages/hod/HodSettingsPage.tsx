import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { updateUser } from '../../store/authSlice';
import { toast } from 'react-toastify';
import API from '../../services/api';
import { ProfileAvatar } from '../../components/common/ProfileAvatar';
import UpdateEmailModal from '../../components/profile/UpdateEmailModal';
import hodService from '../../services/hod.service';
import {
  User,
  Mail,
  Phone,
  Lock,
  Camera,
  Building,
  Building2,
  Loader2,
  Eye,
  EyeOff,
  Edit2,
  Check,
  X,
  ShieldCheck,
  Award,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const HodSettingsPage: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  const [settingsData, setSettingsData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Profile Form States
  const [phone, setPhone] = useState(user?.phone || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || user?.name?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '');
  const [savingName, setSavingName] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  // Password Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await hodService.getSettings();
      setSettingsData(data);
      if (data?.profile) {
        if (!phone && data.profile.phone) setPhone(data.profile.phone);
        if (!isEditingName) {
          const parts = (data.profile.name || user?.name || '').trim().split(/\s+/);
          if (!firstName) setFirstName(user?.firstName || parts[0] || '');
          if (!lastName && parts.length > 1) setLastName(user?.lastName || parts.slice(1).join(' '));
        }
      }
    } catch (err) {
      console.error('Failed to load HOD settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (user) {
      if (user.phone && !phone) setPhone(user.phone);
      if (!isEditingName) {
        const parts = (user.name || '').trim().split(/\s+/);
        setFirstName(user.firstName || parts[0] || '');
        setLastName(user.lastName !== undefined ? user.lastName : parts.slice(1).join(' '));
      }
    }
  }, [user, isEditingName]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (PNG, JPG, JPEG, WEBP).');
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

  const handleSaveName = async () => {
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanFullName = `${cleanFirst} ${cleanLast}`.trim();

    if (!cleanFirst) {
      toast.error('First name cannot be empty.');
      return;
    }
    if (cleanFullName.length < 2) {
      toast.error('Full name must be at least 2 characters.');
      return;
    }
    if (cleanFullName.length > 100) {
      toast.error('Full name cannot exceed 100 characters.');
      return;
    }

    setSavingName(true);
    try {
      await hodService.updateProfile({
        firstName: cleanFirst,
        lastName: cleanLast,
      });

      dispatch(updateUser({
        firstName: cleanFirst,
        lastName: cleanLast,
        name: cleanFullName,
      }));
      setIsEditingName(false);
      toast.success('🎉 Profile name updated successfully!');
      fetchSettings();
    } catch (err: any) {
      console.error('Failed to update name:', err);
      toast.error(err.response?.data?.error || 'Failed to update profile name.');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const cleanFirst = firstName.trim();
      const cleanLast = lastName.trim();
      const cleanFullName = `${cleanFirst} ${cleanLast}`.trim();

      await hodService.updateProfile({
        phone: phone.trim(),
        firstName: cleanFirst || undefined,
        lastName: cleanLast || undefined,
      });

      dispatch(updateUser({
        phone: phone.trim(),
        firstName: cleanFirst || undefined,
        lastName: cleanLast || undefined,
        name: cleanFullName || undefined,
      }));

      toast.success('🎉 Profile changes saved successfully!');
      fetchSettings();
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      toast.error(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      const msg = 'New password and confirm password do not match.';
      setPasswordMsg({ type: 'error', text: msg });
      toast.error(msg);
      return;
    }

    if (newPassword.length < 8) {
      const msg = 'New password must be at least 8 characters long.';
      setPasswordMsg({ type: 'error', text: msg });
      toast.error(msg);
      return;
    }

    setSavingPassword(true);
    try {
      await hodService.updatePassword({ currentPassword, newPassword });
      setPasswordMsg({ type: 'success', text: 'Password updated successfully!' });
      toast.success('🔒 Access credentials updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const errText = err?.response?.data?.error || 'Failed to update password. Please check your current password.';
      setPasswordMsg({ type: 'error', text: errText });
      toast.error(errText);
    } finally {
      setSavingPassword(false);
    }
  };

  const deptName = settingsData?.department?.name || user?.department?.name || 'Computer Science & Engineering';
  const deptCode = settingsData?.department?.code || user?.department?.code || 'CSE';
  const displayName = user?.name || `${firstName} ${lastName}`.trim() || 'Head of Department';

  return (
    <div className="space-y-6 pb-8">
      {/* Hidden File Input for Avatar Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarChange}
        accept="image/*"
        className="hidden"
      />

      {/* ── Page Header Notice ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
            HOD Profile & Department Settings
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Manage your official profile photo, personal information, locked department credentials, and portal security
          </p>
        </div>
      </div>

      {/* ── Two-Column Main Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── LEFT PROFILE CARD (5 cols) ── */}
        <div className="lg:col-span-5 rounded-[32px] p-6 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-col items-center justify-between text-center space-y-6">
          <div className="space-y-4 w-full flex flex-col items-center">
            
            {/* Avatar with Camera Overlay */}
            <div className="relative">
              <ProfileAvatar
                imageUrl={user?.profileImage}
                name={displayName}
                size="2xl"
                className="w-28 h-28 rounded-[28px] object-cover border-4 border-violet-500/20 dark:border-neutral-800 shadow-md"
              />
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={uploadingImage}
                title="Change Profile Picture"
                className="absolute bottom-1 right-1 w-8 h-8 bg-neutral-900 text-white rounded-full flex items-center justify-center border border-white/20 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg disabled:opacity-50"
              >
                {uploadingImage ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Role Badge and Name */}
            <div className="w-full">
              <span className="px-3 py-1 bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 rounded-full text-xs font-black uppercase inline-flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" />
                HEAD OF DEPARTMENT
              </span>

              {!isEditingName ? (
                <div className="mt-2 flex flex-col items-center justify-center">
                  <div className="flex items-center justify-center gap-2">
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                      {displayName}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingName(true);
                        const parts = (user?.name || '').trim().split(/\s+/);
                        setFirstName(user?.firstName || parts[0] || '');
                        setLastName(user?.lastName !== undefined ? user?.lastName : parts.slice(1).join(' '));
                      }}
                      className="p-1.5 text-neutral-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Edit Profile Name"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-semibold mt-0.5">
                    Department of {deptName} ({deptCode})
                  </p>
                </div>
              ) : (
                <div className="w-full mt-3 p-4 bg-violet-50/60 dark:bg-violet-950/30 border border-violet-200/80 dark:border-violet-800/60 rounded-2xl space-y-3 animate-fade-in text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-400 flex items-center gap-1.5">
                      <Edit2 size={12} /> Edit Display Name
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(false)}
                      className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">First Name *</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First Name"
                        className="w-full px-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold focus:outline-none focus:border-violet-500 text-neutral-900 dark:text-white"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Last Name</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Last Name"
                        className="w-full px-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold focus:outline-none focus:border-violet-500 text-neutral-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingName(false)}
                      disabled={savingName}
                      className="px-3 py-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveName}
                      disabled={savingName}
                      className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      {savingName ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check size={13} />}
                      <span>Save Name</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Institutional, Contact & Department Scope Details */}
          <div className="w-full bg-neutral-50 dark:bg-neutral-800/30 rounded-2xl p-4 text-xs space-y-3.5 text-left border border-neutral-200/60 dark:border-neutral-800">
            
            {/* Institution */}
            <div className="flex items-start space-x-2 text-neutral-600 dark:text-neutral-300">
              <Building className="w-4 h-4 text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Institution</p>
                <p className="font-bold text-neutral-800 dark:text-neutral-200">Jain College of Engineering & Research, Belagavi</p>
              </div>
            </div>

            {/* Email Address with Update Action */}
            <div className="flex items-center justify-between space-x-2 text-neutral-600 dark:text-neutral-300">
              <div className="flex items-center space-x-2 min-w-0">
                <Mail className="w-4 h-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Email Address</p>
                  <p className="font-bold text-neutral-800 dark:text-neutral-200 truncate">{user?.email || settingsData?.profile?.email || 'hod@jcer.edu'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(true)}
                className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/60 dark:hover:bg-violet-900/60 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800/80 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex-shrink-0 shadow-sm"
              >
                Update Email
              </button>
            </div>

            {/* Mobile Number */}
            <div className="flex items-center space-x-2 text-neutral-600 dark:text-neutral-300">
              <Phone className="w-4 h-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
              <div className="w-full">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Mobile Number</p>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full mt-0.5 px-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {/* Assigned Department Scope (Locked) */}
            <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Assigned Department Scope</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-neutral-900 dark:bg-neutral-800 text-white shadow-xs">
                  <Lock className="w-2.5 h-2.5 text-violet-400" /> PERMANENTLY LOCKED
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-700/80">
                <div>
                  <span className="text-[10px] text-neutral-400 block font-medium">Department Name</span>
                  <span className="font-bold text-xs text-neutral-800 dark:text-neutral-200 truncate block">
                    {deptName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 block font-medium">Department Code</span>
                  <span className="font-mono font-bold text-xs text-violet-600 dark:text-violet-400 block">
                    {deptCode}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed italic">
                Note: HOD accounts are strictly scoped to their appointed department. To transfer departments or change institution codes, contact the Dean Academics or Super Admin.
              </p>
            </div>

          </div>

          {/* Save Profile Changes Action */}
          <div className="w-full">
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Save Profile Changes</span>
            </button>
          </div>
        </div>

        {/* ── RIGHT SECURITY CARD (7 cols) ── */}
        <div className="lg:col-span-7 rounded-[32px] p-6 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-2.5 mb-6 border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <ShieldCheck className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              <div>
                <h3 className="font-extrabold text-neutral-900 dark:text-white text-md">
                  SECURITY & CREDENTIALS MANAGEMENT
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Manage your HOD portal login password and account credentials
                </p>
              </div>
            </div>

            {passwordMsg && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  passwordMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {passwordMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4 text-xs">
              
              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    placeholder="Enter your current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:border-violet-500 text-neutral-900 dark:text-white font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Enter new password (min. 8 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:border-violet-500 text-neutral-900 dark:text-white font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:border-violet-500 text-neutral-900 dark:text-white font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="py-3 px-6 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {savingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock size={14} />}
                  <span>Update Access Credentials</span>
                </button>
              </div>
            </form>
          </div>

          {/* ── Recent Administrative Activity Log ── */}
          <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              <span>Recent Administrative Activity Log</span>
            </h4>

            {settingsData?.auditLogs && settingsData.auditLogs.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {settingsData.auditLogs.slice(0, 5).map((log: any) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 text-[11px] flex items-center justify-between"
                  >
                    <div className="truncate pr-2">
                      <p className="font-bold text-neutral-800 dark:text-neutral-200 truncate">{log.action}</p>
                      <p className="text-[10px] text-neutral-400">IP: {log.ipAddress || '127.0.0.1'}</p>
                    </div>
                    <span className="text-[10px] text-neutral-400 font-medium flex-shrink-0">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">No recent activity recorded.</p>
            )}
          </div>
        </div>

      </div>

      {/* ── Secure Email Change Verification Modal ── */}
      <UpdateEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        currentEmail={user?.email || settingsData?.profile?.email || 'hod@jcer.edu'}
        onSuccess={(updatedEmail) => {
          dispatch(updateUser({ email: updatedEmail }));
          fetchSettings();
        }}
      />
    </div>
  );
};

export default HodSettingsPage;

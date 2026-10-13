import React, { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { updateUser } from '../../store/authSlice';
import { toast } from 'react-toastify';
import { 
  User, 
  Mail, 
  Phone, 
  Lock,
  Camera,
  Building,
  Loader2,
  Eye,
  EyeOff,
  Edit2,
  Check,
  X
} from 'lucide-react';
import API from '../../services/api';
import UpdateEmailModal from '../../components/profile/UpdateEmailModal';
import TeachingProfileCard from '../../components/profile/TeachingProfileCard';

export const PrincipalProfilePage: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  
  const [phone, setPhone] = useState(user?.phone || '9448693987');
  const [isEditingName, setIsEditingName] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || user?.name?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '');
  const [savingName, setSavingName] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (PNG, JPG, JPEG).');
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
      const res = await API.put('/auth/profile', {
        firstName: cleanFirst,
        lastName: cleanLast,
        name: cleanFullName
      });

      if (res.data?.success && res.data?.data?.user) {
        const updatedUser = res.data.data.user;
        dispatch(updateUser(updatedUser));
        setIsEditingName(false);
        toast.success('🎉 Profile name updated successfully!');
      } else {
        toast.error(res.data?.error || 'Failed to update profile name.');
      }
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

      const res = await API.put('/auth/profile', {
        phone,
        firstName: cleanFirst || undefined,
        lastName: cleanLast || undefined,
        name: cleanFullName || undefined,
      });

      if (res.data?.success && res.data?.data?.user) {
        dispatch(updateUser(res.data.data.user));
        setIsEditingName(false);
        toast.success('Profile details saved successfully!');
      } else {
        toast.error('Failed to save profile details.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save profile details.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.warning('New password & confirm password do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await API.post('/auth/change-password', {
        currentPassword: oldPassword,
        newPassword
      });
      if (res.data?.success || res.status === 200) {
        toast.success('Password updated successfully!');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const getAvatarUrl = (url?: string | null) => {
    if (!url) return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&fit=crop';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    const base = API.defaults.baseURL || '/api';
    const host = base.replace(/\/api\/?$/, '');
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${host}${cleanPath}`;
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Profile Card */}
        <div className="lg:col-span-5 glass-panel rounded-[32px] p-6 shadow-ambient flex flex-col items-center justify-between text-center space-y-6">
          <div className="space-y-4 w-full flex flex-col items-center">
            <div className="relative">
              <img
                src={getAvatarUrl(user?.profileImage)}
                alt="Principal"
                className="w-28 h-28 rounded-[28px] object-cover border-4 border-white dark:border-neutral-800 shadow-md"
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

            <div className="w-full">
              <span className="px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full text-xs font-black uppercase">
                {user?.role || 'PRINCIPAL'}
              </span>

              {!isEditingName ? (
                <div className="mt-2 flex flex-col items-center justify-center">
                  <div className="flex items-center justify-center gap-2">
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                      {user?.name || 'Dr. S.V. Gorbal'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingName(true);
                        const parts = (user?.name || '').trim().split(/\s+/);
                        setFirstName(user?.firstName || parts[0] || '');
                        setLastName(user?.lastName || parts.slice(1).join(' ') || '');
                      }}
                      className="p-1.5 text-neutral-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Edit Profile Name"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-neutral-400 font-bold mt-0.5">
                    College Administrator / Dean
                  </p>
                </div>
              ) : (
                <div className="w-full mt-3 p-4 bg-violet-50/60 dark:bg-violet-950/30 border border-violet-200/80 dark:border-violet-800/60 rounded-2xl space-y-3 animate-fade-in text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
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
                        placeholder="e.g. Dr. S.V."
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
                        placeholder="e.g. Gorbal"
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

          <div className="w-full bg-neutral-50 dark:bg-neutral-800/30 rounded-2xl p-4 text-xs space-y-3 text-left border border-neutral-200/60 dark:border-neutral-800">
            <div className="flex items-start space-x-2 text-neutral-600 dark:text-neutral-300">
              <Building className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Institution</p>
                <p className="font-bold text-neutral-800 dark:text-neutral-200">Jain College of Engineering & Research, Belagavi</p>
              </div>
            </div>

            <div className="flex items-center justify-between space-x-2 text-neutral-600 dark:text-neutral-300">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Email Address</p>
                  <p className="font-bold text-neutral-800 dark:text-neutral-200">{user?.email || 'arihantdesai47@gmail.com'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex-shrink-0 shadow-sm"
              >
                Update Email
              </button>
            </div>

            <div className="flex items-center space-x-2 text-neutral-600 dark:text-neutral-300">
              <Phone className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              <div className="w-full">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Mobile Number</p>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full mt-0.5 px-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

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

        {/* Change Password Panel */}
        <div className="lg:col-span-7 glass-panel rounded-[32px] p-6 shadow-ambient">
          <div className="flex items-center gap-2 mb-6 border-b border-neutral-100 dark:border-neutral-800 pb-3">
            <Lock className="w-5 h-5 text-indigo-500" />
            <h3 className="font-extrabold text-neutral-900 dark:text-white text-md">🛡️ SECURITY & PASSWORD MANAGEMENT</h3>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">Current Password</label>
              <div className="relative">
                <input
                  type={showOldPassword ? "text" : "password"}
                  placeholder="Enter current password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="py-3 px-6 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {savingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Update Access Credentials</span>
            </button>
          </form>
        </div>

      </div>

      {/* Teaching Profile & Capabilities */}
      <TeachingProfileCard role="PRINCIPAL" />

      <UpdateEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        currentEmail={user?.email || ''}
        onSuccess={(updatedEmail) => {
          dispatch(updateUser({ email: updatedEmail }));
        }}
      />

    </div>
  );
};

export default PrincipalProfilePage;

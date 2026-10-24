import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Megaphone, Search, Plus, Calendar, CheckCircle2, AlertCircle, X, Send } from 'lucide-react';
import officeService, { Notification } from '../../../services/office.service';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';

export const AdminAnnouncementsPage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [searchTerm, setSearchTerm] = useState('');
  const [announcements, setAnnouncements] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    type: 'INFO',
    audience: 'ALL_STUDENTS'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await officeService.getNotifications();
      // We can filter by type if needed, but for now we'll assume this page shows all 
      // broad notifications as announcements.
      setAnnouncements(data);
    } catch (error) {
      toast.error('Failed to fetch announcements');
    } finally {
      setLoading(false);
    }
  };

  const filteredAnnouncements = announcements.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newAnnouncement.title || !newAnnouncement.content) {
      toast.error("Title and Content are required.");
      return;
    }
    try {
      setSubmitting(true);
      await officeService.createNotification(newAnnouncement);
      toast.success("Announcement drafted successfully!");
      setIsAddModalOpen(false);
      setNewAnnouncement({ title: '', content: '', type: 'INFO', audience: 'ALL_STUDENTS' });
      fetchAnnouncements();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to create announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await officeService.publishNotification(id);
      toast.success("Announcement published to all users!");
      fetchAnnouncements();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to publish announcement.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Notice Board</h2>
          <p className="text-sm text-neutral-500">Manage global announcements and campus notices.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all"
        >
          <Plus size={16} /> New Announcement
        </button>
      </div>

      <div className="glass-panel rounded-2xl shadow-ambient p-5 border border-neutral-200/50 dark:border-neutral-800/40">
        
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <input 
              type="text" 
              placeholder="Search announcements..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-12 flex justify-center text-neutral-500">
               <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600"></div>
            </div>
          ) : filteredAnnouncements.length === 0 ? (
             <div className="col-span-full py-12 text-center text-neutral-500 font-semibold">
               No announcements found.
             </div>
          ) : (
            filteredAnnouncements.map(announcement => (
              <div key={announcement.id} className="p-6 rounded-3xl border border-neutral-200/60 dark:border-neutral-700/60 bg-white/50 hover:bg-white dark:bg-neutral-800/20 shadow-sm transition-all flex flex-col relative group overflow-hidden">
                <div className={`absolute top-0 left-0 w-1.5 h-full ${announcement.status === 'PUBLISHED' ? 'bg-emerald-500' : 'bg-amber-400'}`}></div>
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      announcement.type === 'WARNING' ? 'bg-amber-100 text-amber-600' :
                      announcement.type === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {announcement.type === 'WARNING' ? <AlertCircle size={18} /> :
                       announcement.type === 'SUCCESS' ? <CheckCircle2 size={18} /> : <Megaphone size={18} />}
                    </div>
                  </div>
                  
                  {isSuperAdmin && announcement.status === 'DRAFT' && (
                     <button 
                       onClick={() => handlePublish(announcement.id)}
                       className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                     >
                       <Send size={12} /> Publish
                     </button>
                  )}
                </div>

                <h3 className="font-extrabold text-lg text-neutral-900 dark:text-white mb-2 leading-tight">{announcement.title}</h3>
                
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 flex-1 line-clamp-3">
                  {announcement.content}
                </p>

                <div className="flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800/60 pt-4 mt-auto">
                  <span className="text-xs font-bold text-neutral-500 flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 flex items-center justify-center text-[10px]">
                      {announcement.createdBy?.firstName?.[0] || 'A'}
                    </span>
                    {announcement.createdBy?.firstName || 'Admin'}
                  </span>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-semibold text-neutral-400 flex items-center gap-1">
                      <Calendar size={10}/> {new Date(announcement.createdAt).toLocaleDateString()}
                    </span>
                    <span className={`text-[9px] font-black uppercase mt-1 px-1.5 py-0.5 rounded ${announcement.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {announcement.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {isAddModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-800/50">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Megaphone size={18} className="text-violet-600" /> New Announcement
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div>
                <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Title *</label>
                <input 
                  type="text" 
                  value={newAnnouncement.title}
                  onChange={e => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-violet-500 font-bold" 
                  placeholder="e.g. Campus Closed for Holiday"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Announcement Content *</label>
                <textarea 
                  value={newAnnouncement.content}
                  onChange={e => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                  rows={5}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-violet-500 resize-none" 
                  placeholder="Detailed message..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Type</label>
                  <select 
                    value={newAnnouncement.type}
                    onChange={e => setNewAnnouncement({...newAnnouncement, type: e.target.value})}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500 font-semibold"
                  >
                    <option value="INFO">Information (Blue)</option>
                    <option value="WARNING">Warning (Orange)</option>
                    <option value="SUCCESS">Success (Green)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Audience</label>
                  <select 
                    value={newAnnouncement.audience}
                    onChange={e => setNewAnnouncement({...newAnnouncement, audience: e.target.value})}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500 font-semibold"
                  >
                    <option value="ALL_STUDENTS">All Students</option>
                    <option value="ALL_TEACHERS">All Teachers</option>
                    <option value="ALL_USERS">Everyone</option>
                  </select>
                </div>
              </div>
              
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/30 rounded-xl text-xs font-semibold text-indigo-800 dark:text-indigo-300">
                Note: Saving will create a DRAFT. Only SUPER_ADMIN can officially PUBLISH announcements to the notice board.
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex justify-end gap-3">
              <button onClick={() => setIsAddModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors">Cancel</button>
              <button 
                onClick={handleCreate}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 transition-all"
              >
                {submitting ? 'Saving...' : 'Save Draft'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default AdminAnnouncementsPage;

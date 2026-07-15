import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Save, Video, FileText, Upload, Trash2, Play, 
  Download, Eye, BarChart3, CheckCircle2, AlertTriangle, RefreshCw
} from 'lucide-react';

const getFileUrl = (filePath) => {
  if (!filePath) return '';
  const base = import.meta.env.PROD ? '' : 'http://localhost:5001';
  return `${base}${filePath}`;
};

export default function TutorialManagement() {
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [data, setData] = useState({
    page_title: 'Training & Tutorial Center',
    page_description: '',
    videos: [],
    manuals: []
  });

  const [message, setMessage] = useState(null);

  // Form states
  const [pageTitle, setPageTitle] = useState('');
  const [pageDesc, setPageDesc] = useState('');

  // Video Form states
  const [videoTitle, setVideoTitle] = useState('');
  const [videoCategory, setVideoCategory] = useState('Getting Started');
  const [videoDuration, setVideoDuration] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Manual Form states
  const [manualVersion, setManualVersion] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualFile, setManualFile] = useState(null);
  const [uploadingManual, setUploadingManual] = useState(false);

  // Fetch current draft configuration
  const fetchDraft = async () => {
    try {
      const token = localStorage.getItem('token');
      const companyId = localStorage.getItem('activeCompanyId');
      
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-company-id': companyId
        }
      };

      const base = import.meta.env.PROD ? '' : 'http://localhost:5001';
      const res = await axios.get(`${base}/api/tutorial/draft`, config);
      
      setData(res.data);
      setPageTitle(res.data.page_title || '');
      setPageDesc(res.data.page_description || '');
    } catch (err) {
      console.error('Failed to fetch draft tutorial configurations:', err);
      showMsg('Failed to load training center settings.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDraft();
  }, []);

  const showMsg = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Save basic metadata draft
  const handleSaveMetadata = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const companyId = localStorage.getItem('activeCompanyId');
      
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-company-id': companyId
        }
      };

      const base = import.meta.env.PROD ? '' : 'http://localhost:5001';
      const res = await axios.post(`${base}/api/tutorial`, {
        page_title: pageTitle,
        page_description: pageDesc
      }, config);

      setData(res.data);
      showMsg('Metadata changes saved to draft.');
    } catch (err) {
      console.error('Failed to save metadata:', err);
      showMsg('Failed to save training center settings.', 'error');
    }
  };

  // Add/Upload Video
  const handleUploadVideo = async (e) => {
    e.preventDefault();
    if (!videoFile) return showMsg('Please select a video file to upload.', 'error');
    if (!videoTitle) return showMsg('Video title is required.', 'error');

    setUploadingVideo(true);
    try {
      const token = localStorage.getItem('token');
      const companyId = localStorage.getItem('activeCompanyId');
      
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('title', videoTitle);
      formData.append('category', videoCategory);
      formData.append('duration_minutes', videoDuration);

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-company-id': companyId,
          'Content-Type': 'multipart/form-data'
        }
      };

      const base = import.meta.env.PROD ? '' : 'http://localhost:5001';
      const res = await axios.post(`${base}/api/tutorial/upload-video`, formData, config);

      setData(res.data);
      setVideoTitle('');
      setVideoDuration('');
      setVideoFile(null);
      // Reset file input element
      const fileInput = document.getElementById('video-file-input');
      if (fileInput) fileInput.value = '';

      showMsg('Tutorial video uploaded and added successfully.');
    } catch (err) {
      console.error('Failed to upload video:', err);
      showMsg('Video upload failed. Check format or size restrictions (max 100MB).', 'error');
    } finally {
      setUploadingVideo(false);
    }
  };

  // Delete Video
  const handleDeleteVideo = async (videoId) => {
    if (!window.confirm('Are you sure you want to remove this video?')) return;
    try {
      const token = localStorage.getItem('token');
      const companyId = localStorage.getItem('activeCompanyId');
      
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-company-id': companyId
        }
      };

      const base = import.meta.env.PROD ? '' : 'http://localhost:5001';
      const res = await axios.delete(`${base}/api/tutorial/videos/${videoId}`, config);

      setData(res.data);
      showMsg('Video deleted successfully.');
    } catch (err) {
      console.error('Failed to delete video:', err);
      showMsg('Failed to delete video.', 'error');
    }
  };

  // Add/Upload Manual
  const handleUploadManual = async (e) => {
    e.preventDefault();
    if (!manualFile) return showMsg('Please select a PDF document to upload.', 'error');
    if (!manualVersion) return showMsg('Version identifier is required.', 'error');

    setUploadingManual(true);
    try {
      const token = localStorage.getItem('token');
      const companyId = localStorage.getItem('activeCompanyId');
      
      const formData = new FormData();
      formData.append('manual', manualFile);
      formData.append('version_number', manualVersion);
      formData.append('description', manualDesc);

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-company-id': companyId,
          'Content-Type': 'multipart/form-data'
        }
      };

      const base = import.meta.env.PROD ? '' : 'http://localhost:5001';
      const res = await axios.post(`${base}/api/tutorial/upload-manual`, formData, config);

      setData(res.data);
      setManualVersion('');
      setManualDesc('');
      setManualFile(null);
      // Reset file input element
      const fileInput = document.getElementById('manual-file-input');
      if (fileInput) fileInput.value = '';

      showMsg('Manual PDF version added successfully.');
    } catch (err) {
      console.error('Failed to upload manual:', err);
      showMsg('PDF upload failed. Ensure you are uploading a valid PDF document (max 20MB).', 'error');
    } finally {
      setUploadingManual(false);
    }
  };

  // Publish changes
  const handlePublish = async () => {
    setPublishing(true);
    try {
      const token = localStorage.getItem('token');
      const companyId = localStorage.getItem('activeCompanyId');
      
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-company-id': companyId
        }
      };

      const base = import.meta.env.PROD ? '' : 'http://localhost:5001';
      const res = await axios.put(`${base}/api/tutorial/publish`, {}, config);

      setData(prev => ({
        ...prev,
        is_published: true,
        published_at: res.data.published_at
      }));
      showMsg('Training Center changes have been published live.');
    } catch (err) {
      console.error('Failed to publish changes:', err);
      showMsg('Failed to publish changes. Check permissions.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  // Calculate analytics totals
  const totalViews = data.videos.reduce((sum, v) => sum + (v.views || 0), 0);
  const totalWatchSeconds = data.videos.reduce((sum, v) => sum + (v.total_watch_seconds || 0), 0);
  const totalDownloads = data.manuals.reduce((sum, m) => sum + (m.downloads || 0), 0);

  const formatWatchTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = (mins / 60).toFixed(1);
    return `${hrs}h`;
  };

  return (
    <div className="space-y-6">
      
      {/* Messages */}
      {message && (
        <div className={`rounded-xl border px-4 py-3 text-[13px] font-bold flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {message.text}
        </div>
      )}

      {/* Header and Quick Publish Status Panel */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-[17px] font-black text-slate-900">Training & User Manual Configurations</h2>
          <p className="text-slate-500 text-xs mt-1">
            Manage training playlists, search terms, and download files published on the public marketing site.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold block uppercase">Publishing Status</span>
            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider mt-1 ${
              data.is_published 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                : 'bg-amber-100 text-amber-800 border border-amber-250'
            }`}>
              {data.is_published ? 'Published' : 'Draft / Unpublished'}
            </span>
          </div>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 text-xs font-black rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            <Upload size={14} className={publishing ? 'animate-spin' : ''} />
            Publish Changes Live
          </button>
        </div>
      </section>

      {/* Analytics Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Video Views', value: totalViews, icon: Eye, color: 'text-blue-600 bg-blue-50 border-blue-100' },
          { label: 'Total Watch Time', value: formatWatchTime(totalWatchSeconds), icon: Play, color: 'text-violet-600 bg-violet-50 border-violet-100' },
          { label: 'Manual PDF Downloads', value: totalDownloads, icon: Download, color: 'text-cyan-600 bg-cyan-50 border-cyan-100' },
          { label: 'Manual Archive Size', value: `${data.manuals.length} versions`, icon: FileText, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' }
        ].map((stat, idx) => (
          <div key={idx} className={`p-4 rounded-xl border flex items-center gap-4 bg-white shadow-sm`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color.split(' ')[1]} ${stat.color.split(' ')[0]}`}>
              <stat.icon size={20} />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold block uppercase">{stat.label}</span>
              <span className="text-lg font-black text-slate-900">{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Grid forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Basic Metadata settings */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900">1. Landing Page Metadata</h3>
          </div>
          <form onSubmit={handleSaveMetadata} className="p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Page Main Title</label>
              <input
                type="text"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Page Description</label>
              <textarea
                rows={3}
                value={pageDesc}
                onChange={(e) => setPageDesc(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 resize-none"
              />
            </div>

            <button
              type="submit"
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-xs font-black rounded-lg shadow-sm transition-all active:scale-[0.98]"
            >
              <Save size={12} />
              Save Settings Draft
            </button>
          </form>
        </section>

        {/* Upload User Manual PDF */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
            <h3 className="text-sm font-black text-slate-900">2. Upload User Manual Version</h3>
          </div>
          <form onSubmit={handleUploadManual} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Version Number (e.g. v1.2.0)</label>
                <input
                  type="text"
                  placeholder="v1.2.0"
                  value={manualVersion}
                  onChange={(e) => setManualVersion(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Select PDF Manual Document</label>
                <input
                  id="manual-file-input"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setManualFile(e.target.files[0])}
                  className="w-full text-xs text-slate-550 border border-slate-200 rounded-lg file:mr-4 file:py-2.5 file:px-4 file:rounded-l-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Version Change Notes / Description</label>
              <input
                type="text"
                placeholder="Added chapter 4: Depreciations schedules configurations..."
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={uploadingManual}
              className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 text-xs font-black rounded-lg shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Upload size={12} />
              {uploadingManual ? 'Uploading PDF...' : 'Upload Manual Version'}
            </button>
          </form>
        </section>

      </div>

      {/* Video Upload management */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
          <h3 className="text-sm font-black text-slate-900">3. Add Training Video to Playlist</h3>
        </div>
        <form onSubmit={handleUploadVideo} className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Video Lesson Title</label>
            <input
              type="text"
              placeholder="e.g. Accounting Ledgers setup"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Video Category Module</label>
            <select
              value={videoCategory}
              onChange={(e) => setVideoCategory(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
            >
              <option value="Getting Started">Getting Started</option>
              <option value="Finance">Finance</option>
              <option value="Procurement">Procurement</option>
              <option value="Inventory">Inventory</option>
              <option value="Sales">Sales</option>
              <option value="Payroll">Payroll</option>
              <option value="Administration">Administration</option>
              <option value="Analytics">Analytics</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Duration (Minutes)</label>
            <input
              type="number"
              placeholder="e.g. 15"
              value={videoDuration}
              onChange={(e) => setVideoDuration(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Select Video File</label>
            <div className="flex gap-2">
              <input
                id="video-file-input"
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files[0])}
                className="w-full text-xs text-slate-550 border border-slate-200 rounded-lg file:mr-2 file:py-2 file:px-3 file:rounded-l-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-50 file:text-slate-700"
              />
              <button
                type="submit"
                disabled={uploadingVideo}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 h-10 text-xs font-black rounded-lg shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 whitespace-nowrap"
              >
                <Upload size={12} />
                {uploadingVideo ? 'Uploading...' : 'Add Video'}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Playlist and Document tables */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Video Playlist list table */}
        <section className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Video size={16} className="text-emerald-600" />
              Playlist Video Registry ({data.videos.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-150">
                  <th className="px-5 py-3">Seq / Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center">Duration</th>
                  <th className="px-4 py-3 text-right">Views</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.videos.map((video) => (
                  <tr key={video.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-slate-400 font-mono">#{video.sequence_order}</span>
                        <div>
                          <p className="font-bold text-slate-800">{video.title}</p>
                          <a href={getFileUrl(video.video_file)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-600 font-semibold truncate block max-w-xs mt-0.5">
                            {video.video_file}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold uppercase text-[9.5px]">
                        {video.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-slate-500 font-mono">
                      {video.duration_minutes} min
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <p className="font-black text-slate-800 font-mono">{video.views}</p>
                      <p className="text-[9px] text-slate-400 font-mono mt-0.5">{formatWatchTime(video.total_watch_seconds)} watched</p>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleDeleteVideo(video.id)}
                        className="text-red-500 hover:text-red-700 bg-transparent border-none outline-none cursor-pointer"
                        title="Remove Video"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {data.videos.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center py-10 text-slate-400 font-semibold">
                      No training videos uploaded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* User Manual Document Version History list table */}
        <section className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <FileText size={16} className="text-emerald-600" />
              Manual Version Registry ({data.manuals.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-150">
                  <th className="px-5 py-3">Version</th>
                  <th className="px-4 py-3">Uploaded Date</th>
                  <th className="px-4 py-3 text-right">Downloads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.manuals.map((manual) => (
                  <tr key={manual.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <div>
                        <span className="font-extrabold text-slate-800">Version {manual.version_number}</span>
                        {manual.description && (
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs">{manual.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-500 font-mono">
                      {new Date(manual.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-slate-800 font-mono">
                      {manual.downloads}
                    </td>
                  </tr>
                ))}
                {data.manuals.length === 0 && (
                  <tr>
                    <td colSpan="3" className="text-center py-10 text-slate-400 font-semibold">
                      No user manual documents uploaded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>

    </div>
  );
}

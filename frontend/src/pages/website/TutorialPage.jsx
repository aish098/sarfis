import React, { useState, useEffect, useRef } from 'react';
import { motion as Motion, useInView } from 'framer-motion';
import {
  Play, FileText, Download, Search, Video, Info,
  HelpCircle, Sparkles, MessageSquare, Mail, Calendar, PhoneCall
} from 'lucide-react';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

// Dynamic file URL resolver for Dev/Prod compatibility
const getFileUrl = (filePath) => {
  if (!filePath) return '';
  const base = import.meta.env.PROD ? '' : 'http://localhost:5001';
  return `${base}${filePath}`;
};

function AnimatedCounter({ value, suffix = "" }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    const num = parseInt(value, 10);
    if (isNaN(num)) {
      setCount(value);
      return;
    }

    const duration = 1550;
    const startTime = performance.now();

    const animate = (timestamp) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.floor(easeProgress * num);
      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(num);
      }
    };

    requestAnimationFrame(animate);
  }, [isInView, value]);

  return <span ref={ref}>{count}{suffix}</span>;
}

function Typewriter({ text, delay = 50, startDelay = 200 }) {
  const [displayText, setDisplayText] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStarted(true);
    }, startDelay);
    return () => clearTimeout(timer);
  }, [startDelay]);

  useEffect(() => {
    if (!started || !text) return;
    setDisplayText('');
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayText((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, delay);
    return () => clearInterval(interval);
  }, [text, delay, started]);

  return (
    <span>
      {displayText}
      {displayText.length < text.length && (
        <span className="animate-ping ml-0.5 text-emerald-450 font-light">|</span>
      )}
    </span>
  );
}

const CATEGORIES = [
  'All',
  'Getting Started',
  'Finance',
  'Procurement',
  'Inventory',
  'Sales',
  'Payroll',
  'Administration',
  'Analytics'
];

export default function TutorialPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    page_title: 'Training & Tutorial Center',
    page_description: 'Learn how to use SARFIS through complete software training videos and download the latest User Manual.',
    videos: [],
    manuals: []
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeVideo, setActiveVideo] = useState(null);
  const [nextRecommended, setNextRecommended] = useState(null);

  const videoRef = useRef(null);

  // Fetch published tutorials from backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        const base = import.meta.env.PROD ? '' : 'http://localhost:5001';
        const res = await axios.get(`${base}/api/tutorial`);
        setData(res.data);
        if (res.data.videos && res.data.videos.length > 0) {
          setActiveVideo(res.data.videos[0]);
        }
      } catch (err) {
        console.error('Failed to load tutorial data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Update next recommended video whenever the active video changes
  useEffect(() => {
    if (!activeVideo || !data.videos || data.videos.length <= 1) {
      setNextRecommended(null);
      return;
    }

    // Find next video in sequence
    const currentIndex = data.videos.findIndex(v => v.id === activeVideo.id);
    if (currentIndex !== -1 && currentIndex < data.videos.length - 1) {
      setNextRecommended(data.videos[currentIndex + 1]);
    } else {
      // Loop back to the first video
      setNextRecommended(data.videos[0]);
    }
  }, [activeVideo, data.videos]);

  // Track video watch analytics
  const trackVideoWatch = async (video, seconds) => {
    try {
      const base = import.meta.env.PROD ? '' : 'http://localhost:5001';
      await axios.post(`${base}/api/tutorial/videos/${video.id}/watch`, { watch_seconds: seconds });
    } catch (err) {
      console.warn('Analytics tracking failed:', err);
    }
  };

  // Track manual download analytics
  const trackManualDownload = async (manual) => {
    try {
      const base = import.meta.env.PROD ? '' : 'http://localhost:5001';
      await axios.post(`${base}/api/tutorial/manuals/${manual.id}/download`);
    } catch (err) {
      console.warn('Analytics tracking failed:', err);
    }
  };

  const handleVideoEnded = () => {
    if (activeVideo && videoRef.current) {
      // Track full watch time
      trackVideoWatch(activeVideo, Math.round(videoRef.current.duration));
    }
    // Auto-advance to next recommended video if available
    if (nextRecommended) {
      setActiveVideo(nextRecommended);
    }
  };

  const handleDownloadManual = (manual) => {
    trackManualDownload(manual);
    window.open(getFileUrl(manual.file_path), '_blank');
  };

  // Filter videos based on category & search query
  const filteredVideos = (data.videos || []).filter(video => {
    const matchesCategory = selectedCategory === 'All' || video.category === selectedCategory;
    const matchesSearch = video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const latestManual = data.manuals && data.manuals.length > 0 ? data.manuals[0] : null;

  return (
    <Motion.div
      className="relative min-h-screen text-white font-sans"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{ background: '#030b1a' }}
    >
      <Navbar />

      {/* Hero Header */}
      <section className="pt-32 pb-20 px-5 sm:px-8 relative overflow-hidden text-center">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '52px 52px' }} />
          <Motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 12, repeat: Infinity }} className="absolute -top-32 right-0 w-[550px] h-[550px] rounded-full" style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 75%)', filter: 'blur(90px)' }} />
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <Motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-6 uppercase tracking-wider animate-in fade-in"
            style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)', color: '#6ee7b7' }}
          >
            Official Learning Center
          </Motion.div>

          {(() => {
            const titleText = data.page_title || 'Training & Tutorial Center';
            const titleParts = titleText.split(' ');
            let firstPart = 'Training &';
            let secondPart = 'Tutorial Center';
            
            if (titleParts.length > 1) {
              const halfIndex = Math.ceil(titleParts.length / 2);
              firstPart = titleParts.slice(0, halfIndex).join(' ');
              secondPart = titleParts.slice(halfIndex).join(' ');
            }

            return (
              <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight mb-4 flex flex-wrap justify-center gap-x-4 gap-y-2" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
                <Motion.span
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                  className="text-white"
                >
                  {firstPart}
                </Motion.span>
                <span className="relative inline-block overflow-hidden">
                  <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    {secondPart}
                  </span>
                  <Motion.span
                    initial={{ x: "0%" }}
                    animate={{ x: "100%" }}
                    transition={{ delay: 0.25, duration: 0.6, ease: "easeOut" }}
                    className="absolute inset-y-0 left-0 right-0 bg-[#030b1a] z-10"
                  />
                </span>
              </h1>
            );
          })()}

          <Motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            {data.page_description}
          </Motion.p>

          {/* Quick Metrics Statistics Banner */}
          <Motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: "easeOut" }}
            className="grid grid-cols-3 gap-4 max-w-2xl mx-auto p-5 bg-[#050f21]/60 border border-slate-900 rounded-2xl backdrop-blur-md shadow-xl text-center"
          >
            <div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                <AnimatedCounter value={data.videos.length > 0 ? String(data.videos.length) : "20"} suffix="+" />
              </div>
              <div className="text-[10px] text-slate-500 uppercase font-bold mt-1 tracking-wider">Training Videos</div>
            </div>
            <div className="border-x border-slate-800">
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                <AnimatedCounter value="150" suffix="+" />
              </div>
              <div className="text-[10px] text-slate-500 uppercase font-bold mt-1 tracking-wider">ERP Features</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono">
                <Motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.65, ease: "easeOut" }}
                  className="inline-block"
                >
                  {latestManual ? latestManual.version_number : 'v1.2.0'}
                </Motion.span>
              </div>
              <div className="text-[10px] text-slate-500 uppercase font-bold mt-1 tracking-wider">User Manual</div>
            </div>
          </Motion.div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="py-12 px-5 sm:px-8 max-w-7xl mx-auto relative z-10">

        {/* Search & Categories Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8 border-b border-slate-900 pb-6">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 justify-center md:justify-start w-full md:w-auto">
            {CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 ${selectedCategory === category
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-[#050f21]/40 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tutorials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-800 bg-[#050f21]/60 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Video Player Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-20">

          {/* Left Column: Active Video Player */}
          <div className="lg:col-span-8 space-y-4">
            {activeVideo ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/20 text-emerald-400">
                      {activeVideo.category}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold text-white mt-2" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
                      {activeVideo.title}
                    </h2>
                  </div>
                  {activeVideo.duration_minutes > 0 && (
                    <span className="text-xs text-slate-400 font-semibold font-mono">
                      Duration: {activeVideo.duration_minutes} min
                    </span>
                  )}
                </div>

                {/* HTML5 Video Player */}
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
                  <video
                    ref={videoRef}
                    key={activeVideo.id}
                    src={getFileUrl(activeVideo.video_file)}
                    className="w-full h-full object-contain"
                    controls
                    autoPlay
                    onEnded={handleVideoEnded}
                  />
                </div>

                {/* Recommended Next Video Notification */}
                {nextRecommended && (
                  <Motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-4 bg-[#050f21]/60 border border-slate-900 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <Sparkles className="text-emerald-400" size={18} />
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Next Recommended</div>
                        <div className="text-xs font-bold text-white mt-0.5">{nextRecommended.title}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveVideo(nextRecommended)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-[11px] font-black rounded-lg text-white transition-all shadow-md shadow-emerald-500/10"
                    >
                      ▶ Watch Now
                    </button>
                  </Motion.div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center aspect-video rounded-2xl border border-dashed border-slate-800 bg-[#050f21]/20 text-center p-8">
                <Video size={48} className="text-slate-500 mb-4 animate-pulse" />
                <p className="text-slate-400 font-medium">🎥 Tutorial video will be available soon.</p>
              </div>
            )}
          </div>

          {/* Right Column: Video Playlist */}
          <div className="lg:col-span-4 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 border-b border-slate-900 pb-2">
              Tutorial Video Playlist ({filteredVideos.length})
            </h3>

            <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2">
              {filteredVideos.map(video => (
                <div
                  key={video.id}
                  onClick={() => setActiveVideo(video)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 flex gap-4 items-center ${activeVideo?.id === video.id
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-[#050f21]/60 border-slate-900 hover:border-slate-800 hover:bg-[#050f21]/80'
                    }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${activeVideo?.id === video.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-900 text-slate-400'
                    }`}>
                    <Play size={14} className={activeVideo?.id === video.id ? 'fill-emerald-400' : ''} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white truncate">{video.title}</h4>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[9px] font-black uppercase text-slate-500">{video.category}</span>
                      {video.duration_minutes > 0 && (
                        <span className="text-[9px] font-mono text-slate-500">{video.duration_minutes} min</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {filteredVideos.length === 0 && (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No videos found matching your selection.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* User Manual Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-20 border-t border-slate-900 pt-16">
          <div className="lg:col-span-5 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-950/60 border border-cyan-500/25 rounded-full text-[10px] font-black text-cyan-400 uppercase tracking-widest">
              PDF Guide
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
              User Documentation & Reference Manual
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Prefer reading? Download our comprehensive PDF user guides covering configuration, journal postings, depreciation tables, and core settings workflows.
            </p>
          </div>

          <div className="lg:col-span-7">
            {latestManual ? (
              <div className="p-6 bg-[#050f21]/60 border border-slate-900 rounded-2xl shadow-xl space-y-6">
                <div className="flex justify-between items-start flex-wrap gap-4 border-b border-slate-900 pb-5">
                  <div className="flex gap-4 items-start">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 flex-shrink-0">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">SARFIS Enterprise User Manual</h3>
                      <p className="text-[11px] text-slate-500 mt-1 font-semibold">
                        Version: {latestManual.version_number} &bull; Updated: {new Date(latestManual.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownloadManual(latestManual)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-xs font-black text-white rounded-xl shadow-lg shadow-emerald-500/10 transition-all cursor-pointer"
                  >
                    <Download size={14} />
                    Download User Manual
                  </button>
                </div>

                {latestManual.description && (
                  <div>
                    <h4 className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1.5">Version Notes</h4>
                    <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/40 p-4 border border-slate-900 rounded-xl">
                      {latestManual.description}
                    </p>
                  </div>
                )}

                {/* Older Manual Versions (Version History list) */}
                {data.manuals.length > 1 && (
                  <div>
                    <h4 className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-3">Version History Archive</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                      {data.manuals.slice(1).map(manual => (
                        <div key={manual.id} className="flex justify-between items-center p-3 bg-[#050f21]/20 border border-slate-900/60 rounded-xl hover:border-slate-800 transition-colors">
                          <div className="min-w-0">
                            <span className="text-[11px] font-bold text-slate-300">Version {manual.version_number}</span>
                            <span className="text-[9px] text-slate-500 ml-2 font-mono">{new Date(manual.created_at).toLocaleDateString()}</span>
                          </div>
                          <button
                            onClick={() => handleDownloadManual(manual)}
                            className="flex items-center gap-1.5 text-[10px] font-black text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            <Download size={10} />
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-slate-800 bg-[#050f21]/20 text-center">
                <FileText size={40} className="text-slate-500 mb-3" />
                <p className="text-slate-400 text-xs font-semibold">📄 User Manual is currently unavailable.</p>
              </div>
            )}
          </div>
        </div>

        {/* Support CTA and Placeholder Cards */}
        <div className="border-t border-slate-900 pt-16 text-center max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Didn't find what you need?
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mb-10 max-w-md mx-auto">
            Our strategic support teams, advisors, and corporate developers are available to assist with your integration.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {[
              { icon: Mail, title: 'Email Support', info: 'support@sarfis.com', cta: 'Send Email', href: 'mailto:support@sarfis.com', color: '#10b981' },
              { icon: MessageSquare, title: 'WhatsApp Live', info: '+92 300 1234567', cta: 'Chat on WhatsApp', href: 'https://wa.me/923001234567', color: '#06b6d4' },
              { icon: PhoneCall, title: 'Schedule Demo', info: 'Direct with Leadership', cta: 'Request Calendar', href: '/contact', color: '#f59e0b' }
            ].map((s, idx) => (
              <div key={idx} className="p-6 bg-[#050f21]/60 border border-slate-900 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-800 transition-all">
                <div>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${s.color}15`, color: s.color }}>
                    <s.icon size={20} />
                  </div>
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">{s.title}</h3>
                  <p className="text-sm font-bold text-white mt-1">{s.info}</p>
                </div>
                <a
                  href={s.href}
                  className="inline-flex items-center gap-1.5 text-xs font-bold transition-all"
                  style={{ color: s.color }}
                >
                  {s.cta} &rarr;
                </a>
              </div>
            ))}
          </div>
        </div>

      </section>

      <Footer />
    </Motion.div>
  );
}

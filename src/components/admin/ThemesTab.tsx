import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { ThemePreset, ThemeConfig, Banner3DConfig } from '../../types';
import {
  Palette,
  Sparkles,
  Layers,
  Check,
  Plus,
  Trash2,
  Edit2,
  Sliders,
  Eye,
  RefreshCw,
  Box,
  Image as ImageIcon
} from 'lucide-react';

export const ThemesTab: React.FC = () => {
  const {
    themeConfig,
    setThemePreset,
    updateThemeConfig,
    banners3D,
    updateBanner3D,
    addBanner3D,
    deleteBanner3D,
    showToast
  } = useStore();

  const presets: {
    id: ThemePreset;
    name: string;
    description: string;
    primary: string;
    accent: string;
    bg: string;
  }[] = [
    {
      id: 'minimal-luxury',
      name: 'Minimal Luxury',
      description: 'Forest pine, warm ivory, and copper accents. The iconic VANTREL signature.',
      primary: '#14221C',
      accent: '#FF762E',
      bg: '#F7F5EF'
    },
    {
      id: 'black-and-gold',
      name: 'Black & Gold',
      description: 'Onyx obsidian, dark gold metallics, and sharp architectural cuts.',
      primary: '#0D0D0D',
      accent: '#D4AF37',
      bg: '#000000'
    },
    {
      id: 'modern-streetwear',
      name: 'Modern Streetwear',
      description: 'Graphite slate, neon orange pop, and stark industrial borders.',
      primary: '#18181B',
      accent: '#EA580C',
      bg: '#FAFAFA'
    },
    {
      id: 'clean-white',
      name: 'Clean White',
      description: 'Crisp optic white, minimal typography, and cobalt blue highlights.',
      primary: '#1F2937',
      accent: '#2563EB',
      bg: '#FFFFFF'
    },
    {
      id: 'dark-cinematic',
      name: 'Dark Cinematic',
      description: 'Midnight navy, cyber cyan glow, and deep immersive glassmorphism.',
      primary: '#0A0F1D',
      accent: '#38BDF8',
      bg: '#050814'
    },
    {
      id: 'seasonal-collection',
      name: 'Seasonal Collection',
      description: 'Olive sage, terracotta earth, and desert parchment tones.',
      primary: '#1B3022',
      accent: '#E07A5F',
      bg: '#F4F1DE'
    }
  ];

  // 3D Banner Modal state
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [bannerFormData, setBannerFormData] = useState({
    title: '',
    subtitle: '',
    badge: 'Limited Drop',
    ctaText: 'Explore Now',
    ctaLink: 'shop',
    bgImage: '/src/assets/images/hero_fashion_yeamin_1792588589630.jpg',
    layerDepth: 35,
    lighting: 'warm' as 'warm' | 'cool' | 'neon' | 'ambient',
    isActive: true
  });

  // Interactive 3D Preview Card State
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setTilt({
      x: -(y / (rect.height / 2)) * 12,
      y: (x / (rect.width / 2)) * 12
    });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const handleOpenAddBanner = () => {
    setEditingBannerId(null);
    setBannerFormData({
      title: '',
      subtitle: '',
      badge: 'Limited Drop',
      ctaText: 'Explore Now',
      ctaLink: 'shop',
      bgImage: '/src/assets/images/product_premium_hoodie_1792588590406.jpg',
      layerDepth: 35,
      lighting: 'warm',
      isActive: true
    });
    setIsBannerModalOpen(true);
  };

  const handleOpenEditBanner = (b: Banner3DConfig) => {
    setEditingBannerId(b.id);
    setBannerFormData({
      title: b.title,
      subtitle: b.subtitle,
      badge: b.badge,
      ctaText: b.ctaText,
      ctaLink: b.ctaLink,
      bgImage: b.bgImage || b.bgImageUrl || '/src/assets/images/hero_fashion_yeamin_1792588589630.jpg',
      layerDepth: b.layerDepth ?? 35,
      lighting: b.lighting || 'warm',
      isActive: b.isActive
    });
    setIsBannerModalOpen(true);
  };

  const handleBannerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerFormData.title.trim()) {
      showToast('Validation Error', 'Title is required for the 3D banner.', 'error');
      return;
    }

    if (editingBannerId) {
      updateBanner3D(editingBannerId, bannerFormData);
    } else {
      addBanner3D(bannerFormData);
    }
    setIsBannerModalOpen(false);
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: THEME PRESETS */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E5E1D5] space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#14221C] text-[#FF762E] text-[10px] font-bold uppercase rounded">
              Store Customizer
            </span>
            <span className="text-xs text-[#202522]/50">6 Production Color Presets</span>
          </div>
          <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight mt-1">
            Visual Brand Themes & Aesthetics
          </h3>
          <p className="text-xs text-[#202522]/60 mt-0.5">
            Select one of the 6 curated fashion palettes or fine-tune brand tokens with instant storefront synchronization.
          </p>
        </div>

        {/* 6 Theme Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets.map((p) => {
            const isSelected = themeConfig.preset === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setThemePreset(p.id)}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer space-y-3 relative group ${
                  isSelected
                    ? 'border-[#14221C] bg-[#F7F5EF] shadow-md scale-102'
                    : 'border-[#E5E1D5] bg-white hover:border-stone-400'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[#14221C] text-[#FF762E] flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border border-black/20" style={{ backgroundColor: p.primary }} />
                  <div className="w-5 h-5 rounded-full border border-black/20" style={{ backgroundColor: p.accent }} />
                  <div className="w-5 h-5 rounded-full border border-black/20" style={{ backgroundColor: p.bg }} />
                </div>

                <div>
                  <h4 className="font-bold text-sm text-[#14221C]">{p.name}</h4>
                  <p className="text-xs text-[#202522]/60 mt-1 leading-relaxed">
                    {p.description}
                  </p>
                </div>

                <div className="pt-2">
                  <span
                    className={`inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg ${
                      isSelected
                        ? 'bg-[#14221C] text-white'
                        : 'bg-[#F7F5EF] text-[#202522]/70 group-hover:bg-[#14221C] group-hover:text-white transition-colors'
                    }`}
                  >
                    {isSelected ? 'Active Storefront Theme' : 'Click to Apply Theme'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Fine-Tuning Controls */}
        <div className="pt-6 border-t border-[#E5E1D5] space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-heading text-sm font-bold text-[#14221C] uppercase tracking-tight">
              Custom Token Fine-Tuning
            </h4>
            <span className="text-[11px] text-[#202522]/50">
              Live CSS variables: --vt-primary, --vt-accent, --vt-bg
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            {/* Primary Color */}
            <div className="space-y-1.5">
              <label className="font-bold text-[#14221C] block">Primary Tone</label>
              <div className="flex items-center gap-2 bg-[#F7F5EF] p-1.5 rounded-xl border border-[#E5E1D5]">
                <input
                  type="color"
                  value={themeConfig.primaryColor}
                  onChange={(e) => updateThemeConfig({ primaryColor: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <span className="font-mono text-[11px] text-[#14221C]">
                  {themeConfig.primaryColor}
                </span>
              </div>
            </div>

            {/* Accent Color */}
            <div className="space-y-1.5">
              <label className="font-bold text-[#14221C] block">Accent Tone</label>
              <div className="flex items-center gap-2 bg-[#F7F5EF] p-1.5 rounded-xl border border-[#E5E1D5]">
                <input
                  type="color"
                  value={themeConfig.accentColor}
                  onChange={(e) => updateThemeConfig({ accentColor: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <span className="font-mono text-[11px] text-[#14221C]">
                  {themeConfig.accentColor}
                </span>
              </div>
            </div>

            {/* Background Color */}
            <div className="space-y-1.5">
              <label className="font-bold text-[#14221C] block">Background Tone</label>
              <div className="flex items-center gap-2 bg-[#F7F5EF] p-1.5 rounded-xl border border-[#E5E1D5]">
                <input
                  type="color"
                  value={themeConfig.bgColor}
                  onChange={(e) => updateThemeConfig({ bgColor: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <span className="font-mono text-[11px] text-[#14221C]">
                  {themeConfig.bgColor}
                </span>
              </div>
            </div>

            {/* Text Color / Contrast */}
            <div className="space-y-1.5">
              <label className="font-bold text-[#14221C] block">Text Contrast Tone</label>
              <div className="flex items-center gap-2 bg-[#F7F5EF] p-1.5 rounded-xl border border-[#E5E1D5]">
                <input
                  type="color"
                  value={themeConfig.textColor}
                  onChange={(e) => updateThemeConfig({ textColor: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <span className="font-mono text-[11px] text-[#14221C]">
                  {themeConfig.textColor}
                </span>
              </div>
            </div>

            {/* Corner Radius */}
            <div className="space-y-1.5">
              <label className="font-bold text-[#14221C] block">Corner Silhouette</label>
              <select
                value={themeConfig.buttonRadius}
                onChange={(e) => updateThemeConfig({ buttonRadius: e.target.value })}
                className="w-full px-3 py-2.5 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold text-[#14221C]"
              >
                <option value="rounded-none">Sharp Industrial (rounded-none)</option>
                <option value="rounded-md">Subtle Modern (rounded-md)</option>
                <option value="rounded-xl">Curved Luxury (rounded-xl)</option>
                <option value="rounded-2xl">Ultra Soft (rounded-2xl)</option>
              </select>
            </div>

            {/* Motion Intensity */}
            <div className="space-y-1.5">
              <label className="font-bold text-[#14221C] block">Motion Physics</label>
              <select
                value={themeConfig.animationIntensity}
                onChange={(e) =>
                  updateThemeConfig({ animationIntensity: e.target.value as any })
                }
                className="w-full px-3 py-2.5 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold text-[#14221C]"
              >
                <option value="subtle">Subtle Minimal</option>
                <option value="normal">Standard Fluid</option>
                <option value="cinematic">Cinematic 3D Parallax</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: 3D LAYERED BANNERS SHOWCASE */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E5E1D5] space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-[#14221C] text-[#FF762E] text-[10px] font-bold uppercase rounded">
                3D Visual Engine
              </span>
              <span className="text-xs text-[#202522]/50">Interactive Perspective Banners</span>
            </div>
            <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight mt-1">
              Layered 3D Fashion Banners
            </h3>
            <p className="text-xs text-[#202522]/60 mt-0.5">
              Manage high-impact multi-plane 3D banners with real-time cursor tilt physics.
            </p>
          </div>

          <button
            onClick={handleOpenAddBanner}
            className="px-4 py-2 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold uppercase rounded-xl flex items-center gap-1.5 transition-colors shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4 text-[#FF762E]" />
            <span>Create 3D Banner</span>
          </button>
        </div>

        {/* Live Interactive 3D Showcase Preview */}
        {banners3D.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#14221C]">
              Live Interactive 3D Canvas Preview (Move cursor over banner)
            </span>
            <div
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{
                perspective: 1000
              }}
              className="relative h-64 sm:h-80 rounded-3xl overflow-hidden cursor-crosshair border border-[#E5E1D5] bg-[#14221C] shadow-lg select-none"
            >
              <div
                style={{
                  transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.02, 1.02, 1.02)`,
                  transition: tilt.x === 0 ? 'transform 0.5s ease-out' : 'transform 0.05s ease-out'
                }}
                className="w-full h-full relative"
              >
                {/* Background Layer with Depth */}
                <img
                  src={banners3D[0].bgImage}
                  alt={banners3D[0].title}
                  className="w-full h-full object-cover object-center scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#14221C] via-[#14221C]/60 to-transparent" />

                {/* Floating Content Layer (Offset by 3D translation) */}
                <div
                  style={{
                    transform: `translateZ(${banners3D[0].layerDepth}px)`
                  }}
                  className="absolute inset-0 p-8 flex flex-col justify-end text-white space-y-2"
                >
                  <span className="inline-block px-3 py-1 bg-[#FF762E] text-white text-[10px] font-bold uppercase tracking-widest rounded-full w-fit shadow-md">
                    {banners3D[0].badge}
                  </span>
                  <h3 className="font-heading text-2xl sm:text-4xl font-extrabold uppercase tracking-tight drop-shadow-md">
                    {banners3D[0].title}
                  </h3>
                  <p className="text-xs sm:text-sm text-white/80 max-w-xl line-clamp-2">
                    {banners3D[0].subtitle}
                  </p>
                  <div className="pt-2">
                    <span className="px-5 py-2.5 bg-white text-[#14221C] text-xs font-bold uppercase tracking-wider rounded-xl shadow-md inline-block">
                      {banners3D[0].ctaText} →
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3D Banners List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {banners3D.map((banner) => (
            <div
              key={banner.id}
              className="bg-[#F7F5EF] p-4 rounded-2xl border border-[#E5E1D5] space-y-3 flex flex-col justify-between"
            >
              <div className="flex items-start gap-3">
                <img
                  src={banner.bgImage}
                  alt={banner.title}
                  className="w-20 h-20 rounded-xl object-cover border border-[#E5E1D5] shrink-0"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-[#14221C] text-white text-[9px] font-bold uppercase rounded">
                      {banner.badge}
                    </span>
                    <span className="text-[10px] text-[#202522]/50 font-mono">
                      Depth: {banner.layerDepth}px
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-[#14221C]">{banner.title}</h4>
                  <p className="text-xs text-[#202522]/60 line-clamp-1">{banner.subtitle}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#E5E1D5] text-xs">
                <span
                  className={`text-[10px] font-bold uppercase ${
                    banner.isActive ? 'text-emerald-700' : 'text-stone-400'
                  }`}
                >
                  {banner.isActive ? 'Active on Storefront' : 'Hidden'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditBanner(banner)}
                    className="p-1.5 hover:bg-stone-200 text-[#202522] rounded-lg"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      deleteBanner3D(banner.id);
                    }}
                    className="p-1.5 hover:bg-rose-100 text-[#202522]/40 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add / Edit 3D Banner Modal */}
      {isBannerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#E5E1D5] max-w-lg w-full p-6 sm:p-8 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-[#E5E1D5]">
              <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                {editingBannerId ? 'Edit 3D Banner' : 'Create 3D Perspective Banner'}
              </h3>
              <button
                onClick={() => setIsBannerModalOpen(false)}
                className="text-[#202522]/50 hover:text-[#14221C]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBannerSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#14221C] mb-1">Headline / Title *</label>
                <input
                  type="text"
                  placeholder="e.g. ARCHITECTURAL LUXURY 2026"
                  value={bannerFormData.title}
                  onChange={(e) => setBannerFormData({ ...bannerFormData, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#14221C] mb-1">Subtitle / Descriptor</label>
                <textarea
                  rows={2}
                  placeholder="Heavyweight French Terry cuts engineered in Dhaka."
                  value={bannerFormData.subtitle}
                  onChange={(e) =>
                    setBannerFormData({ ...bannerFormData, subtitle: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#14221C] mb-1">Badge Tag</label>
                  <input
                    type="text"
                    value={bannerFormData.badge}
                    onChange={(e) =>
                      setBannerFormData({ ...bannerFormData, badge: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#14221C] mb-1">CTA Button Label</label>
                  <input
                    type="text"
                    value={bannerFormData.ctaText}
                    onChange={(e) =>
                      setBannerFormData({ ...bannerFormData, ctaText: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#14221C] mb-1">Background Image URL</label>
                <input
                  type="text"
                  value={bannerFormData.bgImage}
                  onChange={(e) =>
                    setBannerFormData({ ...bannerFormData, bgImage: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#14221C] mb-1">
                    3D Parallax Depth: {bannerFormData.layerDepth}px
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    value={bannerFormData.layerDepth}
                    onChange={(e) =>
                      setBannerFormData({
                        ...bannerFormData,
                        layerDepth: Number(e.target.value)
                      })
                    }
                    className="w-full cursor-pointer accent-[#14221C]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#14221C] mb-1">Ambient Atmosphere</label>
                  <select
                    value={bannerFormData.lighting}
                    onChange={(e) =>
                      setBannerFormData({
                        ...bannerFormData,
                        lighting: e.target.value as any
                      })
                    }
                    className="w-full px-3 py-2 bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl font-bold text-[#14221C]"
                  >
                    <option value="warm">Warm Studio Glow</option>
                    <option value="cool">Cool Daylight</option>
                    <option value="neon">Cyber Neon Pop</option>
                    <option value="ambient">Atmospheric Minimal</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#E5E1D5]">
                <button
                  type="button"
                  onClick={() => setIsBannerModalOpen(false)}
                  className="px-4 py-2 bg-[#F7F5EF] text-[#202522] rounded-xl font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#14221C] hover:bg-[#202522] text-white font-bold uppercase rounded-xl transition-colors shadow-xs"
                >
                  {editingBannerId ? 'Save Changes' : 'Publish 3D Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

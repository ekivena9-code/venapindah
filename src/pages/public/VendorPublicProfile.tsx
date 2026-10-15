import React, { useState, useEffect, useCallback } from 'react';
import { VendorProfile, VendorPortfolio } from '../../types';
import { getVendorProfile } from '../../services/vendorProfile';
import { listVendorPortfolios } from '../../services/vendorPortfolios';
import { getEmbedVideoUrl } from '../../utils/videoUtils';
import { useSupabaseRealtimeRefresh } from '../../hooks/useSupabaseRealtimeRefresh';

const FAQ_OPEN_DEFAULT = new Set<string>();

const INITIAL_VISIBLE = 6;

const VendorPublicProfile: React.FC = () => {
    const [profile, setProfile] = useState<VendorProfile | null>(null);
    const [portfolios, setPortfolios] = useState<VendorPortfolio[]>([]);
    const [loading, setLoading] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string>('Semua');
    const [showAll, setShowAll] = useState(false);
    const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
    const [openFaqIds, setOpenFaqIds] = useState<string[]>([]);

    const loadData = useCallback(async () => {
        try {
            const [profileData, portfoliosData] = await Promise.all([
                getVendorProfile(),
                listVendorPortfolios()
            ]);
            setProfile(profileData);
            setPortfolios(portfoliosData);
        } catch (error) {
            console.error("Error loading vendor public profile:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useSupabaseRealtimeRefresh('public-vendor-profile', ['vendor_profiles', 'vendor_portfolios'], loadData);

    useEffect(() => {
        if (!profile?.hero_images || profile.hero_images.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentHeroIndex(prev => (prev + 1) % profile.hero_images!.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [profile?.hero_images]);

    const formatWa = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;

    const categoryKey = (category: string) => category.trim().toLowerCase();
    const categoryLabels = Array.from(new Map(
        portfolios
            .map(portfolio => portfolio.category.trim())
            .filter(Boolean)
            .map(category => [categoryKey(category), category])
    ).values());
    const categories = ['Semua', ...categoryLabels];
    const filteredPortfolios = activeFilter === 'Semua'
        ? portfolios
        : portfolios.filter(portfolio => categoryKey(portfolio.category) === categoryKey(activeFilter));

    // Reset showAll when filter changes
    const handleFilterChange = (cat: string) => {
        setActiveFilter(cat);
        setShowAll(false);
    };

    const toggleFaq = (faqId: string) => {
        setOpenFaqIds(prev =>
            prev.includes(faqId)
                ? prev.filter(id => id !== faqId)
                : [...prev, faqId]
        );
    };

    const visiblePortfolios = showAll ? filteredPortfolios : filteredPortfolios.slice(0, INITIAL_VISIBLE);
    const hasMore = filteredPortfolios.length > INITIAL_VISIBLE;

    // Smooth scroll helper — avoids hash routing conflicts
    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setMenuOpen(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-[#525252] border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs tracking-[0.3em] uppercase text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>Loading</p>
                </div>
            </div>
        );
    }

    const whatsappUrl = profile?.whatsapp_number ? formatWa(profile.whatsapp_number) : null;
    const vendorName = profile?.hero_title || 'Photography';

    const handlePortfolioClick = (id: string) => {
        window.location.hash = `#/portfolio/${id}`;
    };

    return (
        <div className="vendor-public-profile min-h-screen bg-[#f5f5f5]" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* ─── Navbar ─── */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#f5f5f5]/90 backdrop-blur-sm border-b border-[#e5e5e5]/60">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    {/* Left nav links */}
                    <div className="hidden md:flex items-center gap-8">
                        <button
                            onClick={() => scrollTo('about')}
                            className="text-xs text-[#737373] tracking-[0.18em] uppercase hover:text-[#171717] transition-colors bg-transparent border-none cursor-pointer"
                            style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                            About
                        </button>
                        <button
                            onClick={() => scrollTo('portfolio')}
                            className="text-xs text-[#737373] tracking-[0.18em] uppercase hover:text-[#171717] transition-colors bg-transparent border-none cursor-pointer"
                            style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                            Portfolio
                        </button>
                        {profile?.videos && profile.videos.length > 0 && (
                            <button
                                onClick={() => scrollTo('videos')}
                                className="text-xs text-[#737373] tracking-[0.18em] uppercase hover:text-[#171717] transition-colors bg-transparent border-none cursor-pointer"
                                style={{ fontFamily: 'Inter, sans-serif' }}
                            >
                                Videos
                            </button>
                        )}
                        {profile?.faqs && profile.faqs.length > 0 && (
                            <button
                                onClick={() => scrollTo('faq')}
                                className="text-xs text-[#737373] tracking-[0.18em] uppercase hover:text-[#171717] transition-colors bg-transparent border-none cursor-pointer"
                                style={{ fontFamily: 'Inter, sans-serif' }}
                            >
                                FAQ
                            </button>
                        )}
                    </div>

                    {/* Center logo */}
                    <button
                        onClick={() => {
                            window.location.hash = '#/';
                            setMenuOpen(false);
                        }}
                        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center bg-transparent border-none cursor-pointer"
                    >
                        <span className="text-xl font-medium text-[#171717] tracking-[0.08em]">{vendorName}</span>
                    </button>

                    {/* Right nav links */}
                    <div className="hidden md:flex items-center gap-6">
                        <button
                            type="button"
                            onClick={() => window.location.hash = '#/login'}
                            className="text-xs text-[#737373] tracking-[0.18em] uppercase hover:text-[#171717] transition-colors border border-[#d4d4d4] rounded-full px-4 py-2 bg-white/30 hover:bg-[#171717] hover:text-[#f5f5f5]"
                            style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                            Login
                        </button>
                        {whatsappUrl && (
                            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-[#737373] tracking-[0.18em] uppercase hover:text-[#171717] transition-colors"
                                style={{ fontFamily: 'Inter, sans-serif' }}>
                                Contact
                            </a>
                        )}
                    </div>

                    {/* Mobile hamburger */}
                    <button className="md:hidden ml-auto text-[#737373]" onClick={() => setMenuOpen(!menuOpen)}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {menuOpen
                                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                            }
                        </svg>
                    </button>
                </div>

                {/* Mobile menu */}
                {menuOpen && (
                    <div className="md:hidden bg-[#f5f5f5] border-t border-[#e5e5e5] px-6 py-4 flex flex-col gap-4">
                        <button
                            onClick={() => scrollTo('about')}
                            className="text-sm text-[#737373] tracking-[0.15em] uppercase text-left bg-transparent border-none cursor-pointer"
                            style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                            About
                        </button>
                        <button
                            onClick={() => scrollTo('portfolio')}
                            className="text-sm text-[#737373] tracking-[0.15em] uppercase text-left bg-transparent border-none cursor-pointer"
                            style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                            Portfolio
                        </button>
                        {profile?.videos && profile.videos.length > 0 && (
                            <button
                                onClick={() => scrollTo('videos')}
                                className="text-sm text-[#737373] tracking-[0.15em] uppercase text-left bg-transparent border-none cursor-pointer"
                                style={{ fontFamily: 'Inter, sans-serif' }}
                            >
                                Videos
                            </button>
                        )}
                        {profile?.faqs && profile.faqs.length > 0 && (
                            <button
                                onClick={() => scrollTo('faq')}
                                className="text-sm text-[#737373] tracking-[0.15em] uppercase text-left bg-transparent border-none cursor-pointer"
                                style={{ fontFamily: 'Inter, sans-serif' }}
                            >
                                FAQ
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                window.location.hash = '#/login';
                                setMenuOpen(false);
                            }}
                            className="text-sm text-[#737373] tracking-[0.15em] uppercase text-left bg-transparent border-none cursor-pointer"
                            style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                            Login
                        </button>
                        {whatsappUrl && (
                            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                                className="text-sm text-[#737373] tracking-[0.15em] uppercase"
                                style={{ fontFamily: 'Inter, sans-serif' }}
                                onClick={() => setMenuOpen(false)}
                            >
                                Contact
                            </a>
                        )}
                    </div>
                )}
            </nav>

            {/* ─── Hero Section ─── */}
            <section id="hero" className="vendor-profile-hero relative w-full min-h-[85vh] md:min-h-screen flex items-end overflow-hidden bg-[#171717]">
                {profile?.hero_images && profile.hero_images.length > 0 ? (
                    profile.hero_images.map((img, idx) => (
                        <img 
                            key={idx}
                            src={img} 
                            alt={`Hero ${idx + 1}`} 
                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                                idx === currentHeroIndex ? 'opacity-100' : 'opacity-0'
                            }`} 
                        />
                    ))
                ) : profile?.hero_image_url ? (
                    <img src={profile.hero_image_url} alt="Hero" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-b from-[#a3a3a3] to-[#737373]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />

                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-10">
                    <div className="w-px h-16 bg-white/40 animate-pulse" />
                    <span className="text-white/50 text-[10px] tracking-[0.25em] uppercase mt-2" style={{ writingMode: 'vertical-rl', fontFamily: 'Inter, sans-serif' }}>scroll</span>
                </div>

                <div className="vendor-profile-hero-content relative z-10 px-6 sm:px-10 md:px-16 pb-16 md:pb-24 max-w-4xl">
                    <p className="text-white/75 text-xs sm:text-sm font-medium tracking-[0.22em] uppercase mb-5">Vendor Profile</p>
                    <h1 className="vendor-profile-hero-title text-white text-4xl sm:text-5xl md:text-7xl font-medium leading-[1.05] tracking-tight mb-5">
                        {profile?.hero_title || 'Capture Every Moment'}
                    </h1>
                    {profile?.hero_subtitle && (
                        <p className="vendor-profile-hero-subtitle text-white/85 text-base sm:text-lg font-medium leading-relaxed max-w-xl mb-8">{profile.hero_subtitle}</p>
                    )}
                    {whatsappUrl && (
                        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-3 border border-white/50 text-white text-xs tracking-[0.2em] uppercase px-7 py-3 hover:bg-white hover:text-[#171717] transition-all duration-300"
                            style={{ fontFamily: 'Inter, sans-serif' }}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                            Get in Touch
                        </a>
                    )}
                </div>
            </section>

            {/* ─── About Section ─── */}
            <section id="about" className="py-20 md:py-28 px-6 bg-[#f5f5f5]">
                <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-[0.7fr_2fr] md:items-start">
                    <p className="text-[#525252] text-xs font-medium tracking-[0.25em] uppercase md:pt-3" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Hi, you've found us!
                    </p>
                    <div>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl text-[#171717] font-medium leading-snug mb-8">
                        {profile?.hero_subtitle
                            || "We love these things — thought to remember, to stay as they happened. Preserving love's timeless and beautiful story about yours."}
                    </h2>
                    <div className="w-14 h-0.5 bg-[#525252]" />
                    </div>
                </div>
            </section>

            {/* ─── Page Banner Section ─── */}
            {(profile?.page_banner_title || profile?.page_banner_subtitle || profile?.page_banner_image_url) && (
                <section className="relative min-h-[360px] md:min-h-[460px] flex items-center overflow-hidden bg-[#262626]">
                    {profile.page_banner_image_url && (
                        <img
                            src={profile.page_banner_image_url}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/20" />
                    <div className="relative z-10 max-w-7xl w-full mx-auto px-6 sm:px-10 md:px-16 py-20">
                        <div className="max-w-2xl">
                            <p className="text-white/75 text-xs font-medium tracking-[0.25em] uppercase mb-5">Cerita Kami</p>
                            {profile.page_banner_title && (
                                <h2 className="text-white text-3xl sm:text-4xl md:text-6xl font-medium tracking-tight leading-tight">
                                    {profile.page_banner_title}
                                </h2>
                            )}
                            {profile.page_banner_subtitle && (
                                <p className="text-white/85 text-base md:text-lg font-medium leading-relaxed mt-5 max-w-xl">
                                    {profile.page_banner_subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* ─── Portfolio Grid Section ─── */}
            {portfolios.length > 0 && (
                <section id="portfolio" className="py-10 md:py-16 px-4 sm:px-6 bg-[#f5f5f5]">
                    <div className="max-w-7xl mx-auto">
                        {/* Section header */}
                        <div className="text-center mb-8">
                            <p className="text-[#737373] text-xs tracking-[0.3em] uppercase mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Our Work</p>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl text-[#171717] font-medium">Portfolio</h2>
                        </div>

                        {/* Category Filter */}
                        {categories.length > 1 && (
                            <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => handleFilterChange(cat)}
                                        className={`px-4 py-1.5 rounded-full text-xs tracking-[0.15em] uppercase border transition-all duration-200 ${activeFilter === cat
                                            ? 'bg-[#171717] text-white border-[#171717]'
                                            : 'bg-transparent text-[#737373] border-[#a3a3a3] hover:border-[#171717] hover:text-[#171717]'
                                            }`}
                                        style={{ fontFamily: 'Inter, sans-serif' }}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Portfolio Grid — mobile: 2 col, tablet: 2 col, desktop: 3 col */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                            {visiblePortfolios.map(portfolio => {
                                const thumb = portfolio.cover_image_url
                                    || (portfolio.images && portfolio.images.length > 0 ? portfolio.images[0].url : null);

                                return (
                                    <button
                                        key={portfolio.id}
                                        onClick={() => handlePortfolioClick(portfolio.id)}
                                        className="vendor-portfolio-card relative overflow-hidden group block text-left w-full aspect-square"
                                    >
                                        {thumb ? (
                                            <img
                                                src={thumb}
                                                alt={portfolio.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-[#e5e5e5] flex items-center justify-center">
                                                <span className="text-[#737373] text-sm">No Image</span>
                                            </div>
                                        )}
                                        {/* Hover overlay */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-all duration-500" />
                                        {/* Hover text */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-400">
                                            <span className="text-white/70 text-[10px] tracking-[0.3em] uppercase mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                                                {portfolio.category}
                                            </span>
                                            <h3 className="text-white text-xl font-medium text-center">{portfolio.title}</h3>
                                            <p className="text-white/60 text-xs mt-2 tracking-widest" style={{ fontFamily: 'Inter, sans-serif' }}>
                                                {portfolio.images?.length || 0} foto · Lihat Detail →
                                            </p>
                                        </div>
                                        {/* Always-visible label */}
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/65 to-transparent group-hover:opacity-0 transition-opacity duration-300">
                                            <p className="vendor-portfolio-category text-white/70 text-[9px] tracking-widest uppercase mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>{portfolio.category}</p>
                                            <p className="vendor-portfolio-title text-white font-light text-base leading-tight line-clamp-2">{portfolio.title}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {filteredPortfolios.length === 0 && (
                            <div className="text-center py-16 text-[#737373]">
                                Tidak ada portofolio dalam kategori ini.
                            </div>
                        )}

                        {/* ─── Lihat Lebih Banyak / Sembunyikan Button ─── */}
                        {hasMore && (
                            <div className="mt-10 flex justify-center">
                                <button
                                    onClick={() => setShowAll(prev => !prev)}
                                    className="group inline-flex items-center gap-3 border border-[#171717]/30 text-[#171717] text-xs tracking-[0.25em] uppercase px-10 py-4 hover:bg-[#171717] hover:text-white transition-all duration-300"
                                    style={{ fontFamily: 'Inter, sans-serif' }}
                                >
                                    {showAll ? (
                                        <>
                                            <svg className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7" />
                                            </svg>
                                            Sembunyikan
                                        </>
                                    ) : (
                                        <>
                                            Lihat Lebih Banyak
                                            <svg className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                                            </svg>
                                            <span className="ml-1 text-[#737373] group-hover:text-white/70 text-[10px]">
                                                (+{filteredPortfolios.length - INITIAL_VISIBLE})
                                            </span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* ─── Video Section ─── */}
            {profile?.videos && profile.videos.length > 0 && (
                <section id="videos" className="py-16 md:py-24 px-4 sm:px-6 bg-[#171717]">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-12">
                            <p className="text-[#525252] text-xs tracking-[0.3em] uppercase mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Featured</p>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl text-white font-medium">Cinematic Highlights</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-8 justify-center">
                            {profile.videos.map(vid => {
                                const embedUrl = getEmbedVideoUrl(vid.url);
                                return (
                                    <div key={vid.id} className="space-y-4 max-w-3xl mx-auto w-full">
                                        <div className="aspect-video bg-black rounded-lg overflow-hidden relative shadow-xl border border-white/10">
                                            {embedUrl ? (
                                                <iframe
                                                    src={embedUrl}
                                                    title={vid.title}
                                                    className="w-full h-full border-0 absolute inset-0"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-white/50 text-sm">
                                                    Video tidak tersedia
                                                </div>
                                            )}
                                        </div>
                                        <h3 className="text-white text-lg font-medium text-center">{vid.title}</h3>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* ─── Partners Section ─── */}
            {profile?.partners && profile.partners.length > 0 && (
                <section id="partners" className="py-16 md:py-24 px-6 bg-[#f5f5f5]">
                    <div className="max-w-7xl mx-auto text-center">
                        <p className="text-[#737373] text-xs tracking-[0.3em] uppercase mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Trusted By</p>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl text-[#171717] font-medium mb-12">Our Partners</h2>
                        
                        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-70">
                            {profile.partners.map(partner => (
                                <div key={partner.id} className="flex flex-col items-center justify-center gap-2 w-24 md:w-32 hover:opacity-100 transition-opacity duration-300">
                                    <img src={partner.logo_url} alt={partner.name} className="max-h-16 max-w-full object-contain grayscale hover:grayscale-0 transition-all duration-300" />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ─── FAQ Section ─── */}
            {profile?.faqs && profile.faqs.length > 0 && (
                <section id="faq" className="py-16 md:py-24 px-6 bg-[#f5f5f5] border-t border-[#e5e5e5]">
                    <div className="max-w-5xl mx-auto">
                        <div className="text-center mb-10 md:mb-14">
                            <p className="text-[#737373] text-xs tracking-[0.3em] uppercase mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Information</p>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl text-[#171717] font-medium">FAQ</h2>
                        </div>

                        <div className="grid gap-4 md:gap-5">
                            {profile.faqs.map((faq) => {
                                const isOpen = openFaqIds.includes(faq.id);
                                return (
                                    <div
                                        key={faq.id}
                                        className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white/80 shadow-[0_8px_20px_rgba(0,0,0,0.04)]"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => toggleFaq(faq.id)}
                                            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left md:px-6 md:py-5 transition-colors hover:bg-[#f5f5f5]"
                                        >
                                            <span className="text-base md:text-lg text-[#171717] font-medium leading-relaxed">
                                                {faq.question}
                                            </span>
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e5e5e5] bg-[#f5f5f5] text-[#171717] text-xl leading-none">
                                                {isOpen ? '−' : '+'}
                                            </span>
                                        </button>

                                        {isOpen && (
                                            <div className="border-t border-[#e5e5e5] bg-[#fafafa] px-5 py-4 md:px-6 md:py-5">
                                                <p className="text-sm md:text-base leading-relaxed text-[#525252] whitespace-pre-line">
                                                    {faq.answer}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* ─── CTA Section ─── */}
            <section id="contact" className="relative py-24 md:py-36 px-6 overflow-hidden bg-[#171717]">
                {profile?.hero_image_url && (
                    <img src={profile.hero_image_url} alt="CTA Background" className="absolute inset-0 w-full h-full object-cover opacity-25" />
                )}
                <div className="relative z-10 max-w-xl mx-auto text-center">
                    <p className="text-[#a3a3a3] text-xs font-medium tracking-[0.35em] uppercase mb-5" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Let's Work Together
                    </p>
                    <h2 className="text-white text-3xl sm:text-4xl md:text-5xl font-medium mb-4">We'll see you soon</h2>
                    <p className="text-white/70 text-sm md:text-base font-medium mb-10 leading-relaxed">
                        Thank you for taking the time to explore our work. We hope our story is as amazing as the love we serve here.
                    </p>
                    {whatsappUrl && (
                        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-3 bg-[#525252] hover:bg-[#404040] text-white text-xs font-medium tracking-[0.2em] uppercase px-8 py-4 transition-colors duration-300"
                            style={{ fontFamily: 'Inter, sans-serif' }}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                            Get in Touch
                        </a>
                    )}
                </div>
            </section>

            {/* ─── Footer ─── */}
            <footer className="bg-[#171717] py-12 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-10">
                        <div>
                            <h4 className="text-[#525252] text-xs tracking-[0.2em] uppercase mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>Studio</h4>
                            <ul className="space-y-2">
                                <li>
                                    <button onClick={() => scrollTo('about')} className="text-white/40 hover:text-white/70 text-sm font-light transition-colors text-left bg-transparent border-none cursor-pointer">
                                        About
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => scrollTo('portfolio')} className="text-white/40 hover:text-white/70 text-sm font-light transition-colors text-left bg-transparent border-none cursor-pointer">
                                        Portfolio
                                    </button>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-[#525252] text-xs tracking-[0.2em] uppercase mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>Contact</h4>
                            <ul className="space-y-2">
                                {whatsappUrl && (
                                    <li><a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white/70 text-sm font-light transition-colors">WhatsApp</a></li>
                                )}
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-[#525252] text-xs tracking-[0.2em] uppercase mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>Categories</h4>
                            <ul className="space-y-2">
                                {categories.filter(c => c !== 'Semua').map(cat => (
                                    <li key={cat}>
                                        <button
                                            onClick={() => { handleFilterChange(cat); scrollTo('portfolio'); }}
                                            className="text-white/40 hover:text-white/70 text-sm font-light transition-colors text-left bg-transparent border-none cursor-pointer"
                                        >
                                            {cat}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-white/5 pt-8 text-center">
                        <p className="text-white/20 text-xs tracking-widest" style={{ fontFamily: 'Inter, sans-serif' }}>
                            © {vendorName} Copyright {new Date().getFullYear()} Studio
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default VendorPublicProfile;

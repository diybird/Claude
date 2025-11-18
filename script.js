// AI Models Showcase - Interactive Features
// Author: Enhanced Version 2025

// State Management
const state = {
    activeFilters: {
        modelType: [],
        features: []
    },
    currentSearchTerm: '',
    sortBy: 'name',
    comparisonMode: false,
    selectedModels: new Set(),
    theme: localStorage.getItem('theme') || 'dark'
};

// DOM Elements
const elements = {
    searchInput: null,
    clearSearchBtn: null,
    searchResultsCount: null,
    filterButtons: null,
    modelCards: null,
    sortSelect: null,
    comparisonToggle: null,
    comparisonModal: null,
    themeToggle: null
};

// Interactive Dot Grid Background
class InteractiveDotGrid {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.dots = [];
        this.mouseX = -100;
        this.mouseY = -100;
        this.dotSpacing = 5; // 4x denser (was 20px)
        this.dotRadius = 1;
        this.hoverRadius = 30;
        this.animationFrame = null;
    }

    init() {
        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'dotCanvas';
        document.body.prepend(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        // Set canvas size
        this.resize();

        // Create dots
        this.createDots();

        // Event listeners
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));

        // Start animation
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.createDots();
    }

    createDots() {
        this.dots = [];
        const cols = Math.ceil(this.canvas.width / this.dotSpacing);
        const rows = Math.ceil(this.canvas.height / this.dotSpacing);

        for (let i = 0; i <= cols; i++) {
            for (let j = 0; j <= rows; j++) {
                this.dots.push({
                    x: i * this.dotSpacing,
                    y: j * this.dotSpacing,
                    baseRadius: this.dotRadius
                });
            }
        }
    }

    handleMouseMove(e) {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
    }

    getDotColor() {
        const isDark = state.theme === 'dark';
        return isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.12)';
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const color = this.getDotColor();

        this.dots.forEach(dot => {
            const dx = this.mouseX - dot.x;
            const dy = this.mouseY - dot.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Calculate radius based on distance from cursor
            let radius = dot.baseRadius;
            if (distance < this.hoverRadius) {
                const factor = 1 - (distance / this.hoverRadius);
                radius = dot.baseRadius * (1 + factor); // Up to 2x bigger
            }

            // Draw dot
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
        });

        this.animationFrame = requestAnimationFrame(() => this.animate());
    }

    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        if (this.canvas) {
            this.canvas.remove();
        }
    }
}

// Initialize dot grid
let dotGrid = null;

// Tooltip descriptions for feature tags
const featureTooltips = {
    'Text-to-Image': 'Generate images from text descriptions',
    'Text-to-Video': 'Create videos from text prompts',
    'Image-to-Video': 'Convert still images into video',
    'Video-to-Video': 'Transform existing video content',
    'Image Editing': 'Modify and enhance existing images',
    'Character Consistency': 'Maintain same character across generations',
    'Face/Identity Preservation': 'Keep facial features consistent',
    'Multi-Image Fusion': 'Combine multiple images intelligently',
    'Natural Language': 'Use conversational prompts',
    'Fast': 'Quick generation times',
    'Lighting Preservation': 'Maintain lighting conditions',
    'Background Replacement': 'Change image backgrounds easily',
    'Context-Aware Editing': 'Smart editing based on image context',
    'Style Transfer': 'Apply artistic styles to content',
    'Watermark Removal': 'Remove watermarks from images',
    'Relighting': 'Adjust lighting in generated content',
    'Iterative Workflow': 'Refine results through iterations',
    '4MP Ultra Resolution': 'Generate ultra-high resolution images',
    'Unique Aesthetics': 'Distinctive artistic style',
    'Character Reference (cref)': 'Reference existing characters',
    'Draft Mode (10x speed)': 'Rapid draft generation',
    'Body/Hand Coherence': 'Realistic body and hand rendering',
    'Personalization': 'Customize to your style preferences',
    'Style Explorer': 'Discover and apply various styles',
    'Enhanced Textures': 'High-quality texture rendering',
    'Image Prompts': 'Use images as generation guides',
    'Food Photography': 'Specialized in food imagery',
    'Natural Scenes': 'Excels at landscape and nature',
    'Lighting Effects': 'Advanced lighting control',
    'Bing Integration': 'Works with Bing services',
    'Copilot Integration': 'Microsoft Copilot support',
    'Speed Optimized': 'Fast processing times',
    '4MP Native Resolution': 'Native 4-megapixel output',
    'Photorealistic': 'Hyper-realistic image quality',
    'Custom Models': 'Train custom variations',
    'Partner Ecosystem': 'Integrate with partner tools',
    'Studio Quality': 'Professional-grade output',
    'Commercial Safe': 'Cleared for commercial use',
    'Exceptional Text Rendering': 'Perfect text in images',
    'Prompt Adherence': 'Follows instructions precisely',
    'Multimodal Native': 'Understands multiple input types',
    'Context Awareness': 'Understands prompt context',
    'ChatGPT Integration': 'Works within ChatGPT',
    'Best Prompt Adherence': 'Industry-leading prompt accuracy',
    'Complex Compositions': 'Handles intricate scenes',
    'Multi-Element Handling': 'Manages multiple objects well',
    'High Detail': 'Exceptional detail level',
    'Text Rendering Excellence': 'Perfect text generation',
    'Style Reference (3 images)': 'Use up to 3 style references',
    'Canvas Editor': 'Built-in editing canvas',
    'Batch Generation': 'Generate multiple at once',
    'Sharp Visuals': 'Crisp, clear output',
    'Multiple Styles': 'Various artistic styles',
    'Improved Realism': 'Enhanced realistic rendering',
    'Graphic Generation': 'Create graphics and designs',
    'SynthID Watermark': 'AI-generated content marking',
    'Native Audio Generation': 'Built-in audio creation',
    'Multi-Shot Sequencing': 'Create video sequences',
    'Prevents Feature Changes': 'Maintains character features',
    'Scene Extension': 'Extend existing scenes',
    'Precise Editing': 'Fine-grained control',
    'Object Add/Remove': 'Modify objects in scenes',
    'Flow Integration': 'Google Flow support',
    'Audio Sync': 'Synchronized audio generation',
    'YouTube Shorts Integration': 'Create YouTube Shorts',
    'Free Access': 'No cost to use',
    'Motion Application': 'Apply motion to stills',
    'Video Restyling': 'Change video style',
    'Prop Addition': 'Add props to scenes',
    'Hyper-Realistic': 'Extremely realistic output',
    'Up to 1 Minute': 'Generate 60-second videos',
    'Storyboard Interface': 'Plan with storyboards',
    'Cinematic B-Roll': 'Professional B-roll footage',
    'Sequential Creation': 'Create video sequences',
    'High Resolution': 'High-quality output',
    'Camera Path Controls': 'Control camera movement',
    "Director's Mode": 'Professional filmmaking controls',
    'Pan / Tilt / Rotate': 'Camera angle controls',
    'Zoom Control': 'Control zoom in/out',
    'Camera Speed Control': 'Adjust camera movement speed',
    'Lip-Sync': 'Synchronize lips to audio',
    'Reference Conditioning': 'Use reference materials',
    '24 FPS': '24 frames per second output',
    'Shot Extension': 'Extend existing shots',
    '1080p Resolution': 'Full HD quality',
    '30 FPS': '30 frames per second',
    'Up to 2 Minutes': 'Generate 2-minute videos',
    'Realistic Physics': 'Accurate physical simulation',
    'Dynamic Cameras': 'Moving camera effects',
    'Multi-Shot': 'Multiple camera angles',
    'Ultra Fast (120 frames/120s)': 'Very fast generation',
    '720p Resolution': 'HD quality output',
    '9 Camera Angle Concepts': 'Nine preset camera angles',
    'Low/High Angle': 'Low and high angle shots',
    'POV / Over Shoulder': 'POV and shoulder shots',
    'Aerial / Overhead': 'Aerial and overhead views',
    'Camera Motion Control': 'Control camera movement',
    '1080p HD': 'Full HD 1080p',
    'Pikadditions': 'Add objects to videos',
    'Scene Integration': 'Integrate elements seamlessly',
    'Object Insertion': 'Insert new objects',
    'Social Media Focus': 'Optimized for social media',
    'Complex Motion': 'Handle complex movements',
    'Choreography': 'Dance and movement generation',
    'Temporal Consistency': 'Consistent across time',
    'High Prompt Accuracy': 'Follows prompts precisely',
    'Dramatic Content': 'Create dramatic scenes',
    'Open Source': 'Free and open source',
    '720p @ 24fps': '720p at 24 frames/second',
    'MoE Architecture': 'Mixture of Experts AI',
    'Consumer GPU': 'Runs on consumer graphics cards',
    'Cinematic Control': 'Professional cinematography',
    'Camera Angle Control': 'Adjust camera angles',
    'Shot Angle Settings': 'Configure shot angles',
    'Motion Control': 'Control motion parameters',
    'Keyframe Support': 'Use keyframes for timing',
    'Vertical/Horizontal': 'Multiple aspect ratios',
    'Creative Cloud Integration': 'Adobe Creative Cloud support',
    '1080p @ 24fps': '1080p at 24 frames/second',
    'Multi-Shot Sequences': 'Multiple shot sequences',
    'Smooth Motion': 'Fluid motion generation',
    'Style Preservation': 'Maintain consistent style',
    'Camera Angle Switching': 'Switch between angles',
    'Community Driven': 'Community development',
    'Customizable': 'Highly customizable',
    'Research Friendly': 'Great for research',
    'Image-to-3D Video': 'Convert 2D to 3D video',
    'Multi-View Diffusion': 'Multiple viewpoint generation',
    '360° Rotation': 'Full 360-degree rotation',
    'Lemniscate Path': 'Figure-8 camera path',
    'Spiral Movement': 'Spiral camera movement',
    'Dolly Zoom': 'Dolly zoom effect',
    'Pan/Roll Control': 'Pan and roll camera',
    'User-Defined Trajectories': 'Custom camera paths',
    'Up to 1000 Frames': 'Generate 1000 frames',
    'Real Footage Editing': 'Edit real video footage',
    'Camera Angle Generation': 'Generate new angles',
    'Shot Continuation': 'Continue existing shots',
    'Environment Change': 'Change scene environment',
    'Weather Alteration': 'Modify weather conditions',
    'Character Appearance': 'Modify character looks',
    'Green Screen Mattes': 'Green screen compositing',
    'Professional VFX': 'Professional visual effects',
    'Real-Time Generation': 'Generate in real-time',
    '48 kHz Stereo': 'High-quality stereo audio',
    'Interactive Creation': 'Interactive music creation',
    'MusicFX DJ': 'DJ-style music mixing',
    'Multi-Player Jams': 'Collaborative music making',
    'YouTube Dream Track': 'YouTube integration',
    'SynthID Watermarking': 'AI audio watermarking',
    'Text-to-Music': 'Generate music from text',
    'Studio-Grade Fidelity': 'Professional audio quality',
    'Natural Vocals': 'Realistic vocal synthesis',
    'Full Song Generation': 'Complete song creation',
    'Lyrics Creation': 'Generate song lyrics',
    'Personas (Style Memory)': 'Remember style preferences',
    'Stem Separation': 'Separate audio tracks',
    'Song Extension': 'Extend existing songs',
    'Custom Song Generation': 'Create custom songs',
    'Best-in-Class Vocals': 'Top-tier vocal quality',
    'Human-Like Synthesis': 'Natural-sounding voices',
    'Production Ready': 'Ready for production use',
    'Strong Instrumentals': 'Quality instrumental tracks',
    'Commercial Use': 'Licensed for commercial use',
    'Licensed Training Data': 'Ethically sourced data',
    'Artist Compensation': 'Artists are compensated',
    'Adaptive Music': 'Music adapts to content',
    'Content-Matched': 'Matches your content',
    'Background Scoring': 'Create background music',
    'Royalty-Free': 'No royalty payments needed',
    'Ethical AI': 'Ethically developed AI'
};

// Add tooltips to feature tags
function addFeatureTooltips() {
    const tags = document.querySelectorAll('.tag');
    tags.forEach(tag => {
        const tagText = tag.textContent.trim();
        if (featureTooltips[tagText]) {
            tag.setAttribute('data-tooltip', featureTooltips[tagText]);
        }
    });
}

// Initialize the application
function init() {
    // Cache DOM elements
    cacheElements();

    // Apply saved theme
    applyTheme(state.theme);

    // Initialize interactive dot grid
    dotGrid = new InteractiveDotGrid();
    dotGrid.init();

    // Add tooltips to feature tags
    addFeatureTooltips();

    // Set up event listeners
    setupEventListeners();

    // Initial render
    applyFiltersAndSort();

    // Announce page ready for screen readers
    announceToScreenReader('AI Models Showcase loaded. Use the search and filters to find models.');
}

// Cache DOM elements for performance
function cacheElements() {
    elements.searchInput = document.getElementById('searchInput');
    elements.clearSearchBtn = document.getElementById('clearSearch');
    elements.searchResultsCount = document.getElementById('searchResultsCount');
    elements.filterButtons = document.querySelectorAll('.filter-btn');
    elements.modelCards = document.querySelectorAll('.model-card');
    elements.sortSelect = document.getElementById('sortSelect');
    elements.comparisonToggle = document.getElementById('comparisonToggle');
    elements.comparisonModal = document.getElementById('comparisonModal');
    elements.themeToggle = document.getElementById('themeToggle');
}

// Set up all event listeners
function setupEventListeners() {
    // Search functionality
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', handleSearch);
        elements.searchInput.addEventListener('keydown', handleSearchKeydown);
    }

    if (elements.clearSearchBtn) {
        elements.clearSearchBtn.addEventListener('click', clearSearch);
    }

    // Filter buttons
    if (elements.filterButtons) {
        elements.filterButtons.forEach(button => {
            button.addEventListener('click', handleFilterClick);
        });
    }

    // Sort select
    if (elements.sortSelect) {
        elements.sortSelect.addEventListener('change', handleSortChange);
    }

    // Comparison mode
    if (elements.comparisonToggle) {
        elements.comparisonToggle.addEventListener('click', toggleComparisonMode);
    }

    // Theme toggle
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', toggleTheme);
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeydown);

    // Close comparison modal
    const closeBtn = document.getElementById('closeComparison');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeComparisonModal);
    }

    // Close modal on background click
    if (elements.comparisonModal) {
        elements.comparisonModal.addEventListener('click', (e) => {
            if (e.target === elements.comparisonModal) {
                closeComparisonModal();
            }
        });
    }
}

// Handle search input
function handleSearch(e) {
    state.currentSearchTerm = e.target.value.toLowerCase().trim();

    // Show/hide clear button
    if (elements.clearSearchBtn) {
        elements.clearSearchBtn.style.display = state.currentSearchTerm ? 'flex' : 'none';
    }

    applyFiltersAndSort();
}

// Handle search keyboard shortcuts
function handleSearchKeydown(e) {
    if (e.key === 'Escape') {
        clearSearch();
    }
}

// Clear search
function clearSearch() {
    if (elements.searchInput) {
        elements.searchInput.value = '';
        state.currentSearchTerm = '';
        elements.clearSearchBtn.style.display = 'none';
        applyFiltersAndSort();
        elements.searchInput.focus();
    }
}

// Handle filter button clicks
function handleFilterClick(e) {
    const button = e.currentTarget;
    const filterValue = button.getAttribute('data-filter');

    // Determine which category this filter belongs to
    const isModelType = ['image', 'video', 'audio'].includes(filterValue);
    const category = isModelType ? 'modelType' : 'features';

    // Toggle the filter
    if (button.classList.contains('active')) {
        button.classList.remove('active');
        const index = state.activeFilters[category].indexOf(filterValue);
        if (index > -1) {
            state.activeFilters[category].splice(index, 1);
        }
    } else {
        button.classList.add('active');
        state.activeFilters[category].push(filterValue);
    }

    applyFiltersAndSort();

    // Announce filter change
    const action = button.classList.contains('active') ? 'activated' : 'deactivated';
    announceToScreenReader(`Filter ${filterValue} ${action}`);
}

// Handle sort change
function handleSortChange(e) {
    state.sortBy = e.target.value;
    applyFiltersAndSort();
    announceToScreenReader(`Sorted by ${state.sortBy}`);
}

// Apply filters and sorting
function applyFiltersAndSort() {
    let visibleCount = 0;
    const cardsArray = Array.from(elements.modelCards);

    // Filter cards
    const filteredCards = cardsArray.filter(card => {
        const isVisible = checkCardVisibility(card);
        card.style.display = isVisible ? 'block' : 'none';
        if (isVisible) visibleCount++;
        return isVisible;
    });

    // Sort visible cards
    sortCards(filteredCards);

    // Update results count
    updateResultsCount(visibleCount);
}

// Check if a card should be visible
function checkCardVisibility(card) {
    const tags = card.getAttribute('data-tags') || '';
    const modelName = card.querySelector('.model-name')?.textContent.toLowerCase() || '';
    const developer = card.querySelector('.developer')?.textContent.toLowerCase() || '';
    const description = card.querySelector('.model-description')?.textContent.toLowerCase() || '';
    const price = card.getAttribute('data-price') || '';

    let tagText = '';
    const allTags = card.querySelectorAll('.tag');
    allTags.forEach(tag => {
        tagText += tag.textContent.toLowerCase() + ' ';
    });

    // Check Model Type filter match
    let modelTypeMatch = state.activeFilters.modelType.length === 0 ||
                        state.activeFilters.modelType.some(type => tags.includes(type));

    // Check Features filter match (AND logic)
    let featuresMatch = state.activeFilters.features.length === 0 ||
                       state.activeFilters.features.every(feature => tags.includes(feature));

    // Check search match
    let searchMatch = !state.currentSearchTerm;
    if (state.currentSearchTerm) {
        const searchableText = `${modelName} ${developer} ${description} ${tags} ${tagText} ${price}`;
        searchMatch = searchableText.includes(state.currentSearchTerm);
    }

    return modelTypeMatch && featuresMatch && searchMatch;
}

// Sort cards
function sortCards(cards) {
    cards.sort((a, b) => {
        switch (state.sortBy) {
            case 'name':
                const nameA = a.querySelector('.model-name')?.textContent || '';
                const nameB = b.querySelector('.model-name')?.textContent || '';
                return nameA.localeCompare(nameB);

            case 'price-low':
            case 'price-high':
                const priceA = parseFloat(a.getAttribute('data-price') || '99999');
                const priceB = parseFloat(b.getAttribute('data-price') || '99999');
                return state.sortBy === 'price-low' ? priceA - priceB : priceB - priceA;

            case 'date':
                const dateA = a.getAttribute('data-date') || '';
                const dateB = b.getAttribute('data-date') || '';
                return dateB.localeCompare(dateA); // Newest first

            default:
                return 0;
        }
    });

    // Re-append cards in sorted order
    cards.forEach(card => {
        card.parentElement.appendChild(card);
    });
}

// Update results count
function updateResultsCount(count) {
    if (!elements.searchResultsCount) return;

    const hasActiveFilters = state.activeFilters.modelType.length > 0 ||
                            state.activeFilters.features.length > 0;

    if (state.currentSearchTerm || hasActiveFilters) {
        if (count === 0) {
            elements.searchResultsCount.textContent = 'No models found';
            elements.searchResultsCount.style.color = 'var(--error-color)';
        } else if (count === 1) {
            elements.searchResultsCount.textContent = '1 model found';
            elements.searchResultsCount.style.color = 'var(--text-secondary)';
        } else {
            elements.searchResultsCount.textContent = `${count} models found`;
            elements.searchResultsCount.style.color = 'var(--text-secondary)';
        }
    } else {
        elements.searchResultsCount.textContent = '';
    }
}

// Toggle comparison mode
function toggleComparisonMode() {
    state.comparisonMode = !state.comparisonMode;

    if (elements.comparisonToggle) {
        elements.comparisonToggle.classList.toggle('active', state.comparisonMode);
    }

    if (state.comparisonMode) {
        enableComparisonMode();
        announceToScreenReader('Comparison mode enabled. Click on models to compare.');
    } else {
        disableComparisonMode();
        announceToScreenReader('Comparison mode disabled.');
    }
}

// Enable comparison mode
function enableComparisonMode() {
    elements.modelCards.forEach(card => {
        // Add checkbox
        if (!card.querySelector('.compare-checkbox')) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'compare-checkbox';
            checkbox.setAttribute('aria-label', 'Select for comparison');
            checkbox.addEventListener('change', (e) => handleCompareCheckbox(e, card));
            card.appendChild(checkbox);
        }
    });
}

// Disable comparison mode
function disableComparisonMode() {
    elements.modelCards.forEach(card => {
        const checkbox = card.querySelector('.compare-checkbox');
        if (checkbox) {
            checkbox.remove();
        }
        card.classList.remove('comparing');
    });
    state.selectedModels.clear();
}

// Handle compare checkbox
function handleCompareCheckbox(e, card) {
    const modelName = card.querySelector('.model-name')?.textContent || '';

    if (e.target.checked) {
        state.selectedModels.add(card);
        card.classList.add('comparing');
    } else {
        state.selectedModels.delete(card);
        card.classList.remove('comparing');
    }

    // Auto-open comparison if 2+ models selected
    if (state.selectedModels.size >= 2) {
        showComparisonModal();
    }
}

// Show comparison modal
function showComparisonModal() {
    if (!elements.comparisonModal) return;

    const comparisonGrid = document.getElementById('comparisonGrid');
    if (!comparisonGrid) return;

    // Clear previous comparisons
    comparisonGrid.innerHTML = '';

    // Add selected models to comparison
    state.selectedModels.forEach(card => {
        const clone = card.cloneNode(true);
        clone.classList.remove('comparing');
        const checkbox = clone.querySelector('.compare-checkbox');
        if (checkbox) checkbox.remove();
        comparisonGrid.appendChild(clone);
    });

    elements.comparisonModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus on close button for accessibility
    const closeBtn = document.getElementById('closeComparison');
    if (closeBtn) closeBtn.focus();

    announceToScreenReader(`Comparing ${state.selectedModels.size} models`);
}

// Close comparison modal
function closeComparisonModal() {
    if (!elements.comparisonModal) return;

    elements.comparisonModal.classList.remove('active');
    document.body.style.overflow = '';

    // Return focus to comparison toggle
    if (elements.comparisonToggle) {
        elements.comparisonToggle.focus();
    }
}

// Toggle theme
function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(state.theme);
    localStorage.setItem('theme', state.theme);

    announceToScreenReader(`${state.theme === 'dark' ? 'Dark' : 'Light'} theme activated`);
}

// Apply theme
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    if (elements.themeToggle) {
        const icon = theme === 'dark' ? '☀️' : '🌙';
        const text = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
        elements.themeToggle.innerHTML = `${icon} <span>${text}</span>`;
    }
}

// Handle global keyboard shortcuts
function handleGlobalKeydown(e) {
    // Ctrl/Cmd + K: Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (elements.searchInput) {
            elements.searchInput.focus();
        }
    }

    // Escape: Clear search or close modal
    if (e.key === 'Escape') {
        if (elements.comparisonModal && elements.comparisonModal.classList.contains('active')) {
            closeComparisonModal();
        } else if (document.activeElement === elements.searchInput && state.currentSearchTerm) {
            clearSearch();
        }
    }

    // Ctrl/Cmd + /: Toggle theme
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        toggleTheme();
    }
}

// Announce to screen readers
function announceToScreenReader(message) {
    const announcement = document.getElementById('aria-announcements');
    if (announcement) {
        announcement.textContent = message;
    }
}

// Smooth scroll behavior
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { state, applyFiltersAndSort, toggleTheme };
}

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

// Initialize the application
function init() {
    // Cache DOM elements
    cacheElements();

    // Apply saved theme
    applyTheme(state.theme);

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

// Interactive Dot Grid Background
const canvas = document.getElementById('dotCanvas');
if (canvas) {
    const ctx = canvas.getContext('2d');
    let mouseX = -1000;
    let mouseY = -1000;
    const interactiveRadius = 200;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = document.documentElement.scrollHeight;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Track mouse position
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY + window.scrollY;
    });

    // Draw dots
    function drawDots() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const dotSpacing = 30;
        const dotSize = 1.5;
        const baseOpacity = 0.25;
        const highlightOpacity = 0.8;

        // Get theme-aware color
        const isDarkTheme = document.documentElement.getAttribute('data-theme') !== 'light';
        const dotColor = isDarkTheme ? '102, 126, 234' : '102, 126, 234';

        for (let x = 0; x < canvas.width; x += dotSpacing) {
            for (let y = 0; y < canvas.height; y += dotSpacing) {
                const distance = Math.sqrt(Math.pow(x - mouseX, 2) + Math.pow(y - mouseY, 2));

                // Calculate opacity with smooth gradient falloff
                let opacity = baseOpacity;
                if (distance < interactiveRadius) {
                    // Smooth easing function for gradual falloff
                    const normalizedDistance = distance / interactiveRadius;
                    const easing = 1 - Math.pow(normalizedDistance, 2);
                    opacity = baseOpacity + (highlightOpacity - baseOpacity) * easing;
                }

                ctx.fillStyle = `rgba(${dotColor}, ${opacity})`;
                ctx.beginPath();
                ctx.arc(x, y, dotSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        requestAnimationFrame(drawDots);
    }

    drawDots();

    // Update canvas height on scroll
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const newHeight = document.documentElement.scrollHeight;
            if (Math.abs(canvas.height - newHeight) > 100) {
                resizeCanvas();
            }
        }, 100);
    });
}

// Export for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { state, applyFiltersAndSort, toggleTheme };
}

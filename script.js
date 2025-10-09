// Intersection Observer for scroll animations
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            
            // If this is the skills section, animate the skill bars
            if (entry.target.id === 'skills') {
                const skillBars = entry.target.querySelectorAll('li');
                skillBars.forEach((bar, index) => {
                    setTimeout(() => {
                        bar.style.setProperty('--skill-level-visible', bar.style.getPropertyValue('--skill-level'));
                    }, index * 100);
                });
            }
        }
    });
}, {
    threshold: 0.15, // Trigger when at least 15% of the element is visible
    rootMargin: '0px' // No margin around the viewport
});

// Observe all sections
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateParticleColors(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateParticleColors(newTheme);
}

function updateParticleColors(theme) {
    const particles = document.querySelectorAll('.particle-canvas');
    particles.forEach(canvas => {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const computedStyle = getComputedStyle(document.documentElement);
            const accentColor = computedStyle.getPropertyValue('--accent-color').trim();
            // Update particle colors if they exist
            if (window.particles) {
                window.particles.forEach(particle => {
                    particle.color = accentColor;
                });
            }
        }
    });
}

window.addEventListener('load', () => {
    // Hide loading screen
    const loadingScreen = document.querySelector('.loading-screen');
    const body = document.body;
    
    if (loadingScreen && body) {
        loadingScreen.classList.add('hide');
        body.classList.remove('loading');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const sections = document.querySelectorAll('section');
    sections.forEach(section => observer.observe(section));

    // Initialize theme
    initTheme();

    // Theme toggle button
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Add smooth scroll behavior for navigation links
    document.querySelectorAll('nav a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});
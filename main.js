import { SundialApp } from './app/sundial.js';

/**
 * Creates a visual indicator representing the sun on screen.
 * @returns {HTMLDivElement} The created sun indicator element.
 */
function createSunIndicator() {
    const sunDiv = document.createElement('div');
    sunDiv.className = 'sun-indicator';
    sunDiv.id = 'sunIndicator';
    document.body.appendChild(sunDiv);
    return sunDiv;
}

/**
 * Updates the CSS class of the time display element to reflect the time of day.
 * Applies different styles for day, night, and sunrise/sunset hours.
 * 
 * @param {string} timeString - The current time in HH:mm format.
 */
function updateTimeDisplayStyle(timeString) {
    const timeDisplay = document.getElementById('timeDisplay');
    const hour = parseInt(timeString.split(':')[0]);
    
    timeDisplay.classList.remove('day-time', 'night-time', 'sunrise-time');
    
    if (hour >= 6 && hour <= 8 || hour >= 17 && hour <= 19) {
        timeDisplay.classList.add('sunrise-time');
    } else if (hour >= 9 && hour <= 16) {
        timeDisplay.classList.add('day-time');
    } else {
        timeDisplay.classList.add('night-time');
    }
}


/**
 * Updates the screen position and appearance of the sun indicator element.
 * 
 * @param {number} azimuth - The sun's azimuth angle in degrees.
 * @param {number} elevation - The sun's elevation angle in degrees.
 */
function updateSunIndicator(azimuth, elevation) {
    const sunIndicator = document.getElementById('sunIndicator');
    if (!sunIndicator) return;
    
    // Convert angles into screen coordinates
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    const azimuthRad = (azimuth - 90) * Math.PI / 180;
    const elevationRad = elevation * Math.PI / 180;
    
    const distance = 200 * (1 - elevationRad / (Math.PI / 2));
    const x = centerX + distance * Math.cos(azimuthRad);
    const y = centerY - distance * Math.sin(azimuthRad) * 0.5;
    
    sunIndicator.style.left = (x - 20) + 'px';
    sunIndicator.style.top = (y - 20) + 'px';
    
    // Adjust brightness based on elevation angle
    const brightness = Math.max(0.3, elevationRad / (Math.PI / 2));
    sunIndicator.style.opacity = brightness;
}


/**
 * Initializes the Sundial application and UI enhancements.
 * Sets up DOM listeners and handles errors gracefully.
 */
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Starting enhanced sundial application...');
        
        // Create visual sun indicator
        createSunIndicator();
        
        const app = new SundialApp();
        
        // Listen for updates and apply visual changes
        document.addEventListener('sundialUpdate', (event) => {
            updateTimeDisplayStyle(event.detail.time);
            updateSunIndicator(event.detail.azimuth, event.detail.elevation);
        });
        
        console.log('Enhanced application started successfully!');
    } catch (error) {
        console.error('Error during initialization:', error);
        document.body.innerHTML += 
            '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 10px;">Errore: ' + 
            error.message + '</div>';
    }
});
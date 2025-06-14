
import { SundialApp } from './app/sundial.js';

// Initialize and launch the sundial application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Starting sundial application...');
        const app = new SundialApp();
        console.log('Application started successfully!');
    } catch (error) {
        console.error('Error during initialization:', error);
        document.body.innerHTML += 
            '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 10px;">Errore: ' + 
            error.message + '</div>';
    }
});
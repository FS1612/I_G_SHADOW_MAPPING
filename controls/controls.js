
import { dayOfYearToDateString } from '../utils/astronomy.js';
/**
 * Handles user interaction with the 3D camera using mouse input.
 * Allows orbiting around the sundial and zooming in/out.
 */
export class CameraControls {
    /**
     * @param {HTMLCanvasElement} canvas - The canvas element where the scene is rendered.
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.cameraDistance = 30;
        this.cameraAngleX = 45;
        this.cameraAngleY = 45;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.setupEventListeners();
    }
    /**
     * Sets up mouse event listeners for dragging and zooming.
     */
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const deltaX = e.clientX - this.lastMouseX;
                const deltaY = e.clientY - this.lastMouseY;

                this.cameraAngleY += deltaX * 0.5;
                this.cameraAngleX += deltaY * 0.5;
                this.cameraAngleX = Math.max(-80, Math.min(80, this.cameraAngleX));

                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.cameraDistance += e.deltaY * 0.01;
            this.cameraDistance = Math.max(5, Math.min(30, this.cameraDistance));
        });
    }
    /**
     * Calculates the 3D position of the camera based on angle and distance.
     * @returns {number[]} - [x, y, z] coordinates of the camera.
     */
    getCameraPosition() {
        const cameraX = Math.sin(this.cameraAngleY * Math.PI / 180) * Math.cos(this.cameraAngleX * Math.PI / 180) * this.cameraDistance;
        const cameraY = Math.sin(this.cameraAngleX * Math.PI / 180) * this.cameraDistance;
        const cameraZ = Math.cos(this.cameraAngleY * Math.PI / 180) * Math.cos(this.cameraAngleX * Math.PI / 180) * this.cameraDistance;
        
        return [cameraX, cameraY, cameraZ];
    }
}
/**
 * Manages the UI controls for adjusting solar parameters and displaying time.
 * Connects the DOM inputs to the sundial simulation.
 */
export class UIControls {
    constructor() {
        /** @type {HTMLInputElement} */
        this.sunAngleSlider = document.getElementById('sunAngle');
        /** @type {HTMLInputElement} */
        this.sunHeightSlider = document.getElementById('sunHeight');
        /** @type {HTMLInputElement} */
        this.monthDaySlider = document.getElementById('monthDay');
        /** @type {HTMLInputElement} */
        this.autoRotateCheckbox = document.getElementById('autoRotate');
        /** @type {HTMLInputElement} */
        this.azimuthValue = document.getElementById('azimuthValue');
        /** @type {HTMLInputElement} */
        this.heightValue = document.getElementById('heightValue');
        /** @type {HTMLInputElement} */
        this.dayValue = document.getElementById('dayValue');
        /** @type {HTMLInputElement} */
        this.timeDisplay = document.getElementById('timeDisplay');
        /** @type {HTMLInputElement} */
        this.shadowTime = document.getElementById('shadowTime');

        this.setupEventListeners();
        this.updateDisplay();
    }
    /**
     * Sets up input listeners to update display values when sliders are changed.
     */
    setupEventListeners() {
        this.sunAngleSlider.addEventListener('input', () => this.updateDisplay());
        this.sunHeightSlider.addEventListener('input', () => this.updateDisplay());
        this.monthDaySlider.addEventListener('input', () => this.updateDisplay());
    }
    /**
     * Updates text values in the UI to reflect current slider positions.
     */
    updateDisplay() {
        this.azimuthValue.textContent = this.sunAngleSlider.value + '°';
        this.heightValue.textContent = this.sunHeightSlider.value + '°';
        this.dayValue.textContent = dayOfYearToDateString(parseInt(this.monthDaySlider.value));
    }
    /**
     * Returns the current values from the UI controls.
     * @returns {{ sunAngle: number, sunHeight: number, dayOfYear: number, autoRotate: boolean }}
     */
    getValues() {
        return {
            sunAngle: parseFloat(this.sunAngleSlider.value),
            sunHeight: parseFloat(this.sunHeightSlider.value),
            dayOfYear: parseInt(this.monthDaySlider.value),
            autoRotate: this.autoRotateCheckbox.checked
        };
    }
    /**
     * Programmatically sets the sun angle slider value and updates the display.
     * @param {number} angle - The new sun angle in degrees.
     */
    setSunAngle(angle) {
        this.sunAngleSlider.value = angle;
        this.updateDisplay();
    }
    /**
     * Updates the current time and shadow time labels in the UI.
     * @param {string} currentTime - The time derived from sun position.
     * @param {string} shadowTimeStr - The time indicated by the shadow.
     */
    updateTimeDisplay(currentTime, shadowTimeStr) {
        this.timeDisplay.textContent = currentTime;
        this.shadowTime.textContent = `Time indicated by the shadow: ${shadowTimeStr}`;
    }
}
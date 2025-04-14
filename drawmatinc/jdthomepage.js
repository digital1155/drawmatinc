document.addEventListener('DOMContentLoaded', () => {
    // Menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
  
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
    });
  
    // Slideshow hover pause
    const slideshowTrack = document.querySelector('.slideshow-track');
    const slideshowContainer = document.querySelector('.slideshow-container');
  
    if (slideshowTrack && slideshowContainer) {
      slideshowContainer.addEventListener('mouseenter', () => {
        slideshowTrack.style.animationPlayState = 'paused';
      });
  
      slideshowContainer.addEventListener('mouseleave', () => {
        slideshowTrack.style.animationPlayState = 'running';
      });
    }
  });